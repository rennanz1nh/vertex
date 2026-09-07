"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, ExternalLink, Copy, Check } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

const amazonLogo = "/images/sales-channels/Amazon.png";

// Amazon doesn't expose a stable deep-link that pre-fills the report's date range — the
// Seller Central UI has changed shape too many times to trust a query-string URL. Instead
// we send the operator straight to the reports screen and hand them the exact dates to
// type in, since that's the piece most likely to be entered wrong by hand.
const SELLER_CENTRAL_REPORTS_URL = "https://sellercentral.amazon.com/reportcentral/FlatFileAllOrdersReport/1";

function last30DaysRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  // Seller Central's date fields expect US format (MM/DD/YYYY) regardless of the seller's
  // locale — pasting a DD/MM/YYYY value there would silently swap day and month.
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
  return { start: fmt(start), end: fmt(end) };
}

function CopyableDate({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted transition-colors"
      title="Clique para copiar"
    >
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono font-medium">{value}</span>
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

type ImportResult = {
  imported: number;
  skipped: number;
  failed: number;
  details: Array<{ orderId: string; outcome: "imported" | "skipped" | "failed"; message?: string }>;
  problems: Array<{ row: number; orderId: string | null; reason: string }>;
  unmappedAsins: string[];
};

export function AmazonOrderUploadDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFileName(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setResult(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      // Amazon ships the report as tab-separated .txt; XLSX.read handles .xlsx/.csv/.txt
      // alike, so the operator doesn't have to convert anything before uploading.
      const workbook = XLSX.read(buffer, { type: "array", raw: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

      if (rows.length === 0) {
        setError("O arquivo está vazio ou não tem uma linha de cabeçalho reconhecível.");
        return;
      }
      if (!("amazon-order-id" in rows[0])) {
        setError(
          'Não encontrei a coluna "amazon-order-id". Confirme que é o relatório "All Orders" do Seller Central.'
        );
        return;
      }

      const res = await authedFetch("/api/amazon/import-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Falha ao importar os pedidos.");
        return;
      }

      setResult(data as ImportResult);
      if (data.imported > 0) onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={amazonLogo} alt="Amazon" className="h-5 w-auto object-contain" />
            Importar Pedidos da Amazon
          </DialogTitle>
          <DialogDescription>
            Importa o relatório de pedidos do Seller Central. Pedidos que já existem no sistema são
            ignorados automaticamente — pode reenviar o mesmo arquivo sem medo de duplicar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!result && (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="font-medium">Como gerar o arquivo:</p>
                <a
                  href={SELLER_CENTRAL_REPORTS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
                >
                  Abrir Seller Central <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Período (últimos 30 dias, formato EUA MM/DD/AAAA):</span>
                <CopyableDate label="De" value={last30DaysRange().start} />
                <CopyableDate label="Até" value={last30DaysRange().end} />
              </div>

              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                <li>Clique em <strong>&quot;Abrir Seller Central&quot;</strong> acima — já leva direto para o relatório certo (&quot;Flat File All Orders Report by Order Date&quot;)</li>
                <li>Cole as datas de <strong>De</strong>/<strong>Até</strong> acima e clique em <strong>Request</strong></li>
                <li>Quando ficar pronto, clique em <strong>Download</strong></li>
                <li>Envie o arquivo aqui (aceita .txt, .csv ou .xlsx)</li>
              </ol>
              <p className="text-xs text-muted-foreground pt-1 border-t">
                A Amazon não permite gerar/baixar esse relatório automaticamente sem um plano
                Professional (SP-API) — esse passo no Seller Central precisa ser feito manualmente.
                Nome, e-mail, telefone e endereço do comprador são importados junto e ficam
                vinculados ao cliente automaticamente.
              </p>
              <p className="text-xs text-muted-foreground pt-1 border-t">
                Os produtos são vinculados pelo <strong>ASIN</strong>. Se algum ASIN não estiver
                cadastrado em nenhum produto, o pedido ainda é importado, mas o item fica sem produto
                vinculado — e eu aviso quais ASINs faltam.
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                  <p className="text-xs text-green-700">Importados</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-gray-600">{result.skipped}</p>
                  <p className="text-xs text-gray-600">Já existiam</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{result.failed}</p>
                  <p className="text-xs text-red-700">Com erro</p>
                </div>
              </div>

              {result.imported > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    {result.imported} pedido(s) importado(s) com sucesso. A lista já foi atualizada.
                  </AlertDescription>
                </Alert>
              )}

              {result.unmappedAsins.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">
                      {result.unmappedAsins.length} ASIN(s) sem produto cadastrado:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {result.unmappedAsins.map((a) => (
                        <Badge key={a} variant="outline" className="font-mono text-[10px]">
                          {a}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs mt-1.5">
                      Preencha o campo ASIN nesses produtos e reimporte para vincular.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {result.problems.length > 0 && (
                <div className="rounded-lg border p-3 text-xs space-y-1">
                  <p className="font-medium">Linhas ignoradas:</p>
                  {result.problems.slice(0, 10).map((p, i) => (
                    <p key={i} className="text-muted-foreground">
                      • Linha {p.row}
                      {p.orderId ? ` (${p.orderId})` : ""}: {p.reason}
                    </p>
                  ))}
                  {result.problems.length > 10 && (
                    <p className="text-muted-foreground">+{result.problems.length - 10} outras</p>
                  )}
                </div>
              )}

              {result.failed > 0 && (
                <div className="rounded-lg border border-red-200 p-3 text-xs space-y-1">
                  <p className="font-medium text-red-700">Pedidos com erro:</p>
                  {result.details
                    .filter((d) => d.outcome === "failed")
                    .slice(0, 10)
                    .map((d, i) => (
                      <p key={i} className="text-muted-foreground">
                        • {d.orderId}: {d.message}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          <div className="flex gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 bg-black hover:bg-black/80 text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando {fileName}...
                </>
              ) : result ? (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Enviar outro arquivo
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Escolher arquivo
                </>
              )}
            </Button>
            {result && (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
