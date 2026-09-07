"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertCircle, Loader2, Send, CheckCircle2, Megaphone, FlaskConical } from "lucide-react";
import { EmailMarketingTabs } from "@/components/email-marketing/EmailMarketingTabs";
import { EmailMarketingHeader } from "@/components/email-marketing/EmailMarketingHeader";
import { authedFetch } from "@/lib/admin-fetch";

type BrevoList = { id: number; name: string };
type Campaign = { id: number; name: string; subject: string; status: string; recipients?: { lists: number[] } };

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  archive: "Arquivada",
  queued: "Na fila",
  suspended: "Suspensa",
  in_process: "Enviando",
};

export default function EmailMarketingCampaigns() {
  const [lists, setLists] = useState<BrevoList[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const [testEmail, setTestEmail] = useState("");
  const [testingCampaignId, setTestingCampaignId] = useState<number | null>(null);
  const [testSent, setTestSent] = useState<number | null>(null);

  const [pendingSendId, setPendingSendId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);

  function fetchAll() {
    setLoading(true);
    return Promise.all([
      authedFetch("/api/email-marketing/lists").then((r) => r.json()),
      authedFetch("/api/email-marketing/campaigns").then((r) => r.json()),
    ])
      .then(([listsData, campaignsData]) => {
        if (listsData.error || campaignsData.error) {
          setError(listsData.error || campaignsData.error);
          return;
        }
        setLists(listsData.lists ?? []);
        setCampaigns(campaignsData.campaigns ?? []);
        if (!selectedListId && listsData.lists?.length) setSelectedListId(listsData.lists[0].id);
      })
      .catch(() => setError("Falha ao carregar campanhas"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    if (!name.trim() || !subject.trim() || !htmlContent.trim() || !selectedListId) return;
    setCreating(true);
    setError("");
    try {
      const res = await authedFetch("/api/email-marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, htmlContent, listIds: [selectedListId] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar campanha");
        return;
      }
      setName("");
      setSubject("");
      setHtmlContent("");
      await fetchAll();
    } catch {
      setError("Falha na conexão ao criar campanha");
    } finally {
      setCreating(false);
    }
  }

  async function handleSendTest(campaignId: number) {
    if (!testEmail.trim()) return;
    setTestingCampaignId(campaignId);
    setTestSent(null);
    setError("");
    try {
      const res = await authedFetch(`/api/email-marketing/campaigns/${campaignId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: [testEmail.trim()] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao enviar teste");
        return;
      }
      setTestSent(campaignId);
    } catch {
      setError("Falha na conexão ao enviar teste");
    } finally {
      setTestingCampaignId(null);
    }
  }

  async function handleSendNow(campaignId: number) {
    setSendingId(campaignId);
    setError("");
    try {
      const res = await authedFetch(`/api/email-marketing/campaigns/${campaignId}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao disparar campanha");
        return;
      }
      await fetchAll();
    } catch {
      setError("Falha na conexão ao disparar campanha");
    } finally {
      setSendingId(null);
      setPendingSendId(null);
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
          <CardTitle>Nova Campanha</CardTitle>
          <CardDescription>Crie uma campanha de e-mail e escolha a lista de destino</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Nome da campanha (interno)</Label>
              <Input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Promoção de Verão" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-subject">Assunto do e-mail</Label>
              <Input id="campaign-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="10% off em toda a loja" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Lista de destino</Label>
            {lists.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma lista encontrada. Crie uma em Contatos & Listas primeiro.</p>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {lists.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedListId(l.id)}
                    className={`h-9 px-3 rounded-md text-xs font-medium border transition-colors ${
                      selectedListId === l.id
                        ? "bg-black text-white border-black"
                        : "bg-background text-muted-foreground border-input hover:bg-muted"
                    }`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-html">Conteúdo (HTML)</Label>
            <Textarea
              id="campaign-html"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="<p>Olá {{contact.FIRSTNAME}},</p><p>Aproveite 10% off em toda a loja!</p>"
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !subject.trim() || !htmlContent.trim() || !selectedListId}
            className="bg-black hover:bg-black/80 text-white"
          >
            {creating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</>
            ) : (
              <><Megaphone className="mr-2 h-4 w-4" />Criar Campanha (Rascunho)</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas</CardTitle>
          <CardDescription>Campanhas criadas na sua conta Brevo</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando campanhas...</span>
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma campanha criada ainda</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.subject}</p>
                    </div>
                    <Badge variant={c.status === "sent" ? "default" : "outline"}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                  </div>

                  {c.status === "draft" && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                      <Input
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="email@teste.com"
                        className="h-8 text-xs max-w-[200px]"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!testEmail.trim() || testingCampaignId === c.id}
                        onClick={() => handleSendTest(c.id)}
                      >
                        {testingCampaignId === c.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Enviar Teste
                      </Button>
                      {testSent === c.id && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Teste enviado
                        </span>
                      )}

                      <Button
                        size="sm"
                        className="bg-black hover:bg-black/80 text-white ml-auto"
                        disabled={sendingId === c.id}
                        onClick={() => setPendingSendId(c.id)}
                      >
                        {sendingId === c.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Disparar Agora
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingSendId !== null} onOpenChange={(open) => !open && setPendingSendId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disparar campanha agora?</AlertDialogTitle>
            <AlertDialogDescription>
              O e-mail será enviado imediatamente para todos os contatos da lista selecionada. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingSendId && handleSendNow(pendingSendId)}>
              Disparar Agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
