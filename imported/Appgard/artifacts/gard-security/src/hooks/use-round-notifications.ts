import { useEffect, useRef } from "react";
import { useListRounds } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

const NOTIFIED_KEY = "gard_notified_rounds";
const NOTIFY_BEFORE_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 30 * 1000;

function formatFecha(date: Date): string {
  return date.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatHora(date: Date): string {
  return date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function getNotifiedIds(): Set<number> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveNotifiedId(id: number) {
  try {
    const ids = getNotifiedIds();
    ids.add(id);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]));
  } catch {}
}

async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function showBrowserNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "gard-round-alert",
      requireInteraction: true,
    });
  } catch {}
}

export function useRoundNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const permissionRequestedRef = useRef(false);

  const { data: rounds, refetch } = useListRounds(undefined, {
    query: {
      enabled: !!user,
      refetchInterval: POLL_INTERVAL_MS,
    },
  });

  useEffect(() => {
    if (!user) return;
    if (!permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      requestNotificationPermission();
    }
  }, [user]);

  useEffect(() => {
    if (!rounds || !user) return;

    const now = new Date();
    const notified = getNotifiedIds();

    rounds.forEach((round) => {
      if (!round.scheduledAt) return;
      if (round.status !== "pending") return;
      if (notified.has(round.id)) return;

      const scheduledAt = new Date(round.scheduledAt);
      const diff = scheduledAt.getTime() - now.getTime();

      if (diff > 0 && diff <= NOTIFY_BEFORE_MS) {
        const minutos = Math.round(diff / 60000);
        const fecha = formatFecha(scheduledAt);
        const hora = formatHora(scheduledAt);
        const body = `Tu ronda "${round.name}" comienza en ${minutos} minuto${minutos !== 1 ? "s" : ""}.\n${fecha} a las ${hora}`;

        saveNotifiedId(round.id);

        showBrowserNotification("Ronda por comenzar - GARD Security", body);

        toast({
          title: `Ronda por comenzar en ${minutos} min`,
          description: `"${round.name}" — ${fecha} a las ${hora}`,
          duration: 12000,
        });
      }
    });
  }, [rounds, user, toast]);

  return { refetch };
}
