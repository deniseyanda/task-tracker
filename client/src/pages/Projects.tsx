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
        <div className="mb-10 border-b-2 border-black pb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-[oklch(0.45_0.22_27)] mb-1">
              Organização
            </p>
            <h1 className="text-4xl font-black tracking-tight text-black">Projetos</h1>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-xs font-bold uppercase tracking-wide"
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo Projeto
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : projects.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 p-16 text-center">
            <FolderOpen className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
              Nenhum projeto criado
            </p>
            <p className="text-xs text-gray-300 mt-1">Crie seu primeiro projeto para organizar suas tarefas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-black">
            {projects.map((project, idx) => {
              const count = taskCountByProject(project.id);
              return (
                <div
                  key={project.id}
                  className={`p-6 border-b border-r border-black group hover:bg-gray-50 transition-colors ${
                    (idx + 1) % 3 === 0 ? "border-r-0" : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditing(project as Project)}
                        className="h-7 w-7 flex items-center justify-center hover:bg-gray-200 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5 text-gray-500" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Excluir "${project.name}"? As tarefas não serão excluídas.`)) {
                            deleteProject.mutate({ id: project.id });
                          }
                        }}
                        className="h-7 w-7 flex items-center justify-center hover:bg-gray-200 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[oklch(0.45_0.22_27)]" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-lg font-black tracking-tight text-black mb-1">{project.name}</h3>
                  {project.description && (
                    <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{project.description}</p>
                  )}
                  <div className="flex items-center gap-1 mt-auto">
                    <span className="text-xs font-bold text-black">{count}</span>
                    <span className="text-xs text-gray-400 uppercase tracking-wide">
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
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setColor(project.color);
    } else {
      setName("");
      setDescription("");
      setColor("#dc2626");
    }
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
      <DialogContent className="max-w-md border-2 border-black p-0">
        <div className="h-1.5 w-full bg-[oklch(0.45_0.22_27)]" />
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black tracking-tight">
              {isEdit ? "Editar Projeto" : "Novo Projeto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest mb-1.5 block">Nome *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do projeto"
                className="border-black"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest mb-1.5 block">Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional..."
                className="border-black resize-none"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest mb-2 block">Cor</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 transition-all ${color === c ? "ring-2 ring-offset-2 ring-black scale-110" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={onClose} className="border-black">Cancelar</Button>
              <Button
                type="submit"
                disabled={isPending || !name.trim()}
                className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] font-bold uppercase tracking-wide"
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
