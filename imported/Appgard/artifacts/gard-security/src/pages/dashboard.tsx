import { useAuth } from "@/components/auth-provider";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetGuardLocations,
  useGetRecentActivity,
  useGetRoundStats,
  useListIncidents,
  useListPanicAlerts,
  useListRounds,
  useResolvePanic,
} from "@workspace/api-client-react";
import { getListPanicAlertsQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Users,
  Route,
  AlertTriangle,
  CheckCircle,
  Clock,
  CalendarDays,
  Building2,
  Smartphone,
  WifiOff,
  Radio,
  MapPin,
  TrendingUp,
  Activity,
  Siren,
  UserCheck,
  ChevronRight,
  Eye,
  Medal,
  Star,
  FileWarning,
} from "lucide-react";

type CompanyStat = { name: string; avgScore: number; totalRounds: number; fullyCompleted: number };
type GuardPerf = { guardId: number; guardName: string; avgScore: number; totalRounds: number; startedRounds: number };

async function fetchJson<T>(url: string, token: string | null): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("fetch error");
  return res.json();
}

const priorityBadge: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  low: "bg-blue-500/20 text-blue-300 border-blue-500/40",
};

const priorityLabel: Record<string, string> = {
  critical: "Critico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

const activityTypeIcons: Record<string, any> = {
  round_started: Route,
  round_completed: CheckCircle,
  checkpoint_reached: CheckCircle,
  incident_reported: AlertTriangle,
  panic_triggered: Siren,
  panic_resolved: Shield,
};

const activityTypeColors: Record<string, string> = {
  round_started: "text-blue-400",
  round_completed: "text-green-400",
  checkpoint_reached: "text-emerald-400",
  incident_reported: "text-orange-400",
  panic_triggered: "text-red-400",
  panic_resolved: "text-primary",
};

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isGuard = user?.role === "guard";
  const isSupervisorOrAdmin = user?.role === "supervisor" || user?.role === "admin";

  const { token } = useAuth();
  const { data: summary } = useGetDashboardSummary();
  const { data: activity } = useGetRecentActivity();
  const { data: stats } = useGetRoundStats();
  const { data: rounds } = useListRounds(undefined, { query: { refetchInterval: 8000 } });
  const { data: alerts } = useListPanicAlerts({ query: { refetchInterval: 4000 } });
  const { data: incidents } = useListIncidents(undefined, { query: { refetchInterval: 10000 } });
  const { data: locations } = useGetGuardLocations({ query: { refetchInterval: 6000, enabled: isSupervisorOrAdmin } });
  const resolvePanic = useResolvePanic();

  const { data: companyStats } = useQuery<CompanyStat[]>({
    queryKey: ["dashboard-company-stats"],
    queryFn: () => fetchJson<CompanyStat[]>("/api/dashboard/company-stats", token),
    enabled: isSupervisorOrAdmin,
    refetchInterval: 30000,
  });

  const { data: guardPerf } = useQuery<GuardPerf[]>({
    queryKey: ["dashboard-guard-performance"],
    queryFn: () => fetchJson<GuardPerf[]>("/api/dashboard/guard-performance", token),
    enabled: isSupervisorOrAdmin,
    refetchInterval: 30000,
  });

  const myRounds = isGuard ? (rounds?.filter((r) => !r.assignedToId || r.assignedToId === user?.id) ?? []) : [];
  const activeRounds = rounds?.filter((r) => r.status === "active") ?? [];
  const activePanicAlerts = alerts?.filter((alert) => alert.status === "active") ?? [];
  const openIncidents = incidents?.filter((i) => i.status !== "resolved") ?? [];
  const criticalIncidents = openIncidents.filter((i) => i.priority === "critical" || i.priority === "high");
  const offlineGuards = locations?.filter((l) => l.status === "offline") ?? [];
  const guardsOnRound = locations?.filter((l) => l.status === "on_round") ?? [];

  const todayLabel = new Date().toLocaleDateString("es-CL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const handleResolvePanic = (id: number) => {
    resolvePanic.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPanicAlertsQueryKey() }),
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-7xl mx-auto">

      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-4 md:p-6 shadow-lg">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">
              {isGuard ? `Bienvenido, ${user?.name}` : user?.role === "admin" ? "Centro de Mando" : "Centro de Supervisión"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isGuard ? "Tu panel de control personal" : "Monitoreo en tiempo real de operaciones de seguridad"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isGuard && (
              <Link href="/guard-mode">
                <Button className="rounded-xl">
                  <Smartphone size={16} className="mr-2" />
                  Modo Guardia
                </Button>
              </Link>
            )}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground capitalize">
              <CalendarDays size={14} className="text-primary" />
              {todayLabel}
            </div>
          </div>
        </div>
      </div>

      {activePanicAlerts.length > 0 && (
        <div className="rounded-2xl border-2 border-red-500/60 bg-red-500/10 p-4 space-y-3 animate-pulse-slow">
          <div className="flex items-center gap-2 text-red-400">
            <Siren size={18} className="animate-pulse" />
            <span className="font-black uppercase tracking-wider text-sm">ALERTAS DE PANICO ACTIVAS ({activePanicAlerts.length})</span>
          </div>
          {activePanicAlerts.map((alert) => (
            <div key={alert.id} className="rounded-xl bg-red-500/15 border border-red-500/30 p-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-200">{(alert as any).guardName ?? "Guardia"}</p>
                <p className="text-xs text-red-300/80 mt-0.5">{alert.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(alert.createdAt).toLocaleString("es-CL")}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-red-500/40 text-red-300 hover:bg-red-500/20 shrink-0"
                onClick={() => handleResolvePanic(alert.id)}
                disabled={resolvePanic.isPending}
              >
                Resolver
              </Button>
            </div>
          ))}
        </div>
      )}

      {isSupervisorOrAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className={`glass-panel border transition-colors ${activePanicAlerts.length > 0 ? "border-red-500/50 bg-red-500/5" : "border-border"}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/15 shrink-0">
                <Siren size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-panic-alerts">{activePanicAlerts.length}</p>
                <p className="text-xs text-muted-foreground">Panico activo</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`glass-panel border transition-colors ${criticalIncidents.length > 0 ? "border-orange-500/50 bg-orange-500/5" : "border-border"}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/15 shrink-0">
                <Radio size={18} className="text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{criticalIncidents.length}</p>
                <p className="text-xs text-muted-foreground">Criticos/Altos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/15 shrink-0">
                <MapPin size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{guardsOnRound.length}</p>
                <p className="text-xs text-muted-foreground">En ronda</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`glass-panel border transition-colors ${offlineGuards.length > 0 ? "border-muted-foreground/40" : "border-border"}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary shrink-0">
                <WifiOff size={18} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{offlineGuards.length}</p>
                <p className="text-xs text-muted-foreground">Sin GPS</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {!isGuard && (
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <Users size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-total-guards">{summary.totalGuards}</p>
                    <p className="text-xs text-muted-foreground">Guardias</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {!isGuard && (
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10 shrink-0">
                    <UserCheck size={16} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-active-guards">{summary.activeGuards}</p>
                    <p className="text-xs text-muted-foreground">Activos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                  <Route size={16} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-active-rounds">{summary.activeRounds}</p>
                  <p className="text-xs text-muted-foreground">Rondas Activas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                  <CheckCircle size={16} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-completed-today">{summary.completedRoundsToday}</p>
                  <p className="text-xs text-muted-foreground">Completadas Hoy</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10 shrink-0">
                  <AlertTriangle size={16} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-open-incidents">{summary.openIncidents}</p>
                  <p className="text-xs text-muted-foreground">Incidentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10 shrink-0">
                  <Siren size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.activePanicAlerts}</p>
                  <p className="text-xs text-muted-foreground">Alertas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isGuard && (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guard-mode">
            <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/20 via-primary/10 to-card p-4 flex flex-col gap-3 h-full cursor-pointer hover:border-primary/70 transition-colors">
              <div className="p-2.5 rounded-xl bg-primary/20 w-fit">
                <Smartphone size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm">Modo Guardia</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Panico, GPS y rondas</p>
              </div>
            </div>
          </Link>
          <Link href="/incidents">
            <div className="rounded-2xl border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-card p-4 flex flex-col gap-3 h-full cursor-pointer hover:border-orange-500/60 transition-colors">
              <div className="p-2.5 rounded-xl bg-orange-500/20 w-fit">
                <FileWarning size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="font-bold text-sm">Incidentes</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Ver y reportar</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {isGuard && myRounds.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Route size={16} className="text-primary" />
                Mis Rondas Asignadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myRounds.map((r) => (
                <Link key={r.id} href={`/rounds/${r.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border hover:border-primary/30 transition-colors cursor-pointer" data-testid={`card-round-${r.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.name}</p>
                      <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                        <Building2 size={10} /> {(r as any).companyName}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: r.totalCheckpoints > 0 ? `${(r.completedCheckpoints / r.totalCheckpoints) * 100}%` : "0%" }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{r.completedCheckpoints}/{r.totalCheckpoints}</span>
                      </div>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <Badge variant="outline" className={r.status === "completed" ? "text-green-400 border-green-500/40" : r.status === "active" ? "text-blue-400 border-blue-500/40" : "text-muted-foreground"}>
                        {r.status === "pending" ? "Pendiente" : r.status === "active" ? "En Curso" : "Completada"}
                      </Badge>
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {isSupervisorOrAdmin && activeRounds.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity size={16} className="text-blue-400" />
                  Rondas en Curso
                </span>
                <span className="text-xs text-muted-foreground font-normal">{activeRounds.length} activas</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeRounds.map((r) => {
                const progress = r.totalCheckpoints > 0 ? Math.round((r.completedCheckpoints / r.totalCheckpoints) * 100) : 0;
                return (
                  <Link key={r.id} href={`/rounds/${r.id}`}>
                    <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{r.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 size={10} /> {r.companyName}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-blue-400">{progress}%</p>
                          <p className="text-[10px] text-muted-foreground">{r.completedCheckpoints}/{r.totalCheckpoints} pts</p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
              <Link href="/rounds">
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground mt-1">
                  Ver todas las rondas <ChevronRight size={14} className="ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {isSupervisorOrAdmin && locations && locations.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  Estado de Guardias
                </span>
                <span className="text-xs text-muted-foreground font-normal">{locations.length} registrados</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {locations.map((loc) => (
                <div key={loc.guardId} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/20 border border-border">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${loc.status === "on_round" ? "bg-blue-400 animate-pulse" : loc.status === "available" ? "bg-green-400" : "bg-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{loc.guardName}</p>
                    <p className="text-[10px] text-muted-foreground">{loc.roundName ?? "Sin ronda"}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${loc.status === "on_round" ? "text-blue-400 border-blue-500/40" : loc.status === "available" ? "text-green-400 border-green-500/40" : "text-muted-foreground"}`}>
                    {loc.status === "on_round" ? "En ronda" : loc.status === "available" ? "Disponible" : "Sin señal"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {isSupervisorOrAdmin && openIncidents.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-orange-400" />
                  Incidentes Abiertos
                </span>
                <Link href="/incidents">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-auto p-1">
                    <Eye size={13} className="mr-1" /> Ver todos
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {openIncidents.slice(0, 5).map((inc) => (
                <div key={inc.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/20 border border-border">
                  <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${inc.priority === "critical" ? "bg-red-400 animate-pulse" : inc.priority === "high" ? "bg-orange-400" : inc.priority === "medium" ? "bg-yellow-400" : "bg-blue-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inc.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(inc.createdAt).toLocaleString("es-CL")}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 border ${priorityBadge[inc.priority]}`}>
                    {priorityLabel[inc.priority]}
                  </Badge>
                </div>
              ))}
              {openIncidents.length > 5 && (
                <Link href="/incidents">
                  <p className="text-xs text-center text-muted-foreground pt-1 hover:text-primary transition-colors cursor-pointer">+{openIncidents.length - 5} incidentes mas</p>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {stats && isSupervisorOrAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                Estadisticas Semanales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
                  <p className="text-2xl font-bold text-primary">{stats.completionRate}%</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Puntaje prom. checkpoints</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/40 text-center">
                  <p className="text-2xl font-bold">{stats.averageCompletionTime} min</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tiempo promedio</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Puntaje checkpoint por dia</p>
                {(stats.roundsByDay as any[]).map((d) => (
                  <div key={d.day} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-8 shrink-0 font-mono">{d.day}</span>
                    <div className="flex-1 h-2 bg-secondary/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: d.avgScore != null ? `${d.avgScore}%` : d.total > 0 ? `${(d.completed / d.total) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 font-mono">
                      {d.avgScore != null ? `${d.avgScore}%` : `${d.completed}/${d.total}`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isSupervisorOrAdmin && companyStats && companyStats.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Medal size={16} className="text-yellow-400" />
                Ranking por Empresa
                <span className="text-xs text-muted-foreground font-normal ml-auto">% checkpoints reales</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {companyStats.map((co, idx) => (
                <div key={co.name} className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-5 shrink-0 ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-orange-400" : "text-muted-foreground"}`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{co.name}</p>
                      <span className={`text-sm font-bold shrink-0 ${co.avgScore >= 90 ? "text-green-400" : co.avgScore >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                        {co.avgScore}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${co.avgScore >= 90 ? "bg-green-500" : co.avgScore >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${co.avgScore}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{co.fullyCompleted}/{co.totalRounds} rondas 100% completadas</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {isSupervisorOrAdmin && guardPerf && guardPerf.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star size={16} className="text-primary" />
                Desempeno de Guardias
                <span className="text-xs text-muted-foreground font-normal ml-auto">% checkpoints visitados</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {guardPerf.map((g, idx) => (
                <div key={g.guardId} className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-5 shrink-0 ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-orange-400" : "text-muted-foreground"}`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{g.guardName}</p>
                      <span className={`text-sm font-bold shrink-0 ${g.avgScore >= 90 ? "text-green-400" : g.avgScore >= 60 ? "text-yellow-400" : g.startedRounds === 0 ? "text-muted-foreground" : "text-red-400"}`}>
                        {g.startedRounds === 0 ? "—" : `${g.avgScore}%`}
                      </span>
                    </div>
                    {g.startedRounds > 0 && (
                      <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${g.avgScore >= 90 ? "bg-green-500" : g.avgScore >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${g.avgScore}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">{g.startedRounds} rondas iniciadas de {g.totalRounds} asignadas</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock size={16} className="text-muted-foreground" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {!activity?.length && (
                <p className="text-sm text-muted-foreground py-2">Sin actividad reciente</p>
              )}
              {activity?.slice(0, 8).map((a) => {
                const Icon = activityTypeIcons[a.type] || Clock;
                const colorClass = activityTypeColors[a.type] || "text-muted-foreground";
                return (
                  <div key={a.id} className="flex items-start gap-3 text-sm" data-testid={`activity-${a.id}`}>
                    <div className={`p-1.5 rounded-lg bg-secondary/50 mt-0.5 shrink-0 ${colorClass}`}>
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-tight">{a.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{a.userName} · {new Date(a.createdAt).toLocaleString("es-CL")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
