import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  useListIncidents,
  useCreateIncident,
  useUpdateIncident,
  getListIncidentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertTriangle, Clock, CheckCircle, Search } from "lucide-react";

export default function Incidents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isGuard = user?.role === "guard";

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [pendingResolveId, setPendingResolveId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");

  const { data: incidents, isLoading } = useListIncidents(
    statusFilter || priorityFilter ? {
      status: statusFilter ? statusFilter as any : undefined,
      priority: priorityFilter ? priorityFilter as any : undefined,
    } : undefined
  );

  const createIncident = useCreateIncident();
  const updateIncident = useUpdateIncident();

  const handleCreate = () => {
    if (!title || !description) {
      toast({ variant: "destructive", title: "Completa todos los campos" });
      return;
    }

    const submitData: any = { title, description, priority };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          submitData.latitude = pos.coords.latitude;
          submitData.longitude = pos.coords.longitude;
          doCreate(submitData);
        },
        () => doCreate(submitData),
        { enableHighAccuracy: true }
      );
    } else {
      doCreate(submitData);
    }
  };

  const doCreate = (data: any) => {
    createIncident.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
          toast({ title: "Incidente reportado" });
          setDialogOpen(false);
          setTitle("");
          setDescription("");
          setPriority("medium");
        },
      }
    );
  };

  const handleStatusChange = (incidentId: number, newStatus: string) => {
    if (newStatus === "resolved") {
      setPendingResolveId(incidentId);
      return;
    }

    updateIncident.mutate(
      { id: incidentId, data: { status: newStatus as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
          toast({ title: "Incidente actualizado" });
        },
      }
    );
  };

  const confirmResolve = () => {
    if (!pendingResolveId) return;
    updateIncident.mutate(
      { id: pendingResolveId, data: { status: "resolved" as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
          toast({ title: "Incidente resuelto" });
          setPendingResolveId(null);
        },
      }
    );
  };

  const priorityColors: Record<string, string> = {
    low: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    critical: "bg-red-500/10 text-red-400 border-red-500/30",
  };

  const statusIcons: Record<string, typeof AlertTriangle> = {
    open: AlertTriangle,
    investigating: Search,
    resolved: CheckCircle,
  };

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-incidents-title">Incidentes</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestion de incidentes de seguridad</p>
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:flex sm:items-center sm:gap-3 w-full sm:w-auto">
          <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
            <SelectTrigger className="w-full sm:w-40 bg-card" data-testid="select-status-filter">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abiertos</SelectItem>
              <SelectItem value="investigating">Investigando</SelectItem>
              <SelectItem value="resolved">Resueltos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter || "all"} onValueChange={(value) => setPriorityFilter(value === "all" ? "" : value)}>
            <SelectTrigger className="w-full sm:w-40 bg-card" data-testid="select-priority-filter">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Prioridad</SelectItem>
              <SelectItem value="critical">Critica</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="low">Baja</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-incident" className="min-w-11 px-3 sm:px-4">
                <Plus size={16} className="mr-2" />
                <span className="hidden sm:inline">Reportar</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reportar Incidente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Titulo</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titulo del incidente" data-testid="input-incident-title" />
                </div>
                <div className="space-y-2">
                  <Label>Descripcion</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe el incidente..." data-testid="input-incident-desc" />
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="critical">Critica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createIncident.isPending} data-testid="button-submit-incident">
                  Reportar Incidente
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      <div className="space-y-3">
        {incidents?.length === 0 && !isLoading && (
          <Card className="glass-panel"><CardContent className="p-10 text-center text-muted-foreground">No hay incidentes</CardContent></Card>
        )}
        {incidents?.map((incident) => {
          const Icon = statusIcons[incident.status] || AlertTriangle;
          return (
            <Card key={incident.id} className="glass-panel overflow-hidden" data-testid={`card-incident-${incident.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-secondary/50 mt-0.5 flex-shrink-0">
                      <Icon size={18} className="text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold break-words">{incident.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{incident.description}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span>Por: {incident.reportedByName}</span>
                        <span>{new Date(incident.createdAt).toLocaleString("es-CL")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 justify-between sm:justify-start">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[incident.priority]}`}>
                      {incident.priority === "low" ? "Baja" : incident.priority === "medium" ? "Media" : incident.priority === "high" ? "Alta" : "Critica"}
                    </span>
                    {!isGuard && incident.status !== "resolved" && (
                      <Select value={incident.status} onValueChange={(v) => handleStatusChange(incident.id, v)}>
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Abierto</SelectItem>
                          <SelectItem value="investigating">Investigando</SelectItem>
                          <SelectItem value="resolved">Resuelto</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={pendingResolveId !== null} onOpenChange={(open) => !open && setPendingResolveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cierre de incidente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion marcara el incidente como resuelto. Usala solo cuando la situacion ya fue verificada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResolve}>
              Confirmar cierre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
