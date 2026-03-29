import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Calendar, CalendarCheck, ExternalLink, FolderOpen, GripVertical, Loader2, Plus, Search, Trash2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Status = "backlog" | "em_andamento" | "concluido" | "bloqueado";
type Priority = "baixa" | "media" | "alta";

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "border-t-gray-400" },
  { id: "em_andamento", label: "Em Andamento", color: "border-t-black" },
  { id: "concluido", label: "Concluído", color: "border-t-[oklch(0.45_0.22_27)]" },
  { id: "bloqueado", label: "Bloqueado", color: "border-t-gray-500" },
];

const PRIORITY_STYLES: Record<Priority, string> = {
  alta: "bg-[oklch(0.45_0.22_27)] text-white",
  media: "bg-black text-white",
  baixa: "bg-gray-100 text-gray-600",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

type Task = {
  id: number;
  title: string;
  description?: string | null;
  status: Status;
  priority: Priority;
  deadline?: number | null;
  assignee?: string | null;
  projectId?: number | null;
  tags?: { id: number; name: string; color: string }[];
};

export default function Kanban() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createStatus, setCreateStatus] = useState<Status>("backlog");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);

  const { data: tasks = [], isLoading } = trpc.tasks.list.useQuery({
    search: search || undefined,
    projectId: filterProject !== "all" ? parseInt(filterProject) : undefined,
    priority: filterPriority !== "all" ? (filterPriority as Priority) : undefined,
    assignee: filterAssignee !== "all" ? filterAssignee : undefined,
  });

  const { data: projects = [] } = trpc.projects.list.useQuery();
  const { data: assignees = [] } = trpc.tasks.assignees.useQuery();

  const hasActiveFilters = filterAssignee !== "all" || filterPriority !== "all" || filterProject !== "all" || !!search;
  const clearFilters = () => { setFilterAssignee("all"); setFilterPriority("all"); setFilterProject("all"); setSearch(""); };

  const updateStatus = trpc.tasks.updateStatus.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.tasks.list.cancel();
      const prev = utils.tasks.list.getData({});
      utils.tasks.list.setData({}, (old) =>
        old?.map((t) => (t.id === id ? { ...t, status } : t))
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      utils.tasks.list.setData({}, ctx?.prev);
    },
    onSettled: () => utils.tasks.list.invalidate(),
  });

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      toast.success("Tarefa excluída");
    },
  });

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData("taskId", String(taskId));
    setDraggingId(taskId);
  };

  const handleDrop = (e: React.DragEvent, status: Status) => {
    e.preventDefault();
    const taskId = parseInt(e.dataTransfer.getData("taskId"));
    if (!isNaN(taskId)) {
      updateStatus.mutate({ id: taskId, status });
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, status: Status) => {
    e.preventDefault();
    setDragOverCol(status);
  };

  const tasksByStatus = (status: Status) =>
    tasks.filter((t) => t.status === status);

  const [now] = useState(() => Date.now());
  const isOverdue = (task: Task) =>
    task.deadline && task.deadline < now && task.status !== "concluido";

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 md:px-10 pt-8 pb-6 border-b-2 border-black">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[oklch(0.45_0.22_27)] mb-1">
                Gestão visual
              </p>
              <h1 className="text-4xl font-black tracking-tight text-black">Kanban</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Buscar tarefas..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm w-48 border-black"
                />
              </div>
              {/* Project filter */}
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="h-9 text-sm w-36 border-black">
                  <SelectValue placeholder="Projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos projetos</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Priority filter */}
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="h-9 text-sm w-36 border-black">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas prioridades</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
              {/* Assignee filter */}
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="h-9 text-sm w-40 border-black">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate text-sm">
                      {filterAssignee === "all" ? "Responsável" : filterAssignee}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos responsáveis</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                  {assignees.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-400">Nenhum responsável cadastrado</div>
                  )}
                </SelectContent>
              </Select>
              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="h-9 px-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide border border-[oklch(0.45_0.22_27)] text-[oklch(0.45_0.22_27)] hover:bg-[oklch(0.45_0.22_27)] hover:text-white transition-colors"
                  title="Limpar todos os filtros"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar
                </button>
              )}
              <Button
                onClick={() => { setCreateStatus("backlog"); setIsCreating(true); }}
                className="h-9 bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-xs font-bold uppercase tracking-wide"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova Tarefa
              </Button>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto p-6 md:p-10">
            <div className="flex gap-0 min-w-max h-full border border-black">
              {COLUMNS.map((col, colIdx) => {
                const colTasks = tasksByStatus(col.id);
                const isDragTarget = dragOverCol === col.id;
                return (
                  <div
                    key={col.id}
                    className={`flex flex-col w-72 shrink-0 ${colIdx < COLUMNS.length - 1 ? "border-r border-black" : ""} ${isDragTarget ? "bg-gray-100" : "bg-gray-50"} transition-colors`}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={(e) => handleDrop(e, col.id)}
                  >
                    {/* Column header */}
                    <div className={`px-4 py-3 bg-white border-b border-black border-t-4 ${col.color} flex items-center justify-between gap-2`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black truncate">{col.label}</span>
                        <span className="text-xs font-bold bg-black text-white px-1.5 py-0.5 min-w-5 text-center shrink-0">
                          {colTasks.length}
                        </span>
                      </div>
                      <button
                        onClick={() => { setCreateStatus(col.id); setIsCreating(true); }}
                        className="h-6 w-6 flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Tasks */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {colTasks.length === 0 && (
                        <div className={`border-2 border-dashed ${isDragTarget ? "border-[oklch(0.45_0.22_27)]" : "border-gray-200"} p-4 text-center text-xs text-gray-400 transition-colors`}>
                          {isDragTarget ? "Soltar aqui" : "Sem tarefas"}
                        </div>
                      )}
                      {colTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task as Task}
                          isDragging={draggingId === task.id}
                          isOverdue={!!isOverdue(task as Task)}
                          onEdit={() => setEditingTask(task as Task)}
                          onDelete={() => deleteTask.mutate({ id: task.id })}
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={() => setDraggingId(null)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <TaskModal
        open={isCreating || !!editingTask}
        task={editingTask}
        defaultStatus={createStatus}
        onClose={() => { setIsCreating(false); setEditingTask(null); }}
        onSaved={() => {
          setIsCreating(false);
          setEditingTask(null);
          utils.tasks.list.invalidate();
        }}
      />
    </DashboardLayout>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  isDragging,
  isOverdue,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  isDragging: boolean;
  isOverdue: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-white border border-gray-200 p-3 cursor-grab active:cursor-grabbing transition-all group shadow-sm ${
        isDragging ? "opacity-40 rotate-1 shadow-none" : "hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
      } ${isOverdue ? "border-l-4 border-l-[oklch(0.45_0.22_27)]" : ""}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${PRIORITY_STYLES[task.priority]}`}
          >
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="h-5 w-5 flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-black transition-colors text-xs"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            className="h-5 w-5 flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-[oklch(0.45_0.22_27)] transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Title */}
      <p
        className="text-sm font-semibold text-black leading-snug mb-2 cursor-pointer hover:text-[oklch(0.45_0.22_27)] transition-colors"
        onClick={onEdit}
      >
        {task.title}
      </p>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              className="text-[10px] font-medium px-1.5 py-0.5 border"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        {task.deadline ? (
          <span className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? "text-[oklch(0.45_0.22_27)]" : "text-gray-500"}`}>
            {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            {new Date(task.deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </span>
        ) : (
          <span />
        )}
        {task.assignee && (
          <span className="text-[10px] text-gray-400 font-medium truncate max-w-20">{task.assignee}</span>
        )}
      </div>
    </div>
  );
}

// ─── Task Modal ───────────────────────────────────────────────────────────────

function TaskModal({
  open,
  task,
  defaultStatus,
  onClose,
  onSaved,
}: {
  open: boolean;
  task: Task | null;
  defaultStatus: Status;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!task;
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const { data: allTags = [] } = trpc.tags.list.useQuery();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("backlog");
  const [priority, setPriority] = useState<Priority>("media");
  const [assignee, setAssignee] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [deadline, setDeadline] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [driveClientName, setDriveClientName] = useState<string>("");
  const [driveClientPath, setDriveClientPath] = useState<string>("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const { data: driveClients = [] } = trpc.drive.listClients.useQuery();

  const { data: taskDetail } = trpc.tasks.get.useQuery(
    { id: task?.id ?? 0 },
    { enabled: !!task?.id }
  );

  const createSubtask = trpc.subtasks.create.useMutation();
  const toggleSubtask = trpc.subtasks.toggle.useMutation();
  const deleteSubtask = trpc.subtasks.delete.useMutation();
  const syncCalendar = trpc.calendar.syncTask.useMutation({
    onSuccess: () => toast.success("Sincronizado com Google Calendar!"),
    onError: () => toast.error("Erro ao sincronizar com Calendar"),
  });

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setAssignee(task.assignee ?? "");
      setProjectId(task.projectId ? String(task.projectId) : "none");
      setDeadline(task.deadline ? new Date(task.deadline).toISOString().split("T")[0] : "");
      setSelectedTags(task.tags?.map((t) => t.id) ?? []);
      setDriveClientName((taskDetail as Record<string, unknown>)?.driveClientName ?? "");
      setDriveClientPath((taskDetail as Record<string, unknown>)?.driveClientPath ?? "");
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus);
      setPriority("media");
      setAssignee("");
      setProjectId("none");
      setDeadline("");
      setEstimatedHours("");
      setSelectedTags([]);
      setDriveClientName("");
      setDriveClientPath("");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [task, defaultStatus, open, taskDetail]);

  const createTask = trpc.tasks.create.useMutation({ onSuccess: onSaved });
  const updateTask = trpc.tasks.update.useMutation({ onSuccess: onSaved });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      description: description || undefined,
      status,
      priority,
      assignee: assignee || undefined,
      projectId: projectId !== "none" ? parseInt(projectId) : undefined,
      deadline: deadline ? new Date(deadline).getTime() : undefined,
      estimatedHours: estimatedHours ? parseInt(estimatedHours) : undefined,
      tagIds: selectedTags,
      driveClientName: driveClientName || undefined,
      driveClientPath: driveClientPath || undefined,
    };

    if (isEdit && task) {
      updateTask.mutate({ id: task.id, ...payload });
    } else {
      createTask.mutate(payload);
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim() || !task) return;
    createSubtask.mutate(
      { taskId: task.id, title: newSubtask.trim() },
      { onSuccess: () => { setNewSubtask(""); } }
    );
  };

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-black p-0">
        {/* Red top bar */}
        <div className="h-1.5 w-full bg-[oklch(0.45_0.22_27)]" />
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black tracking-tight">
              {isEdit ? "Editar Tarefa" : "Nova Tarefa"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                Título *
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="[VERBO] + [O QUÊ] + [DETALHES]"
                className="border-black text-sm"
                required
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                Descrição
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes adicionais..."
                className="border-black text-sm resize-none"
                rows={3}
              />
            </div>

            {/* Row: Status + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger className="border-black text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger className="border-black text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row: Deadline + Estimated hours */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Prazo</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="border-black text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Horas Estimadas</Label>
                <Input
                  type="number"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="Ex: 4"
                  className="border-black text-sm"
                  min={0}
                />
              </div>
            </div>

            {/* Row: Project + Assignee */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Projeto</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="border-black text-sm">
                    <SelectValue placeholder="Sem projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem projeto</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Responsável</Label>
                <Input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Nome do responsável"
                  className="border-black text-sm"
                />
              </div>
            </div>

            {/* Drive Client */}
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Cliente (Google Drive)</Label>
              {driveClientName ? (
                <div className="flex items-center gap-2 border border-black p-2">
                  <FolderOpen className="h-4 w-4 text-[oklch(0.45_0.22_27)] shrink-0" />
                  <span className="text-sm font-medium flex-1 truncate">{driveClientName}</span>
                  <a
                    href={`https://drive.google.com/drive/search?q=${encodeURIComponent(driveClientName)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-gray-100"
                    title="Abrir no Drive"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                  </a>
                  <button
                    type="button"
                    onClick={() => { setDriveClientName(""); setDriveClientPath(""); }}
                    className="p-1 hover:bg-gray-100"
                  >
                    <X className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowClientPicker(!showClientPicker)}
                    className="flex items-center gap-2 text-xs font-medium border border-dashed border-gray-300 hover:border-black px-3 py-2 w-full transition-colors"
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-gray-400" />
                    Vincular cliente do Drive
                  </button>
                  {showClientPicker && (
                    <div className="mt-1 border border-black bg-white shadow-lg z-10">
                      <div className="p-2 border-b border-gray-100">
                        <input
                          type="text"
                          placeholder="Buscar cliente..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="w-full text-xs border border-gray-200 px-2 py-1.5 outline-none focus:border-black"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {driveClients
                          .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setDriveClientName(c.name);
                                setDriveClientPath(c.path);
                                setShowClientPicker(false);
                                setClientSearch("");
                              }}
                              className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-xs border-b border-gray-50 last:border-b-0"
                            >
                              <FolderOpen className="h-3.5 w-3.5 text-[oklch(0.45_0.22_27)] shrink-0" />
                              {c.name}
                            </button>
                          ))}
                        {driveClients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-4 text-xs text-gray-400 text-center">Nenhum cliente encontrado</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tags */}
            {allTags.length > 0 && (
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const selected = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`text-xs font-medium px-2 py-1 border transition-all ${
                          selected ? "text-white" : "bg-white"
                        }`}
                        style={{
                          borderColor: tag.color,
                          backgroundColor: selected ? tag.color : "white",
                          color: selected ? "white" : tag.color,
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Subtasks (edit mode only) */}
            {isEdit && taskDetail && (
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Subtarefas</Label>
                <div className="space-y-1 mb-2">
                  {taskDetail.subtasks?.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 group">
                      <input
                        type="checkbox"
                        checked={sub.completed === "1"}
                        onChange={(e) => toggleSubtask.mutate({ id: sub.id, completed: e.target.checked })}
                        className="accent-[oklch(0.45_0.22_27)]"
                      />
                      <span className={`text-sm flex-1 ${sub.completed === "1" ? "line-through text-gray-400" : ""}`}>
                        {sub.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteSubtask.mutate({ id: sub.id })}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[oklch(0.45_0.22_27)] transition-all"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Adicionar subtarefa..."
                    className="border-black text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSubtask(); } }}
                  />
                  <Button type="button" onClick={handleAddSubtask} className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              {isEdit && task && deadline && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => syncCalendar.mutate({ taskId: task.id })}
                  disabled={syncCalendar.isPending}
                  className="border-black text-xs font-medium"
                >
                  {syncCalendar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CalendarCheck className="h-3.5 w-3.5 mr-1" />}
                  Sync Calendar
                </Button>
              )}
              {(!isEdit || !deadline) && <span />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} className="border-black text-sm">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || !title.trim()}
                  className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-sm font-bold uppercase tracking-wide"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Salvar" : "Criar Tarefa"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
