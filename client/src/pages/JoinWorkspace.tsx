import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { CheckCircle, Loader2, ShieldAlert, Users } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const ROLE_LABELS: Record<string, string> = {
  administrador: "Administrador",
  diretor: "Diretor",
  supervisor: "Supervisor",
  operador: "Operador",
};

export default function JoinWorkspace() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [token] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("convite")
  );
  const [accepted, setAccepted] = useState(false);

  const { data: inviteInfo, isLoading: loadingInfo, error: infoError } =
    trpc.collaborators.getInviteInfo.useQuery(
      { token: token ?? "" },
      { enabled: !!token && !!user }
    );

  const acceptInvite = trpc.collaborators.acceptInvite.useMutation({
    onSuccess: () => {
      setAccepted(true);
      setTimeout(() => navigate("/"), 2500);
    },
  });

  if (!token) {
    return <ErrorScreen message="Link de convite inválido ou expirado." />;
  }

  if (authLoading) {
    return <LoadingScreen message="Verificando autenticação..." />;
  }

  if (!user) {
    return (
      <CenteredCard>
        <div className="flex flex-col items-start gap-6 w-full">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold tracking-widest uppercase text-[oklch(0.45_0.22_27)]">
              TaskFlow
            </p>
            <h1 className="text-3xl font-black tracking-tight text-black leading-tight">
              Você foi convidado para um workspace
            </h1>
          </div>
          <div className="w-12 h-0.5 bg-black" />
          <p className="text-sm text-gray-600 leading-relaxed">
            Faça login para aceitar o convite e começar a colaborar.
          </p>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] px-8 py-3 text-sm font-bold uppercase tracking-wide"
          >
            Fazer Login
          </Button>
        </div>
      </CenteredCard>
    );
  }

  if (loadingInfo) {
    return <LoadingScreen message="Carregando informações do convite..." />;
  }

  if (infoError || !inviteInfo) {
    return <ErrorScreen message="Convite não encontrado ou inválido." />;
  }

  if (inviteInfo.used) {
    return <ErrorScreen message="Este convite já foi utilizado." />;
  }

  if (inviteInfo.expired) {
    return <ErrorScreen message="Este convite expirou. Solicite um novo convite ao administrador." />;
  }

  if (accepted) {
    return (
      <CenteredCard>
        <div className="flex flex-col items-center text-center gap-4 w-full">
          <div className="w-16 h-16 bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Bem-vindo!</h2>
          <p className="text-sm text-gray-500">
            Você entrou no workspace como{" "}
            <strong>{ROLE_LABELS[inviteInfo.role] ?? inviteInfo.role}</strong>.
            Redirecionando...
          </p>
        </div>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <div className="flex flex-col items-start gap-6 w-full">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-widest uppercase text-[oklch(0.45_0.22_27)]">
            Convite de Colaboração
          </p>
          <h1 className="text-3xl font-black tracking-tight text-black leading-tight">
            Entrar no Workspace
          </h1>
        </div>
        <div className="w-12 h-0.5 bg-black" />

        <div className="w-full border border-black p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Workspace de</span>
            <span className="text-sm font-bold">{inviteInfo.ownerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Seu nível</span>
            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-black text-white">
              {ROLE_LABELS[inviteInfo.role] ?? inviteInfo.role}
            </span>
          </div>
          <div className="text-xs text-gray-400">
            Expira em{" "}
            {new Date(inviteInfo.expiresAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">
          Você está logado como <strong>{user.name}</strong>. Ao aceitar, você passará a
          fazer parte deste workspace com o nível de acesso indicado acima.
        </p>

        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="border-black flex-1 text-sm"
          >
            Recusar
          </Button>
          <Button
            onClick={() => acceptInvite.mutate({ token })}
            disabled={acceptInvite.isPending}
            className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] flex-1 font-bold uppercase tracking-wide text-xs"
          >
            {acceptInvite.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Aceitar Convite"
            )}
          </Button>
        </div>
      </div>
    </CenteredCard>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md border border-black">
        <div className="h-1.5 w-full bg-[oklch(0.45_0.22_27)]" />
        <div className="p-10">{children}</div>
      </div>
    </div>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  const [, navigate] = useLocation();
  return (
    <CenteredCard>
      <div className="flex flex-col items-center text-center gap-4 w-full">
        <div className="w-16 h-16 bg-red-50 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-[oklch(0.45_0.22_27)]" />
        </div>
        <h2 className="text-xl font-black tracking-tight">Convite Inválido</h2>
        <p className="text-sm text-gray-500">{message}</p>
        <Button
          onClick={() => navigate("/")}
          className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-xs font-bold uppercase tracking-wide"
        >
          Ir para o Dashboard
        </Button>
      </div>
    </CenteredCard>
  );
}
