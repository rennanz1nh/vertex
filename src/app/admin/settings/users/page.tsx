"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, UserPlus, KeyRound, Shield, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { SettingsHeader } from "@/components/admin/SettingsHeader";
import { authedFetch } from "@/lib/admin-fetch";
import { useAuth } from "@/hooks/useAuth";

// Phone rows show the last login in the same format as the table.
function formatLastLogin(at: string | null | undefined) {
  return at
    ? new Date(at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "Nunca";
}

type AppUser = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
};

export default function UsersSettingsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", display_name: "", role: "user" });
  const [creating, setCreating] = useState(false);

  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [roleTarget, setRoleTarget] = useState<AppUser | null>(null);
  const [newRole, setNewRole] = useState("user");
  const [changingRole, setChangingRole] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users);
    } catch (e: any) {
      setError(e.message || "Falha ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  }

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreate(false);
      setCreateForm({ email: "", password: "", display_name: "", role: "user" });
      flashSuccess("Usuário criado com sucesso");
      fetchUsers();
    } catch (e: any) {
      setError(e.message || "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    setResetting(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: resetTarget.id, action: "reset_password", password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResetTarget(null);
      setNewPassword("");
      flashSuccess(`Senha de ${resetTarget.email} alterada`);
    } catch (e: any) {
      setError(e.message || "Erro ao resetar senha");
    } finally {
      setResetting(false);
    }
  }

  async function handleChangeRole() {
    if (!roleTarget) return;
    setChangingRole(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: roleTarget.id, action: "change_role", role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRoleTarget(null);
      flashSuccess(`Role de ${roleTarget.email} alterado para ${data.role}`);
      fetchUsers();
    } catch (e: any) {
      setError(e.message || "Erro ao alterar role");
    } finally {
      setChangingRole(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <SettingsHeader />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Acesso restrito a administradores.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-md:space-y-4">
      <SettingsHeader />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="max-md:p-4">
          <div className="flex items-center justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 max-md:text-xl">
                <Users className="h-5 w-5" />
                Gerenciar Usuários
              </CardTitle>
              <CardDescription>Criar usuários, alterar senhas e gerenciar permissões.</CardDescription>
            </div>
            <Button onClick={() => setShowCreate(true)} className="bg-black hover:bg-black/80 text-white max-md:w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent className="max-md:px-4 max-md:pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando...
            </div>
          ) : (
            <>
            {/* Phones: one block per user with the two actions side by side */}
            <ul className="-mx-4 divide-y border-y md:hidden">
              {users.map((u) => (
                <li key={u.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{u.display_name || u.email}</p>
                      {u.display_name && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
                      <p className="text-[11px] text-muted-foreground">Último login: {formatLastLogin(u.last_sign_in_at)}</p>
                    </div>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"} className="shrink-0">
                      {u.role === "admin" ? "Admin" : "Usuário"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setResetTarget(u); setNewPassword(""); }}>
                      <KeyRound className="h-3.5 w-3.5 mr-1" />
                      Senha
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setRoleTarget(u); setNewRole(u.role === "admin" ? "user" : "admin"); }}>
                      <Shield className="h-3.5 w-3.5 mr-1" />
                      Role
                    </Button>
                  </div>
                </li>
              ))}
              {users.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</li>}
            </ul>
            <div className="max-md:hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Último login</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{u.display_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role === "admin" ? "Admin" : "Usuário"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Nunca"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1.5 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setResetTarget(u);
                            setNewPassword("");
                          }}
                        >
                          <KeyRound className="h-3.5 w-3.5 mr-1" />
                          Senha
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRoleTarget(u);
                            setNewRole(u.role === "admin" ? "user" : "admin");
                          }}
                        >
                          <Shield className="h-3.5 w-3.5 mr-1" />
                          Role
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create user dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Crie um novo usuário com e-mail e senha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                placeholder="Nome do usuário"
                value={createForm.display_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input
                type="text"
                placeholder="Senha inicial"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createForm.email || !createForm.password}
              className="bg-black hover:bg-black/80 text-white"
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetar Senha</DialogTitle>
            <DialogDescription>Nova senha para {resetTarget?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nova Senha</Label>
              <Input
                type="text"
                placeholder="Digite a nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetting || !newPassword}
              className="bg-black hover:bg-black/80 text-white"
            >
              {resetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change role dialog */}
      <Dialog open={!!roleTarget} onOpenChange={(open) => !open && setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Role</DialogTitle>
            <DialogDescription>Alterar permissão de {roleTarget?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={changingRole}
              className="bg-black hover:bg-black/80 text-white"
            >
              {changingRole ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
