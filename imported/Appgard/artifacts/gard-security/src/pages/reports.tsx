import { useMemo, useState } from "react";
import { useListIncidents, useListPanicAlerts, useListRounds, useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  AlertTriangle, BriefcaseBusiness, CheckCircle2, Download, FileText,
  Route, ShieldAlert, Users, TrendingUp, BarChart2,
} from "lucide-react";

type RangeKey = "today" | "7d" | "30d" | "all";

type LogItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  priority: "normal" | "warning" | "critical";
  at: string;
};

const rangeLabels: Record<RangeKey, string> = {
  today: "Hoy",
  "7d": "Ultimos 7 dias",
  "30d": "Ultimos 30 dias",
  all: "Todo",
};

const COLORS = ["#3b82f6", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#06b6d4"];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#3b82f6",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export default function Reports() {
  const [range, setRange] = useState<RangeKey>("7d");
  const { data: rounds } = useListRounds(undefined, { query: { refetchInterval: 10000 } });
  const { data: incidents } = useListIncidents(undefined, { query: { refetchInterval: 10000 } });
  const { data: alerts } = useListPanicAlerts({ query: { refetchInterval: 10000 } });
  const { data: users } = useListUsers();

  const since = useMemo(() => {
    const now = new Date();
    if (range === "all") return null;
    if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = range === "7d" ? 7 : 30;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }, [range]);

  const inRange = (value?: string | null) => {
    if (!value) return false;
    if (!since) return true;
    return new Date(value) >= since;
  };

  const filteredRounds = rounds?.filter((r) => inRange(r.completedAt ?? r.startedAt ?? r.scheduledAt ?? r.createdAt)) ?? [];
  const filteredIncidents = incidents?.filter((i) => inRange(i.createdAt)) ?? [];
  const filteredAlerts = alerts?.filter((a) => inRange(a.createdAt)) ?? [];

  const completedRounds = filteredRounds.filter((r) => r.status === "completed").length;
  const activeRounds = filteredRounds.filter((r) => r.status === "active").length;
  const openIncidents = filteredIncidents.filter((i) => i.status !== "resolved").length;
  const criticalEvents = filteredIncidents.filter((i) => i.priority === "critical" || i.priority === "high").length;

  const companyRows = useMemo(() => {
    const map = new Map<string, { name: string; total: number; completed: number; active: number; pending: number; totalCheckpoints: number; completedCheckpoints: number }>();
    filteredRounds.forEach((round) => {
      const name = round.companyName || "Sin empresa";
      const current = map.get(name) ?? { name, total: 0, completed: 0, active: 0, pending: 0, totalCheckpoints: 0, completedCheckpoints: 0 };
      current.total += 1;
      if (round.status === "completed") current.completed += 1;
      if (round.status === "active") current.active += 1;
      if (round.status === "pending") current.pending += 1;
      current.totalCheckpoints += round.totalCheckpoints;
      current.completedCheckpoints += round.completedCheckpoints;
      map.set(name, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredRounds]);

  const logItems = useMemo<LogItem[]>(() => {
    const roundLogs = filteredRounds.map((round) => ({
      id: `round-${round.id}`,
      type: "Ronda",
      title: round.name,
      detail: `${round.companyName} · ${round.status === "completed" ? "Completada" : round.status === "active" ? "En curso" : "Pendiente"} · ${round.completedCheckpoints}/${round.totalCheckpoints} puntos`,
      priority: round.status === "pending" ? "warning" as const : "normal" as const,
      at: round.completedAt ?? round.startedAt ?? round.scheduledAt ?? round.createdAt,
    }));
    const incidentLogs = filteredIncidents.map((incident) => ({
      id: `incident-${incident.id}`,
      type: "Incidente",
      title: incident.title,
      detail: `${incident.reportedByName} · ${incident.status === "resolved" ? "Resuelto" : incident.status === "investigating" ? "Investigando" : "Abierto"}`,
      priority: incident.priority === "critical" || incident.priority === "high" ? "critical" as const : "warning" as const,
      at: incident.createdAt,
    }));
    const alertLogs = filteredAlerts.map((alert) => ({
      id: `panic-${alert.id}`,
      type: "Panico",
      title: alert.status === "active" ? "Alerta de panico activa" : "Alerta de panico resuelta",
      detail: `${alert.userName}${alert.message ? ` · ${alert.message}` : ""}`,
      priority: alert.status === "active" ? "critical" as const : "warning" as const,
      at: alert.createdAt,
    }));
    return [...roundLogs, ...incidentLogs, ...alertLogs]
      .filter((item) => Boolean(item.at))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [filteredAlerts, filteredIncidents, filteredRounds]);

  const incidentsByPriority = useMemo(() => {
    const map: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    filteredIncidents.forEach((i) => { map[i.priority] = (map[i.priority] ?? 0) + 1; });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: PRIORITY_LABELS[name] ?? name, value, color: PRIORITY_COLORS[name] }));
  }, [filteredIncidents]);

  const incidentsByDay = useMemo(() => {
    const days = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 30;
    const map = new Map<string, { date: string; incidentes: number; rondas: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
      map.set(key, { date: key, incidentes: 0, rondas: 0 });
    }
    filteredIncidents.forEach((inc) => {
      const key = new Date(inc.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
      const entry = map.get(key);
      if (entry) entry.incidentes += 1;
    });
    filteredRounds.forEach((r) => {
      const at = r.completedAt ?? r.startedAt ?? r.scheduledAt ?? r.createdAt;
      const key = new Date(at).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
      const entry = map.get(key);
      if (entry) entry.rondas += 1;
    });
    return Array.from(map.values());
  }, [filteredIncidents, filteredRounds, range]);

  const guardStats = useMemo(() => {
    const guards = users?.filter((u) => u.role === "guard") ?? [];
    return guards.map((g) => {
      const myRounds = filteredRounds.filter((r) => r.assignedToId === g.id);
      const completed = myRounds.filter((r) => r.status === "completed").length;
      const active = myRounds.filter((r) => r.status === "active").length;
      const totalCp = myRounds.reduce((a, r) => a + r.totalCheckpoints, 0);
      const doneCp = myRounds.reduce((a, r) => a + r.completedCheckpoints, 0);
      const coverage = totalCp > 0 ? Math.round((doneCp / totalCp) * 100) : 0;
      const myIncidents = filteredIncidents.filter((i) => i.reportedByName === g.name).length;
      return {
        name: g.name.split(" ")[0],
        fullName: g.name,
        total: myRounds.length,
        completed,
        active,
        coverage,
        incidentes: myIncidents,
      };
    }).sort((a, b) => b.total - a.total);
  }, [users, filteredRounds, filteredIncidents]);

  const exportCsv = () => {
    const rows = [
      ["Fecha", "Tipo", "Titulo", "Detalle", "Prioridad"],
      ...logItems.map((item) => [
        new Date(item.at).toLocaleString("es-CL"),
        item.type,
        item.title,
        item.detail,
        item.priority === "critical" ? "Critica" : item.priority === "warning" ? "Atencion" : "Normal",
      ]),
    ];
    const csv = rows.map((row) => row.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gard-reporte-${range}-${new Date().toLocaleDateString("es-CL").replaceAll("/", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportGuardCsv = () => {
    const rows = [
      ["Guardia", "Total Rondas", "Completadas", "Activas", "Cobertura %", "Incidentes Reportados"],
      ...guardStats.map((g) => [g.fullName, g.total, g.completed, g.active, g.coverage, g.incidentes]),
    ];
    const csv = rows.map((row) => row.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gard-guardias-${range}-${new Date().toLocaleDateString("es-CL").replaceAll("/", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText size={24} className="text-primary" />
            Reportes Operativos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estadisticas, graficos y bitacora de seguridad
          </p>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 md:flex md:items-center">
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="bg-card md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(rangeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportCsv} disabled={logItems.length === 0} variant="outline">
            <Download size={16} className="mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <ReportCard icon={Route} label="Rondas completadas" value={completedRounds} color="text-green-400" />
        <ReportCard icon={Route} label="Rondas activas" value={activeRounds} color="text-blue-400" />
        <ReportCard icon={AlertTriangle} label="Incidentes abiertos" value={openIncidents} color="text-orange-400" />
        <ReportCard icon={ShieldAlert} label="Eventos criticos" value={criticalEvents} color="text-red-400" />
        <ReportCard icon={BriefcaseBusiness} label="Empresas" value={companyRows.length} color="text-primary" />
      </div>

      <Tabs defaultValue="graficos" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="graficos" className="flex items-center gap-1.5">
            <BarChart2 size={14} />
            Graficos
          </TabsTrigger>
          <TabsTrigger value="guardias" className="flex items-center gap-1.5">
            <Users size={14} />
            Por Guardia
          </TabsTrigger>
          <TabsTrigger value="empresas" className="flex items-center gap-1.5">
            <BriefcaseBusiness size={14} />
            Por Empresa
          </TabsTrigger>
          <TabsTrigger value="bitacora" className="flex items-center gap-1.5">
            <FileText size={14} />
            Bitacora
          </TabsTrigger>
        </TabsList>

        <TabsContent value="graficos" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="glass-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" />
                  Actividad diaria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incidentsByDay.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={incidentsByDay} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: 12 }}
                        labelStyle={{ color: "#e2e8f0" }}
                      />
                      <Bar dataKey="rondas" name="Rondas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="incidentes" name="Incidentes" fill="#f97316" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded bg-blue-500 inline-block" />Rondas</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded bg-orange-500 inline-block" />Incidentes</span>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle size={16} className="text-orange-400" />
                  Incidentes por prioridad
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incidentsByPriority.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin incidentes en el periodo</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={incidentsByPriority}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ stroke: "rgba(255,255,255,0.2)" }}
                      >
                        {incidentsByPriority.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BriefcaseBusiness size={16} className="text-primary" />
                Rondas por empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {companyRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos de empresas</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={companyRows.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} width={90} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: 12 }}
                    />
                    <Bar dataKey="completed" name="Completadas" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="active" name="Activas" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="pending" name="Pendientes" stackId="a" fill="#475569" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex items-center gap-4 mt-2 justify-center">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded bg-green-500 inline-block" />Completadas</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded bg-blue-500 inline-block" />Activas</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded bg-slate-500 inline-block" />Pendientes</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardias" className="mt-4">
          <Card className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users size={16} className="text-primary" />
                Rendimiento por guardia
              </CardTitle>
              <Button variant="outline" size="sm" onClick={exportGuardCsv} disabled={guardStats.length === 0}>
                <Download size={14} className="mr-1.5" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              {guardStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin guardias registrados</p>
              ) : (
                <>
                  <div className="mb-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={guardStats.slice(0, 8)} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: 12 }} />
                        <Bar dataKey="completed" name="Completadas" fill="#10b981" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="active" name="Activas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guardia</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Completadas</TableHead>
                        <TableHead className="text-right">Cobertura</TableHead>
                        <TableHead className="text-right">Incidentes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guardStats.map((g) => (
                        <TableRow key={g.fullName}>
                          <TableCell className="font-medium">{g.fullName}</TableCell>
                          <TableCell className="text-right">{g.total}</TableCell>
                          <TableCell className="text-right">{g.completed}</TableCell>
                          <TableCell className="text-right">
                            <span className={g.coverage >= 80 ? "text-green-400" : g.coverage >= 50 ? "text-yellow-400" : g.total === 0 ? "text-muted-foreground" : "text-red-400"}>
                              {g.total > 0 ? `${g.coverage}%` : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{g.incidentes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empresas" className="mt-4">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Rendimiento por empresa</CardTitle>
            </CardHeader>
            <CardContent>
              {companyRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin rondas en el periodo seleccionado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Completadas</TableHead>
                      <TableHead className="text-right">Activas</TableHead>
                      <TableHead className="text-right">Pendientes</TableHead>
                      <TableHead className="text-right">Checkpoints</TableHead>
                      <TableHead className="text-right">Cobertura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyRows.map((company) => {
                      const rate = company.totalCheckpoints > 0
                        ? Math.round((company.completedCheckpoints / company.totalCheckpoints) * 100)
                        : 0;
                      return (
                        <TableRow key={company.name}>
                          <TableCell className="font-medium">{company.name}</TableCell>
                          <TableCell className="text-right text-green-400">{company.completed}</TableCell>
                          <TableCell className="text-right text-blue-400">{company.active}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{company.pending}</TableCell>
                          <TableCell className="text-right text-muted-foreground text-xs">
                            {company.completedCheckpoints}/{company.totalCheckpoints}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={rate >= 80 ? "text-green-400" : rate >= 50 ? "text-yellow-400" : "text-red-400"}>
                              {company.totalCheckpoints > 0 ? `${rate}%` : "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bitacora" className="mt-4">
          <Card className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Bitacora operativa</CardTitle>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={logItems.length === 0}>
                <Download size={14} className="mr-1.5" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {logItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin eventos en el periodo seleccionado</p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {logItems.slice(0, 100).map((item) => (
                    <div key={item.id} className={`rounded-xl border p-3 ${
                      item.priority === "critical"
                        ? "border-red-500/40 bg-red-500/5"
                        : item.priority === "warning"
                          ? "border-yellow-500/30 bg-yellow-500/5"
                          : "border-border bg-secondary/20"
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.type}</p>
                          <h3 className="font-semibold mt-0.5 break-words">{item.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1 break-words">{item.detail}</p>
                        </div>
                        {item.priority === "critical" ? (
                          <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 size={18} className="text-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(item.at).toLocaleString("es-CL")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({ icon: Icon, label, value, color }: { icon: typeof Route; label: string; value: number; color: string }) {
  return (
    <Card className="glass-panel">
      <CardContent className="p-4">
        <Icon size={20} className={color} />
        <p className="text-2xl font-bold mt-3">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
