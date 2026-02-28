import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  clearReadNotifications,
  countUnreadNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  runNotificationJob,
} from "../db";

export const notificationsRouter = router({
  /** List all notifications for the current user */
  list: protectedProcedure.query(({ ctx }) => listNotifications(ctx.user.id)),

  /** Count unread notifications */
  unreadCount: protectedProcedure.query(({ ctx }) =>
    countUnreadNotifications(ctx.user.id)
  ),

  /** Mark a single notification as read */
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => markNotificationRead(input.id, ctx.user.id)),

  /** Mark all notifications as read */
  markAllRead: protectedProcedure.mutation(({ ctx }) =>
    markAllNotificationsRead(ctx.user.id)
  ),

  /** Delete a single notification */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteNotification(input.id, ctx.user.id)),

  /** Clear all read notifications */
  clearRead: protectedProcedure.mutation(({ ctx }) =>
    clearReadNotifications(ctx.user.id)
  ),

  /**
   * Manually trigger the notification job for the current user.
   * Also called automatically by the server-side interval job.
   */
  runJob: protectedProcedure.mutation(({ ctx }) =>
    runNotificationJob(ctx.user.id)
  ),
});
