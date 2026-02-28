import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Check,
  Copy,
  Crown,
  Link2,
  Loader2,
  Mail,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CollabRole = "administrador" | "diretor" | "supervisor" | "operador";

const ROLE_CONFIG: Record<
  CollabRole,
  { label: string; color: string; bg: string; icon: React.ReactNode; description: string }
> = {
  administrador: {
    label: "Administrador",
    color: "text-[oklch(0.45_0.22_27)]",
    bg: "bg-[oklch(0.45_0.22_27)]",
    icon: <Crown className="h-3.5 w-3.5" />,
    description: "Acesso total, exceto convidar colaboradores",
  },
  diretor: {
    label: "Diretor",
    color: "text-black",
    bg: "bg-black",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    description: "Ver tudo, editar tudo, excluir tarefas e gerenciar projetos",
  },
  supervisor: {
    label: "Supervisor",
    color: "text-gray-700",
    bg: "bg-gray-700",
    icon: <UserCheck className="h-3.5 w-3.5" />,
    description: "Ver tudo, editar tudo, gerenciar tags e relatórios",
  },
  operador: {
    label: "Operador",
    color: "text-gray-500",
    bg: "bg-gray-400",
    icon: <Users className="h-3.5 w-3.5" />,
    description: "Criar e editar apenas suas próprias tarefas",
  },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role as CollabRole];
  if (!cfg) return <span className="text-xs text-gray-400">{role}</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 text-white ${cfg.bg}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export default function Collaborators() {
  const utils = trpc.useUtils();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState<CollabRole>("operador");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: perms } = trpc.collaborators.myPermissions.useQuery();
  const { data: collaborators = [], isLoading } = trpc.collaborators.list.useQuery(undefined, {
    enabled: !!perms?.canManageCollaborators || (perms?.level ?? 0) >= 3,
  });
  const { data: invitesList = [] } = trpc.collaborators.listInvites.useQuery(undefined, {
    enabled: !!perms?.canManageCollaborators,
  });

  const updateRole = trpc.collaborators.updateRole.useMutation({
    onSuccess: () => {
      utils.collaborators.list.invalidate();
      setEditingId(null);
      toast.success("Role atualizado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.collaborators.remove.useMutation({
    onSuccess: () => {
      utils.collaborators.list.invalidate();
      toast.success("Colaborador removido");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteInvite = trpc.collaborators.deleteInvite.useMutation({
    onSuccess: () => {
      utils.collaborators.listInvites.invalidate();
      toast.success("Convite cancelado");
    },
  });

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copiado!");
  };

  if (!perms) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
        </div>
      </DashboardLayout>
    );
  }

  const canManage = perms.canManageCollaborators;
  const canView = (perms.level ?? 0) >= 3; // diretor+

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full text-center p-12">
          <div className="w-16 h-16 bg-gray-100 flex items-center justify-center mb-6">
            <Users className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="text-xl font-black tracking-tight mb-2">Acesso Restrito</h3>
          <p className="text-sm text-gray-400">
            Você não tem permissão para ver esta página.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="px-6 md:px-10 pt-8 pb-10 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b-2 border-black pb-6">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-[oklch(0.45_0.22_27)] mb-1">
              Equipe
            </p>
            <h1 className="text-4xl font-black tracking-tight text-black">Colaboradores</h1>
          </div>
          {canManage && (
            <Button
              onClick={() => { setShowInviteModal(true); setInviteLink(null); }}
              className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-xs font-bold uppercase tracking-widest h-10 px-5"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar Colaborador
            </Button>
          )}
        </div>

        {/* Permission matrix legend */}
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-widest mb-3">Níveis de Acesso</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.entries(ROLE_CONFIG) as [CollabRole, typeof ROLE_CONFIG[CollabRole]][]).map(([role, cfg]) => (
              <div key={role} className="border border-black p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`${cfg.color} font-black text-sm`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{cfg.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Collaborators list */}
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-widest mb-3 border-b border-black pb-2">
            Membros Ativos ({collaborators.length})
          </p>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
          ) : collaborators.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 p-12 text-center">
              <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">Nenhum colaborador ainda</p>
              <p className="text-xs text-gray-300 mt-1">
                Convide colaboradores usando o botão acima
              </p>
            </div>
          ) : (
            <div className="border border-black">
              {/* Header */}
              <div className="grid grid-cols-12 px-4 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest">
                <div className="col-span-4">Nome</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Nível</div>
                <div className="col-span-2">Último acesso</div>
                <div className="col-span-1 text-right">Ações</div>
              </div>
              {collaborators.map((collab, idx) => (
                <div
                  key={collab.id}
                  className={`grid grid-cols-12 px-4 py-3 items-center border-b border-gray-100 last:border-b-0 ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  }`}
                >
                  <div className="col-span-4 font-semibold text-sm truncate">
                    {collab.name ?? "—"}
                  </div>
                  <div className="col-span-3 text-xs text-gray-500 truncate flex items-center gap-1">
                    <Mail className="h-3 w-3 shrink-0" />
                    {collab.email ?? "—"}
                  </div>
                  <div className="col-span-2">
                    {editingId === collab.id ? (
                      <div className="flex items-center gap-1">
                        <Select
                          value={editRole}
                          onValueChange={(v) => setEditRole(v as CollabRole)}
                        >
                          <SelectTrigger className="h-7 text-xs border-black w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="administrador">Administrador</SelectItem>
                            <SelectItem value="diretor">Diretor</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="operador">Operador</SelectItem>
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() =>
                            updateRole.mutate({ collaboratorId: collab.id, role: editRole })
                          }
                          disabled={updateRole.isPending}
                          className="p-1 hover:bg-gray-100"
                        >
                          {updateRole.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          )}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 hover:bg-gray-100"
                        >
                          <X className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                      </div>
                    ) : (
                      <RoleBadge role={collab.role ?? "operador"} />
                    )}
                  </div>
                  <div className="col-span-2 text-xs text-gray-400">
                    {collab.lastSignedIn
                      ? new Date(collab.lastSignedIn).toLocaleDateString("pt-BR")
                      : "—"}
                  </div>
                  <div className="col-span-1 flex justify-end gap-1">
                    {canManage && editingId !== collab.id && (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(collab.id);
                            setEditRole((collab.role as CollabRole) ?? "operador");
                          }}
                          className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-black transition-colors"
                          title="Alterar role"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remover ${collab.name ?? "colaborador"}?`)) {
                              remove.mutate({ collaboratorId: collab.id });
                            }
                          }}
                          className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-[oklch(0.45_0.22_27)] transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending invites */}
        {canManage && invitesList.length > 0 && (
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-3 border-b border-black pb-2">
              Convites Pendentes ({invitesList.filter((i) => !i.usedAt).length})
            </p>
            <div className="space-y-2">
              {invitesList
                .filter((i) => !i.usedAt)
                .map((invite) => {
                  const expired = new Date() > new Date(invite.expiresAt);
                  return (
                    <div
                      key={invite.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 border ${
                        expired ? "border-gray-200 opacity-60" : "border-black"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Link2 className="h-4 w-4 text-gray-400 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <RoleBadge role={invite.role} />
                            {invite.name && (
                              <span className="text-xs text-gray-500">para {invite.name}</span>
                            )}
                            {expired && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                Expirado
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Expira em{" "}
                            {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteInvite.mutate({ id: invite.id })}
                        className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-[oklch(0.45_0.22_27)] transition-colors shrink-0"
                        title="Cancelar convite"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => { setShowInviteModal(false); setInviteLink(null); }}
          onCreated={(link) => setInviteLink(link)}
          inviteLink={inviteLink}
          copied={copied}
          onCopy={handleCopyLink}
        />
      )}
    </DashboardLayout>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  onClose,
  onCreated,
  inviteLink,
  copied,
  onCopy,
}: {
  onClose: () => void;
  onCreated: (link: string) => void;
  inviteLink: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  const [role, setRole] = useState<CollabRole>("operador");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const createInvite = trpc.collaborators.createInvite.useMutation({
    onSuccess: (data) => {
      onCreated(data.inviteUrl);
      trpc.useUtils().collaborators.listInvites.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createInvite.mutate({
      role,
      name: name || undefined,
      email: email || undefined,
      origin: window.location.origin,
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md border-2 border-black p-0">
        <div className="h-1.5 w-full bg-[oklch(0.45_0.22_27)]" />
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black tracking-tight">
              Convidar Colaborador
            </DialogTitle>
          </DialogHeader>

          {!inviteLink ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest mb-1.5 block">
                  Nível de Acesso *
                </Label>
                <Select value={role} onValueChange={(v) => setRole(v as CollabRole)}>
                  <SelectTrigger className="border-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrador">Administrador</SelectItem>
                    <SelectItem value="diretor">Diretor</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="operador">Operador</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">
                  {ROLE_CONFIG[role].description}
                </p>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-widest mb-1.5 block">
                  Nome (opcional)
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do colaborador"
                  className="border-black text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-widest mb-1.5 block">
                  Email (opcional)
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="border-black text-sm"
                />
              </div>

              <div className="border border-gray-200 p-3 bg-gray-50">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Será gerado um link de convite válido por <strong>7 dias</strong>. O colaborador deve acessar o link e fazer login para entrar no workspace.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="border-black flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createInvite.isPending}
                  className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] flex-1 font-bold uppercase tracking-wide text-xs"
                >
                  {createInvite.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Gerar Link
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-100 flex items-center justify-center">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-bold">Link gerado com sucesso!</p>
                  <p className="text-xs text-gray-400">Válido por 7 dias</p>
                </div>
              </div>

              <div className="border border-black p-3 bg-gray-50">
                <p className="text-xs text-gray-500 break-all font-mono">{inviteLink}</p>
              </div>

              <Button
                onClick={onCopy}
                className={`w-full font-bold uppercase tracking-wide text-xs ${
                  copied
                    ? "bg-green-600 text-white"
                    : "bg-black text-white hover:bg-[oklch(0.45_0.22_27)]"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Link
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={onClose}
                className="w-full border-black text-xs"
              >
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
