import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  useListPanicAlerts,
  useTriggerPanic,
  useResolvePanic,
  getListPanicAlertsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { AlertTriangle, CheckCircle, MapPin, Loader2 } from "lucide-react";

export default function Panic() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isGuard = user?.role === "guard";

  const [panicMessage, setPanicMessage] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [pendingResolveId, setPendingResolveId] = useState<number | null>(null);

  const { data: alerts, isLoading } = useListPanicAlerts({ query: { refetchInterval: 5000 } });
  const triggerPanic = useTriggerPanic();
  const resolvePanic = useResolvePanic();

  const handlePanic = () => {
    setTriggering(true);
    const sendAlert = (latitude: number, longitude: number, locationNote?: string) => {
      triggerPanic.mutate(
        {
          data: {
            latitude,
            longitude,
            message: [locationNote, panicMessage].filter(Boolean).join(" - ") || undefined,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPanicAlertsQueryKey() });
            toast({ title: "ALERTA DE PANICO ENVIADA", description: "Tu supervisor ha sido notificado" });
            setPanicMessage("");
            setTriggering(false);
          },
          onError: () => {
            toast({ variant: "destructive", title: "No se pudo enviar la alerta" });
            setTriggering(false);
          },
        }
      );
    };

    const fallbackLocation = () => {
      const saved = localStorage.getItem("lastKnownLocation");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          sendAlert(parsed.latitude, parsed.longitude, "Ubicacion aproximada: ultima posicion registrada");
          return;
        } catch {
        }
      }
      sendAlert(0, 0, "GPS no disponible: alerta enviada sin ubicacion exacta");
    };

    if (!navigator.geolocation) {
      fallbackLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        localStorage.setItem(
          "lastKnownLocation",
          JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            at: new Date().toISOString(),
          }),
        );
        sendAlert(pos.coords.latitude, pos.coords.longitude);
      },
      fallbackLocation,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  };

  const handleResolve = (id: number) => {
    resolvePanic.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPanicAlertsQueryKey() });
          toast({ title: "Alerta resuelta" });
          setPendingResolveId(null);
        },
      }
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-full overflow-hidden">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-panic-title">
          {isGuard ? "Boton de Panico" : "Alertas de Panico"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isGuard ? "Usa este boton en caso de emergencia" : "Monitoreo de alertas de emergencia"}
        </p>
      </div>

      {isGuard && (
        <Card className="border-destructive/30 bg-gradient-to-br from-destructive/10 via-card to-card shadow-lg shadow-destructive/10">
          <CardContent className="p-4 md:p-6 space-y-4">
            <Textarea
              value={panicMessage}
              onChange={(e) => setPanicMessage(e.target.value)}
              placeholder="Mensaje opcional de emergencia..."
              className="bg-background/50"
              data-testid="input-panic-message"
            />
            <Button
              className="w-full min-h-20 h-auto py-5 text-base md:text-xl font-bold bg-red-600 hover:bg-red-700 text-white whitespace-normal leading-tight"
              onClick={handlePanic}
              disabled={triggering}
              data-testid="button-trigger-panic"
            >
              {triggering ? (
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
              ) : (
                <AlertTriangle size={28} className="mr-3 flex-shrink-0" />
              )}
              {triggering ? "ENVIANDO ALERTA..." : "ACTIVAR ALERTA DE PANICO"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Se enviara tu ubicacion GPS actual a todos los supervisores
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Historial de Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          <div className="space-y-3">
            {alerts?.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay alertas registradas</p>
            )}
            {alerts?.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border ${alert.status === "active" ? "border-red-500/50 bg-red-500/5" : "border-border bg-secondary/20"}`}
                data-testid={`panic-alert-${alert.id}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-xl flex-shrink-0 ${alert.status === "active" ? "bg-red-500/20" : "bg-secondary/50"}`}>
                      <AlertTriangle size={18} className={alert.status === "active" ? "text-red-500" : "text-muted-foreground"} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{alert.userName}</p>
                      {alert.message && <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                        </span>
                        <span>{new Date(alert.createdAt).toLocaleString("es-CL")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 justify-between sm:justify-start">
                    <Badge variant={alert.status === "active" ? "destructive" : "default"}>
                      {alert.status === "active" ? "ACTIVA" : "Resuelta"}
                    </Badge>
                    {!isGuard && alert.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => setPendingResolveId(alert.id)} data-testid={`button-resolve-${alert.id}`}>
                        <CheckCircle size={14} className="mr-1" />
                        Resolver
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={pendingResolveId !== null} onOpenChange={(open) => !open && setPendingResolveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar resolucion de panico</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma solo si ya se contacto al guardia y la emergencia fue controlada o derivada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingResolveId && handleResolve(pendingResolveId)}>
              Confirmar resolucion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
