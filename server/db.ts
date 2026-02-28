import { and, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertProject,
  InsertSubtask,
  InsertTag,
  InsertTask,
  InsertUser,
  projects,
  subtasks,
  tags,
  taskTags,
  tasks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(projects).values(data);
  return { id: (result as any).insertId as number };
}

export async function listProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(projects.name);
}

export async function updateProject(
  id: number,
  userId: number,
  data: Partial<Pick<InsertProject, "name" | "description" | "color">>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(projects).set(data).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

export async function deleteProject(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Nullify tasks' projectId
  await db.update(tasks).set({ projectId: null }).where(and(eq(tasks.projectId, id), eq(tasks.userId, userId)));
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function createTag(data: InsertTag) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(tags).values(data);
  return { id: (result as any).insertId as number };
}

export async function listTags(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tags).where(eq(tags.userId, userId)).orderBy(tags.name);
}

export async function deleteTag(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(taskTags).where(eq(taskTags.tagId, id));
  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function createTask(data: InsertTask, tagIds: number[] = []) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(tasks).values(data);
  const taskId = (result as any).insertId as number;
  if (tagIds.length > 0) {
    await db.insert(taskTags).values(tagIds.map((tagId) => ({ taskId, tagId })));
  }
  return { id: taskId };
}

export type TaskFilters = {
  projectId?: number;
  priority?: "baixa" | "media" | "alta";
  assignee?: string;
  search?: string;
  status?: "backlog" | "em_andamento" | "concluido" | "bloqueado";
};

export async function listTasks(userId: number, filters: TaskFilters = {}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(tasks.userId, userId)];
  if (filters.projectId) conditions.push(eq(tasks.projectId, filters.projectId));
  if (filters.priority) conditions.push(eq(tasks.priority, filters.priority));
  if (filters.assignee) conditions.push(eq(tasks.assignee, filters.assignee));
  if (filters.status) conditions.push(eq(tasks.status, filters.status));
  if (filters.search) {
    conditions.push(
      or(
        like(tasks.title, `%${filters.search}%`),
        like(tasks.description, `%${filters.search}%`)
      )!
    );
  }

  const taskList = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.updatedAt));

  if (taskList.length === 0) return [];

  const taskIds = taskList.map((t) => t.id);
  const tagLinks = await db
    .select({ taskId: taskTags.taskId, tagId: taskTags.tagId })
    .from(taskTags)
    .where(inArray(taskTags.taskId, taskIds));

  const allTagIds = Array.from(new Set(tagLinks.map((tl) => tl.tagId)));
  const allTags = allTagIds.length > 0
    ? await db.select().from(tags).where(inArray(tags.id, allTagIds))
    : [];

  const tagMap = new Map(allTags.map((t) => [t.id, t]));

  return taskList.map((task) => ({
    ...task,
    tags: tagLinks
      .filter((tl) => tl.taskId === task.id)
      .map((tl) => tagMap.get(tl.tagId))
      .filter(Boolean),
  }));
}

export async function getTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);
  if (!result[0]) return null;

  const tagLinks = await db.select().from(taskTags).where(eq(taskTags.taskId, id));
  const tagIds = tagLinks.map((tl) => tl.tagId);
  const taskTagList = tagIds.length > 0
    ? await db.select().from(tags).where(inArray(tags.id, tagIds))
    : [];

  const subtaskList = await db.select().from(subtasks).where(eq(subtasks.taskId, id));

  return { ...result[0], tags: taskTagList, subtasks: subtaskList };
}

export async function updateTask(
  id: number,
  userId: number,
  data: Partial<InsertTask>,
  tagIds?: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // If completing, set completedAt
  if (data.status === "concluido") {
    data.completedAt = Date.now();
  } else if (data.status && (data.status as string) !== "concluido") {
    data.completedAt = undefined;
  }

  if (Object.keys(data).length > 0) {
    await db.update(tasks).set(data).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  }

  if (tagIds !== undefined) {
    await db.delete(taskTags).where(eq(taskTags.taskId, id));
    if (tagIds.length > 0) {
      await db.insert(taskTags).values(tagIds.map((tagId) => ({ taskId: id, tagId })));
    }
  }
}

export async function deleteTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(taskTags).where(eq(taskTags.taskId, id));
  await db.delete(subtasks).where(eq(subtasks.taskId, id));
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

// ─── Subtasks ─────────────────────────────────────────────────────────────────

export async function createSubtask(data: InsertSubtask) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(subtasks).values(data);
  return { id: (result as any).insertId as number };
}

export async function updateSubtask(id: number, userId: number, completed: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(subtasks)
    .set({ completed: completed ? "1" : "0" })
    .where(and(eq(subtasks.id, id), eq(subtasks.userId, userId)));
}

export async function deleteSubtask(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(subtasks).where(and(eq(subtasks.id, id), eq(subtasks.userId, userId)));
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const now = Date.now();
  const dayMs = 86400000;
  const weekAgo = now - 7 * dayMs;
  const monthAgo = now - 30 * dayMs;

  // Status counts
  const statusCounts = await db
    .select({ status: tasks.status, count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .groupBy(tasks.status);

  // Priority counts
  const priorityCounts = await db
    .select({ priority: tasks.priority, count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .groupBy(tasks.priority);

  // Overdue tasks (deadline < now and not completed)
  const overdueTasks = await db
    .select({ id: tasks.id, title: tasks.title, deadline: tasks.deadline, priority: tasks.priority })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        sql`${tasks.deadline} < ${now}`,
        sql`${tasks.deadline} IS NOT NULL`,
        sql`${tasks.status} != 'concluido'`
      )
    )
    .orderBy(tasks.deadline);

  // Completed this week
  const completedThisWeek = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "concluido"),
        sql`${tasks.completedAt} >= ${weekAgo}`
      )
    );

  // Completed this month
  const completedThisMonth = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "concluido"),
        sql`${tasks.completedAt} >= ${monthAgo}`
      )
    );

  // Daily completions last 7 days
  const dailyCompletions = await db
    .select({
      day: sql<string>`DATE(FROM_UNIXTIME(${tasks.completedAt}/1000))`,
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "concluido"),
        sql`${tasks.completedAt} >= ${weekAgo}`
      )
    )
    .groupBy(sql`DATE(FROM_UNIXTIME(${tasks.completedAt}/1000))`);

  return {
    statusCounts,
    priorityCounts,
    overdueTasks,
    completedThisWeek: Number(completedThisWeek[0]?.count ?? 0),
    completedThisMonth: Number(completedThisMonth[0]?.count ?? 0),
    dailyCompletions,
  };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getTasksDueSoon(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  const in24h = now + 86400000;
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        sql`${tasks.deadline} IS NOT NULL`,
        sql`${tasks.deadline} > ${now}`,
        sql`${tasks.deadline} <= ${in24h}`,
        sql`${tasks.status} != 'concluido'`,
        sql`${tasks.notifiedDeadline} IS NULL`
      )
    );
}

export async function getOverdueTasks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        sql`${tasks.deadline} IS NOT NULL`,
        sql`${tasks.deadline} < ${now}`,
        sql`${tasks.status} != 'concluido'`,
        sql`${tasks.notifiedOverdue} IS NULL`
      )
    );
}

export async function markNotifiedDeadline(taskId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set({ notifiedDeadline: new Date() }).where(eq(tasks.id, taskId));
}

export async function markNotifiedOverdue(taskId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set({ notifiedOverdue: new Date() }).where(eq(tasks.id, taskId));
}

// ─── Weekly Report ────────────────────────────────────────────────────────────

export async function getWeeklyReportData(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;

  const completed = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "concluido"),
        sql`${tasks.completedAt} >= ${weekAgo}`
      )
    );

  const created = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        sql`UNIX_TIMESTAMP(${tasks.createdAt}) * 1000 >= ${weekAgo}`
      )
    );

  const pending = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        sql`${tasks.status} != 'concluido'`
      )
    );

  return {
    completed,
    completedCount: completed.length,
    createdCount: Number(created[0]?.count ?? 0),
    pendingCount: Number(pending[0]?.count ?? 0),
  };
}
