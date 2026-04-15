import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SetupStatus = {
  needsSetup: boolean;
};

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [rut, setRut] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [serverWaking, setServerWaking] = useState(false);
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupForm, setSetupForm] = useState({
    rut: "",
    name: "",
    email: "",
    phone: "",
    accessCode: "",
  });

  useEffect(() => {
    let active = true;
    const apiBase = import.meta.env.VITE_API_URL ?? "";

    const attemptFetch = async (attempt: number): Promise<void> => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(`${apiBase}/api/setup/status`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error("Respuesta no válida del servidor");
        const data = (await res.json()) as SetupStatus;
        if (active) {
          setNeedsSetup(data.needsSetup);
          setCheckingSetup(false);
          setServerWaking(false);
        }
      } catch {
        if (!active) return;
        if (attempt < 5) {
          if (active) setServerWaking(true);
          await new Promise((r) => setTimeout(r, 5000));
          if (active) await attemptFetch(attempt + 1);
        } else {
          if (active) {
            setCheckingSetup(false);
            setServerWaking(false);
            toast({
              variant: "destructive",
              title: "No se pudo conectar con el servidor",
              description: "Revisa que la API y la base de datos esten configuradas correctamente.",
            });
          }
        }
      }
    };

    attemptFetch(0);
    return () => {
      active = false;
    };
  }, [toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { rut, accessCode } },
      {
        onSuccess: (data) => {
          login(data.token, data.user);
          setLocation("/dashboard");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Credenciales incorrectas",
            description: "RUT o codigo de acceso invalido. Intenta de nuevo.",
          });
        },
      }
    );
  };

  const handleInitialSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupForm.rut || !setupForm.name || !setupForm.email || !setupForm.phone || !setupForm.accessCode) {
      toast({ variant: "destructive", title: "Completa todos los campos" });
      return;
    }

    setSetupSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/setup/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setupForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo crear el administrador");
      login(data.token, data.user);
      toast({ title: "Administrador creado correctamente" });
      setLocation("/dashboard");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error en configuracion inicial",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setSetupSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
      <div className="absolute w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -top-[400px] -right-[400px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-4">
        <div className="flex flex-col items-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground mb-4 shadow-xl shadow-primary/30">
            <Shield size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase">GARD SECURITY</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mt-1">Tactical Operations Platform</p>
        </div>

        <Card className="border-border/50 shadow-2xl backdrop-blur-sm bg-card/95">
          <CardHeader className="pb-5">
            <CardTitle className="text-xl">{needsSetup ? "Configuracion inicial" : "Acceso Seguro"}</CardTitle>
            <CardDescription>
              {serverWaking
                ? "Iniciando servidor, espera un momento..."
                : checkingSetup
                  ? "Verificando estado del sistema..."
                  : needsSetup
                    ? "Crea el primer administrador real. No se cargaran datos de prueba."
                    : "Ingresa tu RUT y codigo de acceso para autenticarte."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checkingSetup ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...
              </div>
            ) : needsSetup ? (
              <form onSubmit={handleInitialSetup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="setup-rut">RUT administrador</Label>
                  <Input id="setup-rut" value={setupForm.rut} onChange={(e) => setSetupForm((f) => ({ ...f, rut: e.target.value }))} placeholder="RUT del administrador" autoComplete="username" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-name">Nombre completo</Label>
                  <Input id="setup-name" value={setupForm.name} onChange={(e) => setSetupForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre del administrador" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-email">Email</Label>
                  <Input id="setup-email" type="email" value={setupForm.email} onChange={(e) => setSetupForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email corporativo" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-phone">Telefono</Label>
                  <Input id="setup-phone" value={setupForm.phone} onChange={(e) => setSetupForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Telefono corporativo" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-code">Codigo de acceso</Label>
                  <Input id="setup-code" type="password" value={setupForm.accessCode} onChange={(e) => setSetupForm((f) => ({ ...f, accessCode: e.target.value }))} autoComplete="new-password" required />
                </div>
                <Button type="submit" className="w-full mt-2" size="lg" disabled={setupSaving}>
                  {setupSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</> : <><UserPlus className="mr-2 h-4 w-4" /> Crear Administrador</>}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rut">RUT</Label>
                  <Input id="rut" placeholder="RUT del usuario" value={rut} onChange={(e) => setRut(e.target.value)} className="font-mono bg-background/50" autoComplete="username" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessCode">Codigo de Acceso</Label>
                  <Input id="accessCode" type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} className="font-mono bg-background/50" autoComplete="current-password" required />
                </div>
                <Button type="submit" className="w-full mt-2" size="lg" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Autenticando...</> : "Entrar al Panel"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-[10px] text-muted-foreground font-mono">
          <p>SOLO PERSONAL AUTORIZADO · GARD Security Systems v1.0.5</p>
        </div>
      </div>
    </div>
  );
}
