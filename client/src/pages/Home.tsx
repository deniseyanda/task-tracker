import DashboardLayout from "@/components/DashboardLayout";
import { useTheme } from "@/hooks/useTheme";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Clock, ListTodo, TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

const PRIORITY_COLORS_LIGHT: Record<string, string> = {
  alta: "#dc2626",
  media: "#111111",
  baixa: "#aaaaaa",
};

const PRIORITY_COLORS_DARK: Record<string, string> = {
  alta: "#F43F5E",
  media: "#7C3AED",
  baixa: "#64748B",
};

const PRIORITY_LABELS: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export default function Home() {
  const { isDark } = useTheme();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  const totalTasks = stats?.statusCounts?.reduce((acc, s) => acc + Number(s.count), 0) ?? 0;
  const overdueCount = stats?.overdueTasks?.length ?? 0;

  const STATUS_COLORS = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  const PRIORITY_COLORS = isDark ? PRIORITY_COLORS_DARK : PRIORITY_COLORS_LIGHT;

  const statusData = (stats?.statusCounts ?? []).map((s) => ({
    name: STATUS_LABELS[s.status] ?? s.status,
    value: Number(s.count),
    color: STATUS_COLORS[s.status] ?? "#888",
  }));

  const priorityData = (stats?.priorityCounts ?? []).map((p) => ({
    name: PRIORITY_LABELS[p.priority] ?? p.priority,
    value: Number(p.count),
    color: PRIORITY_COLORS[p.priority] ?? "#888",
  }));

  const dailyData = (stats?.dailyCompletions ?? []).map((d) => ({
    day: d.day ? new Date(d.day).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }) : "",
    concluídas: Number(d.count),
  }));

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10 border-b-2 border-black dark:border-white/[0.06] pb-6">
          <p className="text-xs font-medium text-[oklch(0.45_0.22_27)] dark:text-violet-400 mb-1">
            Visão geral
          </p>
          <h1 className="text-4xl font-black tracking-tight text-black dark:text-white">Dashboard</h1>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-10 border border-black dark:border-white/[0.06]">
          <StatCard
            icon={<ListTodo className="h-5 w-5" />}
            label="Total de tarefas"
            value={isLoading ? "—" : totalTasks}
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Concluídas esta semana"
            value={isLoading ? "—" : stats?.completedThisWeek ?? 0}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Concluídas este mês"
            value={isLoading ? "—" : stats?.completedThisMonth ?? 0}
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Tarefas atrasadas"
            value={isLoading ? "—" : overdueCount}
            danger={overdueCount > 0}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-10 border border-black dark:border-white/[0.06]">
          {/* Daily completions bar chart */}
          <div className="md:col-span-2 p-6 border-r border-black dark:border-white/[0.06]">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">
              Últimos 7 dias
            </p>
            <h2 className="text-xl font-black tracking-tight mb-6 dark:text-white">Tarefas concluídas</h2>
            {dailyData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-600 text-sm">
                Nenhuma tarefa concluída esta semana
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyData} barSize={24}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: isDark ? "#64748B" : "#555" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: isDark ? "#64748B" : "#555" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#111"}`, borderRadius: 6, fontSize: 12, background: isDark ? "#0F1220" : "#fff", color: isDark ? "#E2E8F0" : "#111" }}
                    cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "oklch(0.97 0 0)" }}
                  />
                  <Bar dataKey="concluídas" fill={isDark ? "#7C3AED" : "oklch(0.45 0.22 27)"} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Status pie chart */}
          <div className="p-6">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">
              Distribuição
            </p>
            <h2 className="text-xl font-black tracking-tight mb-6 dark:text-white">Por status</h2>
            {statusData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-600 text-sm">
                Sem dados
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={2}>
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#111"}`, borderRadius: 6, fontSize: 12, background: isDark ? "#0F1220" : "#fff", color: isDark ? "#E2E8F0" : "#111" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1">
                  {statusData.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-gray-600 dark:text-gray-400">{s.name}</span>
                      </div>
                      <span className="font-bold dark:text-white/80">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Priority + Overdue */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-black dark:border-white/[0.06]">
          {/* Priority distribution */}
          <div className="p-6 border-r border-black dark:border-white/[0.06]">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">
              Distribuição
            </p>
            <h2 className="text-xl font-black tracking-tight mb-6 dark:text-white">Por prioridade</h2>
            {priorityData.length === 0 ? (
              <div className="text-gray-400 dark:text-gray-600 text-sm">Sem dados</div>
            ) : (
              <div className="space-y-3">
                {priorityData.map((p) => (
                  <div key={p.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{p.name}</span>
                      <span className="font-bold dark:text-white/80">{p.value}</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-white/[0.06] w-full rounded-full">
                      <div
                        className="h-2 rounded-full transition-all progress-bar"
                        style={{
                          width: `${totalTasks > 0 ? (p.value / totalTasks) * 100 : 0}%`,
                          backgroundColor: p.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overdue tasks */}
          <div className="p-6">
            <p className="text-xs font-medium text-[oklch(0.45_0.22_27)] dark:text-rose-400 mb-1">
              Atenção
            </p>
            <h2 className="text-xl font-black tracking-tight mb-6 dark:text-white">Tarefas atrasadas</h2>
            {(stats?.overdueTasks ?? []).length === 0 ? (
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-emerald-400" />
                Nenhuma tarefa atrasada
              </div>
            ) : (
              <div className="space-y-2">
                {stats!.overdueTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-start justify-between gap-2 border-l-2 border-[oklch(0.45_0.22_27)] dark:border-rose-500 pl-3 py-1">
                    <div>
                      <p className="text-sm font-semibold text-black dark:text-white/90 leading-tight">{task.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {task.deadline ? new Date(task.deadline).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </div>
                ))}
                {stats!.overdueTasks.length > 5 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
                    +{stats!.overdueTasks.length - 5} mais tarefas atrasadas
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  danger?: boolean;
}) {
  return (
    <div className="p-6 border-r border-black dark:border-white/[0.08] last:border-r-0 bg-white dark:bg-white/[0.03] dark:backdrop-blur-xl">
      <div className={`mb-3 ${danger ? "text-[oklch(0.45_0.22_27)] dark:text-rose-400" : "text-gray-400 dark:text-gray-500"}`}>
        {icon}
      </div>
      <p className={`text-3xl font-black tracking-tight leading-none ${danger ? "text-[oklch(0.45_0.22_27)] dark:text-rose-400" : "text-black dark:text-white"}`}>
        {value}
      </p>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-2 leading-snug">
        {label}
      </p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    alta: { label: "Alta", cls: "bg-[oklch(0.45_0.22_27)] text-white dark:bg-rose-500/20 dark:text-rose-300" },
    media: { label: "Média", cls: "bg-black text-white dark:bg-violet-500/20 dark:text-violet-300" },
    baixa: { label: "Baixa", cls: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400" },
  };
  const { label, cls } = map[priority] ?? { label: priority, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${cls}`}>
      {label}
    </span>
  );
}
