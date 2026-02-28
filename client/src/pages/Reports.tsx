import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
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

const STATUS_COLORS: Record<string, string> = {
  backlog: "#888888",
  em_andamento: "#111111",
  concluido: "#dc2626",
  bloqueado: "#555555",
};

export default function Reports() {
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
        <div className="mb-10 border-b-2 border-black pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-[oklch(0.45_0.22_27)] mb-1">
              Análise
            </p>
            <h1 className="text-4xl font-black tracking-tight text-black">Relatórios</h1>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-black mb-0">
              <KpiCard label="Total de Tarefas" value={totalTasks} icon={<Clock className="h-5 w-5" />} />
              <KpiCard label="Concluídas" value={completedTasks} icon={<CheckCircle2 className="h-5 w-5" />} accent />
              <KpiCard label="Taxa de Conclusão" value={`${completionRate}%`} icon={<TrendingUp className="h-5 w-5" />} />
              <KpiCard label="Atrasadas" value={stats?.overdueTasks?.length ?? 0} icon={<Bell className="h-5 w-5" />} danger={(stats?.overdueTasks?.length ?? 0) > 0} />
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-x border-b border-black">
              {/* Daily completions */}
              <div className="p-6 border-r border-black">
                <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-1">Últimos 7 dias</p>
                <h2 className="text-xl font-black tracking-tight mb-6">Tarefas Concluídas por Dia</h2>
                {dailyData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Sem dados esta semana</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyData} barSize={28}>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#555" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#555" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ border: "1px solid #111", borderRadius: 0, fontSize: 12 }} cursor={{ fill: "#f5f5f5" }} />
                      <Bar dataKey="concluídas" fill="oklch(0.45 0.22 27)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Status distribution */}
              <div className="p-6">
                <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-1">Distribuição</p>
                <h2 className="text-xl font-black tracking-tight mb-6">Por Status</h2>
                {statusData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Sem dados</div>
                ) : (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                          {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ border: "1px solid #111", borderRadius: 0, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 flex-1">
                      {statusData.map((s) => (
                        <div key={s.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="text-xs text-gray-600">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 bg-gray-100 w-16">
                              <div className="h-1.5" style={{ width: `${totalTasks > 0 ? (s.value / totalTasks) * 100 : 0}%`, backgroundColor: s.color }} />
                            </div>
                            <span className="text-xs font-bold w-4 text-right">{s.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tasks by project */}
            <div className="border-x border-b border-black p-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-1">Distribuição</p>
              <h2 className="text-xl font-black tracking-tight mb-6">Tarefas por Projeto</h2>
              {projectData.length === 0 ? (
                <div className="text-gray-300 text-sm">Sem dados</div>
              ) : (
                <div className="space-y-3">
                  {projectData.map((p) => (
                    <div key={p.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-black truncate max-w-48">{p.name}</span>
                        <span className="font-bold">{p.count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 w-full">
                        <div
                          className="h-2 bg-black transition-all"
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
              <div className="border-x border-b border-black p-6">
                <p className="text-xs font-semibold tracking-widest uppercase text-[oklch(0.45_0.22_27)] mb-1">Atenção</p>
                <h2 className="text-xl font-black tracking-tight mb-4">Tarefas Atrasadas ({stats!.overdueTasks.length})</h2>
                <div className="space-y-2">
                  {stats!.overdueTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between border-l-2 border-[oklch(0.45_0.22_27)] pl-3 py-1">
                      <span className="text-sm font-semibold">{task.title}</span>
                      <span className="text-xs text-gray-500">
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
    <div className={`p-6 border-r border-black last:border-r-0 ${accent ? "bg-[oklch(0.45_0.22_27)]" : "bg-white"}`}>
      <div className={`mb-3 ${accent ? "text-white" : danger ? "text-[oklch(0.45_0.22_27)]" : "text-black"}`}>{icon}</div>
      <p className={`text-3xl font-black tracking-tight ${accent ? "text-white" : "text-black"}`}>{value}</p>
      <p className={`text-xs font-medium uppercase tracking-widest mt-1 ${accent ? "text-white/80" : "text-gray-500"}`}>{label}</p>
    </div>
  );
}
