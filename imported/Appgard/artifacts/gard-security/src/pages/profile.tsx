import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Calendar, Hash, LogOut, Shield, KeyRound, UserCheck, Clock } from "lucide-react";
import { useLocation } from "wouter";

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; gradient: string }> = {
  guard: {
    label: "Guardia",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
    gradient: "from-blue-600 to-blue-800",
  },
  supervisor: {
    label: "Supervisor",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    gradient: "from-amber-600 to-orange-700",
  },
  admin: {
    label: "Administrador",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/30",
    gradient: "from-purple-600 to-purple-800",
  },
};

export default function Profile() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  if (!user) return null;

  const role = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.guard;
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const memberSince = new Date(user.createdAt);
  const now = new Date();
  const monthsActive = Math.floor(
    (now.getTime() - memberSince.getTime()) / (1000 * 60 * 60 * 24 * 30),
  );

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      {/* Header banner */}
      <div className={`rounded-2xl bg-gradient-to-br ${role.gradient} p-5 md:p-7 relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 1px, transparent 1px), radial-gradient(circle at 20% 80%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold text-white border border-white/30 flex-shrink-0 shadow-lg">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white tracking-tight break-words" data-testid="text-user-name">
              {user.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full border border-white/30">
                <Shield size={12} />
                {role.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${user.active ? "bg-green-400/20 text-green-200 border border-green-400/40" : "bg-red-400/20 text-red-200 border border-red-400/40"}`}>
                <UserCheck size={12} />
                {user.active ? "Cuenta activa" : "Cuenta inactiva"}
              </span>
            </div>
            {monthsActive > 0 && (
              <p className="text-white/60 text-xs mt-2 flex items-center gap-1">
                <Clock size={11} />
                Miembro desde hace {monthsActive} {monthsActive === 1 ? "mes" : "meses"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info grid */}
      <Card>
        <CardContent className="p-4 md:p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Informacion de la cuenta
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow icon={Hash} label="RUT" value={user.rut} testId="text-user-rut" mono />
            <InfoRow icon={Mail} label="Correo electronico" value={user.email} testId="text-user-email" />
            <InfoRow icon={Phone} label="Telefono" value={user.phone || "No registrado"} testId="text-user-phone" />
            <InfoRow
              icon={Calendar}
              label="Fecha de registro"
              value={memberSince.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
              testId="text-user-date"
            />
          </div>
        </CardContent>
      </Card>

      {/* Access code card — most useful for guards */}
      {user.accessCode && (
        <Card className={`border ${role.bg}`}>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-secondary`}>
                <KeyRound size={20} className={role.color} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Codigo de acceso
                </p>
                <p className="text-2xl font-bold font-mono tracking-widest mt-0.5" data-testid="text-user-access-code">
                  {user.accessCode}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Usa este codigo para iniciar sesion en cualquier dispositivo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role permissions summary */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Permisos del rol
          </p>
          <div className="flex flex-wrap gap-2">
            {user.role === "guard" && (
              <>
                <PermBadge label="Ver rondas asignadas" />
                <PermBadge label="Registrar puntos de control" />
                <PermBadge label="Reportar incidentes" />
                <PermBadge label="Alerta de panico" />
                <PermBadge label="Chat" />
              </>
            )}
            {user.role === "supervisor" && (
              <>
                <PermBadge label="Crear rondas" />
                <PermBadge label="Ver todos los guardias" />
                <PermBadge label="Mapa en tiempo real" />
                <PermBadge label="Gestion de incidentes" />
                <PermBadge label="Reportes" />
                <PermBadge label="Chat" />
              </>
            )}
            {user.role === "admin" && (
              <>
                <PermBadge label="Acceso total" />
                <PermBadge label="Gestion de usuarios" />
                <PermBadge label="Crear rondas" />
                <PermBadge label="Ver todos los guardias" />
                <PermBadge label="Mapa en tiempo real" />
                <PermBadge label="Reportes completos" />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="destructive"
        className="w-full"
        onClick={handleLogout}
        data-testid="button-logout"
      >
        <LogOut size={16} className="mr-2" />
        Cerrar sesion
      </Button>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  testId,
  mono,
}: {
  icon: any;
  label: string;
  value: string;
  testId?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
      <div className="p-2 rounded-lg bg-secondary flex-shrink-0">
        <Icon size={15} className="text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-medium break-all ${mono ? "font-mono" : ""}`} data-testid={testId}>
          {value}
        </p>
      </div>
    </div>
  );
}

function PermBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
      {label}
    </span>
  );
}
