import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  createInvite,
  deleteInvite,
  getInviteByToken,
  listAllUsers,
  listCollaborators,
  listInvites,
  removeCollaborator,
  setUserRole,
  updateCollaboratorRole,
  useInvite,
  getDb,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Permission helpers ───────────────────────────────────────────────────────

type AppRole = "admin" | "administrador" | "diretor" | "supervisor" | "operador" | "user";

const ROLE_LEVEL: Record<AppRole, number> = {
  admin: 5,
  administrador: 4,
  diretor: 3,
  supervisor: 2,
  operador: 1,
  user: 0,
};

/** Returns true if the user's role is >= the required level */
export function hasRole(userRole: string, required: AppRole): boolean {
  return (ROLE_LEVEL[userRole as AppRole] ?? 0) >= ROLE_LEVEL[required];
}

/** Returns true if the user is the workspace owner (admin/administrador) */
export function isOwnerOrAdmin(userRole: string): boolean {
  return hasRole(userRole, "administrador");
}

const collabRoleEnum = z.enum(["administrador", "diretor", "supervisor", "operador"]);

// ─── Router ───────────────────────────────────────────────────────────────────

export const collaboratorsRouter = router({
  /** List all collaborators in the owner's workspace */
  list: protectedProcedure.query(async ({ ctx }) => {
    // Only admin/administrador/diretor can see collaborators list
    if (!hasRole(ctx.user.role, "diretor")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
    }
    // Determine the workspace owner id
    const ownerId = ctx.user.ownerId ?? ctx.user.id;
    return listCollaborators(ownerId);
  }),

  /** Update a collaborator's role — only admin/administrador */
  updateRole: protectedProcedure
    .input(z.object({ collaboratorId: z.number(), role: collabRoleEnum }))
    .mutation(async ({ ctx, input }) => {
      if (!isOwnerOrAdmin(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem alterar roles" });
      }
      const ownerId = ctx.user.ownerId ?? ctx.user.id;
      await updateCollaboratorRole(input.collaboratorId, ownerId, input.role);
      return { success: true };
    }),

  /** Remove a collaborator — only admin/administrador */
  remove: protectedProcedure
    .input(z.object({ collaboratorId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!isOwnerOrAdmin(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem remover colaboradores" });
      }
      const ownerId = ctx.user.ownerId ?? ctx.user.id;
      await removeCollaborator(input.collaboratorId, ownerId);
      return { success: true };
    }),

  // ─── Invites ───────────────────────────────────────────────────────────────

  /** Create an invite link — only admin/administrador */
  createInvite: protectedProcedure
    .input(z.object({
      role: collabRoleEnum,
      email: z.string().email().optional(),
      name: z.string().max(255).optional(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isOwnerOrAdmin(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem convidar colaboradores" });
      }
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const ownerId = ctx.user.ownerId ?? ctx.user.id;
      await createInvite({
        ownerId,
        token,
        email: input.email,
        role: input.role,
        name: input.name,
        expiresAt,
      });
      const inviteUrl = `${input.origin}/entrar?convite=${token}`;
      return { token, inviteUrl, expiresAt };
    }),

  /** List all invites created by owner */
  listInvites: protectedProcedure.query(async ({ ctx }) => {
    if (!isOwnerOrAdmin(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
    }
    return listInvites(ctx.user.ownerId ?? ctx.user.id);
  }),

  /** Delete an invite */
  deleteInvite: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!isOwnerOrAdmin(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      await deleteInvite(input.id, ctx.user.ownerId ?? ctx.user.id);
      return { success: true };
    }),

  /** Accept an invite — called after login with the token */
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await getInviteByToken(input.token);
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Convite não encontrado" });
      }
      if (invite.usedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este convite já foi utilizado" });
      }
      if (new Date() > invite.expiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este convite expirou" });
      }
      // Update the user's role and ownerId
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(users)
        .set({ role: invite.role, ownerId: invite.ownerId })
        .where(eq(users.id, ctx.user.id));
      await useInvite(input.token, ctx.user.id);
      return { success: true, role: invite.role, ownerId: invite.ownerId };
    }),

  /** Get invite info (public — to show on the join page) */
  getInviteInfo: protectedProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx: _ctx, input }) => {
      const invite = await getInviteByToken(input.token);
      if (!invite) throw new TRPCError({ code: "NOT_FOUND" });
      // Get owner name
      const db = await getDb();
      let ownerName = "Workspace";
      if (db) {
        const owner = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, invite.ownerId))
          .limit(1);
        ownerName = owner[0]?.name ?? "Workspace";
      }
      return {
        role: invite.role,
        ownerName,
        expiresAt: invite.expiresAt,
        used: !!invite.usedAt,
        expired: new Date() > invite.expiresAt,
      };
    }),

  /** List all users in the system — system admin only */
  listAllUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
    }
    return listAllUsers();
  }),

  /** Set a user's system role — system admin only */
  setUserRole: protectedProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["admin", "user"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o admin do sistema pode alterar roles" });
      }
      if (ctx.user.id === input.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode alterar seu próprio role" });
      }
      await setUserRole(input.userId, input.role);
      return { success: true };
    }),

  /** Get current user's permission level */
  myPermissions: protectedProcedure.query(({ ctx }) => {
    const role = ctx.user.role as AppRole;
    return {
      role,
      level: ROLE_LEVEL[role] ?? 0,
      canManageCollaborators: isOwnerOrAdmin(role),
      canDeleteTasks: hasRole(role, "diretor"),
      canManageProjects: hasRole(role, "diretor"),
      canManageTags: hasRole(role, "supervisor"),
      canViewReports: hasRole(role, "supervisor"),
      canAccessDrive: hasRole(role, "supervisor"),
      canUseAI: hasRole(role, "supervisor"),
      canViewAllTasks: hasRole(role, "supervisor"),
      canEditAllTasks: hasRole(role, "supervisor"),
    };
  }),
});
