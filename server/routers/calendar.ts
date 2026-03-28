import { TRPCError } from "@trpc/server";
import { execSync } from "child_process";
import { z } from "zod";
import { getTask, listTasks, updateTask } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

type CalendarResponse = { created?: { id?: string }[]; [k: string]: unknown };

function callMCP(tool: string, args: Record<string, unknown>): unknown {
  try {
    const input = JSON.stringify(args);
    const result = execSync(
      `manus-mcp-cli tool call ${tool} --server google-calendar --input '${input.replace(/'/g, "'\\''")}'`,
      { encoding: "utf-8", timeout: 30000 }
    );
    // Parse the last JSON block from output
    const lines = result.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("{") || line.startsWith("[")) {
        try {
          return JSON.parse(line);
        } catch {
          // line is not valid JSON — skip
        }
      }
    }
    return { success: true, raw: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Calendar MCP Error]", message);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Google Calendar error: ${message}`,
    });
  }
}

export const calendarRouter = router({
  // Sync a task to Google Calendar
  syncTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const task = await getTask(input.taskId, ctx.user.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      if (!task.deadline) throw new TRPCError({ code: "BAD_REQUEST", message: "Tarefa sem prazo definido" });

      const deadlineDate = new Date(task.deadline);
      const dateStr = deadlineDate.toISOString().split("T")[0];

      const eventPayload = {
        summary: task.title,
        description: task.description ?? "",
        start: { date: dateStr },
        end: { date: dateStr },
        colorId: task.priority === "alta" ? "11" : task.priority === "media" ? "5" : "2",
      };

      if (task.calendarEventId) {
        // Update existing event
        callMCP("google_calendar_update_events", {
          event_id: task.calendarEventId,
          calendar_id: "primary",
          ...eventPayload,
        });
        return { action: "updated", eventId: task.calendarEventId };
      } else {
        // Create new event
        const result = callMCP("google_calendar_create_events", {
          events: [eventPayload],
          calendar_id: "primary",
        }) as CalendarResponse;

        const eventId = result.created?.[0]?.id ?? (result[0] as { id?: string } | undefined)?.id ?? null;
        if (eventId) {
          await updateTask(input.taskId, ctx.user.id, { calendarEventId: eventId });
        }
        return { action: "created", eventId };
      }
    }),

  // Sync all tasks with deadlines
  syncAll: protectedProcedure.mutation(async ({ ctx }) => {
    const allTasks = await listTasks(ctx.user.id);
    const tasksWithDeadline = allTasks.filter(
      (t) => t.deadline && t.status !== "concluido" && t.status !== "bloqueado"
    );

    let synced = 0;
    for (const task of tasksWithDeadline) {
      try {
        const deadlineDate = new Date(task.deadline!);
        const dateStr = deadlineDate.toISOString().split("T")[0];
        const eventPayload = {
          summary: task.title,
          description: task.description ?? "",
          start: { date: dateStr },
          end: { date: dateStr },
          colorId: task.priority === "alta" ? "11" : task.priority === "media" ? "5" : "2",
        };

        if (task.calendarEventId) {
          callMCP("google_calendar_update_events", {
            event_id: task.calendarEventId,
            calendar_id: "primary",
            ...eventPayload,
          });
        } else {
          const result = callMCP("google_calendar_create_events", {
            events: [eventPayload],
            calendar_id: "primary",
          }) as CalendarResponse;
          const eventId = result.created?.[0]?.id ?? (result[0] as { id?: string } | undefined)?.id ?? null;
          if (eventId) {
            await updateTask(task.id, ctx.user.id, { calendarEventId: eventId });
          }
        }
        synced++;
      } catch (e) {
        console.error(`[Calendar] Failed to sync task ${task.id}:`, e);
      }
    }

    return { synced, total: tasksWithDeadline.length };
  }),

  // Remove task from calendar
  removeTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const task = await getTask(input.taskId, ctx.user.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      if (!task.calendarEventId) return { removed: false };

      callMCP("google_calendar_delete_events", {
        event_id: task.calendarEventId,
        calendar_id: "primary",
      });

      await updateTask(input.taskId, ctx.user.id, { calendarEventId: null });
      return { removed: true };
    }),
});
