import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { ElapsedTimer } from "@/components/elapsed-timer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getListIncidentsQueryKey,
  getListPanicAlertsQueryKey,
  getListRoundsQueryKey,
  useCompleteRound,
  useCreateIncident,
  useGetRecentActivity,
  useListIncidents,
  useListRounds,
  useStartRound,
  useTriggerPanic,
} from "@workspace/api-client-react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  FileWarning,
  Loader2,
  MapPin,
  Navigation,
  Play,
  Shield,
  Wifi,
  WifiOff,
  Zap,
  ChevronRight,
  Activity,
  Phone,
  Radio,
  TrendingUp,
  Star,
  CalendarClock,
  ClipboardList,
  Route,
} from "lucide-react";

const quickIncidentOptions = [
  { title: "Acceso no autorizado", priority: "high", icon: "🚨", description: "Reporte rapido desde Modo Guardia: acceso no autorizado detectado." },
  { title: "Persona sospechosa", priority: "high", icon: "👤", description: "Reporte rapido desde Modo Guardia: persona sospechosa en el area." },
  { title: "Puerta o perimetro abierto", priority: "medium", icon: "🚪", description: "Reporte rapido desde Modo Guardia: punto vulnerable abierto o sin cierre." },
  { title: "Dano en instalaciones", priority: "medium", icon: "⚠️", description: "Reporte rapido desde Modo Guardia: dano o deterioro detectado en instalaciones." },
  { title: "Situacion de robo", priority: "critical", icon: "🔴", description: "Reporte rapido desde Modo Guardia: situacion de robo o asalto en progreso." },
  { title: "Novedad menor", priority: "low", icon: "📝", description: "Reporte rapido desde Modo Guardia: novedad menor registrada durante el turno." },
];

const priorityColors: Record<string, string> = {
  critical: "border-red-500/60 bg-red-500/10 text-red-300",
  high: "border-orange-500/60 bg-orange-500/10 text-orange-300",
  medium: "border-yellow-500/60 bg-yellow-500/10 text-yellow-300",
  low: "border-blue-500/40 bg-blue-500/5 text-blue-300",
};

const priorityLabel: Record<string, string> = {
  critical: "Critico", high: "Alto", medium: "Medio", low: "Bajo",
};

function OnDutyStatusCard({ shiftStart, guardName }: { shiftStart: string; guardName: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const timeStr = now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <Card className="flex-1 min-h-[180px] border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden relative">
      <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">En servicio</span>
      </div>
      <CardContent className="p-4 flex flex-col h-full justify-between gap-4 pt-10">
        <div>
          <p className="text-3xl font-black font-mono text-foreground tracking-tight tabular-nums">{timeStr}</p>
          <p className="text-xs text-muted-foreground mt-1 capitalize">{dateStr}</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock size={11} className="text-primary" />
            <span>Tiempo en turno: </span>
            <ElapsedTimer startedAt={shiftStart} className="text-primary font-semibold" />
          </div>
          <div className="rounded-xl bg-secondary/30 px-3 py-2.5 flex items-center gap-2">
            <Shield size={14} className="text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{guardName}</span> — Permanece atento a tu zona de patrullaje. Reporta cualquier novedad.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function scoreColor(score: number) {
  if (score >= 90) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score > 0) return "text-orange-400";
  return "text-muted-foreground";
}

function scoreBarColor(score: number) {
  if (score >= 90) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-orange-500";
}

export default function GuardMode() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [panicSending, setPanicSending] = useState(false);
  const [panicHeld, setPanicHeld] = useState(false);
  const [panicProgress, setPanicProgress] = useState(0);
  const panicTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const panicHoldDuration = 1500;
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [customIncident, setCustomIncident] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"checking" | "ok" | "error">("checking");
  const [shiftStart] = useState(() => {
    const saved = sessionStorage.getItem("shiftStart");
    if (saved) return saved;
    const now = new Date().toISOString();
    sessionStorage.setItem("shiftStart", now);
    return now;
  });

  const { data: rounds } = useListRounds(undefined, { query: { refetchInterval: 8000 } });
  const { data: activity } = useGetRecentActivity({ query: { refetchInterval: 15000 } });
  const { data: incidents } = useListIncidents(undefined, { query: { refetchInterval: 15000 } });
  const startRound = useStartRound();
  const completeRound = useCompleteRound();
  const triggerPanic = useTriggerPanic();
  const createIncident = useCreateIncident();

  const myRounds = useMemo(
    () => rounds?.filter((round) => !round.assignedToId || round.assignedToId === user?.id) ?? [],
    [rounds, user?.id],
  );
  const activeRound = myRounds.find((round) => round.status === "active");
  const nextRound = myRounds.find((round) => round.status === "pending");
  const pendingRounds = myRounds.filter((r) => r.status === "pending");
  const completedRounds = myRounds.filter((r) => r.status === "completed");
  const completedToday = completedRounds.filter((round) => {
    if (!round.completedAt) return false;
    return new Date(round.completedAt).toDateString() === new Date().toDateString();
  });

  const myIncidentsToday = useMemo(() => {
    if (!incidents) return [];
    const today = new Date().toDateString();
    return incidents.filter((i) => new Date(i.createdAt).toDateString() === today);
  }, [incidents]);

  const myActivity = useMemo(() => {
    if (!activity || !user) return [];
    return activity.filter((a) => (a as any).userName === user.name).slice(0, 6);
  }, [activity, user]);

  const totalCheckpointsToday = completedToday.reduce((sum, r) => sum + r.totalCheckpoints, 0);
  const visitedCheckpointsToday = completedToday.reduce((sum, r) => sum + r.completedCheckpoints, 0);
  const avgScoreToday = totalCheckpointsToday > 0
    ? Math.round((visitedCheckpointsToday / totalCheckpointsToday) * 100)
    : 0;

  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus("error"); return; }
    navigator.geolocation.getCurrentPosition(
      () => setGpsStatus("ok"),
      () => setGpsStatus("error"),
      { timeout: 5000 },
    );
  }, []);

  const refreshOperationalQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListRoundsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListPanicAlertsQueryKey() });
  };

  const withLocation = (callback: (latitude?: number, longitude?: number, note?: string) => void) => {
    const fallback = () => {
      const saved = localStorage.getItem("lastKnownLocation");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          callback(parsed.latitude, parsed.longitude, "Ubicacion aproximada: ultima posicion registrada");
          return;
        } catch {}
      }
      callback(undefined, undefined, "GPS no disponible");
    };
    if (!navigator.geolocation) { fallback(); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        localStorage.setItem("lastKnownLocation", JSON.stringify({
          latitude: pos.coords.latitude, longitude: pos.coords.longitude, at: new Date().toISOString(),
        }));
        callback(pos.coords.latitude, pos.coords.longitude);
      },
      fallback,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
    );
  };

  const startPanicHold = () => {
    setPanicHeld(true);
    setPanicProgress(0);
    const start = Date.now();
    panicTimer.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min((elapsed / panicHoldDuration) * 100, 100);
      setPanicProgress(progress);
      if (elapsed >= panicHoldDuration) {
        clearInterval(panicTimer.current!);
        setPanicHeld(false);
        setPanicProgress(0);
        firePanic();
      }
    }, 30);
  };

  const cancelPanicHold = () => {
    if (panicTimer.current) clearInterval(panicTimer.current);
    setPanicHeld(false);
    setPanicProgress(0);
  };

  const firePanic = () => {
    if (panicSending) return;
    setPanicSending(true);
    withLocation((latitude, longitude, note) => {
      triggerPanic.mutate(
        { data: { latitude: latitude ?? 0, longitude: longitude ?? 0, message: note ? `${note} - Activada desde Modo Guardia` : "Activada desde Modo Guardia" } },
        {
          onSuccess: () => {
            refreshOperationalQueries();
            toast({ title: "🚨 ALERTA DE PANICO ENVIADA", description: "Supervisor notificado. Mantente en posicion segura." });
            setPanicSending(false);
          },
          onError: () => {
            toast({ variant: "destructive", title: "No se pudo enviar la alerta", description: "Intenta de nuevo o llama directamente." });
            setPanicSending(false);
          },
        },
      );
    });
  };

  const reportIncident = (incident: { title: string; priority: string; description: string }) => {
    withLocation((latitude, longitude, note) => {
      createIncident.mutate(
        { data: { title: incident.title, priority: incident.priority as any, description: [incident.description, customIncident, note].filter(Boolean).join(" "), latitude, longitude } },
        {
          onSuccess: () => {
            refreshOperationalQueries();
            toast({ title: "Incidente reportado", description: incident.title });
            setIncidentOpen(false);
            setCustomIncident("");
          },
          onError: () => toast({ variant: "destructive", title: "No se pudo reportar el incidente" }),
        },
      );
    });
  };

  const startNextRound = (round = nextRound) => {
    if (!round) return;
    startRound.mutate({ id: round.id }, {
      onSuccess: () => { refreshOperationalQueries(); toast({ title: "Ronda iniciada", description: round.name }); },
      onError: () => toast({ variant: "destructive", title: "No se pudo iniciar la ronda" }),
    });
  };

  const finishActiveRound = () => {
    if (!activeRound) return;
    completeRound.mutate({ id: activeRound.id }, {
      onSuccess: () => { refreshOperationalQueries(); toast({ title: "Ronda completada ✓", description: activeRound.name }); },
      onError: () => toast({ variant: "destructive", title: "No se pudo completar la ronda" }),
    });
  };

  const activeProgress = activeRound && activeRound.totalCheckpoints > 0
    ? Math.round((activeRound.completedCheckpoints / activeRound.totalCheckpoints) * 100)
    : 0;

  return (
    <div className="flex flex-col min-h-[calc(100svh-57px)] bg-gradient-to-b from-slate-950 via-background to-background p-3 pb-8">
      <div className="max-w-5xl mx-auto flex flex-col flex-1 gap-3">

        {/* ── Header ── */}
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card to-card p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Modo Guardia</span>
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              </div>
              <h1 className="text-xl font-bold truncate">{user?.name}</h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock size={11} />
                  Turno: <ElapsedTimer startedAt={shiftStart} className="text-primary font-semibold ml-1" />
                </span>
                <span className={`text-xs flex items-center gap-1 ${gpsStatus === "ok" ? "text-green-400" : gpsStatus === "error" ? "text-red-400" : "text-yellow-400"}`}>
                  {gpsStatus === "ok" ? <Wifi size={11} /> : <WifiOff size={11} />}
                  {gpsStatus === "ok" ? "GPS activo" : gpsStatus === "error" ? "Sin GPS" : "Verificando..."}
                </span>
              </div>
            </div>
            <div className="rounded-2xl bg-primary/20 border border-primary/30 p-3 text-primary shrink-0">
              <Shield size={22} />
            </div>
          </div>
        </div>

        {/* ── Panic button ── */}
        <div
          className={`relative rounded-2xl overflow-hidden select-none ${panicSending ? "opacity-70" : ""}`}
          onMouseDown={startPanicHold}
          onMouseUp={cancelPanicHold}
          onMouseLeave={cancelPanicHold}
          onTouchStart={startPanicHold}
          onTouchEnd={cancelPanicHold}
        >
          <button
            className="w-full min-h-[80px] bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-2xl flex flex-col items-center justify-center gap-1 shadow-2xl shadow-red-950/60 border border-red-500/50 transition-colors duration-100 cursor-pointer"
            disabled={panicSending}
          >
            {panicSending ? (
              <><Loader2 className="h-7 w-7 animate-spin" /><span className="text-sm font-bold tracking-widest">ENVIANDO...</span></>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Zap size={20} className={panicHeld ? "animate-pulse" : ""} />
                  <span className="text-xl font-black tracking-widest">PANICO</span>
                  <Zap size={20} className={panicHeld ? "animate-pulse" : ""} />
                </div>
                <span className="text-[10px] text-red-200 font-semibold tracking-wider">
                  {panicHeld ? "SUELTA PARA CANCELAR..." : "MANTENER PRESIONADO PARA ACTIVAR"}
                </span>
              </>
            )}
          </button>
          {panicHeld && (
            <div className="absolute bottom-0 left-0 h-1.5 bg-white/60 rounded-b-2xl transition-all duration-75" style={{ width: `${panicProgress}%` }} />
          )}
        </div>

        {/* ── Main 2-column grid on desktop ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 md:items-stretch">

          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-3">

            {/* Ronda actual / próxima */}
            <Card className={`border-2 transition-colors ${activeRound ? "border-blue-500/50 bg-blue-500/5" : nextRound ? "border-primary/30 bg-primary/5" : "border-border"}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${activeRound ? "text-blue-300" : "text-muted-foreground"}`}>
                      {activeRound ? "● Ronda en curso" : nextRound ? "Proxima ronda" : "Sin ronda pendiente"}
                    </span>
                    <h2 className="text-lg font-bold mt-0.5 truncate">
                      {activeRound?.name ?? nextRound?.name ?? "Sin rondas asignadas"}
                    </h2>
                    {(activeRound ?? nextRound) && (
                      <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                        <Building2 size={11} />
                        {(activeRound ?? nextRound)?.companyName}
                      </p>
                    )}
                    {!activeRound && !nextRound && completedRounds.length > 0 && (
                      <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                        <CheckCircle2 size={11} />
                        Todas las rondas completadas
                      </p>
                    )}
                    {!activeRound && !nextRound && completedRounds.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Espera instrucciones del supervisor</p>
                    )}
                  </div>
                  {(activeRound ?? nextRound) && (
                    <Badge variant="outline" className={activeRound ? "text-blue-300 border-blue-500/50 shrink-0" : "text-primary border-primary/50 shrink-0"}>
                      {activeRound ? "Activa" : "Pendiente"}
                    </Badge>
                  )}
                </div>

                {activeRound && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin size={11} /> Puntos</span>
                      <span className="font-bold text-foreground">{activeRound.completedCheckpoints} / {activeRound.totalCheckpoints}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500" style={{ width: `${activeProgress}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-secondary/40 p-2.5 flex items-center gap-2">
                        <Activity size={14} className="text-blue-300 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Tiempo</p>
                          <ElapsedTimer startedAt={activeRound.startedAt} className="text-sm font-bold text-blue-300" />
                        </div>
                      </div>
                      <Link href={`/rounds/${activeRound.id}`}>
                        <Button variant="outline" size="sm" className="h-full w-full rounded-xl border-blue-500/30 text-blue-300">
                          <Navigation size={14} className="mr-1.5" />Ver mapa
                        </Button>
                      </Link>
                    </div>
                    <Button variant="outline" className="w-full min-h-11 rounded-xl font-bold border-green-500/40 text-green-300 hover:bg-green-500/10" onClick={finishActiveRound} disabled={completeRound.isPending}>
                      {completeRound.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Finalizar ronda
                    </Button>
                  </div>
                )}

                {!activeRound && nextRound && (
                  <Button className="w-full min-h-11 rounded-xl text-base font-bold" onClick={() => startNextRound(nextRound)} disabled={startRound.isPending}>
                    {startRound.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Iniciar ronda
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Resumen del turno */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <TrendingUp size={14} />
                  Resumen del turno
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="rounded-xl bg-secondary/30 p-3 text-center">
                    <Route className="text-blue-400 mx-auto mb-1" size={16} />
                    <p className="text-xl font-bold">{completedToday.length}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Rondas hoy</p>
                  </div>
                  <div className="rounded-xl bg-secondary/30 p-3 text-center">
                    <MapPin className="text-green-400 mx-auto mb-1" size={16} />
                    <p className="text-xl font-bold">{visitedCheckpointsToday}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Puntos visitados</p>
                  </div>
                  <div className="rounded-xl bg-secondary/30 p-3 text-center">
                    <Star className={`mx-auto mb-1 ${scoreColor(avgScoreToday)}`} size={16} />
                    <p className={`text-xl font-bold ${scoreColor(avgScoreToday)}`}>
                      {totalCheckpointsToday > 0 ? `${avgScoreToday}%` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Puntaje</p>
                  </div>
                </div>
                {totalCheckpointsToday > 0 && (
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Cobertura de checkpoints hoy</span>
                      <span>{visitedCheckpointsToday}/{totalCheckpointsToday}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${scoreBarColor(avgScoreToday)}`} style={{ width: `${avgScoreToday}%` }} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reportar incidente */}
            <Button
              variant="secondary"
              className="w-full min-h-14 rounded-2xl text-base font-bold border border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/15"
              onClick={() => setIncidentOpen(true)}
            >
              <FileWarning className="mr-2 h-5 w-5" />
              Reportar Incidente
            </Button>

            {/* Contactos de emergencia */}
            <Card className="border-border/50">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Phone size={12} />
                  Contacto de emergencia
                </p>
                <div className="rounded-xl bg-secondary/30 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-sm">Central de supervisores</span>
                  <span className="text-sm font-bold text-primary">+56 9 0000 0000</span>
                </div>
                <div className="rounded-xl bg-secondary/30 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-sm">Carabineros</span>
                  <span className="text-sm font-bold text-red-400">133</span>
                </div>
                <div className="rounded-xl bg-secondary/30 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-sm">Bomberos</span>
                  <span className="text-sm font-bold text-orange-400">132</span>
                </div>
                <div className="rounded-xl bg-secondary/30 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-sm">SAMU</span>
                  <span className="text-sm font-bold text-blue-400">131</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-3">

            {/* Rondas pendientes */}
            {pendingRounds.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <Radio size={14} />
                    Rondas pendientes
                    <Badge variant="outline" className="ml-auto text-[10px]">{pendingRounds.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {pendingRounds.map((round) => (
                    <div key={round.id} className="rounded-xl bg-secondary/30 border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{round.name}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 size={9} />{round.companyName}
                          </p>
                          <p className="text-[10px] text-primary mt-0.5">{round.totalCheckpoints} puntos de control</p>
                        </div>
                        {!activeRound && (
                          <Button size="sm" className="rounded-lg h-8 shrink-0" onClick={() => startNextRound(round)} disabled={startRound.isPending}>
                            <Play size={12} className="mr-1" />Iniciar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Historial de rondas del turno */}
            {completedRounds.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <ClipboardList size={14} />
                    Historial de rondas
                    <Badge variant="outline" className="ml-auto text-[10px] text-green-400 border-green-500/40">{completedRounds.length} completadas</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {completedRounds.slice(0, 6).map((round) => {
                    const score = round.totalCheckpoints > 0
                      ? Math.round((round.completedCheckpoints / round.totalCheckpoints) * 100)
                      : 0;
                    const isToday = round.completedAt && new Date(round.completedAt).toDateString() === new Date().toDateString();
                    return (
                      <Link key={round.id} href={`/rounds/${round.id}`}>
                        <div className="rounded-xl bg-secondary/20 border border-border hover:border-primary/30 transition-colors p-3 cursor-pointer">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{round.name}</p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Building2 size={9} />{round.companyName}
                                {isToday && round.completedAt && (
                                  <span className="ml-1">· {new Date(round.completedAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
                                )}
                              </p>
                            </div>
                            <span className={`text-sm font-bold shrink-0 ${scoreColor(score)}`}>
                              {round.totalCheckpoints > 0 ? `${score}%` : "—"}
                            </span>
                          </div>
                          {round.totalCheckpoints > 0 && (
                            <>
                              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${scoreBarColor(score)}`} style={{ width: `${score}%` }} />
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">{round.completedCheckpoints}/{round.totalCheckpoints} puntos visitados</p>
                            </>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Incidentes reportados hoy */}
            {myIncidentsToday.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle size={14} className="text-orange-400" />
                    Incidentes reportados hoy
                    <Badge variant="outline" className="ml-auto text-[10px] text-orange-400 border-orange-500/40">{myIncidentsToday.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {myIncidentsToday.slice(0, 4).map((inc) => (
                    <div key={inc.id} className="rounded-xl bg-secondary/20 border border-border p-3 flex items-start gap-3">
                      <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${inc.priority === "critical" ? "bg-red-400 animate-pulse" : inc.priority === "high" ? "bg-orange-400" : inc.priority === "medium" ? "bg-yellow-400" : "bg-blue-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{inc.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(inc.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          <span className={`${inc.status === "resolved" ? "text-green-400" : "text-yellow-400"}`}>
                            {inc.status === "resolved" ? "Resuelto" : "Abierto"}
                          </span>
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 border ${priorityColors[inc.priority]}`}>
                        {priorityLabel[inc.priority]}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Actividad del turno */}
            {myActivity.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <CalendarClock size={14} />
                    Actividad del turno
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2.5">
                  {myActivity.map((a) => (
                    <div key={a.id} className="flex items-start gap-2.5 text-sm">
                      <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${a.type === "round_completed" ? "bg-green-500/15 text-green-400" : a.type === "checkpoint_reached" ? "bg-blue-500/15 text-blue-400" : a.type === "incident_reported" ? "bg-orange-500/15 text-orange-400" : "bg-secondary/50 text-muted-foreground"}`}>
                        {a.type === "round_completed" ? <CheckCircle2 size={12} /> : a.type === "checkpoint_reached" ? <MapPin size={12} /> : a.type === "incident_reported" ? <AlertTriangle size={12} /> : <Activity size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground leading-tight truncate">{a.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Tarjeta de estado — siempre visible, llena el espacio restante */}
            <OnDutyStatusCard shiftStart={shiftStart} guardName={user?.name ?? ""} />
          </div>
        </div>
      </div>

      {/* ── Incident dialog ── */}
      <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-400" />
              Reporte de incidente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={customIncident}
              onChange={(e) => setCustomIncident(e.target.value)}
              placeholder="Descripcion adicional para el supervisor (opcional)..."
              className="min-h-20 text-sm"
            />
            <div className="grid gap-2">
              {quickIncidentOptions.map((incident) => (
                <button
                  key={incident.title}
                  className={`text-left rounded-xl border px-3 py-2.5 flex items-center gap-3 transition-colors hover:opacity-80 active:opacity-60 ${priorityColors[incident.priority]} ${createIncident.isPending ? "opacity-50 pointer-events-none" : ""}`}
                  onClick={() => reportIncident(incident)}
                  disabled={createIncident.isPending}
                >
                  <span className="text-lg leading-none">{incident.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{incident.title}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{priorityLabel[incident.priority]}</p>
                  </div>
                  {createIncident.isPending ? <Loader2 size={14} className="animate-spin flex-shrink-0" /> : <ChevronRight size={14} className="flex-shrink-0 opacity-50" />}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
