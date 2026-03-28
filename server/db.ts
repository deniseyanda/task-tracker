import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

type MySQLResult = { insertId: number };
import {
  InsertInvite,
  InsertNotification,
  InsertProject,
  InsertSubtask,
  InsertTag,
  InsertTask,
  InsertUser,
  invites,
  notifications,
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

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(users);
  return Number(row?.count ?? 0);
}

export async function createEmailUser(data: {
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
  role?: InsertUser["role"];
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(users).values({
    openId: data.openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    loginMethod: "email",
    lastSignedIn: new Date(),
    ...(data.role ? { role: data.role } : {}),
  });
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      lastSignedIn: users.lastSignedIn,
      loginMethod: users.loginMethod,
    })
    .from(users)
    .orderBy(users.name);
}

export async function setUserRole(userId: number, role: InsertUser["role"]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(projects).values(data);
  return { id: (result as MySQLResult).insertId as number };
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
  return { id: (result as MySQLResult).insertId as number };
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
  const taskId = (result as MySQLResult).insertId as number;
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
  return { id: (result as MySQLResult).insertId as number };
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
  // Use FROM_UNIXTIME with milliseconds divided by 1000, wrapped in try/catch
  let dailyCompletions: { day: string; count: number }[];
  try {
  dailyCompletions = await db
    .select({
      day: sql<string>`DATE(FROM_UNIXTIME(CAST(${tasks.completedAt} AS UNSIGNED)/1000))`,
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
    .groupBy(sql`DATE(FROM_UNIXTIME(CAST(${tasks.completedAt} AS UNSIGNED)/1000))`);
  } catch {
    // Fallback: compute daily completions in JS if SQL function unavailable
    const raw = await db
      .select({ completedAt: tasks.completedAt })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.status, "concluido"),
          sql`${tasks.completedAt} >= ${weekAgo}`
        )
      );
    const countMap: Record<string, number> = {};
    for (const row of raw) {
      if (!row.completedAt) continue;
      const day = new Date(Number(row.completedAt)).toISOString().split("T")[0];
      countMap[day] = (countMap[day] ?? 0) + 1;
    }
    dailyCompletions = Object.entries(countMap).map(([day, count]) => ({ day, count }));
  }

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

// ─── Collaborators ────────────────────────────────────────────────────────────

type CollabRole = "administrador" | "diretor" | "supervisor" | "operador";

/** List all collaborators that belong to this owner's workspace */
export async function listCollaborators(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      loginMethod: users.loginMethod,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.ownerId, ownerId))
    .orderBy(users.name);
}

/** Update a collaborator's role */
export async function updateCollaboratorRole(
  collaboratorId: number,
  ownerId: number,
  role: CollabRole
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(users)
    .set({ role })
    .where(and(eq(users.id, collaboratorId), eq(users.ownerId, ownerId)));
}

/** Remove a collaborator from the workspace */
export async function removeCollaborator(collaboratorId: number, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Nullify their tasks' userId so data isn't lost
  await db
    .update(tasks)
    .set({ assignee: null })
    .where(eq(tasks.userId, collaboratorId));
  await db
    .delete(users)
    .where(and(eq(users.id, collaboratorId), eq(users.ownerId, ownerId)));
}

// ─── Invites ──────────────────────────────────────────────────────────────────

/** Create an invite token */
export async function createInvite(data: InsertInvite) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(invites).values(data);
  return { id: (result as MySQLResult).insertId as number };
}

/** Get invite by token */
export async function getInviteByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);
  return result[0];
}

/** Mark invite as used */
export async function useInvite(token: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(invites)
    .set({ usedAt: new Date(), usedByUserId: userId })
    .where(eq(invites.token, token));
}

/** List all invites created by owner */
export async function listInvites(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(invites)
    .where(eq(invites.ownerId, ownerId))
    .orderBy(desc(invites.createdAt));
}

/** Delete an invite */
export async function deleteInvite(id: number, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .delete(invites)
    .where(and(eq(invites.id, id), eq(invites.ownerId, ownerId)));
}

/** Get unique assignee names from tasks of a user */
export async function getUniqueAssignees(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ assignee: tasks.assignee })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), sql`${tasks.assignee} IS NOT NULL AND ${tasks.assignee} != ''`))
    .orderBy(tasks.assignee);
  return rows.map((r) => r.assignee).filter(Boolean) as string[];
}

// ─── Notifications ────────────────────────────────────────────────────────────

/** Create a notification for a user */
export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

/** List notifications for a user (newest first, max 50) */
export async function listNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

/** Count unread notifications for a user */
export async function countUnreadNotifications(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, "0")));
  return Number(rows[0]?.count ?? 0);
}

/** Mark a single notification as read */
export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ read: "1" })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

/** Mark all notifications as read for a user */
export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ read: "1" })
    .where(eq(notifications.userId, userId));
}

/** Delete a notification */
export async function deleteNotification(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

/** Delete all read notifications for a user */
export async function clearReadNotifications(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, "1")));
}

/**
 * Check tasks with deadline in the next 24h and create "prazo_proximo" notifications.
 * Also check overdue tasks and create "atrasada" notifications.
 * Avoids duplicates by checking notifiedDeadline / notifiedOverdue flags on tasks.
 */
export async function runNotificationJob(userId: number) {
  const db = await getDb();
  if (!db) return { deadlineCount: 0, overdueCount: 0 };

  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;

  // Tasks due in next 24h that haven't been notified yet
  const dueSoon = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        sql`${tasks.status} != 'concluido'`,
        sql`${tasks.deadline} IS NOT NULL`,
        sql`${tasks.deadline} > ${now}`,
        sql`${tasks.deadline} <= ${in24h}`,
        sql`${tasks.notifiedDeadline} IS NULL`
      )
    );

  for (const task of dueSoon) {
    const hoursLeft = Math.round(((task.deadline ?? 0) - now) / (1000 * 60 * 60));
    await createNotification({
      userId,
      taskId: task.id,
      type: "prazo_proximo",
      title: "Prazo se aproximando",
      message: `"${task.title}" vence em ${hoursLeft}h. Não deixe para depois!`,
      read: "0",
    });
    await db
      .update(tasks)
      .set({ notifiedDeadline: new Date() })
      .where(eq(tasks.id, task.id));
  }

  // Overdue tasks that haven't been notified yet
  const overdue = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        sql`${tasks.status} != 'concluido'`,
        sql`${tasks.deadline} IS NOT NULL`,
        sql`${tasks.deadline} < ${now}`,
        sql`${tasks.notifiedOverdue} IS NULL`
      )
    );

  for (const task of overdue) {
    const daysLate = Math.round((now - (task.deadline ?? 0)) / (1000 * 60 * 60 * 24));
    await createNotification({
      userId,
      taskId: task.id,
      type: "atrasada",
      title: "Tarefa atrasada",
      message: `"${task.title}" está atrasada há ${daysLate > 0 ? daysLate + " dia(s)" : "algumas horas"}. Ação necessária!`,
      read: "0",
    });
    await db
      .update(tasks)
      .set({ notifiedOverdue: new Date() })
      .where(eq(tasks.id, task.id));
  }

  return { deadlineCount: dueSoon.length, overdueCount: overdue.length };
}

// ─── Daily Job Helper ─────────────────────────────────────────────────────────
/** Returns all user IDs in the system — used by the daily notification job */
export async function getAllUserIds(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: users.id }).from(users);
  return rows.map((r) => r.id);
}
