import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2, ChevronDown, ChevronUp, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const testCredentials = [
  { rol: "Guardia", rut: "11.111.111-1", codigo: "1234", color: "text-blue-400 border-blue-500/30 bg-blue-500/5" },
  { rol: "Guardia 2", rut: "44.444.444-4", codigo: "4444", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/5" },
  { rol: "Supervisor", rut: "22.222.222-2", codigo: "2222", color: "text-orange-400 border-orange-500/30 bg-orange-500/5" },
  { rol: "Jefe / Admin", rut: "33.333.333-3", codigo: "3333", color: "text-purple-400 border-purple-500/30 bg-purple-500/5" },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [rut, setRut] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [showCreds, setShowCreds] = useState(false);

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

  const fillCredentials = (cred: { rut: string; codigo: string }) => {
    setRut(cred.rut);
    setAccessCode(cred.codigo);
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
            <CardTitle className="text-xl">Acceso Seguro</CardTitle>
            <CardDescription>
              Ingresa tu RUT y codigo de acceso para autenticarte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rut">RUT</Label>
                <Input
                  id="rut"
                  placeholder="12.345.678-9"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  className="font-mono bg-background/50"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessCode">Codigo de Acceso</Label>
                <Input
                  id="accessCode"
                  type="password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="font-mono bg-background/50"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full mt-2"
                size="lg"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Autenticando...</>
                ) : (
                  "Entrar al Panel"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/70">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowCreds(!showCreds)}
          >
            <span className="flex items-center gap-2">
              <UserCheck size={15} className="text-primary" />
              Credenciales de prueba
            </span>
            {showCreds ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {showCreds && (
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {testCredentials.map((cred) => (
                <button
                  key={cred.rut}
                  type="button"
                  onClick={() => fillCredentials(cred)}
                  className={`text-left rounded-xl border px-3 py-2.5 transition-all hover:opacity-80 active:scale-95 ${cred.color}`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide">{cred.rol}</p>
                  <p className="font-mono text-xs text-foreground/80 mt-0.5">{cred.rut}</p>
                  <p className="font-mono text-xs text-foreground/60">cod: {cred.codigo}</p>
                </button>
              ))}
              <p className="col-span-2 text-[10px] text-muted-foreground text-center pt-1">
                Haz clic en un perfil para rellenar el formulario automaticamente
              </p>
            </div>
          )}
        </Card>

        <div className="text-center text-[10px] text-muted-foreground font-mono">
          <p>SOLO PERSONAL AUTORIZADO · GARD Security Systems v1.0.4</p>
        </div>
      </div>
    </div>
  );
}
