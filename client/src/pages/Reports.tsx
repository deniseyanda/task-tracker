import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { trpc } from "@/lib/trpc";
import { Bell, CalendarCheck, CheckCircle2, Clock, Loader2, Send, TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  bloqueado: "Bloqueado",
};

const STATUS_COLORS_LIGHT: Record<string, string> = {
  backlog: "#94A3B8",
  em_andamento: "#111111",
  concluido: "#dc2626",
  bloqueado: "#555555",
};

const STATUS_COLORS_DARK: Record<string, string> = {
  backlog: "#94A3B8",
  em_andamento: "#06B6D4",
  concluido: "#10B981",
  bloqueado: "#F43F5E",
};

export default function Reports() {
  const { isDark } = useTheme();
  const STATUS_COLORS = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: tasks = [] } = trpc.tasks.list.useQuery({});

  const syncCalendar = trpc.calendar.syncAll.useMutation({
    onSuccess: (data) => toast.success(`${data.synced} tarefas sincronizadas com Google Calendar`),
    onError: () => toast.error("Erro ao sincronizar com Calendar"),
  });

  const checkNotify = trpc.notifications.checkAndNotify.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.notified} notificações enviadas`);
    },
  });

  const weeklyReport = trpc.notifications.weeklyReport.useMutation({
    onSuccess: () => toast.success("Relatório semanal enviado!"),
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "concluido").length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const statusData = (stats?.statusCounts ?? []).map((s) => ({
    name: STATUS_LABELS[s.status] ?? s.status,
    value: Number(s.count),
    color: STATUS_COLORS[s.status] ?? "#888",
  }));

  const dailyData = (stats?.dailyCompletions ?? []).map((d) => ({
    day: d.day ? new Date(d.day).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }) : "",
    concluídas: Number(d.count),
  }));

  // Tasks by project
  const projectMap: Record<string, number> = {};
  tasks.forEach((t) => {
    const key = t.projectId ? String(t.projectId) : "Sem projeto";
    projectMap[key] = (projectMap[key] ?? 0) + 1;
  });
  const projectData = Object.entries(projectMap).map(([name, count]) => ({ name, count }));

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10 border-b-2 border-black dark:border-white/[0.06] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium tracking-wider text-[oklch(0.55_0.15_27)] dark:text-violet-400/70 mb-1.5">
              Análise
            </p>
            <h1 className="text-4xl font-black tracking-tight text-black dark:text-white">Relatórios</h1>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => syncCalendar.mutate()}
              disabled={syncCalendar.isPending}
              variant="outline"
              className="border-black text-xs font-bold uppercase tracking-wide"
            >
              {syncCalendar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CalendarCheck className="h-4 w-4 mr-1" />}
              Sync Google Calendar
            </Button>
            <Button
              onClick={() => checkNotify.mutate()}
              disabled={checkNotify.isPending}
              variant="outline"
              className="border-black text-xs font-bold uppercase tracking-wide"
            >
              {checkNotify.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Bell className="h-4 w-4 mr-1" />}
              Verificar Notificações
            </Button>
            <Button
              onClick={() => weeklyReport.mutate()}
              disabled={weeklyReport.isPending}
              className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-xs font-bold uppercase tracking-wide"
            >
              {weeklyReport.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Enviar Relatório Semanal
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="space-y-0">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-black dark:border-white/[0.06] mb-0">
              <KpiCard label="Total de Tarefas" value={totalTasks} icon={<Clock className="h-5 w-5" />} />
              <KpiCard label="Concluídas" value={completedTasks} icon={<CheckCircle2 className="h-5 w-5" />} accent />
              <KpiCard label="Taxa de Conclusão" value={`${completionRate}%`} icon={<TrendingUp className="h-5 w-5" />} />
              <KpiCard label="Atrasadas" value={stats?.overdueTasks?.length ?? 0} icon={<Bell className="h-5 w-5" />} danger={(stats?.overdueTasks?.length ?? 0) > 0} />
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-x border-b border-black dark:border-white/[0.06]">
              {/* Daily completions */}
              <div className="p-6 border-r border-black dark:border-white/[0.06]">
                <p className="text-[10px] font-medium tracking-wider text-gray-400 dark:text-gray-500 mb-1">Últimos 7 dias</p>
                <h2 className="text-xl font-black tracking-tight mb-6 dark:text-white">Tarefas Concluídas por Dia</h2>
                {dailyData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-300 dark:text-gray-600 text-sm">Sem dados esta semana</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyData} barSize={28}>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: isDark ? "#64748B" : "#555" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: isDark ? "#64748B" : "#555" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#111"}`, borderRadius: 6, fontSize: 12, background: isDark ? "#0F1220" : "#fff", color: isDark ? "#E2E8F0" : "#111" }} cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "#f5f5f5" }} />
                      <Bar dataKey="concluídas" fill={isDark ? "#7C3AED" : "oklch(0.45 0.22 27)"} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Status distribution */}
              <div className="p-6">
                <p className="text-[10px] font-medium tracking-wider text-gray-400 dark:text-gray-500 mb-1">Distribuição</p>
                <h2 className="text-xl font-black tracking-tight mb-6 dark:text-white">Por Status</h2>
                {statusData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Sem dados</div>
                ) : (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                          {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#111"}`, borderRadius: 6, fontSize: 12, background: isDark ? "#0F1220" : "#fff", color: isDark ? "#E2E8F0" : "#111" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 flex-1">
                      {statusData.map((s) => (
                        <div key={s.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="text-xs text-gray-600 dark:text-gray-400">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 bg-gray-100 dark:bg-white/[0.06] w-16 rounded-full">
                              <div className="h-1.5 rounded-full" style={{ width: `${totalTasks > 0 ? (s.value / totalTasks) * 100 : 0}%`, backgroundColor: s.color }} />
                            </div>
                            <span className="text-xs font-bold w-4 text-right dark:text-white/70">{s.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tasks by project */}
            <div className="border-x border-b border-black dark:border-white/[0.06] p-6">
              <p className="text-[10px] font-medium tracking-wider text-gray-400 dark:text-gray-500 mb-1">Distribuição</p>
              <h2 className="text-xl font-black tracking-tight mb-6 dark:text-white">Tarefas por Projeto</h2>
              {projectData.length === 0 ? (
                <div className="text-gray-300 dark:text-gray-600 text-sm">Sem dados</div>
              ) : (
                <div className="space-y-3">
                  {projectData.map((p) => (
                    <div key={p.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-black dark:text-white/80 truncate max-w-48">{p.name}</span>
                        <span className="font-bold dark:text-white/70">{p.count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-white/[0.06] w-full rounded-full">
                        <div
                          className="h-2 bg-black dark:bg-violet-500 rounded-full transition-all progress-bar"
                          style={{ width: `${totalTasks > 0 ? (p.count / totalTasks) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Overdue tasks */}
            {(stats?.overdueTasks?.length ?? 0) > 0 && (
              <div className="border-x border-b border-black dark:border-white/[0.06] p-6">
                <p className="text-[10px] font-medium tracking-wider text-[oklch(0.45_0.22_27)] dark:text-rose-400/80 mb-1">Atenção</p>
                <h2 className="text-xl font-black tracking-tight mb-4 dark:text-white">Tarefas Atrasadas ({stats!.overdueTasks.length})</h2>
                <div className="space-y-2">
                  {stats!.overdueTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between border-l-2 border-[oklch(0.45_0.22_27)] dark:border-rose-500 pl-3 py-1">
                      <span className="text-sm font-semibold dark:text-white/90">{task.title}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {task.deadline ? new Date(task.deadline).toLocaleDateString("pt-BR") : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function KpiCard({
  label, value, icon, accent, danger,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={`p-6 border-r border-black dark:border-white/[0.06] last:border-r-0 ${accent ? "bg-[oklch(0.45_0.22_27)] dark:bg-violet-600/20" : "bg-white dark:bg-white/[0.02]"}`}>
      <div className={`mb-3 ${accent ? "text-white dark:text-violet-300" : danger ? "text-[oklch(0.45_0.22_27)] dark:text-rose-400" : "text-black dark:text-gray-400"}`}>{icon}</div>
      <p className={`text-3xl font-black tracking-tight ${accent ? "text-white dark:text-violet-200" : "text-black dark:text-white"}`}>{value}</p>
      <p className={`text-xs font-medium mt-1 ${accent ? "text-white/80 dark:text-violet-300/70" : "text-gray-500 dark:text-gray-400"}`}>{label}</p>
    </div>
  );
}
