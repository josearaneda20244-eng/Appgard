import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function ElapsedTimer({
  startedAt,
  completedAt,
  label = "Tiempo en ronda",
  className = "",
  iconSize = 14,
}: {
  startedAt?: string | null;
  completedAt?: string | null;
  label?: string;
  className?: string;
  iconSize?: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || completedAt) return;

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt, completedAt]);

  if (!startedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : now;

  return (
    <span className={`inline-flex items-center gap-1 font-mono ${className}`}>
      <Clock size={iconSize} />
      <span className="font-sans">{label}:</span>
      {formatElapsed(end - start)}
    </span>
  );
}