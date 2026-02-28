import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Bot, Brain, Clock, Loader2, Send, Scissors } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type Message = { role: "user" | "assistant"; content: string };

export default function Assistant() {
  const { data: tasks = [] } = trpc.tasks.list.useQuery({});
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou seu assistente de produtividade. Posso ajudar a priorizar suas tarefas, estimar prazos realistas e quebrar tarefas complexas em subtarefas menores. Como posso ajudar hoje?",
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: String(data.reply) }]);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    },
  });

  const prioritize = trpc.ai.prioritize.useMutation({
    onSuccess: (data) => {
      const msg = `**Sugestão de Priorização:**\n\n${data.reasoning}\n\n**Ordem recomendada:**\n${data.orderedIds.map((id: number, i: number) => {
        const task = tasks.find((t) => t.id === id);
        const reason = data.taskReasons?.[String(id)] ?? "";
        return `${i + 1}. **${task?.title ?? `Tarefa #${id}`}** — ${reason}`;
      }).join("\n")}`;
      setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    },
  });

  const breakTask = trpc.ai.breakTask.useMutation({
    onSuccess: (data) => {
      const msg = `**Subtarefas criadas:**\n\n${data.reasoning}\n\n${data.subtasks.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}`;
      setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      toast.success("Subtarefas criadas na tarefa!");
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    },
  });

  const estimateDeadline = trpc.ai.estimateDeadline.useMutation({
    onSuccess: (data) => {
      const task = tasks.find((t) => t.id === selectedTaskId);
      const msg = `**Estimativa de Prazo para "${task?.title}":**\n\n⏱️ Horas estimadas: **${data.estimatedHours}h**\n📅 Prazo sugerido: **${data.suggestedDeadlineDays} dias**\n🎯 Confiança: **${data.confidence}**\n\n${data.reasoning}`;
      setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    chat.mutate({ message: userMsg });
  };

  const pendingTasks = tasks.filter((t) => t.status !== "concluido");
  const isLoading = chat.isPending || prioritize.isPending || breakTask.isPending || estimateDeadline.isPending;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen max-h-screen">
        {/* Header */}
        <div className="px-6 md:px-10 pt-8 pb-6 border-b-2 border-black shrink-0">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-[oklch(0.45_0.22_27)] mb-1">
                Inteligência Artificial
              </p>
              <h1 className="text-4xl font-black tracking-tight text-black">Assistente IA</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500 font-medium">Online</span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Chat area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 bg-[oklch(0.45_0.22_27)] flex items-center justify-center shrink-0 mr-2 mt-0.5">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-xl text-sm leading-relaxed px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-black text-white"
                        : "bg-gray-50 border border-gray-200 text-black"
                    }`}
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 bg-[oklch(0.45_0.22_27)] flex items-center justify-center shrink-0 mr-2">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-50 border border-gray-200 px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    <span className="text-xs text-gray-400">Pensando...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t-2 border-black bg-white shrink-0">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Pergunte algo sobre suas tarefas..."
                  className="border-black text-sm"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right panel: Quick actions */}
          <div className="w-72 border-l-2 border-black overflow-y-auto shrink-0 hidden md:flex flex-col">
            <div className="p-4 border-b border-black">
              <p className="text-xs font-black uppercase tracking-widest">Ações Rápidas</p>
            </div>

            {/* Prioritize all pending */}
            <div className="p-4 border-b border-black">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-[oklch(0.45_0.22_27)]" />
                <p className="text-xs font-bold uppercase tracking-wide">Priorizar Tarefas</p>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Analise e ordene todas as suas tarefas pendentes por prioridade.
              </p>
              <Button
                onClick={() => {
                  if (pendingTasks.length === 0) {
                    toast.info("Sem tarefas pendentes para priorizar");
                    return;
                  }
                  setMessages((prev) => [...prev, { role: "user", content: "Priorize minhas tarefas pendentes" }]);
                  prioritize.mutate({ taskIds: pendingTasks.map((t) => t.id) });
                }}
                disabled={isLoading}
                className="w-full bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-xs font-bold uppercase tracking-wide h-8"
              >
                {prioritize.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Priorizar Agora"}
              </Button>
            </div>

            {/* Break task */}
            <div className="p-4 border-b border-black">
              <div className="flex items-center gap-2 mb-2">
                <Scissors className="h-4 w-4 text-[oklch(0.45_0.22_27)]" />
                <p className="text-xs font-bold uppercase tracking-wide">Quebrar Tarefa</p>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Selecione uma tarefa para dividi-la em subtarefas menores.
              </p>
              <select
                value={selectedTaskId ?? ""}
                onChange={(e) => setSelectedTaskId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full text-xs border border-black p-1.5 mb-2 bg-white"
              >
                <option value="">Selecionar tarefa...</option>
                {pendingTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title.slice(0, 40)}{t.title.length > 40 ? "..." : ""}</option>
                ))}
              </select>
              <Button
                onClick={() => {
                  if (!selectedTaskId) { toast.info("Selecione uma tarefa"); return; }
                  const task = tasks.find((t) => t.id === selectedTaskId);
                  setMessages((prev) => [...prev, { role: "user", content: `Quebre a tarefa "${task?.title}" em subtarefas` }]);
                  breakTask.mutate({ taskId: selectedTaskId });
                }}
                disabled={isLoading || !selectedTaskId}
                className="w-full bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-xs font-bold uppercase tracking-wide h-8"
              >
                {breakTask.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Quebrar Tarefa"}
              </Button>
            </div>

            {/* Estimate deadline */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-[oklch(0.45_0.22_27)]" />
                <p className="text-xs font-bold uppercase tracking-wide">Estimar Prazo</p>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Estime o prazo realista baseado no seu histórico.
              </p>
              <select
                value={selectedTaskId ?? ""}
                onChange={(e) => setSelectedTaskId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full text-xs border border-black p-1.5 mb-2 bg-white"
              >
                <option value="">Selecionar tarefa...</option>
                {pendingTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title.slice(0, 40)}{t.title.length > 40 ? "..." : ""}</option>
                ))}
              </select>
              <Button
                onClick={() => {
                  if (!selectedTaskId) { toast.info("Selecione uma tarefa"); return; }
                  const task = tasks.find((t) => t.id === selectedTaskId);
                  if (!task) return;
                  setMessages((prev) => [...prev, { role: "user", content: `Estime o prazo para "${task.title}"` }]);
                  estimateDeadline.mutate({
                    title: task.title,
                    description: task.description ?? undefined,
                    estimatedHours: task.estimatedHours ?? undefined,
                  });
                }}
                disabled={isLoading || !selectedTaskId}
                className="w-full bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-xs font-bold uppercase tracking-wide h-8"
              >
                {estimateDeadline.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Estimar Prazo"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
