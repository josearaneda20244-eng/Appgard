import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { useListRounds, useUpdateRound, useDeleteRound, useListUsers, getListRoundsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, ChevronRight, MapPin, Clock, User, CalendarClock,
  Shield, Play, CheckCircle2, Building2, RefreshCw, Zap, ListChecks,
  Sun, Moon, Users, Pencil, Trash2,
} from "lucide-react";
import { ElapsedTimer } from "@/components/elapsed-timer";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  active: "En Curso",
  completed: "Completada",
};

const STATUS_PILL: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  active: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/10 text-green-400 border-green-500/30",
};

const TABS = ["todas", "pending", "active", "completed"] as const;
const TAB_LABELS: Record<string, string> = {
  todas: "Todas",
  pending: "Pendientes",
  active: "En Curso",
  completed: "Completadas",
};

const SHIFT_TABS = ["todas", "dia", "noche"] as const;
const SHIFT_LABELS: Record<string, string> = { todas: "Todos turnos", dia: "Día", noche: "Noche" };
const SHIFT_PILL: Record<string, string> = {
  dia: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  noche: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  ambos: "bg-secondary/60 text-muted-foreground border-border",
};

type EditForm = {
  name: string;
  companyName: string;
  description: string;
  shift: string;
  assignedToId: string;
  scheduledAt: string;
};

export default function Rounds() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isGuard = user?.role === "guard";
  const isSupervisor = user?.role === "supervisor" || user?.role === "admin";

  const { data: rounds, isLoading, refetch, isFetching } = useListRounds(undefined, { query: { refetchInterval: 15000 } });
  const { data: users } = useListUsers();
  const updateRound = useUpdateRound();
  const deleteRound = useDeleteRound();

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("todas");
  const [activeShift, setActiveShift] = useState<(typeof SHIFT_TABS)[number]>("todas");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", companyName: "", description: "", shift: "ambos", assignedToId: "", scheduledAt: "" });

  const guards = users?.filter((u) => u.role === "guard" || u.role === "supervisor") ?? [];

  const visibleRounds = rounds;
  const filtered = visibleRounds?.filter((r) => {
    const statusOk = activeTab === "todas" || r.status === activeTab;
    const shiftOk = activeShift === "todas" || (r as any).shift === activeShift || (r as any).shift === "ambos";
    return statusOk && shiftOk;
  });

  const activeRounds = visibleRounds?.filter((r) => r.status === "active") ?? [];
  const pendingCount = visibleRounds?.filter((r) => r.status === "pending").length ?? 0;
  const completedCount = visibleRounds?.filter((r) => r.status === "completed").length ?? 0;

  const openEdit = (round: NonNullable<typeof rounds>[0], e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(round.id);
    setEditForm({
      name: round.name,
      companyName: (round as any).companyName ?? "",
      description: (round as any).description ?? "",
      shift: (round as any).shift ?? "ambos",
      assignedToId: round.assignedToId ? String(round.assignedToId) : "",
      scheduledAt: round.scheduledAt
        ? new Date(round.scheduledAt).toISOString().slice(0, 16)
        : "",
    });
  };

  const openDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
  };

  const handleEdit = () => {
    if (!editingId || !editForm.name.trim()) {
      toast({ variant: "destructive", title: "El nombre es requerido" });
      return;
    }
    const data: any = {
      name: editForm.name.trim(),
      companyName: editForm.companyName.trim(),
      description: editForm.description || undefined,
      shift: editForm.shift,
      assignedToId: editForm.assignedToId ? Number(editForm.assignedToId) : undefined,
      scheduledAt: editForm.scheduledAt ? new Date(editForm.scheduledAt).toISOString() : undefined,
    };
    updateRound.mutate(
      { id: editingId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoundsQueryKey() });
          toast({ title: "Ronda actualizada" });
          setEditingId(null);
        },
        onError: () => toast({ variant: "destructive", title: "Error al actualizar la ronda" }),
      }
    );
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteRound.mutate(
      { id: deletingId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoundsQueryKey() });
          toast({ title: "Ronda eliminada" });
          setDeletingId(null);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error al eliminar la ronda" });
          setDeletingId(null);
        },
      }
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield size={22} className="text-primary flex-shrink-0" />
            {isGuard ? "Mis Rondas" : "Rondas de Vigilancia"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isGuard ? "Rondas asignadas a ti" : "Gestiona y supervisa todas las rondas"}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="flex-shrink-0">
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          </Button>
          {!isGuard && (
            <Link href="/rounds/new" className="flex-1 sm:flex-none">
              <Button data-testid="button-new-round" size="sm" className="w-full whitespace-nowrap">
                <Plus size={16} className="mr-1.5" />
                Nueva Ronda
              </Button>
            </Link>
          )}
        </div>
      </div>

      {!isLoading && visibleRounds && visibleRounds.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
            <Clock size={16} className="text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-bold text-yellow-400">{pendingCount}</p>
              <p className="text-[10px] text-muted-foreground">Pendientes</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <Zap size={16} className="text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-bold text-blue-400">{activeRounds.length}</p>
              <p className="text-[10px] text-muted-foreground">En curso</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/5 border border-green-500/20">
            <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-bold text-green-400">{completedCount}</p>
              <p className="text-[10px] text-muted-foreground">Completadas</p>
            </div>
          </div>
        </div>
      )}

      {isGuard && activeRounds.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />
            En Curso Ahora
          </p>
          {activeRounds.map((round) => {
            const pct = round.totalCheckpoints > 0 ? Math.round((round.completedCheckpoints / round.totalCheckpoints) * 100) : 0;
            return (
              <Link key={round.id} href={`/rounds/${round.id}`}>
                <Card className="border-blue-500/50 bg-gradient-to-br from-blue-500/10 to-card hover:border-blue-400/70 transition-all cursor-pointer overflow-hidden shadow-lg shadow-blue-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 border border-blue-500/30">
                        <Play size={18} className="text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-blue-200 truncate">{round.name}</p>
                          <span className="text-[10px] text-blue-300 font-semibold bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded-full animate-pulse flex-shrink-0">ACTIVA</span>
                        </div>
                        <p className="text-xs text-blue-400/80 flex items-center gap-1 mt-0.5"><Building2 size={10} />{(round as any).companyName}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex-1 h-1.5 rounded-full bg-blue-500/20 overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-blue-300 whitespace-nowrap flex-shrink-0 font-medium">{round.completedCheckpoints}/{round.totalCheckpoints} pts</span>
                        </div>
                        <ElapsedTimer startedAt={round.startedAt} label="Tiempo" className="text-xs text-blue-400/70 mt-1" iconSize={10} />
                      </div>
                      <ChevronRight size={16} className="text-blue-400 flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((tab) => {
          const count = tab === "todas" ? visibleRounds?.length ?? 0 : visibleRounds?.filter((r) => r.status === tab).length ?? 0;
          const isActive = activeTab === tab;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              {TAB_LABELS[tab]}
              {count > 0 && <span className={`ml-1.5 text-[10px] ${isActive ? "opacity-70" : "opacity-60"}`}>({count})</span>}
            </button>
          );
        })}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {SHIFT_TABS.map((s) => {
          const isActive = activeShift === s;
          return (
            <button key={s} onClick={() => setActiveShift(s)} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${isActive ? s === "dia" ? "bg-amber-500 text-white border-amber-500" : s === "noche" ? "bg-indigo-500 text-white border-indigo-500" : "bg-secondary text-foreground border-border" : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"}`}>
              {s === "dia" && <Sun size={11} />}
              {s === "noche" && <Moon size={11} />}
              {s === "todas" && <Users size={11} />}
              {SHIFT_LABELS[s]}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="animate-spin h-7 w-7 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      <div className="grid gap-2.5">
        {!isLoading && filtered?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-2xl bg-secondary/30 mb-4">
              <ListChecks size={32} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {activeTab === "todas" ? "No hay rondas registradas" : `No hay rondas ${TAB_LABELS[activeTab].toLowerCase()}`}
            </p>
            {!isGuard && activeTab === "todas" && (
              <Link href="/rounds/new">
                <Button size="sm" className="mt-4"><Plus size={14} className="mr-1.5" />Crear primera ronda</Button>
              </Link>
            )}
          </div>
        )}

        {filtered?.map((round) => {
          const isScheduledFuture = round.scheduledAt && new Date(round.scheduledAt) > new Date() && round.status === "pending";
          const pct = round.totalCheckpoints > 0 ? Math.round((round.completedCheckpoints / round.totalCheckpoints) * 100) : 0;
          const isMyActiveRound = isGuard && round.status === "active";

          return (
            <Link key={round.id} href={`/rounds/${round.id}`}>
              <Card className={`transition-all cursor-pointer hover:border-primary/40 active:scale-[0.99] ${isMyActiveRound && activeTab === "todas" ? "hidden" : ""}`} data-testid={`card-round-${round.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${round.status === "completed" ? "bg-green-500/15 border border-green-500/20" : round.status === "active" ? "bg-blue-500/15 border border-blue-500/20" : "bg-secondary border border-border"}`}>
                      {round.status === "completed" ? <CheckCircle2 size={17} className="text-green-400" /> : round.status === "active" ? <Play size={17} className="text-blue-400" /> : <Clock size={17} className="text-muted-foreground" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-sm truncate">{round.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 font-medium ${STATUS_PILL[round.status]}`}>{STATUS_LABELS[round.status]}</span>
                        {(round as any).shift && (round as any).shift !== "ambos" && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 font-medium flex items-center gap-1 ${SHIFT_PILL[(round as any).shift]}`}>
                            {(round as any).shift === "dia" ? <Sun size={9} /> : <Moon size={9} />}
                            {(round as any).shift === "dia" ? "Día" : "Noche"}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1 text-primary font-medium"><Building2 size={10} />{(round as any).companyName}</span>
                        {round.assignedToName && <span className="flex items-center gap-1"><User size={10} />{round.assignedToName}</span>}
                        {round.scheduledAt ? (
                          <span className={`flex items-center gap-1 ${isScheduledFuture ? "text-amber-400 font-medium" : ""}`}>
                            <CalendarClock size={10} />
                            {new Date(round.scheduledAt).toLocaleString("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1"><Clock size={10} />{new Date(round.createdAt).toLocaleString("es-CL", { day: "numeric", month: "short", year: "numeric" })}</span>
                        )}
                        {round.status === "active" && <ElapsedTimer startedAt={round.startedAt} label="Tiempo" className="text-blue-400" iconSize={10} />}
                        {round.status === "completed" && round.startedAt && round.completedAt && <ElapsedTimer startedAt={round.startedAt} completedAt={round.completedAt} label="Duracion" className="text-green-400" iconSize={10} />}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${round.status === "completed" ? "bg-green-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 font-medium tabular-nums"><MapPin size={9} className="inline mr-0.5" />{round.completedCheckpoints}/{round.totalCheckpoints}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isSupervisor && round.status === "pending" && (
                        <>
                          <button
                            onClick={(e) => openEdit(round, e)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                            title="Editar ronda"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => openDelete(round.id, e)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Eliminar ronda"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      {isSupervisor && round.status !== "pending" && (
                        <button
                          onClick={(e) => openDelete(round.id, e)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Eliminar ronda"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <ChevronRight size={15} className="text-muted-foreground mt-0" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Ronda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nombre de la ronda</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Empresa</Label>
                <Input value={editForm.companyName} onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="Nombre de la empresa" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Descripcion</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Turno</Label>
                <Select value={editForm.shift} onValueChange={(v) => setEditForm((f) => ({ ...f, shift: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambos">Ambos turnos</SelectItem>
                    <SelectItem value="dia">Día</SelectItem>
                    <SelectItem value="noche">Noche</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Guardia asignado</Label>
                <Select value={editForm.assignedToId} onValueChange={(v) => setEditForm((f) => ({ ...f, assignedToId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asignar</SelectItem>
                    {guards.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Fecha programada</Label>
                <Input type="datetime-local" value={editForm.scheduledAt} onChange={(e) => setEditForm((f) => ({ ...f, scheduledAt: e.target.value }))} />
              </div>
            </div>
            <Button onClick={handleEdit} disabled={updateRound.isPending} className="w-full">
              {updateRound.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar ronda</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion es irreversible. Se eliminaran la ronda y todos sus checkpoints asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
