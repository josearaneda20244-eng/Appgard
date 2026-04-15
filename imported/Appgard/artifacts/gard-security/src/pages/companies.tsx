import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { useListRounds } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Route, CheckCircle, TrendingUp, Search,
  Plus, Pencil, Trash2, Phone, Mail, MapPin, User, FileText,
} from "lucide-react";

type Company = {
  id: number;
  name: string;
  rut?: string | null;
  address?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
};

type CompanyForm = {
  name: string;
  rut: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
};

const emptyForm: CompanyForm = { name: "", rut: "", address: "", contactName: "", contactPhone: "", contactEmail: "", notes: "" };

function useCompanies(token: string | null) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const base = "/api/companies";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(base, { headers });
      if (res.ok) setCompanies(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const create = async (data: CompanyForm): Promise<boolean> => {
    const res = await fetch(base, { method: "POST", headers, body: JSON.stringify(data) });
    if (res.ok) { await load(); return true; }
    return false;
  };

  const update = async (id: number, data: Partial<CompanyForm>): Promise<boolean> => {
    const res = await fetch(`${base}/${id}`, { method: "PATCH", headers, body: JSON.stringify(data) });
    if (res.ok) { await load(); return true; }
    return false;
  };

  const remove = async (id: number): Promise<boolean> => {
    const res = await fetch(`${base}/${id}`, { method: "DELETE", headers });
    if (res.ok) { await load(); return true; }
    return false;
  };

  return { companies, loading, reload: load, create, update, remove };
}

export default function Companies() {
  const { token } = useAuth();
  const { toast } = useToast();
  const { companies, loading, create, update, remove } = useCompanies(token);
  const { data: rounds } = useListRounds(undefined, { query: { refetchInterval: 30000 } });

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const roundsByCompany = (name: string) => rounds?.filter((r) => r.companyName === name) ?? [];

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contactName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => {
    const compRounds = roundsByCompany(c.name);
    return compRounds.some((r) => r.status === "active");
  }).length;
  const avgCoverage = (() => {
    if (!rounds || companies.length === 0) return 0;
    let total = 0, count = 0;
    companies.forEach((c) => {
      const cr = roundsByCompany(c.name);
      const totalCp = cr.reduce((a, r) => a + r.totalCheckpoints, 0);
      const doneCp = cr.reduce((a, r) => a + r.completedCheckpoints, 0);
      if (totalCp > 0) { total += (doneCp / totalCp) * 100; count++; }
    });
    return count > 0 ? Math.round(total / count) : 0;
  })();

  const openCreate = () => { setForm(emptyForm); setCreateOpen(true); };
  const openEdit = (c: Company) => {
    setEditingCompany(c);
    setForm({ name: c.name, rut: c.rut ?? "", address: c.address ?? "", contactName: c.contactName ?? "", contactPhone: c.contactPhone ?? "", contactEmail: c.contactEmail ?? "", notes: c.notes ?? "" });
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast({ variant: "destructive", title: "El nombre es requerido" }); return; }
    setSaving(true);
    const ok = await create(form);
    setSaving(false);
    if (ok) { toast({ title: "Empresa creada" }); setCreateOpen(false); setForm(emptyForm); }
    else toast({ variant: "destructive", title: "Error al crear empresa" });
  };

  const handleEdit = async () => {
    if (!editingCompany || !form.name.trim()) { toast({ variant: "destructive", title: "El nombre es requerido" }); return; }
    setSaving(true);
    const ok = await update(editingCompany.id, form);
    setSaving(false);
    if (ok) { toast({ title: "Empresa actualizada" }); setEditingCompany(null); }
    else toast({ variant: "destructive", title: "Error al actualizar empresa" });
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const ok = await remove(deletingId);
    if (ok) toast({ title: "Empresa eliminada" });
    else toast({ variant: "destructive", title: "Error al eliminar empresa" });
    setDeletingId(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 size={24} className="text-primary" />
            Empresas Clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona las empresas con las que trabajas</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus size={16} className="mr-2" />
          Nueva Empresa
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="glass-panel">
          <CardContent className="p-4">
            <Building2 size={18} className="text-primary" />
            <p className="text-2xl font-bold mt-2">{totalCompanies}</p>
            <p className="text-xs text-muted-foreground">Total empresas</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <Route size={18} className="text-blue-400" />
            <p className="text-2xl font-bold mt-2">{activeCompanies}</p>
            <p className="text-xs text-muted-foreground">Con rondas activas</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <TrendingUp size={18} className="text-green-400" />
            <p className="text-2xl font-bold mt-2">{avgCoverage}%</p>
            <p className="text-xs text-muted-foreground">Cobertura promedio</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar empresa o contacto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-16 text-center">
            <Building2 size={36} className="text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground mb-4">{search ? "No se encontraron empresas" : "Aun no tienes empresas registradas"}</p>
            {!search && <Button onClick={openCreate}><Plus size={14} className="mr-1.5" />Agregar primera empresa</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((company) => {
            const compRounds = roundsByCompany(company.name);
            const completed = compRounds.filter((r) => r.status === "completed").length;
            const active = compRounds.filter((r) => r.status === "active").length;
            const totalCp = compRounds.reduce((a, r) => a + r.totalCheckpoints, 0);
            const doneCp = compRounds.reduce((a, r) => a + r.completedCheckpoints, 0);
            const coverage = totalCp > 0 ? Math.round((doneCp / totalCp) * 100) : 0;
            const coverageColor = coverage >= 80 ? "text-green-400" : coverage >= 50 ? "text-yellow-400" : totalCp > 0 ? "text-red-400" : "text-muted-foreground";
            const coverageBg = coverage >= 80 ? "bg-green-500" : coverage >= 50 ? "bg-yellow-500" : totalCp > 0 ? "bg-red-500" : "bg-muted";

            return (
              <Card key={company.id} className="glass-panel overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <Building2 size={16} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{company.name}</h3>
                        {company.rut && <p className="text-xs text-muted-foreground font-mono">{company.rut}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {active > 0 && <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">Activa</Badge>}
                      <button onClick={() => openEdit(company)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeletingId(company.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  {(company.contactName || company.contactPhone || company.contactEmail || company.address) && (
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {company.contactName && (
                        <p className="flex items-center gap-1.5"><User size={11} className="flex-shrink-0" />{company.contactName}</p>
                      )}
                      {company.contactPhone && (
                        <p className="flex items-center gap-1.5"><Phone size={11} className="flex-shrink-0" />{company.contactPhone}</p>
                      )}
                      {company.contactEmail && (
                        <p className="flex items-center gap-1.5 break-all"><Mail size={11} className="flex-shrink-0" />{company.contactEmail}</p>
                      )}
                      {company.address && (
                        <p className="flex items-center gap-1.5"><MapPin size={11} className="flex-shrink-0" />{company.address}</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-secondary/30 p-2">
                      <p className="text-lg font-bold text-green-400">{completed}</p>
                      <p className="text-[10px] text-muted-foreground">Completadas</p>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-2">
                      <p className="text-lg font-bold text-blue-400">{active}</p>
                      <p className="text-[10px] text-muted-foreground">Activas</p>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-2">
                      <p className="text-lg font-bold text-muted-foreground">{compRounds.length}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                  </div>

                  {totalCp > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1"><CheckCircle size={11} />Cobertura</span>
                        <span className={`font-semibold ${coverageColor}`}>{coverage}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${coverageBg}`} style={{ width: `${coverage}%` }} />
                      </div>
                    </div>
                  )}

                  {company.notes && (
                    <p className="text-xs text-muted-foreground border-t border-border/40 pt-2 flex gap-1.5">
                      <FileText size={11} className="flex-shrink-0 mt-0.5" />
                      {company.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva Empresa</DialogTitle></DialogHeader>
          <CompanyFormFields form={form} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))} />
          <Button onClick={handleCreate} disabled={saving} className="w-full mt-2">
            {saving ? "Creando..." : "Crear Empresa"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={editingCompany !== null} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Empresa</DialogTitle></DialogHeader>
          <CompanyFormFields form={form} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))} />
          <Button onClick={handleEdit} disabled={saving} className="w-full mt-2">
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion es irreversible. Las rondas asociadas no se eliminaran, pero perderan la referencia a esta empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CompanyFormFields({ form, onChange }: { form: CompanyForm; onChange: (key: keyof CompanyForm, value: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label>Nombre de la empresa <span className="text-destructive">*</span></Label>
          <Input value={form.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Ej: Supermercado El Roble" />
        </div>
        <div className="space-y-2">
          <Label>RUT empresa</Label>
          <Input value={form.rut} onChange={(e) => onChange("rut", e.target.value)} placeholder="76.123.456-7" />
        </div>
        <div className="space-y-2">
          <Label>Direccion</Label>
          <Input value={form.address} onChange={(e) => onChange("address", e.target.value)} placeholder="Av. Siempre Viva 123" />
        </div>
        <div className="space-y-2">
          <Label>Contacto</Label>
          <Input value={form.contactName} onChange={(e) => onChange("contactName", e.target.value)} placeholder="Nombre del encargado" />
        </div>
        <div className="space-y-2">
          <Label>Telefono contacto</Label>
          <Input value={form.contactPhone} onChange={(e) => onChange("contactPhone", e.target.value)} placeholder="+56 9 1234 5678" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Email contacto</Label>
          <Input value={form.contactEmail} onChange={(e) => onChange("contactEmail", e.target.value)} placeholder="contacto@empresa.cl" type="email" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Notas adicionales</Label>
          <Textarea value={form.notes} onChange={(e) => onChange("notes", e.target.value)} placeholder="Observaciones, horarios especiales, etc." rows={2} />
        </div>
      </div>
    </div>
  );
}
