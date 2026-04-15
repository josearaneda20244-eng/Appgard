import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useCreateRound,
  useCreateCheckpoint,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Trash2, Loader2, Clock, RefreshCw, Users, Sun, Moon } from "lucide-react";

const MAP_TILE_SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const MAP_TILE_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const CHECKPOINT_RADIUS_METERS = 35;

interface TempCheckpoint {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export default function RoundNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [checkpoints, setCheckpoints] = useState<TempCheckpoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [shift, setShift] = useState<"dia" | "noche" | "ambos">("ambos");

  const createRound = useCreateRound();
  const createCheckpoint = useCreateCheckpoint();

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const map = L.map(mapRef.current!, { attributionControl: false }).setView(
        [-33.4489, -70.6693],
        15,
      );
      L.tileLayer(MAP_TILE_SATELLITE, { maxZoom: 19 }).addTo(map);
      L.tileLayer(MAP_TILE_LABELS, { maxZoom: 19, opacity: 0.85 }).addTo(map);

      map.locate({ setView: true, maxZoom: 16 });

      map.on("click", (e: any) => {
        const idx = markersRef.current.length + 1;
        const cp: TempCheckpoint = {
          name: `Punto ${idx}`,
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
          radius: CHECKPOINT_RADIUS_METERS,
        };

        const marker = L.circleMarker([cp.latitude, cp.longitude], {
          radius: 12,
          fillColor: "#3b82f6",
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(map);
        marker.bindPopup(`<b>${cp.name}</b>`).openPopup();
        markersRef.current.push(marker);
        setCheckpoints((prev) => [...prev, cp]);
      });

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const removeCheckpoint = (index: number) => {
    if (markersRef.current[index] && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markersRef.current[index]);
    }
    markersRef.current.splice(index, 1);
    setCheckpoints((prev) => prev.filter((_, i) => i !== index));
  };

  const createRoundWithCheckpoints = async (
    roundName: string,
    scheduledDate: Date | null,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      createRound.mutate(
        {
          data: {
            name: roundName,
            companyName: companyName.trim(),
            description: description || undefined,
            scheduledAt: scheduledDate ? scheduledDate.toISOString() : undefined,
            shift,
          },
        },
        {
          onSuccess: async (round) => {
            for (let i = 0; i < checkpoints.length; i++) {
              const cp = checkpoints[i];
              await new Promise<void>((res) => {
                createCheckpoint.mutate(
                  {
                    data: {
                      roundId: round.id,
                      name: cp.name,
                      latitude: cp.latitude,
                      longitude: cp.longitude,
                      radius: cp.radius,
                      orderIndex: i + 1,
                    },
                  },
                  { onSettled: () => res() },
                );
              });
            }
            resolve();
          },
          onError: reject,
        },
      );
    });
  };

  const handleSubmit = async () => {
    if (!name) {
      toast({ variant: "destructive", title: "Nombre requerido" });
      return;
    }
    if (!companyName.trim()) {
      toast({ variant: "destructive", title: "Empresa requerida" });
      return;
    }

    setSaving(true);
    try {
      const baseDate = scheduledAt ? new Date(scheduledAt) : null;
      await createRoundWithCheckpoints(name, baseDate);

      toast({
        title: "Ronda reutilizable creada",
        description: "La misma ronda quedara disponible para usarla todos los dias",
      });
      setLocation("/rounds");
    } catch {
      toast({ variant: "destructive", title: "Error al crear la ronda" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight" data-testid="text-new-round-title">
          Nueva Ronda
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Crea una sola vez la ruta diaria y vuelve a usarla cada jornada
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg">Mapa de Puntos de Control</CardTitle>
              <p className="text-xs text-muted-foreground">
                Toca el mapa para agregar puntos de control
              </p>
            </CardHeader>
            <CardContent>
              <div
                ref={mapRef}
                className="h-[300px] md:h-[420px] rounded-lg overflow-hidden border border-border"
                style={{ isolation: "isolate" }}
              />
            </CardContent>
          </Card>

          {checkpoints.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base md:text-lg">
                  Puntos ({checkpoints.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {checkpoints.map((cp, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border gap-2"
                    >
                      <span className="text-xs font-bold w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <Input
                        value={cp.name}
                        onChange={(e) => {
                          const updated = [...checkpoints];
                          updated[idx].name = e.target.value;
                          setCheckpoints(updated);
                        }}
                        className="h-8 text-sm flex-1 min-w-0"
                        data-testid={`input-checkpoint-name-${idx}`}
                      />
                      <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                        {cp.latitude.toFixed(4)}, {cp.longitude.toFixed(4)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCheckpoint(idx)}
                        data-testid={`button-remove-cp-${idx}`}
                        className="flex-shrink-0"
                      >
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg">Detalles de la Ronda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ronda Perimetral Norte"
                  data-testid="input-round-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Empresa / Cliente</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ej: Constructora Norte, Mall Central..."
                  data-testid="input-round-company"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Descripcion</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripcion de la ronda..."
                  rows={2}
                  data-testid="input-round-desc"
                />
              </div>

              <div className="space-y-2">
                <Label>Turno</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["dia", "noche", "ambos"] as const).map((s) => {
                    const labels = { dia: "Día", noche: "Noche", ambos: "Ambos" };
                    const icons = {
                      dia: <Sun size={13} className="flex-shrink-0" />,
                      noche: <Moon size={13} className="flex-shrink-0" />,
                      ambos: <Users size={13} className="flex-shrink-0" />,
                    };
                    const colors = {
                      dia: shift === s ? "bg-amber-500 text-white border-amber-500" : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10",
                      noche: shift === s ? "bg-indigo-500 text-white border-indigo-500" : "border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10",
                      ambos: shift === s ? "bg-primary text-primary-foreground border-primary" : "border-primary/30 text-primary hover:bg-primary/10",
                    };
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setShift(s)}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${colors[s]}`}
                      >
                        {icons[s]}
                        {labels[s]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {shift === "dia" && "Solo aparecerá para guardias del turno de día."}
                  {shift === "noche" && "Solo aparecerá para guardias del turno de noche."}
                  {shift === "ambos" && "Visible para todos los guardias, sin distinción de turno."}
                </p>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock size={15} className="text-primary" />
                  Programacion diaria
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Fecha y hora sugerida de inicio</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/10 p-3">
                  <RefreshCw size={16} className="text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    No se crearan copias por cada dia. Cuando el guardia termine esta ronda, podra volver a iniciarla al dia siguiente con los puntos en cero.
                  </p>
                </div>
              </div>

              <Button
                className="w-full mt-2"
                onClick={handleSubmit}
                disabled={saving || !name || !companyName.trim()}
                data-testid="button-save-round"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save size={16} className="mr-2" />
                )}
                Guardar Ronda Reutilizable
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
