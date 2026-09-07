"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Settings, Plus, Trash2, Package } from "lucide-react";
import { saveBoxes, type BoxPreset } from "@/lib/shippo-types";
import { authedFetch } from "@/lib/admin-fetch";

// Shared box-preset manager used by both the Shipping's page (OrdersTest) and the
// Pedidos page (Orders). Boxes are persisted in the DB via saveBoxes, so any change
// here is mirrored everywhere and across devices.
export function BoxManagerDialog({ open, onOpenChange, boxes, onChange }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  boxes: BoxPreset[]; onChange: (b: BoxPreset[]) => void;
}) {
  const [form, setForm] = useState<Omit<BoxPreset, "id">>({ name: "", length: "", width: "", height: "", distance_unit: "in", unit_count: "", image: undefined });
  const fileRef = React.useRef<HTMLInputElement>(null);

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, image: ev.target?.result as string }));
    reader.readAsDataURL(file);
  }

  async function add() {
    if (!form.name || !form.length || !form.width || !form.height) return;
    const updated = [...boxes, { ...form, id: Date.now().toString() }];
    onChange(updated);
    await saveBoxes(authedFetch, updated);
    setForm({ name: "", length: "", width: "", height: "", distance_unit: "in", unit_count: "", image: undefined });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove(id: string) {
    const u = boxes.filter(b => b.id !== id);
    onChange(u);
    await saveBoxes(authedFetch, u);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Gerenciar caixas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 w-16" />
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-center p-3 font-medium">L×W×H</th>
                  <th className="text-center p-3 font-medium">Un.</th>
                  <th className="text-center p-3 font-medium">Qtd.</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {boxes.map(b => (
                  <tr key={b.id} className="border-t">
                    <td className="p-3">
                      {b.image
                        ? // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.image} alt={b.name} className="w-14 h-14 rounded-md object-cover border" />
                        : <div className="w-14 h-14 rounded-md border bg-muted flex items-center justify-center text-muted-foreground"><Package className="h-6 w-6" /></div>
                      }
                    </td>
                    <td className="p-3 font-medium">{b.name}</td>
                    <td className="p-3 text-center font-mono text-xs text-muted-foreground">{b.length}×{b.width}×{b.height}</td>
                    <td className="p-3 text-center text-muted-foreground">{b.distance_unit}</td>
                    <td className="p-3 text-center text-muted-foreground">{b.unit_count ?? "—"}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(b.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {boxes.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">Nenhuma caixa cadastrada</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-semibold">Adicionar nova caixa</p>
            <div className="flex gap-3 items-start">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="shrink-0 w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 bg-muted/40 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors overflow-hidden"
                title="Adicionar foto da caixa"
              >
                {form.image
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.image} alt="preview" className="w-full h-full object-cover rounded-lg" />
                  : <><Plus className="h-6 w-6" /><span className="text-[10px] font-medium">Foto</span></>
                }
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              <Input
                placeholder="Nome (ex: Envelope, Caixa Grande…)"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="flex-1"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["length", "width", "height"] as const).map((field, i) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs">{["Comprimento", "Largura", "Altura"][i]}</Label>
                  <Input type="number" placeholder={["L", "W", "H"][i]} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">Unidade</Label>
                <Select value={form.distance_unit} onValueChange={v => setForm(f => ({ ...f, distance_unit: v as "in" | "cm" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="in">in</SelectItem><SelectItem value="cm">cm</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit Count (quantidade disponível)</Label>
              <Input type="number" placeholder="Ex: 10" value={form.unit_count ?? ""} onChange={e => setForm(f => ({ ...f, unit_count: e.target.value }))} />
            </div>
            <Button onClick={add} className="w-full bg-black hover:bg-black/80 text-white" disabled={!form.name || !form.length || !form.width || !form.height}>
              <Plus className="mr-2 h-4 w-4" />Adicionar caixa
            </Button>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
