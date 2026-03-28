import { TRPCError } from "@trpc/server";
import { collaboratorsRouter } from "./routers/collaborators";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { calendarRouter } from "./routers/calendar";
import { driveRouter } from "./routers/drive";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import {
  createProject, createSubtask, createTag, createTask,
  deleteProject, deleteSubtask, deleteTag, deleteTask,
  getDashboardStats, getOverdueTasks, getTask, getTasksDueSoon,
  getUniqueAssignees, getWeeklyReportData, listProjects, listTags, listTasks,
  markNotifiedDeadline, markNotifiedOverdue,
  updateProject, updateSubtask, updateTask,
} from "./db";

// ─── Projects Router ──────────────────────────────────────────────────────────

const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listProjects(ctx.user.id)),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#dc2626"),
    }))
    .mutation(({ ctx, input }) =>
      createProject({ ...input, userId: ctx.user.id })
    ),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateProject(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteProject(input.id, ctx.user.id)),
});

// ─── Tags Router ──────────────────────────────────────────────────────────────

const tagsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listTags(ctx.user.id)),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#dc2626"),
    }))
    .mutation(({ ctx, input }) =>
      createTag({ ...input, userId: ctx.user.id })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteTag(input.id, ctx.user.id)),
});

// ─── Tasks Router ─────────────────────────────────────────────────────────────

const statusEnum = z.enum(["backlog", "em_andamento", "concluido", "bloqueado"]);
const priorityEnum = z.enum(["baixa", "media", "alta"]);

const tasksRouter = router({
  list: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      priority: priorityEnum.optional(),
      assignee: z.string().optional(),
      search: z.string().optional(),
      status: statusEnum.optional(),
    }).optional())
    .query(({ ctx, input }) => listTasks(ctx.user.id, input ?? {})),
  assignees: protectedProcedure
    .query(({ ctx }) => getUniqueAssignees(ctx.user.id)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const task = await getTask(input.id, ctx.user.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      projectId: z.number().optional(),
      status: statusEnum.default("backlog"),
      priority: priorityEnum.default("media"),
      assignee: z.string().optional(),
      deadline: z.number().optional(),
      estimatedHours: z.number().optional(),
      tagIds: z.array(z.number()).default([]),
    }))
    .mutation(({ ctx, input }) => {
      const { tagIds, ...taskData } = input;
      return createTask({ ...taskData, userId: ctx.user.id }, tagIds);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().optional(),
      projectId: z.number().nullable().optional(),
      status: statusEnum.optional(),
      priority: priorityEnum.optional(),
      assignee: z.string().optional(),
      deadline: z.number().nullable().optional(),
      estimatedHours: z.number().nullable().optional(),
      actualHours: z.number().nullable().optional(),
      calendarEventId: z.string().nullable().optional(),
      driveClientName: z.string().nullable().optional(),
      driveClientPath: z.string().nullable().optional(),
      tagIds: z.array(z.number()).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, tagIds, ...data } = input;
      const cleanData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) cleanData[k] = v;
      }
      return updateTask(id, ctx.user.id, cleanData as Parameters<typeof updateTask>[2], tagIds);
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: statusEnum,
    }))
    .mutation(({ ctx, input }) =>
      updateTask(input.id, ctx.user.id, { status: input.status })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteTask(input.id, ctx.user.id)),
});

// ─── Subtasks Router ──────────────────────────────────────────────────────────

const subtasksRouter = router({
  create: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      title: z.string().min(1).max(500),
    }))
    .mutation(({ ctx, input }) =>
      createSubtask({ ...input, userId: ctx.user.id, completed: "0" })
    ),

  toggle: protectedProcedure
    .input(z.object({ id: z.number(), completed: z.boolean() }))
    .mutation(({ ctx, input }) =>
      updateSubtask(input.id, ctx.user.id, input.completed)
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteSubtask(input.id, ctx.user.id)),
});

// ─── Dashboard Router ─────────────────────────────────────────────────────────

const dashboardRouter = router({
  stats: protectedProcedure.query(({ ctx }) => getDashboardStats(ctx.user.id)),
});

// ─── AI Assistant Router ──────────────────────────────────────────────────────

const aiRouter = router({
  prioritize: protectedProcedure
    .input(z.object({
      taskIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const allTasks = await listTasks(ctx.user.id);
      const selectedTasks = allTasks.filter((t) => input.taskIds.includes(t.id));

      const taskSummary = selectedTasks
        .map((t) => `- ID ${t.id}: "${t.title}" | Prioridade: ${t.priority} | Prazo: ${t.deadline ? new Date(t.deadline).toLocaleDateString("pt-BR") : "sem prazo"} | Status: ${t.status}`)
        .join("\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um assistente de produtividade especializado em gestão de tarefas. Responda sempre em português brasileiro. Seja direto e prático.`,
          },
          {
            role: "user",
            content: `Analise estas tarefas e sugira a ordem de priorização ideal, explicando brevemente o raciocínio para cada uma:\n\n${taskSummary}\n\nResponda em JSON com o formato: { "orderedIds": [id1, id2, ...], "reasoning": "explicação geral", "taskReasons": { "id": "razão" } }`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "prioritization",
            strict: true,
            schema: {
              type: "object",
              properties: {
                orderedIds: { type: "array", items: { type: "number" } },
                reasoning: { type: "string" },
                taskReasons: {
                  type: "object",
                  additionalProperties: { type: "string" },
                },
              },
              required: ["orderedIds", "reasoning", "taskReasons"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    }),

  estimateDeadline: protectedProcedure
    .input(z.object({
      title: z.string(),
      description: z.string().optional(),
      estimatedHours: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const completedTasks = await listTasks(ctx.user.id, { status: "concluido" });
      const historySummary = completedTasks.slice(0, 10)
        .map((t) => `- "${t.title}": ${t.estimatedHours ?? "?"}h estimadas, ${t.actualHours ?? "?"}h reais`)
        .join("\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Você é um assistente de produtividade. Responda em JSON. Use português brasileiro.",
          },
          {
            role: "user",
            content: `Com base no histórico de tarefas concluídas:\n${historySummary || "Sem histórico ainda."}\n\nEstime o prazo realista para a tarefa: "${input.title}" ${input.description ? `(${input.description})` : ""}. Horas estimadas pelo usuário: ${input.estimatedHours ?? "não informado"}.\n\nResponda em JSON: { "estimatedHours": number, "suggestedDeadlineDays": number, "confidence": "alta|media|baixa", "reasoning": "string" }`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "deadline_estimate",
            strict: true,
            schema: {
              type: "object",
              properties: {
                estimatedHours: { type: "number" },
                suggestedDeadlineDays: { type: "number" },
                confidence: { type: "string" },
                reasoning: { type: "string" },
              },
              required: ["estimatedHours", "suggestedDeadlineDays", "confidence", "reasoning"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    }),

  breakTask: protectedProcedure
    .input(z.object({
      taskId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await getTask(input.taskId, ctx.user.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Você é um assistente de produtividade. Responda em JSON. Use português brasileiro.",
          },
          {
            role: "user",
            content: `Quebre a seguinte tarefa em subtarefas menores e acionáveis:\n\nTarefa: "${task.title}"\nDescrição: ${task.description || "sem descrição"}\n\nResponda em JSON: { "subtasks": ["subtarefa1", "subtarefa2", ...], "reasoning": "string" }`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "task_breakdown",
            strict: true,
            schema: {
              type: "object",
              properties: {
                subtasks: { type: "array", items: { type: "string" } },
                reasoning: { type: "string" },
              },
              required: ["subtasks", "reasoning"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

      // Create subtasks in DB
      for (const title of parsed.subtasks) {
        await createSubtask({ taskId: input.taskId, userId: ctx.user.id, title, completed: "0" });
      }

      return parsed;
    }),

  chat: protectedProcedure
    .input(z.object({
      message: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const allTasks = await listTasks(ctx.user.id);
      const stats = await getDashboardStats(ctx.user.id);

      const taskSummary = allTasks.slice(0, 20)
        .map((t) => `- "${t.title}" | Status: ${t.status} | Prioridade: ${t.priority} | Prazo: ${t.deadline ? new Date(t.deadline).toLocaleDateString("pt-BR") : "sem prazo"}`)
        .join("\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um assistente de produtividade inteligente integrado a um sistema de gestão de tarefas. Responda em português brasileiro de forma direta e útil. Contexto atual do usuário:\n\nTarefas (primeiras 20):\n${taskSummary}\n\nEstatísticas: ${JSON.stringify(stats)}`,
          },
          {
            role: "user",
            content: input.message,
          },
        ],
      });

      return { reply: response.choices[0]?.message?.content ?? "Não consegui processar sua pergunta." };
    }),
});

// ─── Notifications Router ─────────────────────────────────────────────────────
import { notificationsRouter as _notifBase } from "./routers/notifications";
const notificationsRouter = router({
  ..._notifBase._def.procedures,
  checkAndNotify: protectedProcedure.mutation(async ({ ctx }) => {
    const dueSoon = await getTasksDueSoon(ctx.user.id);
    const overdue = await getOverdueTasks(ctx.user.id);
    for (const task of dueSoon) {
      await notifyOwner({
        title: `⏰ Tarefa vencendo em 24h: ${task.title}`,
        content: `A tarefa "${task.title}" vence em ${new Date(task.deadline!).toLocaleDateString("pt-BR")}. Não esqueça de concluí-la!`,
      });
      await markNotifiedDeadline(task.id);
    }
    for (const task of overdue) {
      await notifyOwner({
        title: `🚨 Tarefa atrasada: ${task.title}`,
        content: `A tarefa "${task.title}" estava prevista para ${new Date(task.deadline!).toLocaleDateString("pt-BR")} e ainda não foi concluída.`,
      });
      await markNotifiedOverdue(task.id);
    }
    return { notified: dueSoon.length + overdue.length };
  }),
  weeklyReport: protectedProcedure.mutation(async ({ ctx }) => {
    const data = await getWeeklyReportData(ctx.user.id);
    if (!data) return { sent: false };
    const completedTitles = data.completed
      .slice(0, 10)
      .map((t) => `• ${t.title}`)
      .join("\n");
    await notifyOwner({
      title: `📊 Relatório Semanal de Produtividade`,
      content: `Resumo da semana:\n\n✅ Tarefas concluídas: ${data.completedCount}\n📝 Tarefas criadas: ${data.createdCount}\n⏳ Tarefas pendentes: ${data.pendingCount}\n\nConcluídas esta semana:\n${completedTitles || "Nenhuma"}`,
    });
    return { sent: true };
  }),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  projects: projectsRouter,
  tags: tagsRouter,
  tasks: tasksRouter,
  subtasks: subtasksRouter,
  dashboard: dashboardRouter,
  ai: aiRouter,
  notifications: notificationsRouter,
  calendar: calendarRouter,
  drive: driveRouter,
  collaborators: collaboratorsRouter,
});

export type AppRouter = typeof appRouter;
