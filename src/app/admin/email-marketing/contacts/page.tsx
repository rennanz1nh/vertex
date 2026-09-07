"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, RefreshCw, Plus, Users, CheckCircle2 } from "lucide-react";
import { EmailMarketingTabs } from "@/components/email-marketing/EmailMarketingTabs";
import { EmailMarketingHeader } from "@/components/email-marketing/EmailMarketingHeader";
import { authedFetch } from "@/lib/admin-fetch";

type BrevoList = { id: number; name: string; totalSubscribers?: number; uniqueSubscribers?: number };

export default function EmailMarketingContacts() {
  const [lists, setLists] = useState<BrevoList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [error, setError] = useState("");

  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ total: number; synced: number; failed: number } | null>(null);

  function fetchLists() {
    setLoadingLists(true);
    return authedFetch("/api/email-marketing/lists")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setLists(d.lists ?? []);
      })
      .catch(() => setError("Falha ao carregar listas"))
      .finally(() => setLoadingLists(false));
  }

  useEffect(() => {
    fetchLists();
  }, []);

  async function handleCreateList() {
    if (!newListName.trim()) return;
    setCreatingList(true);
    setError("");
    try {
      const res = await authedFetch("/api/email-marketing/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar lista");
        return;
      }
      setNewListName("");
      await fetchLists();
    } catch {
      setError("Falha na conexão ao criar lista");
    } finally {
      setCreatingList(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError("");
    try {
      const res = await authedFetch("/api/email-marketing/contacts/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao sincronizar contatos");
        return;
      }
      setSyncResult(data);
      await fetchLists();
    } catch {
      setError("Falha na conexão ao sincronizar contatos");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <EmailMarketingHeader />

      <EmailMarketingTabs />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sincronizar Clientes</CardTitle>
          <CardDescription>Envia todos os clientes com e-mail cadastrado (tabela Clientes) para o Brevo como contatos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sincronizando...</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" />Sincronizar Agora</>
            )}
          </Button>
          {syncResult && (
            <Alert className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {syncResult.synced} de {syncResult.total} cliente(s) sincronizado(s)
                {syncResult.failed > 0 && ` — ${syncResult.failed} com erro`}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nova Lista</CardTitle>
          <CardDescription>Crie uma lista para segmentar seus contatos (ex: "Newsletter", "Clientes VIP")</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Nome da lista"
            onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
          />
          <Button onClick={handleCreateList} disabled={creatingList || !newListName.trim()}>
            {creatingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listas</CardTitle>
          <CardDescription>Listas existentes na sua conta Brevo</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLists ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando listas...</span>
            </div>
          ) : lists.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma lista criada ainda</p>
          ) : (
            <div className="space-y-2">
              {lists.map((list) => (
                <div key={list.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{list.name}</span>
                  </div>
                  <Badge variant="outline">{list.uniqueSubscribers ?? list.totalSubscribers ?? 0} contato(s)</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
