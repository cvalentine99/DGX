import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Environment from "./pages/Environment";
import DataCuration from "./pages/DataCuration";
import Training from "./pages/Training";
import Interaction from "./pages/Interaction";
import Statistics from "./pages/Statistics";
import KnowledgeBase from "./pages/KnowledgeBase";
import Holoscan from "./pages/Holoscan";
import DashboardLayout from "./components/DashboardLayout";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/environment" component={Environment} />
        <Route path="/data" component={DataCuration} />
        <Route path="/training" component={Training} />
        <Route path="/interaction" component={Interaction} />
        <Route path="/statistics" component={Statistics} />
        <Route path="/knowledge" component={KnowledgeBase} />
        <Route path="/holoscan" component={Holoscan} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
