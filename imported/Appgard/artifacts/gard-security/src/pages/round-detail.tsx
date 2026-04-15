import { useEffect, useRef, useState, useCallback } from "react";
import { useRoute } from "wouter";
import { useAuth } from "@/components/auth-provider";
import {
  useGetRound,
  getGetRoundQueryKey,
  useStartRound,
  useCompleteRound,
  useCheckinCheckpoint,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Play, CheckCircle, MapPin, Loader2, Navigation, Building2, WifiOff, Satellite } from "lucide-react";
import { ElapsedTimer } from "@/components/elapsed-timer";

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Simple GPS Kalman filter.
 * Smooths noisy GPS readings while tracking real movement.
 * Q = process noise (how much the guard can move between readings, in meters)
 * R = measurement noise (GPS accuracy in meters)
 */
class GpsKalmanFilter {
  private P = 0;       // error covariance (uncertainty in current estimate)
  private lat = 0;
  private lng = 0;
  private initialized = false;
  private readonly Q: number; // process noise

  constructor(processNoise = 2) {
    this.Q = processNoise;
  }

  reset() {
    this.initialized = false;
    this.P = 0;
  }

  update(lat: number, lng: number, accuracy: number): { lat: number; lng: number } {
    const R = Math.max(accuracy, 1);

    if (!this.initialized) {
      this.lat = lat;
      this.lng = lng;
      this.P = R;
      this.initialized = true;
      return { lat, lng };
    }

    // Predict: grow uncertainty with movement
    this.P += this.Q;

    // Update: blend measurement with estimate
    const K = this.P / (this.P + R);
    this.lat = this.lat + K * (lat - this.lat);
    this.lng = this.lng + K * (lng - this.lng);
    this.P = (1 - K) * this.P;

    return { lat: this.lat, lng: this.lng };
  }
}

function getTrailStorageKey(roundId: number) {
  return `gard_trail_${roundId}`;
}

function loadTrailFromStorage(roundId: number): [number, number][] {
  try {
    const raw = localStorage.getItem(getTrailStorageKey(roundId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveTrailToStorage(roundId: number, points: [number, number][]) {
  try {
    localStorage.setItem(getTrailStorageKey(roundId), JSON.stringify(points));
  } catch {}
}

function clearTrailStorage(roundId: number) {
  try {
    localStorage.removeItem(getTrailStorageKey(roundId));
  } catch {}
}

export default function RoundDetail() {
  const [, params] = useRoute("/rounds/:id");
  const id = Number(params?.id);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const guardMarkerRef = useRef<any>(null);
  const trailPolylineRef = useRef<any>(null);
  const trailPointsRef = useRef<[number, number][]>([]);
  const checkpointLayerGroupRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const checkinInProgressRef = useRef<Set<number>>(new Set());
  const mapInitializedRef = useRef(false);
  const lastValidPosRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const kalmanRef = useRef<GpsKalmanFilter>(new GpsKalmanFilter(3));
  // Stability detection: collect recent readings and only start tracking once they converge
  const stabilizationBufferRef = useRef<{ lat: number; lng: number }[]>([]);
  const gpsLockedRef = useRef(false);

  const [guardPos, setGuardPos] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyCheckpoint, setNearbyCheckpoint] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [gpsStatus, setGpsStatus] = useState<"off" | "searching" | "locked">("off");

  const { data, isLoading } = useGetRound(id, {
    query: { enabled: !!id, queryKey: getGetRoundQueryKey(id), refetchInterval: 5000 },
  });

  const startRound = useStartRound();
  const completeRound = useCompleteRound();
  const checkin = useCheckinCheckpoint();

  const round = data?.round;
  const checkpoints = data?.checkpoints ?? [];

  const isGuard = user?.role === "guard";
  const isActive = round?.status === "active";
  const canStartRound = isGuard && (round?.status === "pending" || round?.status === "completed");

  const handleCheckin = useCallback(
    (cpId: number, lat: number, lng: number) => {
      if (checkinInProgressRef.current.has(cpId)) return;
      checkinInProgressRef.current.add(cpId);
      checkin.mutate(
        { id: cpId, data: { latitude: lat, longitude: lng } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetRoundQueryKey(id) });
            toast({ title: "Punto de control registrado automaticamente" });
            checkinInProgressRef.current.delete(cpId);
          },
          onError: () => {
            checkinInProgressRef.current.delete(cpId);
          },
        },
      );
    },
    [checkin, queryClient, id, toast],
  );


  // --- Map initialization (runs once when checkpoints are available) ---
  useEffect(() => {
    if (!mapRef.current || checkpoints.length === 0 || mapInitializedRef.current) return;
    mapInitializedRef.current = true;

    import("leaflet").then((L) => {
      if (!mapRef.current) return;

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const map = L.map(mapRef.current!, { attributionControl: false }).setView(
        [checkpoints[0].latitude, checkpoints[0].longitude],
        16,
      );
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 },
      ).addTo(map);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.8 },
      ).addTo(map);

      // Route line between checkpoints
      if (checkpoints.length > 1) {
        const coords: [number, number][] = checkpoints.map((cp) => [cp.latitude, cp.longitude]);
        L.polyline(coords, { color: "#3b82f6", weight: 2, opacity: 0.6, dashArray: "8 8" }).addTo(map);
      }

      // Checkpoint layer group (will be updated separately)
      const layerGroup = L.layerGroup().addTo(map);
      checkpointLayerGroupRef.current = layerGroup;

      // Fit bounds
      const bounds = L.latLngBounds(checkpoints.map((cp) => [cp.latitude, cp.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40] });

      // Restore trail from localStorage if available
      const savedTrail = loadTrailFromStorage(id);
      if (savedTrail.length > 0) {
        trailPointsRef.current = savedTrail;
        if (savedTrail.length >= 2) {
          trailPolylineRef.current = L.polyline(savedTrail, {
            color: "#f59e0b",
            weight: 4,
            opacity: 0.85,
            smoothFactor: 1,
          }).addTo(map);
        }
      }

      mapInstanceRef.current = map;

      // Draw initial checkpoint markers
      drawCheckpointMarkers(L, layerGroup, checkpoints);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        guardMarkerRef.current = null;
        trailPolylineRef.current = null;
        checkpointLayerGroupRef.current = null;
        mapInitializedRef.current = false;
      }
    };
  }, [checkpoints.length > 0]);

  // --- Update checkpoint markers when data refreshes (without destroying the map) ---
  useEffect(() => {
    if (!mapInstanceRef.current || !checkpointLayerGroupRef.current || checkpoints.length === 0) return;
    import("leaflet").then((L) => {
      drawCheckpointMarkers(L, checkpointLayerGroupRef.current, checkpoints);
    });
  }, [checkpoints]);

  function drawCheckpointMarkers(L: any, layerGroup: any, cps: typeof checkpoints) {
    layerGroup.clearLayers();
    cps.forEach((cp, idx) => {
      const color = cp.checkedIn ? "#22c55e" : "#ef4444";
      const marker = L.circleMarker([cp.latitude, cp.longitude], {
        radius: 12,
        fillColor: color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      });
      marker.bindPopup(
        `<b>${idx + 1}. ${cp.name}</b><br>${cp.checkedIn ? "✅ Registrado" : "⏳ Pendiente"}<br><small>Radio: ${cp.radius}m</small>`,
      );
      layerGroup.addLayer(marker);

      if (!cp.checkedIn) {
        const circle = L.circle([cp.latitude, cp.longitude], {
          radius: cp.radius,
          fillColor: "#ef4444",
          color: "#ef4444",
          weight: 1,
          opacity: 0.3,
          fillOpacity: 0.1,
        });
        layerGroup.addLayer(circle);
      }
    });
  }

  // --- Update guard marker and trail in real-time ---
  useEffect(() => {
    if (!mapInstanceRef.current || !guardPos) return;
    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;

      const last = trailPointsRef.current[trailPointsRef.current.length - 1];
      // ~3 meters threshold to avoid GPS noise creating zigzag in the trail
      const isMoved =
        !last ||
        Math.abs(last[0] - guardPos.lat) > 0.000027 ||
        Math.abs(last[1] - guardPos.lng) > 0.000027;

      if (isMoved) {
        trailPointsRef.current.push([guardPos.lat, guardPos.lng]);
        if (trailPointsRef.current.length > 500) {
          trailPointsRef.current.splice(0, trailPointsRef.current.length - 500);
        }
        // Persist trail to localStorage for offline recovery
        saveTrailToStorage(id, trailPointsRef.current);
      }

      if (trailPointsRef.current.length >= 2) {
        if (trailPolylineRef.current) {
          trailPolylineRef.current.setLatLngs(trailPointsRef.current);
        } else {
          trailPolylineRef.current = L.polyline(trailPointsRef.current, {
            color: "#f59e0b",
            weight: 4,
            opacity: 0.85,
            smoothFactor: 1,
          }).addTo(map);
        }
      }

      if (guardMarkerRef.current) {
        guardMarkerRef.current.setLatLng([guardPos.lat, guardPos.lng]);
      } else {
        const guardIcon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:26px;height:26px;">
            <div style="position:absolute;inset:0;background:#f59e0b;border-radius:50%;opacity:0.3;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:absolute;inset:5px;background:#f59e0b;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>
          </div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        guardMarkerRef.current = L.marker([guardPos.lat, guardPos.lng], { icon: guardIcon })
          .addTo(map)
          .bindPopup("<b>Tu posicion</b>");
      }
    });
  }, [guardPos]);

  // --- GPS watch: starts when active, restarts on reconnect ---
  const startWatchPosition = useCallback(() => {
    if (!navigator.geolocation) return;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    // Full reset on each (re)start
    kalmanRef.current.reset();
    stabilizationBufferRef.current = [];
    gpsLockedRef.current = false;
    lastValidPosRef.current = null;
    setGpsStatus("searching");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const now = Date.now();

        // --- 1. Reject readings worse than 40m ---
        if (accuracy > 40) return;

        // --- 2. STABILIZATION PHASE: wait for 3 consecutive readings within 12m of each other ---
        if (!gpsLockedRef.current) {
          const buf = stabilizationBufferRef.current;
          buf.push({ lat: latitude, lng: longitude });

          // Keep only last 5 readings in buffer
          if (buf.length > 5) buf.splice(0, buf.length - 5);

          // Check if last 3 readings are all within 12m of the most recent one
          if (buf.length >= 3) {
            const latest = buf[buf.length - 1];
            const allClose = buf.slice(-3).every(
              (p) => getDistanceInMeters(p.lat, p.lng, latest.lat, latest.lng) <= 12,
            );
            if (allClose) {
              // GPS is locked — initialize Kalman at the stable position
              gpsLockedRef.current = true;
              kalmanRef.current.reset();
              kalmanRef.current.update(latest.lat, latest.lng, accuracy);
              lastValidPosRef.current = { lat: latest.lat, lng: latest.lng, ts: now };
              setGpsStatus("locked");
              setGuardPos({ lat: latest.lat, lng: latest.lng });
            }
          }
          // Still stabilizing — don't draw trail yet
          return;
        }

        // --- 3. TRACKING PHASE ---

        // Speed filter: discard impossible jumps (walking guard max ~2 m/s, sprinting ~4 m/s)
        const last = lastValidPosRef.current;
        if (last) {
          const elapsed = Math.max((now - last.ts) / 1000, 0.1);
          const rawDist = getDistanceInMeters(last.lat, last.lng, latitude, longitude);
          if (rawDist / elapsed > 4 && rawDist > 10) return; // impossible jump — discard
        }

        // --- 4. Kalman filter smoothing ---
        const smoothed = kalmanRef.current.update(latitude, longitude, accuracy);

        lastValidPosRef.current = { lat: smoothed.lat, lng: smoothed.lng, ts: now };
        setGuardPos({ lat: smoothed.lat, lng: smoothed.lng });

        // --- 5. Checkin detection: use GPS accuracy as dynamic buffer ---
        const extraBuffer = Math.min(accuracy * 0.3, 8);
        checkpoints.forEach((cp) => {
          if (cp.checkedIn) return;
          const dist = getDistanceInMeters(smoothed.lat, smoothed.lng, cp.latitude, cp.longitude);
          if (dist <= cp.radius + extraBuffer) {
            setNearbyCheckpoint(cp.name);
            handleCheckin(cp.id, smoothed.lat, smoothed.lng);
            setTimeout(() => setNearbyCheckpoint(null), 3000);
          }
        });
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }, [checkpoints, handleCheckin]);

  useEffect(() => {
    if (!isGuard || !isActive) return;

    startWatchPosition();

    const handleOnline = () => {
      setIsOffline(false);
      toast({ title: "Conexion restaurada — retomando rastreo" });
      startWatchPosition();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isGuard, isActive, startWatchPosition]);

  // Clear trail storage when round completes
  const handleStart = () => {
    clearTrailStorage(id);
    trailPointsRef.current = [];
    if (trailPolylineRef.current) {
      trailPolylineRef.current.setLatLngs([]);
    }
    startRound.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRoundQueryKey(id) });
          toast({ title: "Ronda iniciada" });
        },
      },
    );
  };

  const handleComplete = () => {
    completeRound.mutate(
      { id },
      {
        onSuccess: () => {
          clearTrailStorage(id);
          queryClient.invalidateQueries({ queryKey: getGetRoundQueryKey(id) });
          toast({ title: "Ronda completada" });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!round) {
    return <div className="p-6 text-muted-foreground">Ronda no encontrada</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight break-words" data-testid="text-round-name">
            {round.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{round.description}</p>
          <p className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
            <Building2 size={13} className="text-primary" />
            <span className="flex-shrink-0">Empresa:</span> <span className="font-semibold text-foreground truncate">{(round as any).companyName}</span>
          </p>
          {round.status === "active" && (
            <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 w-fit">
              <ElapsedTimer startedAt={round.startedAt} label="Tiempo en ronda" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {canStartRound && (
            <Button onClick={handleStart} disabled={startRound.isPending} data-testid="button-start-round" className="flex-1 sm:flex-none">
              <Play size={16} className="mr-2" />
              {round.status === "completed" ? "Iniciar de Nuevo" : "Iniciar Ronda"}
            </Button>
          )}
          {isGuard && round.status === "active" && (
            <Button onClick={handleComplete} disabled={completeRound.isPending} data-testid="button-complete-round" className="flex-1 sm:flex-none">
              <CheckCircle size={16} className="mr-2" />
              Completar Ronda
            </Button>
          )}
          <Badge
            variant={
              round.status === "completed" ? "default" : round.status === "active" ? "secondary" : "outline"
            }
          >
            {round.status === "pending" ? "Pendiente" : round.status === "active" ? "En Curso" : "Lista para reutilizar"}
          </Badge>
        </div>
      </div>

      {nearbyCheckpoint && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/15 border border-green-500/40 text-green-400 font-medium animate-pulse">
          <CheckCircle size={20} />
          Punto detectado: <span className="font-bold">{nearbyCheckpoint}</span> — registrado automaticamente
        </div>
      )}

      {isOffline && isGuard && isActive && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 font-medium">
          <WifiOff size={20} />
          Sin conexion — el recorrido se guarda localmente y se reanudara al reconectarte
        </div>
      )}

      {isGuard && isActive && !isOffline && gpsStatus === "searching" && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
          <Satellite size={18} className="flex-shrink-0 animate-pulse" />
          <div>
            <span className="font-semibold">Buscando señal GPS...</span>
            <span className="text-yellow-400/70 ml-2">Espera unos segundos hasta que se estabilice</span>
          </div>
        </div>
      )}

      {isGuard && isActive && !isOffline && gpsStatus === "locked" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm p-3 rounded-lg bg-green-500/10 border border-green-500/25">
          <div className="flex items-center gap-2 text-green-400">
            <Navigation size={16} className="flex-shrink-0" />
            <span className="font-semibold">GPS bloqueado</span>
            <span className="text-green-400/70">— rastreando en tiempo real</span>
          </div>
          {guardPos && (
            <span className="sm:ml-auto text-xs font-mono text-green-400/70">
              {guardPos.lat.toFixed(5)}, {guardPos.lng.toFixed(5)}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mapa de Ruta</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={mapRef} className="h-[320px] md:h-[420px] rounded-lg overflow-hidden border border-border" style={{ isolation: "isolate" }} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Puntos de Control ({round.completedCheckpoints}/{round.totalCheckpoints})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {checkpoints.map((cp, idx) => (
                  <div
                    key={cp.id}
                    className={`p-3 rounded-lg border transition-all ${
                      cp.checkedIn
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-secondary/30 border-border"
                    }`}
                    data-testid={`checkpoint-${cp.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <span
                          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                            cp.checkedIn ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{cp.name}</p>
                          {cp.checkedInAt && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(cp.checkedInAt).toLocaleTimeString("es-CL")}
                            </p>
                          )}
                          {!cp.checkedIn && (
                            <p className="text-xs text-muted-foreground">Radio: {cp.radius}m</p>
                          )}
                        </div>
                      </div>
                      {isGuard && round.status === "active" && !cp.checkedIn && (
                        <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded-lg bg-secondary/40">
                          <MapPin size={11} className="text-primary" />
                          <span>Auto GPS</span>
                        </div>
                      )}
                      {cp.checkedIn && <CheckCircle size={18} className="text-green-500 flex-shrink-0 mt-1" />}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
