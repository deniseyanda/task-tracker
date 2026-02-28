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
        <div className="mb-10 border-b-2 border-black pb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-[oklch(0.45_0.22_27)] mb-1">
              Classificação
            </p>
            <h1 className="text-4xl font-black tracking-tight text-black">Tags</h1>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-xs font-bold uppercase tracking-wide"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova Tag
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : tags.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 p-16 text-center">
            <Tag className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Nenhuma tag criada</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 border px-3 py-2 group"
                style={{ borderColor: tag.color }}
              >
                <div className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: tag.color }} />
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
        <DialogContent className="max-w-sm border-2 border-black p-0">
          <div className="h-1.5 w-full bg-[oklch(0.45_0.22_27)]" />
          <div className="p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-black tracking-tight">Nova Tag</DialogTitle>
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
                <Label className="text-xs font-bold uppercase tracking-widest mb-1.5 block">Nome *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Urgente, Design, Dev..."
                  className="border-black"
                  required
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
              {/* Preview */}
              {name && (
                <div className="flex items-center gap-2 p-3 bg-gray-50">
                  <span className="text-xs text-gray-500">Prévia:</span>
                  <div className="flex items-center gap-1.5 border px-2 py-1" style={{ borderColor: color }}>
                    <div className="w-2 h-2" style={{ backgroundColor: color }} />
                    <span className="text-xs font-semibold" style={{ color }}>{name}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)} className="border-black">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={create.isPending || !name.trim()}
                  className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] font-bold uppercase tracking-wide"
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
