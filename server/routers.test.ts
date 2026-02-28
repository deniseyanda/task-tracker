import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// Mock DB module
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  createProject: vi.fn().mockResolvedValue({ id: 1 }),
  listProjects: vi.fn().mockResolvedValue([]),
  updateProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  createTag: vi.fn().mockResolvedValue({ id: 1 }),
  listTags: vi.fn().mockResolvedValue([]),
  deleteTag: vi.fn().mockResolvedValue(undefined),
  createTask: vi.fn().mockResolvedValue({ id: 1 }),
  listTasks: vi.fn().mockResolvedValue([]),
  getTask: vi.fn().mockResolvedValue(null),
  updateTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  createSubtask: vi.fn().mockResolvedValue({ id: 1 }),
  updateSubtask: vi.fn().mockResolvedValue(undefined),
  deleteSubtask: vi.fn().mockResolvedValue(undefined),
  getDashboardStats: vi.fn().mockResolvedValue({
    statusCounts: [],
    priorityCounts: [],
    overdueTasks: [],
    completedThisWeek: 0,
    completedThisMonth: 0,
    dailyCompletions: [],
  }),
  getTasksDueSoon: vi.fn().mockResolvedValue([]),
  getOverdueTasks: vi.fn().mockResolvedValue([]),
  markNotifiedDeadline: vi.fn().mockResolvedValue(undefined),
  markNotifiedOverdue: vi.fn().mockResolvedValue(undefined),
  listClients: vi.fn().mockResolvedValue([]),
  listClientFiles: vi.fn().mockResolvedValue([]),
  search: vi.fn().mockResolvedValue({ clients: [], files: [], total: 0 }),
  getShareLink: vi.fn().mockResolvedValue({ url: "https://drive.google.com/test" }),
  getWeeklyReportData: vi.fn().mockResolvedValue({
    completed: [],
    completedCount: 0,
    createdCount: 0,
    pendingCount: 0,
  }),
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ orderedIds: [], reasoning: "test", taskReasons: {} }) } }],
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: { name: string; options: Record<string, unknown> }[] } {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth", () => {
  it("me returns the current user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Test User");
  });

  it("logout clears session cookie", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

// ─── Projects Tests ───────────────────────────────────────────────────────────

describe("projects", () => {
  it("list returns empty array initially", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("create project with valid data", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.create({ name: "Projeto Teste", color: "#dc2626" });
    expect(result).toHaveProperty("id");
    expect(result.id).toBe(1);
  });

  it("create project requires name", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.projects.create({ name: "", color: "#dc2626" })).rejects.toThrow();
  });

  it("update project", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.projects.update({ id: 1, name: "Novo Nome" })).resolves.not.toThrow();
  });

  it("delete project", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.projects.delete({ id: 1 })).resolves.not.toThrow();
  });
});

// ─── Tags Tests ───────────────────────────────────────────────────────────────

describe("tags", () => {
  it("list returns empty array initially", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tags.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("create tag with valid data", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tags.create({ name: "Urgente", color: "#dc2626" });
    expect(result).toHaveProperty("id");
  });

  it("delete tag", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tags.delete({ id: 1 })).resolves.not.toThrow();
  });
});

// ─── Tasks Tests ──────────────────────────────────────────────────────────────

describe("tasks", () => {
  it("list returns empty array initially", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("create task with required fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.create({
      title: "Tarefa de Teste",
      status: "backlog",
      priority: "media",
      tagIds: [],
    });
    expect(result).toHaveProperty("id");
  });

  it("create task requires title", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tasks.create({ title: "", status: "backlog", priority: "media", tagIds: [] })
    ).rejects.toThrow();
  });

  it("create task with all fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.create({
      title: "Tarefa Completa",
      description: "Descrição detalhada",
      status: "em_andamento",
      priority: "alta",
      assignee: "João Silva",
      deadline: Date.now() + 86400000,
      estimatedHours: 4,
      tagIds: [],
    });
    expect(result.id).toBe(1);
  });

  it("update task status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tasks.updateStatus({ id: 1, status: "concluido" })).resolves.not.toThrow();
  });

  it("delete task", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tasks.delete({ id: 1 })).resolves.not.toThrow();
  });

  it("list tasks with filters", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.list({ priority: "alta", status: "backlog" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("get task returns NOT_FOUND when task doesn't exist", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tasks.get({ id: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── Dashboard Tests ──────────────────────────────────────────────────────────

describe("dashboard", () => {
  it("stats returns dashboard data structure", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.stats();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("statusCounts");
    expect(result).toHaveProperty("overdueTasks");
    expect(result).toHaveProperty("completedThisWeek");
    expect(result).toHaveProperty("completedThisMonth");
  });
});

// ─── Notifications Tests ──────────────────────────────────────────────────────

describe("notifications", () => {
  it("checkAndNotify returns notified count", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.checkAndNotify();
    expect(result).toHaveProperty("notified");
    expect(typeof result.notified).toBe("number");
  });

  it("weeklyReport sends report", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.weeklyReport();
    expect(result).toHaveProperty("sent");
  });
});

// ─── Drive Tests ──────────────────────────────────────────────────────────────

describe("drive", () => {
  it("listClients returns empty array initially", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.drive.listClients();
    expect(Array.isArray(result)).toBe(true);
  });

  it("listClientFiles requires clientName", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.drive.listClientFiles({ clientName: "AKAKON - Canela" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("search returns structured result", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.drive.search({ query: "pontao" });
    expect(result).toHaveProperty("clients");
    expect(result).toHaveProperty("files");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.clients)).toBe(true);
    expect(Array.isArray(result.files)).toBe(true);
  });

  it("search requires at least 1 character", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.drive.search({ query: "" })).rejects.toThrow();
  });

  it("getShareLink returns url for folder", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.drive.getShareLink({ fileId: "abc123", isDir: true });
    expect(result).toHaveProperty("url");
    expect(typeof result.url).toBe("string");
  });
});

// ─── Collaborators Tests ──────────────────────────────────────────────────────

describe("collaborators", () => {
  it("myPermissions returns correct level for admin", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const perms = await caller.collaborators.myPermissions();
    expect(perms.role).toBe("user");
    expect(perms.canManageCollaborators).toBe(false);
  });

  it("list throws FORBIDDEN for non-diretor", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.collaborators.list()).rejects.toThrow();
  });

  it("createInvite throws FORBIDDEN for non-admin", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.collaborators.createInvite({
        role: "operador",
        origin: "https://example.com",
      })
    ).rejects.toThrow();
  });

  it("updateRole throws FORBIDDEN for non-admin", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.collaborators.updateRole({ collaboratorId: 99, role: "supervisor" })
    ).rejects.toThrow();
  });

  it("remove throws FORBIDDEN for non-admin", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.collaborators.remove({ collaboratorId: 99 })
    ).rejects.toThrow();
  });

  it("acceptInvite throws NOT_FOUND for invalid token", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.collaborators.acceptInvite({ token: "invalid-token-xyz" })
    ).rejects.toThrow();
  });

  it("getInviteInfo throws NOT_FOUND for invalid token", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.collaborators.getInviteInfo({ token: "invalid-token-xyz" })
    ).rejects.toThrow();
  });
});
