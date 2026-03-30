import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { FolderOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#dc2626", "#111111", "#2563eb", "#16a34a", "#d97706",
  "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#9f1239",
];

type Project = { id: number; name: string; description?: string | null; color: string };

export default function Projects() {
  const utils = trpc.useUtils();
  const { data: projects = [], isLoading } = trpc.projects.list.useQuery();
  const { data: tasks = [] } = trpc.tasks.list.useQuery({});

  const [editing, setEditing] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => { utils.projects.list.invalidate(); toast.success("Projeto excluído"); },
  });

  const taskCountByProject = (projectId: number) =>
    tasks.filter((t) => t.projectId === projectId).length;

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10 border-b border-gray-100 dark:border-white/[0.06] pb-6 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-medium tracking-wider text-[oklch(0.55_0.15_27)] dark:text-violet-400/70 mb-1.5">
              Organização
            </p>
            <h1 className="text-4xl font-black tracking-tight text-black dark:text-white">Projetos</h1>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] dark:bg-violet-600 dark:hover:bg-violet-700 text-sm font-semibold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo projeto
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-200" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-5 shadow-sm">
              <FolderOpen className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-base font-bold text-gray-700 mb-1.5">Nenhum projeto ainda</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs leading-relaxed">
              Crie seu primeiro projeto para agrupar e organizar suas tarefas
            </p>
            <Button
              onClick={() => setIsCreating(true)}
              className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-sm font-semibold"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Criar primeiro projeto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const count = taskCountByProject(project.id);
              return (
                <div
                  key={project.id}
                  className="p-5 rounded-2xl border border-gray-100 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] dark:backdrop-blur-xl shadow-sm group hover:shadow-md hover:border-gray-200 dark:hover:border-purple-500/30 dark:hover:bg-white/[0.07] transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-3.5 h-3.5 rounded-sm shrink-0 mt-1"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditing(project as Project)}
                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Excluir "${project.name}"? As tarefas não serão excluídas.`)) {
                            deleteProject.mutate({ id: project.id });
                          }
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[oklch(0.45_0.22_27)]" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-base font-bold tracking-tight text-black dark:text-white/90 mb-1">{project.name}</h3>
                  {project.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed mb-3 line-clamp-2">{project.description}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{count}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {count === 1 ? "tarefa" : "tarefas"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ProjectModal
        open={isCreating || !!editing}
        project={editing}
        onClose={() => { setIsCreating(false); setEditing(null); }}
        onSaved={() => { setIsCreating(false); setEditing(null); utils.projects.list.invalidate(); }}
      />
    </DashboardLayout>
  );
}

function ProjectModal({
  open,
  project,
  onClose,
  onSaved,
}: {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!project;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#dc2626");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setColor(project.color);
    } else {
      setName("");
      setDescription("");
      setColor("#dc2626");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [project, open]);

  const create = trpc.projects.create.useMutation({ onSuccess: onSaved });
  const update = trpc.projects.update.useMutation({ onSuccess: onSaved });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (isEdit && project) {
      update.mutate({ id: project.id, name: name.trim(), description: description || undefined, color });
    } else {
      create.mutate({ name: name.trim(), description: description || undefined, color });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md border border-gray-100 dark:border-white/[0.1] shadow-xl p-0">
        <div className="h-1 w-full bg-[oklch(0.45_0.22_27)] dark:bg-violet-600 rounded-t-lg" />
        <div className="p-6">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {isEdit ? "Editar projeto" : "Novo projeto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-gray-500 mb-1.5 block">Nome *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do projeto"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 mb-1.5 block">Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional..."
                className="resize-none"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 mb-2 block">Cor</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-md transition-all ${color === c ? "ring-2 ring-offset-2 ring-black scale-110" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                type="submit"
                disabled={isPending || !name.trim()}
                className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] font-semibold"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
