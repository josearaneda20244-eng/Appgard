import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLocationBroadcast } from "@/hooks/use-location-broadcast";
import { useRoundNotifications } from "@/hooks/use-round-notifications";
import { Button } from "@/components/ui/button";
import { useListIncidents, useListPanicAlerts, useLogout, useTriggerPanic } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  LayoutDashboard,
  Route as RouteIcon,
  AlertTriangle,
  MessageSquare,
  Map as MapIcon,
  Users,
  User,
  LogOut,
  Menu,
  X,
  Smartphone,
  Bell,
  FileText,
  Building2,
  Siren,
  CheckCircle,
} from "lucide-react";
import { Link, useLocation } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout: clearAuth } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const triggerPanic = useTriggerPanic();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panicSending, setPanicSending] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useLocationBroadcast();
  useRoundNotifications();

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
  }, [location]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearAuth();
      },
    });
  };

  const handleQuickPanic = () => {
    if (panicSending) return;
    setPanicSending(true);

    const sendAlert = (latitude: number, longitude: number, locationNote?: string) => {
      triggerPanic.mutate(
        { data: { latitude, longitude, message: locationNote } },
        {
          onSuccess: () => {
            toast({ title: "ALERTA DE PANICO ENVIADA", description: "Tu supervisor ha sido notificado" });
            setPanicSending(false);
          },
          onError: () => {
            toast({ variant: "destructive", title: "No se pudo enviar la alerta" });
            setPanicSending(false);
          },
        },
      );
    };

    const fallbackLocation = () => {
      const saved = localStorage.getItem("lastKnownLocation");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          sendAlert(parsed.latitude, parsed.longitude, "Ubicacion aproximada: ultima posicion registrada");
          return;
        } catch {}
      }
      sendAlert(0, 0, "GPS no disponible: alerta enviada sin ubicacion exacta");
    };

    if (!navigator.geolocation) {
      fallbackLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        localStorage.setItem("lastKnownLocation", JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          at: new Date().toISOString(),
        }));
        sendAlert(pos.coords.latitude, pos.coords.longitude);
      },
      fallbackLocation,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
    );
  };

  if (!user) return <>{children}</>;

  const isGuard = user.role === "guard";
  const isSupervisor = user.role === "supervisor" || user.role === "admin";

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/guard-mode", label: "Modo Guardia", icon: Smartphone, show: isGuard },
    { href: "/rounds", label: "Rondas", icon: RouteIcon, show: true },
    { href: "/incidents", label: "Incidentes", icon: AlertTriangle, show: true },
    { href: "/chat", label: "Chat", icon: MessageSquare, show: true },
    { href: "/panic", label: "Alertas Panico", icon: Siren, show: isSupervisor },
    { href: "/map", label: "Mapa en Vivo", icon: MapIcon, show: isSupervisor },
    { href: "/reports", label: "Reportes", icon: FileText, show: isSupervisor },
    { href: "/companies", label: "Empresas", icon: Building2, show: isSupervisor },
    { href: "/users", label: "Equipo", icon: Users, show: isSupervisor },
    { href: "/profile", label: "Mi Perfil", icon: User, show: isGuard },
  ].filter((item) => item.show);

  const roleLabel =
    user.role === "admin" ? "Administrador" : user.role === "supervisor" ? "Supervisor" : "Guardia";

  const SidebarContent = () => (
    <>
      <div className="p-4 border-b border-border flex items-center gap-3 flex-shrink-0">
        <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
          <Shield size={20} />
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-lg tracking-tight uppercase">GARD</h1>
          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
            Command Center
          </p>
        </div>
        <button
          className="lg:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setSidebarOpen(false)}
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
              location === item.href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}

        {isGuard && (
          <div className="mt-6">
            <button
              type="button"
              onClick={handleQuickPanic}
              disabled={panicSending}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-md text-sm font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-70 transition-colors shadow-lg animate-pulse hover:animate-none"
            >
              <AlertTriangle size={18} />
              {panicSending ? "ENVIANDO..." : "BOTON DE PANICO"}
            </button>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-bold text-sm flex-shrink-0">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground hover:text-foreground text-sm"
          onClick={handleLogout}
        >
          <LogOut size={15} className="mr-2" />
          Cerrar Sesion
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-[100svh] overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 lg:hidden"
          style={{ zIndex: 99998 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-card border-r border-border flex flex-col
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0 lg:w-64
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ zIndex: sidebarOpen ? 99999 : undefined }}
      >
        <SidebarContent />
      </aside>

      <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
        <div className="lg:hidden flex items-center gap-2 px-3 py-3 border-b border-border bg-card/95 backdrop-blur sticky top-0" style={{ zIndex: 500 }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary/60 flex-shrink-0"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
              <Shield size={14} className="text-primary-foreground" />
            </div>
            <span className="font-bold text-sm uppercase tracking-wide truncate">GARD Security</span>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {isSupervisor && (
              <div className="relative">
                <NotificationBell onClick={() => setNotifOpen((v) => !v)} />
              </div>
            )}
            {isGuard && (
              <button
                type="button"
                onClick={handleQuickPanic}
                disabled={panicSending}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-destructive text-destructive-foreground disabled:opacity-70 animate-pulse hover:animate-none flex-shrink-0 shadow-lg shadow-destructive/20"
              >
                <AlertTriangle size={14} />
                {panicSending ? "..." : "PANICO"}
              </button>
            )}
          </div>
        </div>

        {notifOpen && isSupervisor && (
          <div className="lg:hidden">
            <NotificationPanel onClose={() => setNotifOpen(false)} />
          </div>
        )}

        {isSupervisor && <OperationalAlerts />}
        <div className="min-h-full min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}

function NotificationBell({ onClick }: { onClick: () => void }) {
  const { data: alerts } = useListPanicAlerts({ query: { refetchInterval: 5000 } });
  const { data: incidents } = useListIncidents(undefined, { query: { refetchInterval: 10000 } });

  const activeAlerts = alerts?.filter((a) => a.status === "active") ?? [];
  const criticalIncidents = incidents?.filter((i) => i.status !== "resolved" && (i.priority === "critical" || i.priority === "high")) ?? [];
  const total = activeAlerts.length + criticalIncidents.length;

  return (
    <button
      onClick={onClick}
      className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60"
    >
      <Bell size={20} className={total > 0 ? "text-red-400" : ""} />
      {total > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
          {total > 9 ? "9+" : total}
        </span>
      )}
    </button>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data: alerts } = useListPanicAlerts({ query: { refetchInterval: 5000 } });
  const { data: incidents } = useListIncidents(undefined, { query: { refetchInterval: 10000 } });

  const activeAlerts = alerts?.filter((a) => a.status === "active") ?? [];
  const criticalIncidents = incidents?.filter((i) => i.status !== "resolved" && (i.priority === "critical" || i.priority === "high")) ?? [];
  const recentIncidents = incidents?.filter((i) => i.status !== "resolved").slice(0, 5) ?? [];

  const total = activeAlerts.length + criticalIncidents.length;

  return (
    <div className="border-b border-border bg-card/98 backdrop-blur px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-sm flex items-center gap-2">
          <Bell size={14} className="text-primary" />
          Notificaciones
          {total > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{total}</span>
          )}
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      {total === 0 && recentIncidents.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <CheckCircle size={20} className="text-green-400" />
          Sin alertas activas
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {activeAlerts.map((alert) => (
            <Link key={alert.id} href="/panic" onClick={onClose}>
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/15 cursor-pointer">
                <Siren size={14} className="text-red-400 mt-0.5 flex-shrink-0 animate-pulse" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-red-300">Alerta de panico activa</p>
                  <p className="text-xs text-muted-foreground truncate">{alert.userName}</p>
                </div>
              </div>
            </Link>
          ))}
          {criticalIncidents.map((inc) => (
            <Link key={inc.id} href="/incidents" onClick={onClose}>
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/15 cursor-pointer">
                <AlertTriangle size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-orange-300 truncate">{inc.title}</p>
                  <p className="text-xs text-muted-foreground">{inc.priority === "critical" ? "Critico" : "Alta prioridad"}</p>
                </div>
              </div>
            </Link>
          ))}
          {recentIncidents.filter((i) => i.priority !== "critical" && i.priority !== "high").slice(0, 3).map((inc) => (
            <Link key={inc.id} href="/incidents" onClick={onClose}>
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 cursor-pointer">
                <AlertTriangle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{inc.title}</p>
                  <p className="text-xs text-muted-foreground">{inc.reportedByName}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function OperationalAlerts() {
  const { data: alerts } = useListPanicAlerts({ query: { refetchInterval: 5000 } });
  const { data: incidents } = useListIncidents(undefined, { query: { refetchInterval: 10000 } });
  const activePanicAlerts = alerts?.filter((alert) => alert.status === "active") ?? [];
  const criticalIncidents = incidents?.filter((incident) => incident.status !== "resolved" && (incident.priority === "critical" || incident.priority === "high")) ?? [];

  if (activePanicAlerts.length === 0 && criticalIncidents.length === 0) return null;

  return (
    <div className="border-b border-red-500/30 bg-red-950/30 px-3 py-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2 text-sm">
          <Bell size={16} className="text-red-400 mt-0.5 animate-pulse flex-shrink-0" />
          <div>
            <p className="font-bold text-red-200">Atencion operativa requerida</p>
            <p className="text-xs text-red-200/80">
              {activePanicAlerts.length > 0 && `${activePanicAlerts.length} alerta${activePanicAlerts.length !== 1 ? "s" : ""} de panico activa${activePanicAlerts.length !== 1 ? "s" : ""}`}
              {activePanicAlerts.length > 0 && criticalIncidents.length > 0 && " · "}
              {criticalIncidents.length > 0 && `${criticalIncidents.length} incidente${criticalIncidents.length !== 1 ? "s" : ""} de alta prioridad`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {activePanicAlerts.length > 0 && (
            <Link href="/panic" className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700">
              Ver panico
            </Link>
          )}
          {criticalIncidents.length > 0 && (
            <Link href="/incidents" className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-bold text-red-100 hover:bg-red-500/10">
              Ver incidentes
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
