import { useState, useRef, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  RotateCcw,
  FolderOpen,
  ListTodo,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  projeto: string;
  tarefa: string;
  quadrante: string;
  urgente: string;
  importante: string;
  acao: string;
  data: number | null;
  priority: "alta" | "media" | "baixa";
  status: "backlog" | "em_andamento" | "concluido" | "bloqueado";
  rowIndex: number;
}

interface PreviewData {
  totalRows: number;
  projects: { name: string; count: number }[];
  rows: ParsedRow[];
  errors: string[];
}

interface ImportResult {
  success: boolean;
  createdTasks: number;
  createdProjects: number;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  alta: { label: "Alta", color: "bg-red-100 text-red-700 border-red-200" },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  baixa: { label: "Baixa", color: "bg-green-100 text-green-700 border-green-200" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  em_andamento: { label: "Em Andamento", color: "bg-blue-100 text-blue-700 border-blue-200" },
  backlog: { label: "Backlog", color: "bg-gray-100 text-gray-700 border-gray-200" },
  bloqueado: { label: "Bloqueado", color: "bg-orange-100 text-orange-700 border-orange-200" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-700 border-green-200" },
};

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pt-BR");
}

// ─── Component ────────────────────────────────────────────────────────────────

type Step = "upload" | "preview" | "done";

export default function Import() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && /\.(xlsx|xls)$/i.test(dropped.name)) {
      setFile(dropped);
    } else {
      toast.error("Apenas arquivos .xlsx ou .xls são aceitos.");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  // ── Preview ────────────────────────────────────────────────────────────────

  const handlePreview = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao processar o arquivo.");
      }

      const data: PreviewData = await res.json();

      if (data.errors.length > 0) {
        toast.warning(`Atenção: ${data.errors.join("; ")}`);
      }

      if (data.totalRows === 0) {
        toast.error("Nenhuma tarefa encontrada no arquivo. Verifique o formato.");
        return;
      }

      setPreview(data);
      setStep("preview");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar o arquivo.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Confirm Import ─────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/confirm", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao importar tarefas.");
      }

      const data: ImportResult = await res.json();
      setResult(data);
      setStep("done");
      toast.success(data.message);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar tarefas.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 border-b border-black pb-6">
          <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-1">
            Ferramentas
          </p>
          <h1 className="text-4xl font-black tracking-tight text-black">Importar Tarefas</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Importe tarefas a partir de uma planilha Excel (.xlsx ou .xls). O sistema detecta
            automaticamente as colunas Projeto, Tarefa, Quadrante, Prazo e Status.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-3 mb-8">
          {(["upload", "preview", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-none flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  step === s
                    ? "bg-red-600 border-red-600 text-white"
                    : i < ["upload", "preview", "done"].indexOf(step)
                    ? "bg-black border-black text-white"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  step === s ? "text-black" : "text-gray-400"
                }`}
              >
                {s === "upload" ? "Upload" : s === "preview" ? "Pré-visualização" : "Concluído"}
              </span>
              {i < 2 && <ArrowRight className="w-4 h-4 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-6">
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed cursor-pointer transition-all p-12 text-center ${
                isDragging
                  ? "border-red-600 bg-red-50"
                  : file
                  ? "border-black bg-gray-50"
                  : "border-gray-300 hover:border-gray-500 bg-white"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <FileSpreadsheet className="w-12 h-12 text-green-600" />
                  <p className="font-bold text-black text-lg">{file.name}</p>
                  <p className="text-gray-500 text-sm">
                    {(file.size / 1024).toFixed(1)} KB — Clique para trocar
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="w-12 h-12 text-gray-400" />
                  <p className="font-bold text-black text-lg">
                    Arraste o arquivo aqui ou clique para selecionar
                  </p>
                  <p className="text-gray-400 text-sm">Suporta .xlsx e .xls — máximo 10 MB</p>
                </div>
              )}
            </div>

            {/* Format guide */}
            <Card className="border border-gray-200 rounded-none shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">
                  Formato Esperado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 border-black">
                      <TableHead className="font-black text-black text-xs uppercase">Coluna</TableHead>
                      <TableHead className="font-black text-black text-xs uppercase">Conteúdo</TableHead>
                      <TableHead className="font-black text-black text-xs uppercase">Exemplo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ["Projeto", "Nome do projeto (auto-criado)", "Pontão Assobecaty"],
                      ["Tarefa", "Título da tarefa (obrigatório)", "Ajustar PAD Pontão"],
                      ["Quadrante", "Q1, Q2, Q3 ou Q4", "Q1"],
                      ["Urgente", "sim / não", "sim"],
                      ["Importante", "sim / não", "sim"],
                      ["Ação", "FAZER / AGENDAR / DELEGAR / ELIMINAR", "FAZER"],
                      ["Data", "Data de prazo", "27/02/2026"],
                      ["Status", "Texto livre (opcional)", "."],
                    ].map(([col, desc, ex]) => (
                      <TableRow key={col} className="border-b border-gray-100">
                        <TableCell className="font-bold text-xs">{col}</TableCell>
                        <TableCell className="text-xs text-gray-600">{desc}</TableCell>
                        <TableCell className="text-xs font-mono text-gray-500">{ex}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handlePreview}
                disabled={!file || isLoading}
                className="bg-red-600 hover:bg-red-700 text-white rounded-none font-bold uppercase tracking-wider px-8"
              >
                {isLoading ? "Processando..." : "Pré-visualizar"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Preview ── */}
        {step === "preview" && preview && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-2 border-black rounded-none shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Total de Tarefas
                  </p>
                  <p className="text-3xl font-black text-black">{preview.totalRows}</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-red-600 rounded-none shadow-none bg-red-600">
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-red-100 mb-1">
                    Projetos
                  </p>
                  <p className="text-3xl font-black text-white">{preview.projects.length}</p>
                </CardContent>
              </Card>
              <Card className="border border-gray-200 rounded-none shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Alta Prioridade
                  </p>
                  <p className="text-3xl font-black text-black">
                    {preview.rows.filter(r => r.priority === "alta").length}
                  </p>
                </CardContent>
              </Card>
              <Card className="border border-gray-200 rounded-none shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Com Prazo
                  </p>
                  <p className="text-3xl font-black text-black">
                    {preview.rows.filter(r => r.data).length}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Projects summary */}
            <Card className="border border-gray-200 rounded-none shadow-none">
              <CardHeader className="pb-2 border-b border-gray-100">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Projetos Detectados
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-2">
                  {preview.projects.map(p => (
                    <div
                      key={p.name}
                      className="flex items-center gap-2 border border-black px-3 py-1"
                    >
                      <span className="text-xs font-bold text-black">{p.name}</span>
                      <span className="text-xs text-gray-500">{p.count} tarefa(s)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Errors */}
            {preview.errors.length > 0 && (
              <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-yellow-800 text-sm mb-1">Avisos</p>
                  {preview.errors.map((e, i) => (
                    <p key={i} className="text-yellow-700 text-sm">
                      {e}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Rows preview table */}
            <Card className="border border-gray-200 rounded-none shadow-none">
              <CardHeader className="pb-2 border-b border-gray-100">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <ListTodo className="w-4 h-4" />
                  Pré-visualização das Tarefas{" "}
                  {preview.totalRows > 50 && (
                    <span className="text-gray-400 font-normal">(primeiras 50)</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-2 border-black">
                        <TableHead className="font-black text-black text-xs uppercase">Projeto</TableHead>
                        <TableHead className="font-black text-black text-xs uppercase">Tarefa</TableHead>
                        <TableHead className="font-black text-black text-xs uppercase">Prioridade</TableHead>
                        <TableHead className="font-black text-black text-xs uppercase">Status</TableHead>
                        <TableHead className="font-black text-black text-xs uppercase">Prazo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.map((row, i) => {
                        const pri = PRIORITY_LABELS[row.priority];
                        const sta = STATUS_LABELS[row.status];
                        return (
                          <TableRow key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            <TableCell className="text-xs font-medium text-gray-700 max-w-[120px] truncate">
                              {row.projeto}
                            </TableCell>
                            <TableCell className="text-xs text-black font-medium max-w-[200px] truncate">
                              {row.tarefa}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 border ${pri.color}`}
                              >
                                {pri.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 border ${sta.color}`}
                              >
                                {sta.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-gray-500 font-mono">
                              {formatDate(row.data)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                onClick={handleReset}
                variant="outline"
                className="rounded-none border-2 border-black font-bold uppercase tracking-wider"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700 text-white rounded-none font-bold uppercase tracking-wider px-8"
              >
                {isLoading
                  ? "Importando..."
                  : `Importar ${preview.totalRows} Tarefa${preview.totalRows !== 1 ? "s" : ""}`}
                <CheckCircle2 className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Done ── */}
        {step === "done" && result && (
          <div className="space-y-6">
            <div className="border-2 border-black p-8 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-black mb-2">Importação Concluída!</h2>
              <p className="text-gray-600 mb-6">{result.message}</p>

              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-8">
                <div className="border-2 border-red-600 p-4 bg-red-600 text-white">
                  <p className="text-3xl font-black">{result.createdTasks}</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-red-100">
                    Tarefas
                  </p>
                </div>
                <div className="border-2 border-black p-4">
                  <p className="text-3xl font-black text-black">{result.createdProjects}</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Projetos
                  </p>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="rounded-none border-2 border-black font-bold uppercase tracking-wider"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Nova Importação
                </Button>
                <Button
                  onClick={() => (window.location.href = "/kanban")}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-none font-bold uppercase tracking-wider px-8"
                >
                  Ver no Kanban
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
