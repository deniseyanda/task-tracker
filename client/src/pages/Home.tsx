import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Clock, ListTodo, TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

const PRIORITY_COLORS: Record<string, string> = {
  alta: "#dc2626",
  media: "#111111",
  baixa: "#aaaaaa",
};

const PRIORITY_LABELS: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export default function Home() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  const totalTasks = stats?.statusCounts?.reduce((acc, s) => acc + Number(s.count), 0) ?? 0;
  const overdueCount = stats?.overdueTasks?.length ?? 0;

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
        <div className="mb-10 border-b-2 border-black pb-6">
          <p className="text-xs font-semibold tracking-widest uppercase text-[oklch(0.45_0.22_27)] mb-1">
            Visão Geral
          </p>
          <h1 className="text-4xl font-black tracking-tight text-black">Dashboard</h1>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-10 border border-black">
          <StatCard
            icon={<ListTodo className="h-5 w-5" />}
            label="Total de Tarefas"
            value={isLoading ? "—" : totalTasks}
            accent={false}
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Concluídas esta semana"
            value={isLoading ? "—" : stats?.completedThisWeek ?? 0}
            accent={true}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Concluídas este mês"
            value={isLoading ? "—" : stats?.completedThisMonth ?? 0}
            accent={false}
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Tarefas Atrasadas"
            value={isLoading ? "—" : overdueCount}
            accent={overdueCount > 0}
            danger={overdueCount > 0}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-10 border border-black">
          {/* Daily completions bar chart */}
          <div className="md:col-span-2 p-6 border-r border-black">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-1">
              Últimos 7 dias
            </p>
            <h2 className="text-xl font-black tracking-tight mb-6">Tarefas Concluídas</h2>
            {dailyData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                Nenhuma tarefa concluída esta semana
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyData} barSize={24}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#555" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#555" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ border: "1px solid #111", borderRadius: 0, fontSize: 12 }}
                    cursor={{ fill: "oklch(0.97 0 0)" }}
                  />
                  <Bar dataKey="concluídas" fill="oklch(0.45 0.22 27)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Status pie chart */}
          <div className="p-6">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-1">
              Distribuição
            </p>
            <h2 className="text-xl font-black tracking-tight mb-6">Por Status</h2>
            {statusData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
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
                    <Tooltip contentStyle={{ border: "1px solid #111", borderRadius: 0, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1">
                  {statusData.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-gray-600">{s.name}</span>
                      </div>
                      <span className="font-bold">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Priority + Overdue */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-black">
          {/* Priority distribution */}
          <div className="p-6 border-r border-black">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-1">
              Distribuição
            </p>
            <h2 className="text-xl font-black tracking-tight mb-6">Por Prioridade</h2>
            {priorityData.length === 0 ? (
              <div className="text-gray-400 text-sm">Sem dados</div>
            ) : (
              <div className="space-y-3">
                {priorityData.map((p) => (
                  <div key={p.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold uppercase tracking-wide">{p.name}</span>
                      <span className="font-bold">{p.value}</span>
                    </div>
                    <div className="h-2 bg-gray-100 w-full">
                      <div
                        className="h-2 transition-all"
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
            <p className="text-xs font-semibold tracking-widest uppercase text-[oklch(0.45_0.22_27)] mb-1">
              Atenção
            </p>
            <h2 className="text-xl font-black tracking-tight mb-6">Tarefas Atrasadas</h2>
            {(stats?.overdueTasks ?? []).length === 0 ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Nenhuma tarefa atrasada
              </div>
            ) : (
              <div className="space-y-2">
                {stats!.overdueTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-start justify-between gap-2 border-l-2 border-[oklch(0.45_0.22_27)] pl-3 py-1">
                    <div>
                      <p className="text-sm font-semibold text-black leading-tight">{task.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {task.deadline ? new Date(task.deadline).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </div>
                ))}
                {stats!.overdueTasks.length > 5 && (
                  <p className="text-xs text-gray-400 pt-1">
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
  accent,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`p-6 border-r border-black last:border-r-0 ${
        accent ? "bg-[oklch(0.45_0.22_27)]" : "bg-white"
      }`}
    >
      <div className={`mb-3 ${accent ? "text-white" : danger ? "text-[oklch(0.45_0.22_27)]" : "text-black"}`}>
        {icon}
      </div>
      <p className={`text-3xl font-black tracking-tight ${accent ? "text-white" : "text-black"}`}>
        {value}
      </p>
      <p className={`text-xs font-medium uppercase tracking-widest mt-1 ${accent ? "text-white/80" : "text-gray-500"}`}>
        {label}
      </p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    alta: { label: "Alta", cls: "bg-[oklch(0.45_0.22_27)] text-white" },
    media: { label: "Média", cls: "bg-black text-white" },
    baixa: { label: "Baixa", cls: "bg-gray-100 text-gray-600" },
  };
  const { label, cls } = map[priority] ?? { label: priority, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 shrink-0 ${cls}`}>
      {label}
    </span>
  );
}
