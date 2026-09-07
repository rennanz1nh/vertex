"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, FileText, Plus } from "lucide-react";
import { EmailMarketingTabs } from "@/components/email-marketing/EmailMarketingTabs";
import { EmailMarketingHeader } from "@/components/email-marketing/EmailMarketingHeader";
import { authedFetch } from "@/lib/admin-fetch";

type Template = { id: number; name: string; subject: string; isActive: boolean };

export default function EmailMarketingTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [templateName, setTemplateName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [creating, setCreating] = useState(false);

  function fetchTemplates() {
    setLoading(true);
    return authedFetch("/api/email-marketing/templates")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setTemplates(d.templates ?? []);
      })
      .catch(() => setError("Falha ao carregar templates"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function handleCreate() {
    if (!templateName.trim() || !subject.trim() || !htmlContent.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await authedFetch("/api/email-marketing/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateName, subject, htmlContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar template");
        return;
      }
      setTemplateName("");
      setSubject("");
      setHtmlContent("");
      await fetchTemplates();
    } catch {
      setError("Falha na conexão ao criar template");
    } finally {
      setCreating(false);
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
          <CardTitle>Novo Template</CardTitle>
          <CardDescription>Templates reutilizáveis para agilizar a criação de campanhas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Nome do template</Label>
              <Input id="template-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Boas-vindas" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-subject">Assunto padrão</Label>
              <Input id="template-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Bem-vindo(a) à Vertex Rental Cars!" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-html">Conteúdo (HTML)</Label>
            <Textarea
              id="template-html"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="<p>Olá {{contact.FIRSTNAME}},</p>"
              rows={6}
              className="font-mono text-xs"
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating || !templateName.trim() || !subject.trim() || !htmlContent.trim()}
            className="bg-black hover:bg-black/80 text-white"
          >
            {creating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</>
            ) : (
              <><Plus className="mr-2 h-4 w-4" />Criar Template</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>Templates existentes na sua conta Brevo</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando templates...</span>
            </div>
          ) : templates.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum template criado ainda</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.subject}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
