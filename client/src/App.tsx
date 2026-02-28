import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Kanban from "./pages/Kanban";
import Projects from "./pages/Projects";
import Tags from "./pages/Tags";
import Reports from "./pages/Reports";
import Assistant from "./pages/Assistant";
import Clients from "./pages/Clients";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/kanban" component={Kanban} />
      <Route path="/projetos" component={Projects} />
      <Route path="/tags" component={Tags} />
      <Route path="/relatorios" component={Reports} />
      <Route path="/assistente" component={Assistant} />
      <Route path="/clientes" component={Clients} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
