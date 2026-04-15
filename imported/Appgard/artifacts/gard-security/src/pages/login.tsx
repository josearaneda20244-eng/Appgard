import { useLocation } from "wouter";
  import { useAuth } from "@/components/auth-provider";
  import { useLogin } from "@workspace/api-client-react";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
  import { Shield, Loader2 } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";
  import { useState } from "react";

  export default function Login() {
    const [, setLocation] = useLocation();
    const { login } = useAuth();
    const { toast } = useToast();
    const [rut, setRut] = useState("");
    const [accessCode, setAccessCode] = useState("");

    const loginMutation = useLogin({
      mutation: {
        retry: (failureCount, error: any) => {
          const status = error?.status ?? error?.response?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 4;
        },
        retryDelay: (attempt) => Math.min(3000 * (attempt + 1), 12000),
      },
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      loginMutation.mutate(
        { data: { rut, accessCode } },
        {
          onSuccess: (data) => {
            login(data.token, data.user);
            setLocation("/dashboard");
          },
          onError: (error: any) => {
            const status = error?.status ?? error?.response?.status;
            const isAuthError = status && status >= 400 && status < 500;
            toast({
              variant: "destructive",
              title: isAuthError ? "Credenciales incorrectas" : "Error de conexion",
              description: isAuthError
                ? "RUT o codigo de acceso invalido. Intenta de nuevo."
                : "El servidor tardo en responder. Intentando reconectar...",
            });
          },
        }
      );
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
                {loginMutation.isPending
                  ? "Conectando con el servidor..."
                  : "Ingresa tu RUT y codigo de acceso para autenticarte."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rut">RUT</Label>
                  <Input
                    id="rut"
                    placeholder="RUT del usuario"
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
                <Button type="submit" className="w-full mt-2" size="lg" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando...</>
                  ) : (
                    "Entrar al Panel"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center text-[10px] text-muted-foreground font-mono">
            <p>SOLO PERSONAL AUTORIZADO · GARD Security Systems v1.0.5</p>
          </div>
        </div>
      </div>
    );
  }
  