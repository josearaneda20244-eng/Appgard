import { useEffect, useRef, useState, useCallback } from "react";
import { useGetGuardLocations, useListRounds } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Wifi, WifiOff, Route, Users, ChevronDown, ChevronUp, RefreshCw, Building2 } from "lucide-react";
import { ElapsedTimer } from "@/components/elapsed-timer";

const TRAIL_COLORS = [
  "#f59e0b", "#3b82f6", "#22c55e", "#ef4444", "#a855f7",
  "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#14b8a6",
];

interface TrailPoint { lat: number; lng: number; ts: number }

export default function LiveMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());
  const trailsRef = useRef<Map<number, any>>(new Map());
  const trailDataRef = useRef<Map<number, TrailPoint[]>>(new Map());
  const colorMapRef = useRef<Map<number, string>>(new Map());
  const colorIndexRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const { data: locations, isLoading, dataUpdatedAt } = useGetGuardLocations({
    query: { refetchInterval: 4000 },
  });

  const { data: activeRounds } = useListRounds(
    { status: "active" as any },
    { query: { refetchInterval: 8000 } },
  );

  const getGuardColor = useCallback((userId: number) => {
    if (!colorMapRef.current.has(userId)) {
      colorMapRef.current.set(userId, TRAIL_COLORS[colorIndexRef.current % TRAIL_COLORS.length]);
      colorIndexRef.current++;
    }
    return colorMapRef.current.get(userId)!;
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current!, { attributionControl: false, zoomControl: true }).setView([-33.4489, -70.6693], 14);
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(map);
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.85 }).addTo(map);
        mapInstanceRef.current = map;
        setMapReady(true);
      }
    });
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !locations) return;
    setLastUpdate(new Date());

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;
      const bounds = L.latLngBounds([]);
      const activeIds = new Set(locations.map((l) => l.userId));

      markersRef.current.forEach((_, id) => {
        if (!activeIds.has(id)) {
          try { map.removeLayer(markersRef.current.get(id)); } catch {}
          markersRef.current.delete(id);
        }
      });

      locations.forEach((loc) => {
        const color = getGuardColor(loc.userId);
        const isActive = loc.status !== "offline";

        if (!trailDataRef.current.has(loc.userId)) {
          trailDataRef.current.set(loc.userId, []);
        }
        const trail = trailDataRef.current.get(loc.userId)!;
        const lastPt = trail[trail.length - 1];
        const isMoved = !lastPt || Math.abs(lastPt.lat - loc.latitude) > 0.000005 || Math.abs(lastPt.lng - loc.longitude) > 0.000005;
        if (isMoved && isActive) {
          trail.push({ lat: loc.latitude, lng: loc.longitude, ts: Date.now() });
          if (trail.length > 300) trail.splice(0, trail.length - 300);
        }

        if (trail.length >= 2) {
          const coords: [number, number][] = trail.map((p) => [p.lat, p.lng]);
          if (trailsRef.current.has(loc.userId)) {
            try { map.removeLayer(trailsRef.current.get(loc.userId)); } catch {}
          }
          const poly = L.polyline(coords, {
            color,
            weight: 3,
            opacity: 0.8,
            smoothFactor: 1,
          }).addTo(map);
          trailsRef.current.set(loc.userId, poly);
        }

        const iconHtml = `
          <div style="position:relative;width:40px;height:40px;">
            ${isActive ? `<div style="position:absolute;inset:0;background:${color};border-radius:50%;opacity:0.25;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ""}
            <div style="position:absolute;inset:5px;background:${color};border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
              <svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='white'><circle cx='12' cy='8' r='4'/><path d='M12 14c-5 0-8 2.5-8 4v1h16v-1c0-1.5-3-4-8-4z'/></svg>
            </div>
            <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis;">${loc.userName.split(" ")[0]}</div>
          </div>`;

        const icon = L.divIcon({ className: "", html: iconHtml, iconSize: [40, 54], iconAnchor: [20, 20] });

        const statusLabel: Record<string, string> = { online: "En Linea", on_round: "En Ronda", offline: "Desconectado" };
        const since = new Date(loc.updatedAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        if (markersRef.current.has(loc.userId)) {
          const m = markersRef.current.get(loc.userId);
          m.setLatLng([loc.latitude, loc.longitude]);
          m.setIcon(icon);
        } else {
          const m = L.marker([loc.latitude, loc.longitude], { icon }).addTo(map);
          m.bindPopup(`<div style="min-width:160px;font-family:sans-serif"><b style="font-size:13px">${loc.userName}</b><br><span style="color:${color};font-weight:700">${statusLabel[loc.status] ?? loc.status}</span><br><small style="color:#888">Ultima senal: ${since}</small></div>`);
          markersRef.current.set(loc.userId, m);
        }

        if (isActive) bounds.extend([loc.latitude, loc.longitude]);
      });

      if (locations.filter((l) => l.status !== "offline").length > 0 && !mapInstanceRef.current._userInteracted) {
        try { map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 }); } catch {}
      }
    });
  }, [locations, mapReady, getGuardColor]);

  const focusGuard = (lat: number, lng: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current._userInteracted = true;
      mapInstanceRef.current.setView([lat, lng], 18);
    }
  };

  const onlineCount = locations?.filter((l) => l.status === "online").length ?? 0;
  const onRoundCount = locations?.filter((l) => l.status === "on_round").length ?? 0;
  const offlineCount = locations?.filter((l) => l.status === "offline").length ?? 0;

  return (
    <div className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 60px)" }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight">Mapa en Vivo</h1>
          {lastUpdate && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <RefreshCw size={9} className="animate-spin" style={{ animationDuration: "3s" }} />
              Actualizado {lastUpdate.toLocaleTimeString("es-CL")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-medium">
            <Wifi size={10} /> {onlineCount}
          </span>
          <span className="flex items-center gap-1 bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full font-medium">
            <Route size={10} /> {onRoundCount}
          </span>
          {offlineCount > 0 && (
            <span className="flex items-center gap-1 bg-gray-500/15 text-gray-400 px-2 py-0.5 rounded-full font-medium">
              <WifiOff size={10} /> {offlineCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
        <div ref={mapRef} className="absolute inset-0" style={{ isolation: "isolate" }} />

        <div className={`absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border transition-all duration-300 z-[500] ${panelOpen ? "max-h-52" : "max-h-10"}`}>
          <button
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => setPanelOpen((p) => !p)}
          >
            <span className="flex items-center gap-1.5">
              <Users size={12} />
              Guardias ({locations?.length ?? 0})
              {activeRounds && activeRounds.length > 0 && (
                <span className="ml-2 text-blue-400">· {activeRounds.length} ronda{activeRounds.length !== 1 ? "s" : ""} activa{activeRounds.length !== 1 ? "s" : ""}</span>
              )}
            </span>
            {panelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          {panelOpen && (
            <div className="overflow-x-hidden overflow-y-auto max-h-40 px-3 pb-3">
              {isLoading && (
                <p className="text-xs text-muted-foreground text-center py-2">Cargando ubicaciones...</p>
              )}
              {!isLoading && (!locations || locations.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-2">Sin guardias con GPS activo</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-2 min-w-0 lg:flex-wrap">
                {locations?.map((loc) => {
                  const color = getGuardColor(loc.userId);
                  const statusLabel: Record<string, string> = { online: "En Linea", on_round: "En Ronda", offline: "Desconectado" };
                  const since = new Date(loc.updatedAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
                  const round = activeRounds?.find((r) => r.assignedToId === loc.userId);
                  return (
                    <button
                      key={loc.userId}
                      onClick={() => focusGuard(loc.latitude, loc.longitude)}
                      className="flex items-center gap-2 bg-secondary/40 hover:bg-secondary/70 rounded-lg px-3 py-2 transition-colors text-left min-w-0 lg:min-w-[160px]"
                    >
                      <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs text-white" style={{ background: color }}>
                        {loc.userName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{loc.userName}</p>
                        <p className="text-[10px]" style={{ color }}>{statusLabel[loc.status]}</p>
                        {round && (
                          <>
                            <p className="text-[10px] text-muted-foreground truncate">{round.name}</p>
                            <p className="text-[10px] text-primary truncate flex items-center gap-1">
                              <Building2 size={9} />
                              {(round as any).companyName}
                            </p>
                            <ElapsedTimer
                              startedAt={round.startedAt}
                              label="Tiempo"
                              className="text-[10px] text-blue-300"
                              iconSize={10}
                            />
                          </>
                        )}
                        <p className="text-[10px] text-muted-foreground">{since}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
