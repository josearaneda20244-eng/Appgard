import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { Layout } from "@/components/layout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Rounds from "@/pages/rounds";
import RoundDetail from "@/pages/round-detail";
import RoundNew from "@/pages/round-new";
import Incidents from "@/pages/incidents";
import Chat from "@/pages/chat";
import Panic from "@/pages/panic";
import UsersManage from "@/pages/users-manage";
import LiveMap from "@/pages/live-map";
import Profile from "@/pages/profile";
import GuardMode from "@/pages/guard-mode";
import Reports from "@/pages/reports";
import Companies from "@/pages/companies";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, allowedRoles }: { component: () => JSX.Element | null; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function AppRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <Login />}
      </Route>

      <Route path="/dashboard">
        <Layout><ProtectedRoute component={Dashboard} /></Layout>
      </Route>

      <Route path="/rounds/new">
        <Layout><ProtectedRoute component={RoundNew} allowedRoles={["supervisor", "admin"]} /></Layout>
      </Route>

      <Route path="/rounds/:id">
        <Layout><ProtectedRoute component={RoundDetail} /></Layout>
      </Route>

      <Route path="/rounds">
        <Layout><ProtectedRoute component={Rounds} /></Layout>
      </Route>

      <Route path="/guard-mode">
        <Layout><ProtectedRoute component={GuardMode} allowedRoles={["guard"]} /></Layout>
      </Route>

      <Route path="/incidents">
        <Layout><ProtectedRoute component={Incidents} /></Layout>
      </Route>

      <Route path="/chat">
        <Layout><ProtectedRoute component={Chat} /></Layout>
      </Route>

      <Route path="/panic">
        <Layout><ProtectedRoute component={Panic} /></Layout>
      </Route>

      <Route path="/reports">
        <Layout><ProtectedRoute component={Reports} allowedRoles={["supervisor", "admin"]} /></Layout>
      </Route>

      <Route path="/companies">
        <Layout><ProtectedRoute component={Companies} allowedRoles={["supervisor", "admin"]} /></Layout>
      </Route>

      <Route path="/users">
        <Layout><ProtectedRoute component={UsersManage} allowedRoles={["supervisor", "admin"]} /></Layout>
      </Route>

      <Route path="/map">
        <Layout><ProtectedRoute component={LiveMap} allowedRoles={["supervisor", "admin"]} /></Layout>
      </Route>

      <Route path="/profile">
        <Layout><ProtectedRoute component={Profile} /></Layout>
      </Route>

      <Route>
        {user ? <Layout><NotFound /></Layout> : <NotFound />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRouter />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
