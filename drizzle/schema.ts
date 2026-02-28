import {
  bigint,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  // Roles: admin (sistema), administrador, diretor, supervisor, operador
  role: mysqlEnum("role", ["user", "admin", "administrador", "diretor", "supervisor", "operador"]).default("user").notNull(),
  // Owner reference: userId of the workspace owner (for multi-tenant isolation)
  ownerId: int("ownerId"), // null = is the owner themselves
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Projects
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#dc2626").notNull(), // hex color
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// Tags
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).default("#dc2626").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

// Tasks
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["backlog", "em_andamento", "concluido", "bloqueado"])
    .default("backlog")
    .notNull(),
  priority: mysqlEnum("priority", ["baixa", "media", "alta"]).default("media").notNull(),
  assignee: varchar("assignee", { length: 255 }),
  deadline: bigint("deadline", { mode: "number" }), // UTC ms
  estimatedHours: int("estimatedHours"),
  actualHours: int("actualHours"),
  calendarEventId: varchar("calendarEventId", { length: 255 }), // Google Calendar event ID
  notifiedDeadline: timestamp("notifiedDeadline"), // when 24h notification was sent
  notifiedOverdue: timestamp("notifiedOverdue"), // when overdue notification was sent
  completedAt: bigint("completedAt", { mode: "number" }), // UTC ms when completed
  driveClientName: varchar("driveClientName", { length: 255 }), // Google Drive client folder name
  driveClientPath: varchar("driveClientPath", { length: 500 }), // Google Drive client folder path
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// Task Tags (many-to-many)
export const taskTags = mysqlTable("task_tags", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  tagId: int("tagId").notNull(),
});

export type TaskTag = typeof taskTags.$inferSelect;

// Subtasks
export const subtasks = mysqlTable("subtasks", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  completed: mysqlEnum("completed", ["0", "1"]).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Subtask = typeof subtasks.$inferSelect;
export type InsertSubtask = typeof subtasks.$inferInsert;

// Collaborator Invites
export const invites = mysqlTable("invites", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(), // who sent the invite
  token: varchar("token", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["administrador", "diretor", "supervisor", "operador"]).notNull(),
  name: varchar("name", { length: 255 }), // optional display name
  usedAt: timestamp("usedAt"), // null = not yet used
  usedByUserId: int("usedByUserId"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invite = typeof invites.$inferSelect;
export type InsertInvite = typeof invites.$inferInsert;

// In-app Notifications
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskId: int("taskId"), // nullable — some notifications may not be task-related
  type: mysqlEnum("type", ["prazo_proximo", "atrasada", "concluida", "sistema"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  read: mysqlEnum("read", ["0", "1"]).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
