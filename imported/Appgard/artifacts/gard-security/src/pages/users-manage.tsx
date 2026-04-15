import { useState } from "react";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Shield, Users, Pencil, Search } from "lucide-react";

type UserForm = {
  rut: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  accessCode: string;
};

const emptyForm: UserForm = { rut: "", name: "", email: "", phone: "", role: "guard", accessCode: "" };

const roleLabels: Record<string, string> = {
  guard: "Guardia",
  supervisor: "Supervisor",
  admin: "Administrador",
};

const roleColors: Record<string, string> = {
  guard: "bg-blue-500/10 text-blue-400",
  supervisor: "bg-purple-500/10 text-purple-400",
  admin: "bg-amber-500/10 text-amber-400",
};

export default function UsersManage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editForm, setEditForm] = useState<Partial<UserForm>>({});

  const { data: users, isLoading } = useListUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const filtered = (users ?? []).filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.rut.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.rut || !form.name || !form.email || !form.phone || !form.accessCode) {
      toast({ variant: "destructive", title: "Completa todos los campos" });
      return;
    }
    createUser.mutate(
      { data: form as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "Usuario creado correctamente" });
          setCreateOpen(false);
          setForm(emptyForm);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error al crear usuario" });
        },
      }
    );
  };

  const openEdit = (user: NonNullable<typeof users>[0]) => {
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, phone: user.phone, role: user.role });
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!editingId || !editForm.name || !editForm.email || !editForm.phone) {
      toast({ variant: "destructive", title: "Completa todos los campos" });
      return;
    }
    updateUser.mutate(
      { id: editingId, data: editForm as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "Usuario actualizado" });
          setEditOpen(false);
          setEditingId(null);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error al actualizar usuario" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteUser.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "Usuario eliminado" });
          setDeleteId(null);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error al eliminar usuario" });
          setDeleteId(null);
        },
      }
    );
  };

  const byRole = (role: string) => filtered.filter((u) => u.role === role);

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-users-title">
            <Users size={24} className="text-primary" />
            Equipo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gestiona los usuarios del sistema</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-user" className="w-full sm:w-auto">
              <UserPlus size={16} className="mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Usuario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>RUT</Label>
                  <Input value={form.rut} onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" data-testid="input-user-rut" />
                </div>
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Juan Perez" data-testid="input-user-name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="juan@empresa.cl" data-testid="input-user-email" />
                </div>
                <div className="space-y-2">
                  <Label>Telefono</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+56 9 1234 5678" data-testid="input-user-phone" />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guard">Guardia</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Codigo de acceso</Label>
                  <Input
                    type="password"
                    value={form.accessCode}
                    onChange={(e) => setForm((f) => ({ ...f, accessCode: e.target.value }))}
                    placeholder="••••••"
                    data-testid="input-user-access-code"
                  />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={createUser.isPending} className="w-full">
                {createUser.isPending ? "Creando..." : "Crear Usuario"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, RUT o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {(["admin", "supervisor", "guard"] as const).map((role) => {
            const group = byRole(role);
            if (group.length === 0) return null;
            return (
              <div key={role}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  <Shield size={12} />
                  {roleLabels[role]}s ({group.length})
                </h2>
                <div className="grid gap-3">
                  {group.map((u) => (
                    <Card key={u.id} className="glass-panel overflow-hidden" data-testid={`card-user-${u.id}`}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{u.name}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>RUT: {u.rut}</span>
                                <span className="break-all">{u.email}</span>
                                <span>{u.phone}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
                            <span className={`text-xs px-2 py-1 rounded-full ${roleColors[u.role]}`}>
                              {roleLabels[u.role]}
                            </span>
                            <Badge variant={u.active ? "default" : "secondary"}>
                              {u.active ? "Activo" : "Inactivo"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(u)}
                              data-testid={`button-edit-user-${u.id}`}
                            >
                              <Pencil size={14} className="text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(u.id)}
                              data-testid={`button-delete-user-${u.id}`}
                            >
                              <Trash2 size={14} className="text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <Card className="glass-panel">
              <CardContent className="py-16 text-center text-muted-foreground">
                {search ? "No se encontraron usuarios" : "Sin usuarios registrados"}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editForm.email ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Telefono</Label>
                <Input value={editForm.phone ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={editForm.role ?? "guard"} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guard">Guardia</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleEdit} disabled={updateUser.isPending} className="w-full">
              {updateUser.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion es irreversible. El usuario perdera acceso al sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
