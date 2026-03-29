import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BarChart3, Bot, FolderOpen, LayoutDashboard, LogOut, PanelLeft, Tag, Trello, Upload, UserCog, Users } from "lucide-react";
import { CSSProperties, startTransition, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import NotificationBell from "./NotificationBell";
import { Button } from "./ui/button";

const menuGroups = [
  {
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Trello, label: "Kanban", path: "/kanban" },
      { icon: FolderOpen, label: "Projetos", path: "/projetos" },
      { icon: Tag, label: "Tags", path: "/tags" },
    ],
  },
  {
    items: [
      { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
      { icon: Bot, label: "Assistente IA", path: "/assistente" },
      { icon: Users, label: "Clientes", path: "/clientes" },
    ],
  },
  {
    items: [
      { icon: UserCog, label: "Colaboradores", path: "/colaboradores" },
      { icon: Upload, label: "Importar", path: "/importar" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 180;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center gap-0 max-w-md w-full border border-black">
          {/* Red accent bar */}
          <div className="w-full h-2 bg-[oklch(0.45_0.22_27)]" />
          <div className="p-12 flex flex-col items-start gap-8 w-full">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium tracking-widest uppercase text-[oklch(0.45_0.22_27)]">
                Task Tracker
              </p>
              <h1 className="text-4xl font-black tracking-tight text-black leading-none">
                Acesse sua<br />área de trabalho
              </h1>
            </div>
            <div className="w-12 h-0.5 bg-black" />
            <p className="text-sm text-gray-600 leading-relaxed">
              Gerencie suas tarefas com precisão. Autentique-se para continuar.
            </p>
            <Button
              onClick={() => { window.location.href = "/login"; }}
              className="bg-black text-white hover:bg-[oklch(0.45_0.22_27)] transition-colors px-8 py-3 text-sm font-semibold tracking-wide uppercase"
            >
              Entrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const allMenuItems = menuGroups.flatMap((g) => g.items);
  const activeMenuItem = allMenuItems.find((item) => item.path === location);

  // Keep as fallback for programmatic navigation / browser back-forward.
  useEffect(() => {
    setOpenMobile(false);
  }, [location]);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing && !isCollapsed) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, isCollapsed, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-16 justify-center border-b border-[oklch(0.2_0_0)]">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-[oklch(0.2_0_0)] transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-[oklch(0.7_0_0)]" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 bg-[oklch(0.45_0.22_27)] shrink-0" />
                  <span className="font-black tracking-tight text-white text-sm uppercase">
                    Task Tracker
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Nav */}
          <SidebarContent className="gap-0 pt-3">
            {menuGroups.map((group, groupIdx) => (
              <div key={groupIdx}>
                {groupIdx > 0 && (
                  <div className="mx-3 my-2 h-px bg-[oklch(0.18_0_0)]" />
                )}
                <SidebarMenu className="px-2 gap-0.5">
                  {group.items.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => { setOpenMobile(false); startTransition(() => setLocation(item.path)); }}
                          tooltip={item.label}
                          className={`h-10 rounded-md transition-all font-medium text-xs ${
                            isActive
                              ? "bg-[oklch(0.45_0.22_27)] text-white hover:bg-[oklch(0.45_0.22_27)]"
                              : "text-[oklch(0.65_0_0)] hover:bg-[oklch(0.45_0.22_27)]/20 hover:text-[oklch(0.92_0_0)]"
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-[oklch(0.2_0_0)]">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 shrink-0 bg-[oklch(0.45_0.22_27)]">
                <AvatarFallback className="text-xs font-bold bg-[oklch(0.45_0.22_27)] text-white">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate text-white">{user?.name || "-"}</p>
                    <p className="text-xs text-[oklch(0.5_0_0)] truncate">{user?.email || "-"}</p>
                  </div>
                  <button
                    onClick={logout}
                    title="Sair"
                    className="h-8 w-8 flex items-center justify-center hover:bg-[oklch(0.2_0_0)] transition-colors focus:outline-none shrink-0"
                  >
                    <LogOut className="h-4 w-4 text-[oklch(0.5_0_0)] hover:text-white" />
                  </button>
                </>
              )}
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[oklch(0.45_0.22_27)]/40 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Top bar with notification bell — always visible */}
        <div className="flex border-b h-14 items-center justify-between bg-white px-4 sticky top-0 z-40 border-gray-100">
          <div className="flex items-center gap-3">
            {isMobile && <SidebarTrigger className="h-8 w-8" />}
            {isMobile && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[oklch(0.45_0.22_27)]" />
                <span className="font-bold text-sm tracking-tight uppercase">
                  {activeMenuItem?.label ?? "Menu"}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell />
          </div>
        </div>
        <main className="flex-1 min-h-screen bg-white">{children}</main>
      </SidebarInset>
    </>
  );
}
