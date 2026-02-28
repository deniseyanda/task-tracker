import { trpc } from "@/lib/trpc";
import { Bell, BellRing, CheckCheck, Clock, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type NotifType = "prazo_proximo" | "atrasada" | "concluida" | "sistema";

const TYPE_CONFIG: Record<NotifType, { icon: React.ReactNode; color: string; bg: string }> = {
  prazo_proximo: {
    icon: <Clock className="h-4 w-4" />,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  atrasada: {
    icon: <TriangleAlert className="h-4 w-4" />,
    color: "text-[oklch(0.45_0.22_27)]",
    bg: "bg-red-50 border-red-200",
  },
  concluida: {
    icon: <CheckCheck className="h-4 w-4" />,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
  },
  sistema: {
    icon: <Bell className="h-4 w-4" />,
    color: "text-gray-500",
    bg: "bg-gray-50 border-gray-200",
  },
};

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export default function NotificationBell() {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [], isLoading } = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 60_000, // poll every 60s
  });
  const { data: unreadCount = 0 } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.invalidate(),
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.invalidate();
      toast.success("Todas as notificações marcadas como lidas");
    },
  });
  const deleteNotif = trpc.notifications.delete.useMutation({
    onSuccess: () => utils.notifications.invalidate(),
  });
  const clearRead = trpc.notifications.clearRead.useMutation({
    onSuccess: () => {
      utils.notifications.invalidate();
      toast.success("Notificações lidas removidas");
    },
  });
  const runJob = trpc.notifications.runJob.useMutation({
    onSuccess: (data) => {
      utils.notifications.invalidate();
      const total = data.deadlineCount + data.overdueCount;
      if (total > 0) {
        toast.success(`${total} nova(s) notificação(ões) gerada(s)`);
      } else {
        toast.info("Nenhuma nova notificação no momento");
      }
    },
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Auto-run job on mount to check for new notifications
  useEffect(() => {
    runJob.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
  };

  const handleNotifClick = (id: number, read: string) => {
    if (read === "0") markRead.mutate({ id });
  };

  const unread = notifications.filter((n) => n.read === "0");
  const hasUnread = unreadCount > 0;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative h-9 w-9 flex items-center justify-center border border-transparent hover:border-black transition-colors"
        title="Notificações"
        aria-label={`Notificações${hasUnread ? ` (${unreadCount} não lidas)` : ""}`}
      >
        {hasUnread ? (
          <BellRing className="h-5 w-5 text-[oklch(0.45_0.22_27)] animate-[wiggle_1s_ease-in-out_infinite]" />
        ) : (
          <Bell className="h-5 w-5 text-gray-500" />
        )}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 bg-[oklch(0.45_0.22_27)] text-white text-[10px] font-black flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest">Notificações</span>
              {hasUnread && (
                <span className="text-[10px] font-bold bg-[oklch(0.45_0.22_27)] text-white px-1.5 py-0.5">
                  {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasUnread && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:text-black px-2 py-1 hover:bg-gray-100 transition-colors"
                  title="Marcar todas como lidas"
                >
                  {markAllRead.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ler todas"}
                </button>
              )}
              <button
                onClick={() => runJob.mutate()}
                disabled={runJob.isPending}
                className="text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:text-black px-2 py-1 hover:bg-gray-100 transition-colors"
                title="Verificar novas notificações agora"
              >
                {runJob.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Atualizar"}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-medium">Nenhuma notificação</p>
                <p className="text-[10px] text-gray-300 mt-1">Você está em dia com tudo!</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const cfg = TYPE_CONFIG[notif.type as NotifType] ?? TYPE_CONFIG.sistema;
                const isUnread = notif.read === "0";
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotifClick(notif.id, notif.read)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors ${
                      isUnread ? "bg-gray-50 hover:bg-gray-100" : "hover:bg-gray-50"
                    }`}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 shrink-0 ${cfg.color}`}>{cfg.icon}</div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-bold leading-snug ${isUnread ? "text-black" : "text-gray-600"}`}>
                          {notif.title}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotif.mutate({ id: notif.id }); }}
                          className="shrink-0 text-gray-300 hover:text-[oklch(0.45_0.22_27)] transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                    {/* Unread dot */}
                    {isUnread && (
                      <div className="mt-1.5 h-2 w-2 shrink-0 bg-[oklch(0.45_0.22_27)]" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                {notifications.length} notificação{notifications.length !== 1 ? "ões" : ""}
              </span>
              {notifications.some((n) => n.read === "1") && (
                <button
                  onClick={() => clearRead.mutate()}
                  disabled={clearRead.isPending}
                  className="text-[10px] font-bold uppercase tracking-wide text-gray-400 hover:text-[oklch(0.45_0.22_27)] transition-colors"
                >
                  {clearRead.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Limpar lidas"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
