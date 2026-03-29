import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#dc2626", "#111111", "#2563eb", "#16a34a", "#d97706",
  "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#9f1239",
];

export default function Tags() {
  const utils = trpc.useUtils();
  const { data: tags = [], isLoading } = trpc.tags.list.useQuery();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#dc2626");

  const create = trpc.tags.create.useMutation({
    onSuccess: () => {
      utils.tags.list.invalidate();
      setIsCreating(false);
      setName("");
      setColor("#dc2626");
      toast.success("Tag criada");
    },
  });

  const deleteTag = trpc.tags.delete.useMutation({
    onSuccess: () => { utils.tags.list.invalidate(); toast.success("Tag excluída"); },
  });

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10 border-b border-gray-100 pb-6 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-medium tracking-wider text-[oklch(0.55_0.15_27)] mb-1.5">
              Classificação
            </p>
            <h1 className="text-4xl font-black tracking-tight text-black">Tags</h1>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-sm font-semibold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nova tag
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-200" />
          </div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-5 shadow-sm">
              <Tag className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-base font-bold text-gray-700 mb-1.5">Nenhuma tag ainda</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs leading-relaxed">
              Crie tags para categorizar e filtrar suas tarefas rapidamente
            </p>
            <Button
              onClick={() => setIsCreating(true)}
              className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-sm font-semibold"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Criar primeira tag
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 border rounded-lg px-3 py-2 group shadow-sm hover:shadow-md transition-shadow bg-white"
                style={{ borderColor: tag.color }}
              >
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="text-sm font-semibold" style={{ color: tag.color }}>{tag.name}</span>
                <button
                  onClick={() => {
                    if (confirm(`Excluir tag "${tag.name}"?`)) deleteTag.mutate({ id: tag.id });
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                >
                  <Trash2 className="h-3.5 w-3.5" style={{ color: tag.color }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isCreating} onOpenChange={(v) => !v && setIsCreating(false)}>
        <DialogContent className="max-w-sm border border-gray-100 shadow-xl p-0">
          <div className="h-1 w-full bg-[oklch(0.45_0.22_27)] rounded-t-lg" />
          <div className="p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="text-xl font-bold tracking-tight">Nova tag</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                create.mutate({ name: name.trim(), color });
              }}
              className="space-y-4"
            >
              <div>
                <Label className="text-xs font-semibold text-gray-500 mb-1.5 block">Nome *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Urgente, Design, Dev..."
                  required
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
              {name && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-500">Prévia:</span>
                  <div className="flex items-center gap-1.5 border rounded-md px-2 py-1" style={{ borderColor: color }}>
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-xs font-semibold" style={{ color }}>{name}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={create.isPending || !name.trim()}
                  className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] font-semibold"
                >
                  {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
