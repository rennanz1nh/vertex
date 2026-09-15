import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, Plus, Minus, X, CreditCard, DollarSign, ExternalLink, Search, Check, Package, LayoutGrid, List, Filter, Printer, Link2, Truck, CheckCircle2, Download, Loader2, AlertTriangle, XCircle, Save } from "lucide-react";
import { SquareFlag } from "@/components/SquareFlag";
import { calcularPedido } from "@/lib/order-calc";
import { detectCarrier, getCarrierLogo, getTrackingUrl, CARRIER_OPTIONS, type Carrier } from "@/lib/carrier-utils";
import { triggerAutomaticEmail } from "@/lib/automatic-emails-client";

// Import channel logos
const amazonLogo = '/images/sales-channels/Amazon.png';
const ebayLogo = '/images/sales-channels/Ebay.png';
const etsyLogo = '/images/sales-channels/Etsy.png';
const tiktokLogo = '/images/sales-channels/TikTok.png';
const zelleLogo = '/images/sales-channels/Zelle.png';
const whatsappLogo = '/images/sales-channels/Whatsapp.png';
const cosmeticMpLogo = '/images/sales-channels/Vertex_Rental_Cars.png';
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import BuyLabelDialog from "@/components/shipping/BuyLabelDialog";
import { COUNTRIES } from "@/data/countries";
import { StripeLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";

// ─── Shipping tab helpers (mirrors the "Detalhes Shippo" dialog on the Shipping's page) ──
const fmtUSD = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

type ShippingDotStatus = "delivered" | "transit" | "not_shipped";
function shippingToDot(status: string | null, hasTracking: boolean): ShippingDotStatus {
  if (!hasTracking) return "not_shipped";
  if (status === "DELIVERED") return "delivered";
  if (status === "TRANSIT" || status === "PRE_TRANSIT") return "transit";
  return "not_shipped";
}
function shippingDotColor(d: ShippingDotStatus) {
  return d === "delivered" ? "bg-green-500" : d === "transit" ? "bg-yellow-400" : "bg-red-500";
}
function shippingDotLabel(d: ShippingDotStatus) {
  return d === "delivered" ? "Entregue" : d === "transit" ? "A Caminho" : "Aguardando Envio";
}

interface OrderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingOrder?: any;
}

interface OrderItem {
  productId: string;
  productName: string;
  marca: string;
  quantidade: number;
  valorUnitario: number;
  custoUnitario: number;
  imageUrl?: string;
  descricao?: string;
  sku?: string;
  // eBay's stable per-line id — carried through untouched so a manual save doesn't
  // erase the anchor the next eBay sync needs to find this same line again.
  ebayLineItemId?: string | null;
}

// Stored amounts come back from Postgres as numeric strings that drop trailing zeros
// ("6.7", "0"). Render them with both cents so every money field reads as money.
function toAmount(value: unknown): string {
  const parsed = parseFloat(String(value ?? 0));
  return (Number.isFinite(parsed) ? parsed : 0).toFixed(2);
}

export function OrderForm({ open, onOpenChange, onSuccess, editingOrder }: OrderFormProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientStreet, setClientStreet] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientState, setClientState] = useState("");
  const [clientZip, setClientZip] = useState("");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  // Kept as the raw typed string (not a number) — a controlled input whose value is
  // parseFloat(text) on every keystroke can never show a trailing "." or trailing zeros
  // (typing "22.05" collapses back to "22" the instant the "." is parsed away), which is
  // exactly what stopped decimals from being entered here.
  const [valorUnitario, setValorUnitario] = useState("");
  const [canal, setCanal] = useState("Online");
  const [carrier, setCarrier] = useState<Carrier | "">("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  // Index into orderItems being assigned a product (e.g. an eBay line item that synced
  // with no SKU match), as opposed to null which means "picking for the add-product row".
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productViewMode, setProductViewMode] = useState<"grid" | "list">("grid");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [ebayFulfillmentStatus, setEbayFulfillmentStatus] = useState<string>("");
  const [ebayStatusManual, setEbayStatusManual] = useState(false);
  const [fundsAvailable, setFundsAvailable] = useState(false);
  const [fundsAvailableManual, setFundsAvailableManual] = useState(false);
  const [orderCountry, setOrderCountry] = useState("");
  const [activeTab, setActiveTab] = useState<'pedido' | 'shipping'>('pedido');
  const [shippoData, setShippoData] = useState<any>(null);
  const [shippoLoading, setShippoLoading] = useState(false);

  // Buy Label — opens the shared <BuyLabelDialog> (same component/state used on the
  // Shipping's admin page), so both entry points always show the same live dialog.
  const [buyLabelOpen, setBuyLabelOpen] = useState(false);

  const [refunding, setRefunding] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showCancelOrderDialog, setShowCancelOrderDialog] = useState(false);

  // "Aplicar 6.5% (FL)" checkbox: while checked, the TAX field auto-tracks 6.5% of the
  // products subtotal (recomputes if items change); unchecking leaves the current value
  // for manual editing.
  const [autoFloridaTax, setAutoFloridaTax] = useState(false);
  async function handleRefund() {
    if (!editingOrder?.numero_pedido_canal) return;
    setShowRefundDialog(false);
    setRefunding(true);
    try {
      const res = await authedFetch("/api/stripe/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: editingOrder.numero_pedido_canal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Reembolso de $${data.amount.toFixed(2)} criado com sucesso.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRefunding(false);
    }
  }

  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      numeroPedidoCanal: "",
      shippingPagoCliente: "0.00",
      custoTotalShipping: "0.00",
      tax: "0.00",
      descontoPlataforma: "0.00",
      comissaoEbay: "0.00",
      promotedListings: "0.00",
      shippingTracking: "",
      observacoes: "",
    }
  });

  const shippingPago = parseFloat(String(watch("shippingPagoCliente") || 0));
  const tax = parseFloat(String(watch("tax") || 0));
  const desconto = parseFloat(String(watch("descontoPlataforma") || 0));
  const comissaoEbay = parseFloat(String(watch("comissaoEbay") || 0));
  const promotedListings = parseFloat(String(watch("promotedListings") || 0));
  const custoTotalShipping = parseFloat(String(watch("custoTotalShipping") || 0));

  // Orders synced from eBay are already "closed" — their products, shipping and tax come
  // from eBay and must not be edited or re-summed locally.
  const isEbay = editingOrder?.canal === 'eBay';
  // A cancelled order is fully locked — nothing about it should be editable anymore.
  const isCancelled = editingOrder?.status === 'Cancelado';

  // Single joined string built from the structured address fields — used for invoices,
  // the packing slip, and orders.endereco_completo, so those keep working the same as
  // before even though the address is no longer typed as one free-text blob.
  const clientAddressCombined = [clientStreet, clientCity, clientState, clientZip].filter(Boolean).join(", ");

  useEffect(() => {
    if (open) {
      setActiveTab('pedido');
      fetchClients();
      fetchProducts();
      
      // Load editing order data
      if (editingOrder) {
        const [y, m, d] = String(editingOrder.data_pedido).split("-").map(Number);
        setDate(new Date(y, (m || 1) - 1, d || 1));
        setCanal(editingOrder.canal || "Online");
        setSelectedClientId(editingOrder.client_id || "");
        setClientName(editingOrder.clients?.nome_razao || "");
        setClientContact(editingOrder.clients?.telefone || "");
        setClientEmail(editingOrder.buyer_email || editingOrder.clients?.email || "");
        {
          // Structured fields (rua/estado/cep) came from a real integration (eBay, Stripe) —
          // use them directly. Older manually-created orders only ever had one free-text
          // blob stuffed into endereco_cidade, so fall back to showing that in Rua so it
          // isn't silently lost — the admin can re-split it once here and it'll stay
          // structured from then on.
          const c = editingOrder.clients;
          const hasStructuredAddress = !!(c?.endereco_rua || c?.endereco_estado || c?.endereco_cep);
          setClientStreet(hasStructuredAddress ? (c?.endereco_rua || "") : (c?.endereco_cidade || ""));
          setClientCity(hasStructuredAddress ? (c?.endereco_cidade || "") : "");
          setClientState(c?.endereco_estado || "");
          setClientZip(c?.endereco_cep || "");
        }
        setOrderCountry(editingOrder.country || editingOrder.clients?.endereco_pais || "");
        // Status: prefer main `status` field (written by sync v2); fall back to ebay_fulfillment_status (v1)
        setEbayFulfillmentStatus(editingOrder.status || editingOrder.ebay_fulfillment_status || "");
        setEbayStatusManual(editingOrder.status_manual || editingOrder.ebay_status_manual || false);
        // Pago plataforma: prefer pago_plataforma (v2); fall back to funds_available (v1)
        setFundsAvailable(editingOrder.pago_plataforma ?? editingOrder.funds_available ?? false);
        setFundsAvailableManual(editingOrder.pago_plataforma_manual ?? editingOrder.funds_available_manual ?? false);
        setValue("numeroPedidoCanal", editingOrder.numero_pedido_canal || "");
        // Loaded as two-decimal strings so the fields read as money ($6.70, not $6.7) —
        // the numbers come back out of watch() through parseFloat all the same.
        setValue("shippingPagoCliente", toAmount(editingOrder.frete_total));
        setValue("custoTotalShipping", toAmount(editingOrder.custo_total_shipping));
        setValue("tax", toAmount(editingOrder.impostos));
        setValue("descontoPlataforma", toAmount(editingOrder.descontos));
        setValue("comissaoEbay", toAmount(editingOrder.comissao_ebay));
        setValue("promotedListings", toAmount(editingOrder.promoted_listings));
        setValue("shippingTracking", editingOrder.shipping_tracking || "");
        setCarrier(editingOrder.carrier || (editingOrder.shipping_tracking ? detectCarrier(editingOrder.shipping_tracking) : ""));
        setValue("observacoes", editingOrder.observacoes || "");
        
        // Load order items if available
        if (editingOrder.order_items) {
          setOrderItems(editingOrder.order_items.map((item: any) => ({
            productId: item.product_id,
            productName: item.products?.name || '',
            marca: item.products?.make || '',
            quantidade: item.quantidade,
            valorUnitario: item.preco_unitario,
            custoUnitario: item.custo_unitario,
            imageUrl: item.products?.image_url || '',
            descricao: item.products?.description || '',
            sku: item.sku || item.products?.vin || '',
            ebayLineItemId: item.ebay_line_item_id ?? null,
          })));
        }
      } else {
        // Reset form when not editing
        setDate(new Date());
        setCanal("Online");
        setSelectedClientId("");
        setClientName("");
        setClientContact("");
        setClientEmail("");
        setClientStreet("");
        setClientCity("");
        setClientState("");
        setClientZip("");
        setOrderCountry("");
        setEbayFulfillmentStatus("");
        setEbayStatusManual(false);
        setFundsAvailable(false);
        setFundsAvailableManual(false);
        setOrderItems([]);
        setValue("numeroPedidoCanal", "");
        setValue("shippingPagoCliente", "0.00");
        setValue("custoTotalShipping", "0.00");
        setValue("tax", "0.00");
        setValue("descontoPlataforma", "0.00");
        setValue("comissaoEbay", "0.00");
        setValue("promotedListings", "0.00");
        setValue("shippingTracking", "");
        setCarrier("");
        setValue("observacoes", "");
      }
    }
  }, [open, editingOrder]);

  // Fetch Shippo data (tracking, transaction, rate, shipment) as soon as the order opens —
  // powers both the live status dot on the Pedido tab and the full "Shipping" tab details.
  // Mirrors the same lookup used by the "Detalhes Shippo" dialog on the Shipping's page.
  useEffect(() => {
    setShippoData(null);
    if (!open || !editingOrder?.shipping_tracking) return;
    const controller = new AbortController();
    setShippoLoading(true);
    const carrier = detectCarrier(editingOrder.shipping_tracking)?.toLowerCase() ?? editingOrder.carrier?.toLowerCase() ?? "usps";
    authedFetch(`/api/shippo/details?tracking=${encodeURIComponent(editingOrder.shipping_tracking)}&carrier=${carrier}`, { signal: controller.signal })
      .then(r => r.json()).then(setShippoData)
      .catch(e => { if (e.name !== "AbortError") setShippoData(null); })
      .finally(() => setShippoLoading(false));
    return () => controller.abort();
  }, [open, editingOrder]);

  // custo_total_shipping in the DB is only populated once a label is bought through us —
  // for orders where it's still null, the "Valor pago pelo envio" field above was showing
  // $0 even though a real Shippo rate/transaction exists, same as the read-only "Resumo do
  // Pedido" section already falls back to below. Backfill it once that data loads.
  useEffect(() => {
    if (!editingOrder || editingOrder.custo_total_shipping) return;
    const amount = shippoData?.transaction?.rate?.amount ?? shippoData?.rate?.amount;
    if (amount) setValue("custoTotalShipping", toAmount(amount));
  }, [shippoData, editingOrder, setValue]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("nome_razao");
    if (data) setClients(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("name");
    if (data) setProducts(data.filter(p => p.name));
  };

  const addProduct = () => {
    const product = products.find(p => p.id === selectedProduct);
    if (!product || quantidade <= 0) {
      toast.error("Selecione um produto e quantidade válida");
      return;
    }

    setOrderItems([...orderItems, {
      productId: product.id,
      productName: product.name,
      marca: product.make || "",
      quantidade,
      valorUnitario: parseFloat(valorUnitario) || 0,
      custoUnitario: 0,
      imageUrl: product.image_url || "",
      descricao: product.description || "",
      sku: product.vin || "",
    }]);

    setSelectedProduct("");
    setQuantidade(1);
    setValorUnitario("");
  };

  // Shared by both grid and list views of the product picker dialog: routes the pick to
  // whichever flow opened it — assigning to an existing line, or staging a new one.
  const handlePickProduct = (product: any) => {
    if (editingItemIndex !== null) {
      assignProductToItem(editingItemIndex, product);
      setEditingItemIndex(null);
    } else {
      setSelectedProduct(product.id);
    }
    setProductPickerOpen(false);
    setProductSearch("");
  };

  const removeProduct = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  // Inline edits on an added line — quantity (min 1) and unit price — so the user can
  // adjust without removing and re-adding the product.
  const updateItemQty = (index: number, qty: number) => {
    setOrderItems(orderItems.map((item, i) => i === index ? { ...item, quantidade: Math.max(1, qty || 1) } : item));
  };
  const updateItemPrice = (index: number, price: string) => {
    const parsed = parseFloat(String(price).replace(/[^0-9.-]/g, ''));
    setOrderItems(orderItems.map((item, i) => i === index ? { ...item, valorUnitario: isNaN(parsed) ? 0 : parsed } : item));
  };

  // Attaches a product to an already-existing line (e.g. an eBay item that synced with
  // no SKU match) without touching its quantity, unit price, or eBay anchor — unlike
  // addProduct, which appends a brand-new line from the quantity/price inputs above.
  const assignProductToItem = (index: number, product: any) => {
    setOrderItems(orderItems.map((item, i) => i === index ? {
      ...item,
      productId: product.id,
      productName: product.name,
      marca: product.make || "",
      custoUnitario: 0,
      imageUrl: product.image_url || "",
      descricao: product.description || "",
      sku: item.sku || product.vin || "",
    } : item));
  };

  const valorProdutosSomados = orderItems.reduce(
    (sum, item) => sum + (item.quantidade * (item.valorUnitario || 0)), 0
  );

  const valorCustoTotal = orderItems.reduce(
    (sum, item) => sum + (item.quantidade * (item.custoUnitario || 0)), 0
  );

  // Single source of truth for the money math, shared with the Pedidos table (order-calc.ts).
  // TAX is informational only — it never adds to the total nor subtracts from profit.
  // totalInformado (the total already stored on an existing order) is checked against the
  // computed total so a mismatch (e.g. a half-filled Amazon order) surfaces a warning.
  const calc = calcularPedido({
    valorProdutos: valorProdutosSomados,
    valorCusto: valorCustoTotal,
    shippingPagoCliente: shippingPago,
    custoTotalShipping,
    comissao: comissaoEbay,
    promotedListings,
    desconto,
    tax,
    totalInformado: editingOrder?.total ?? null,
  });
  const valorTotalVenda = calc.valorTotalVenda;
  const lucroFinal = calc.lucroFinal;

  // Florida sales tax — 6.5% of the products subtotal (same base used to backfill the
  // historical orders; shipping is not taxed here). While the checkbox is on, keep the
  // informational TAX field in sync with the subtotal so adding/removing items updates it.
  const FLORIDA_TAX_RATE = 0.065;
  useEffect(() => {
    if (autoFloridaTax) {
      setValue("tax", (valorProdutosSomados * FLORIDA_TAX_RATE).toFixed(2));
    }
  }, [autoFloridaTax, valorProdutosSomados, setValue]);

  // statusOverride lets the "Marcar como Entregue" button force the status through the
  // same save path as a normal edit, without racing setEbayFulfillmentStatus/setEbayStatusManual
  // (React state updates aren't visible in this closure until the next render, so reading
  // them right after calling their setters would still see the old value). Kept as a
  // separate function from onSubmit below because react-hook-form's SubmitHandler type
  // already reserves the 2nd parameter position for its own (event?) argument.
  const saveOrder = async (data: any, statusOverride?: { status: string; manual: boolean }) => {
    if (orderItems.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }

    try {
      let clientId = selectedClientId;

      // If there's a client name but no selectedClientId, create a new client
      if (clientName.trim() && !selectedClientId) {
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            nome_razao: clientName.trim(),
            telefone: clientContact.trim() || null,
            email: clientEmail.trim() || null,
            endereco_rua: clientStreet.trim() || null,
            endereco_cidade: clientCity.trim() || null,
            endereco_estado: clientState.trim() || null,
            endereco_cep: clientZip.trim() || null,
            endereco_pais: orderCountry || null,
            tipo: "Individual" as const,
            canal_principal: canal,
          })
          .select()
          .single();

        if (clientError) {
          console.error("Error creating client:", clientError);
          toast.error("Erro ao criar cliente");
          return;
        }

        clientId = newClient.id;
        // Refresh clients list
        fetchClients();
      } else if (clientId) {
        // Update existing client's canal_principal and other info if provided
        const updateData: any = { canal_principal: canal };
        if (clientEmail.trim()) updateData.email = clientEmail.trim();
        if (clientStreet.trim()) updateData.endereco_rua = clientStreet.trim();
        if (clientCity.trim()) updateData.endereco_cidade = clientCity.trim();
        if (clientState.trim()) updateData.endereco_estado = clientState.trim();
        if (clientZip.trim()) updateData.endereco_cep = clientZip.trim();
        if (orderCountry) updateData.endereco_pais = orderCountry;
        if (clientContact.trim()) updateData.telefone = clientContact.trim();

        await supabase
          .from("clients")
          .update(updateData)
          .eq("id", clientId);
      }

      const orderData: any = {
        data_pedido: format(date, "yyyy-MM-dd"),
        client_id: clientId || null,
        canal: canal,
        status: statusOverride?.status ?? (ebayFulfillmentStatus || editingOrder?.status || "Orçado"),
        diferente: 0,
        numero_pedido_canal: data.numeroPedidoCanal || null,
        frete_total: shippingPago,
        custo_total_shipping: parseFloat(String(data.custoTotalShipping || 0)),
        impostos: tax,
        descontos: desconto,
        comissao_ebay: comissaoEbay,
        promoted_listings: promotedListings,
        total: valorTotalVenda,
        // forma_pagamento is no longer edited in the UI, but must be preserved on save so
        // Stripe-paid orders keep their "Stripe" marker (drives the refund button + webhook).
        forma_pagamento: editingOrder?.forma_pagamento ?? null,
        shipping_tracking: data.shippingTracking || null,
        carrier: carrier || null,
        observacoes: data.observacoes || null,
        ebay_status_manual: statusOverride?.manual ?? ebayStatusManual,
        funds_available: fundsAvailable,
        funds_available_manual: fundsAvailableManual,
        country: orderCountry || null,
        endereco_completo: clientAddressCombined || null,
      };

      if (editingOrder) {
        // Update existing order
        const { error: orderError } = await supabase
          .from("orders")
          .update(orderData)
          .eq("id", editingOrder.id);

        if (orderError) throw orderError;

        if (statusOverride?.status === "Entregue") {
          triggerAutomaticEmail("order_delivered", editingOrder.id);
        }

        // Delete existing order items
        await supabase
          .from("order_items")
          .delete()
          .eq("order_id", editingOrder.id);

        // Create new order items
        const items = orderItems.map(item => ({
          order_id: editingOrder.id,
          product_id: item.productId,
          quantidade: item.quantidade,
          preco_unitario: item.valorUnitario || 0,
          custo_unitario: item.custoUnitario || 0,
          imposto_unitario: 0,
          frete_unitario: 0,
          sku: item.sku || null,
          ebay_line_item_id: item.ebayLineItemId ?? null,
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(items);

        if (itemsError) throw itemsError;

        if (statusOverride?.status === "Cancelado" && statusOverride?.manual) {
          const { error: restoreError } = await supabase.rpc("restore_stock_for_cancelled_order", {
            p_order_id: editingOrder.id,
          });
          if (restoreError) {
            console.error("Error restoring stock:", restoreError);
            toast.error("Pedido cancelado, mas houve um erro ao devolver os produtos ao estoque");
          } else {
            const totalQty = orderItems.reduce((sum, item) => sum + (item.quantidade || 0), 0);
            toast.success(`${totalQty} produto(s) devolvido(s) ao estoque.`);
          }
        }

        toast.success("Pedido atualizado com sucesso!");
      } else {
        // Create new order
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert(orderData)
          .select()
          .single();

        if (orderError) throw orderError;

        // Create order items
        const items = orderItems.map(item => ({
          order_id: order.id,
          product_id: item.productId,
          quantidade: item.quantidade,
          preco_unitario: item.valorUnitario || 0,
          custo_unitario: item.custoUnitario || 0,
          imposto_unitario: 0,
          frete_unitario: 0,
          sku: item.sku || null,
          ebay_line_item_id: item.ebayLineItemId ?? null,
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(items);

        if (itemsError) throw itemsError;

        if (statusOverride?.status === "Entregue") {
          triggerAutomaticEmail("order_delivered", order.id);
        }

        toast.success("Pedido criado com sucesso!");
      }
      
      onOpenChange(false);
      onSuccess();
      setOrderItems([]);
    } catch (error) {
      console.error("Error with order:", error);
      toast.error(editingOrder ? "Erro ao atualizar pedido" : "Erro ao criar pedido");
    }
  };

  const onSubmit = (data: any) => saveOrder(data);

  const labelUrl: string | undefined = shippoData?.transaction?.label_url;

  const handlePrintPackingSlip = async () => {
    if (!editingOrder) return;
    const { printPackingSlip } = await import('@/lib/packing-slip-pdf');
    const c = editingOrder.clients;
    const address = [
      c?.endereco_rua,
      [c?.endereco_cidade, c?.endereco_estado, c?.endereco_cep].filter(Boolean).join(', '),
      c?.endereco_pais,
    ].filter(Boolean).join(', ');
    try {
      await printPackingSlip({
        clientName: c?.nome_razao || 'Cliente',
        clientAddress: address || undefined,
        orderDate: editingOrder.data_pedido,
        orderNumber: editingOrder.numero_pedido_canal || String(editingOrder.id).slice(0, 8),
        channel: editingOrder.canal,
        items: (editingOrder.order_items || []).map((i: any) => ({
          sku: i.products?.vin,
          name: i.products?.name || 'Produto',
          quantity: i.quantidade,
          unitPrice: i.preco_unitario,
          imageUrl: i.products?.image_url,
        })),
        taxes: editingOrder.impostos,
        shippingFee: editingOrder.frete_total,
        total: editingOrder.total,
        shippingTracking: editingOrder.shipping_tracking,
        carrier: editingOrder.carrier,
        service: shippoData?.transaction?.rate?.servicelevel?.name,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar packing slip');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
            <DialogTitle>{editingOrder ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
            {editingOrder && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Packing Slip */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePrintPackingSlip}
                  className="gap-2"
                  title="Imprimir Packing Slip"
                >
                  <Printer className="h-4 w-4" />
                  Packing Slip
                </Button>
                {/* Baixar Etiqueta — habilitado só quando há etiqueta comprada */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!labelUrl}
                  onClick={() => labelUrl && window.open(labelUrl, '_blank')}
                  className="gap-2 disabled:opacity-50"
                  title={labelUrl ? "Baixar etiqueta de envio" : "Compre a etiqueta primeiro (Buy Label)"}
                >
                  <Download className="h-4 w-4" />
                  Baixar Etiqueta
                </Button>
                {/* Rastrear — logo da carrier, desabilitado sem tracking. Padrão nas duas abas. */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!editingOrder.shipping_tracking}
                  onClick={() => editingOrder.shipping_tracking && window.open(getTrackingUrl(editingOrder.shipping_tracking, (carrier || editingOrder.carrier) || undefined), '_blank')}
                  className="gap-2 disabled:opacity-50"
                  title={editingOrder.shipping_tracking ? "Rastrear pacote" : "Sem código de rastreio ainda"}
                >
                  <ExternalLink className="h-4 w-4" />
                  Rastrear
                </Button>
                {/* Criar Invoice — moved up from the footer to keep the bottom action row short. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" variant="secondary" className="text-primary-foreground bg-secondary">
                      Criar Invoice
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(["pdf", "jpeg"] as const).map((fmt) => (
                      <DropdownMenuItem
                        key={fmt}
                        onClick={async () => {
                          if (orderItems.length === 0) {
                            toast.error("Adicione pelo menos um produto");
                            return;
                          }
                          try {
                            const { generateInvoice } = await import("@/lib/invoice-pdf");
                            const number = await generateInvoice({
                              clientName: clientName || "Cliente",
                              clientContact: clientContact,
                              clientEmail: clientEmail,
                              clientAddress: clientAddressCombined,
                              orderDate: date,
                              orderNumber: watch("numeroPedidoCanal") || undefined,
                              channel: canal,
                              items: orderItems.map((it) => ({
                                sku: it.sku || "—",
                                name: it.productName,
                                quantity: it.quantidade,
                                amount: it.quantidade * (it.valorUnitario || 0),
                                imageUrl: it.imageUrl,
                              })),
                              salesTax: 0,
                              shipping: shippingPago || 0,
                              total: valorProdutosSomados + (shippingPago || 0),
                              shippingTracking: watch("shippingTracking") || undefined,
                              carrier: carrier || undefined,
                            }, fmt);
                            toast.success(`Invoice #${number} gerada (${fmt.toUpperCase()})`);
                          } catch (e) {
                            console.error(e);
                            toast.error("Erro ao gerar invoice");
                          }
                        }}
                      >
                        Baixar como {fmt.toUpperCase()}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem
                      onClick={async () => {
                        if (orderItems.length === 0) {
                          toast.error("Adicione pelo menos um produto");
                          return;
                        }
                        try {
                          const { printInvoice } = await import("@/lib/invoice-pdf");
                          const number = await printInvoice({
                            clientName: clientName || "Cliente",
                            clientContact: clientContact,
                            clientEmail: clientEmail,
                            clientAddress: clientAddressCombined,
                            orderDate: date,
                            orderNumber: watch("numeroPedidoCanal") || undefined,
                            channel: canal,
                            items: orderItems.map((it) => ({
                              sku: it.sku || "—",
                              name: it.productName,
                              quantity: it.quantidade,
                              amount: it.quantidade * (it.valorUnitario || 0),
                              imageUrl: it.imageUrl,
                            })),
                            salesTax: 0,
                            shipping: shippingPago || 0,
                            total: valorProdutosSomados + (shippingPago || 0),
                            shippingTracking: watch("shippingTracking") || undefined,
                            carrier: carrier || undefined,
                          });
                          toast.success(`Invoice #${number} aberta para impressão`);
                        } catch (e) {
                          console.error(e);
                          toast.error("Erro ao abrir impressão");
                        }
                      }}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Buy Label — opens the shared BuyLabelDialog (same buyLabelOpen state as before). */}
                <Button
                  type="button"
                  size="sm"
                  disabled={isCancelled}
                  onClick={() => setBuyLabelOpen(true)}
                  className="bg-black hover:bg-black/80 text-white gap-2 disabled:opacity-50"
                  title={isCancelled ? "Pedido cancelado — não é possível comprar etiqueta" : "Comprar etiqueta de envio via Shippo"}
                >
                  <Package className="h-4 w-4" />
                  Buy Label
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Abas: Pedido | Shipping */}
        <div className="flex gap-2 border-b pb-3">
          <Button
            type="button"
            size="lg"
            variant={activeTab === 'pedido' ? 'default' : 'outline'}
            onClick={() => setActiveTab('pedido')}
            className={`gap-2 text-base px-6 ${activeTab === 'pedido' ? 'bg-black hover:bg-black/80 text-white' : ''}`}
          >
            <Package className="h-5 w-5" />
            Pedido
          </Button>
          <Button
            type="button"
            size="lg"
            variant={activeTab === 'shipping' ? 'default' : 'outline'}
            onClick={() => setActiveTab('shipping')}
            className={`gap-2 text-base px-6 ${activeTab === 'shipping' ? 'bg-black hover:bg-black/80 text-white' : ''}`}
          >
            <Truck className="h-5 w-5" />
            Shipping
          </Button>
        </div>

        <div className={activeTab === 'pedido' ? '' : 'hidden'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className={isCancelled ? "space-y-4 pointer-events-none opacity-60 grayscale-[.3]" : "space-y-4"}>
          {/* Linha 1: Data · Canal de Venda · Nº Pedido Canal */}
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_1fr] gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4 text-[#ff0000]" />
                    {format(date, "MM/dd/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Canal de Venda</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o canal" />
                </SelectTrigger>
                <SelectContent>
                  {/* Marketplaces primeiro */}
                  <SelectItem value="Amazon">
                    <span className="flex items-center gap-2"><img src={amazonLogo} alt="Amazon" className="h-6 w-10 object-contain" /> Amazon</span>
                  </SelectItem>
                  <SelectItem value="eBay">
                    <span className="flex items-center gap-2"><img src={ebayLogo} alt="eBay" className="h-6 w-10 object-contain" /> eBay</span>
                  </SelectItem>
                  <SelectItem value="Etsy">
                    <span className="flex items-center gap-2"><img src={etsyLogo} alt="Etsy" className="h-6 w-10 object-contain" /> Etsy</span>
                  </SelectItem>
                  <SelectItem value="TikTok">
                    <span className="flex items-center gap-2"><img src={tiktokLogo} alt="TikTok" className="h-6 w-10 object-contain" /> TikTok</span>
                  </SelectItem>
                  <SelectItem value="Vertex Rental Cars">
                    <span className="flex items-center gap-2"><img src={cosmeticMpLogo} alt="Vertex Rental Cars" className="h-6 w-10 object-contain" /> Vertex Rental Cars</span>
                  </SelectItem>
                  {/* Não-marketplace por último */}
                  <SelectItem value="Zelle">
                    <span className="flex items-center gap-2"><img src={zelleLogo} alt="Zelle" className="h-6 w-10 object-contain" /> Zelle</span>
                  </SelectItem>
                  <SelectItem value="WhatsApp">
                    <span className="flex items-center gap-2"><img src={whatsappLogo} alt="WhatsApp" className="h-6 w-10 object-contain" /> WhatsApp</span>
                  </SelectItem>
                  <SelectItem value="Credit Card / Presencial">
                    <span className="flex items-center gap-2"><CreditCard className="h-6 w-6" /> Credit Card / Presencial</span>
                  </SelectItem>
                  <SelectItem value="Money / Presencial">
                    <span className="flex items-center gap-2"><DollarSign className="h-6 w-6" /> Money / Presencial</span>
                  </SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nº Pedido Canal</Label>
              <Input
                placeholder="Número do pedido"
                {...register("numeroPedidoCanal")}
              />
            </div>
          </div>

          {/* Linha 2: Cliente · Contato · Email */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2 relative">
              <Label>Cliente</Label>
              <Input
                placeholder="Digite o nome do cliente"
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  setShowClientSuggestions(true);
                  // Clear selection if user starts typing differently
                  const matchingClient = clients.find(c =>
                    c.nome_razao.toLowerCase() === e.target.value.toLowerCase()
                  );
                  if (matchingClient) {
                    setSelectedClientId(matchingClient.id);
                    setClientContact(matchingClient.telefone || "");
                  } else {
                    setSelectedClientId("");
                  }
                }}
                onFocus={() => setShowClientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
              />
              {showClientSuggestions && clientName && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                  {clients
                    .filter(c => c.nome_razao.toLowerCase().includes(clientName.toLowerCase()))
                    .slice(0, 5)
                    .map((client) => (
                      <div
                        key={client.id}
                        className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                      onMouseDown={() => {
                          setClientName(client.nome_razao);
                          setSelectedClientId(client.id);
                          setClientContact(client.telefone || "");
                          setClientEmail(client.email || "");
                          setClientStreet(client.endereco_rua || "");
                          setClientCity(client.endereco_cidade || "");
                          setClientState(client.endereco_estado || "");
                          setClientZip(client.endereco_cep || "");
                          if (client.endereco_pais) setOrderCountry(client.endereco_pais);
                          setShowClientSuggestions(false);
                        }}
                      >
                        {client.nome_razao}
                        {client.telefone && <span className="text-muted-foreground font-bold ml-2">({client.telefone})</span>}
                      </div>
                    ))}
                  {clients.filter(c => c.nome_razao.toLowerCase().includes(clientName.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground font-bold">
                      Novo cliente será criado
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Contato</Label>
              <Input
                placeholder="Telefone do cliente"
                value={clientContact}
                onChange={(e) => setClientContact(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                placeholder="Email do cliente"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Linha 3: Endereço — campos separados (rua/cidade/estado/CEP) em vez de um texto
              livre único, senão a Shippo não consegue validar/cotar frete pra esse cliente
              (ela exige os campos estruturados, não uma string só). */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4">
            <div className="space-y-2">
              <Label>País</Label>
              <Select value={orderCountry || undefined} onValueChange={setOrderCountry}>
                <SelectTrigger className="w-[76px] justify-center px-2">
                  <SelectValue placeholder="País">
                    {orderCountry && orderCountry.length === 2 && (
                      <SquareFlag code={orderCountry} className="h-4 w-6" />
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="flex items-center gap-2">
                        <SquareFlag code={c.code} className="h-4 w-6" />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rua, número</Label>
              <Input
                placeholder="Ex: 123 Main St, Apt 4B"
                value={clientStreet}
                onChange={(e) => setClientStreet(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input placeholder="Cidade" value={clientCity} onChange={(e) => setClientCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input placeholder="Estado" value={clientState} onChange={(e) => setClientState(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input placeholder="CEP / ZIP" value={clientZip} onChange={(e) => setClientZip(e.target.value)} />
            </div>
          </div>

          {/* Product Selection */}
          <div className="space-y-2 border-t pt-4">
            <Label>Adicionar Produtos</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="col-span-2 sm:col-span-1 space-y-1">
                <Label className="text-xs">Produto</Label>
                {(() => {
                  const selected = products.find(p => p.id === selectedProduct);
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setEditingItemIndex(null); setProductPickerOpen(true); setSelectedBrand(""); }}
                      className="w-full justify-start font-normal h-10 px-3"
                    >
                      {selected ? (
                        <div className="flex items-center gap-2 min-w-0">
                          {selected.image_url ? (
                            <img
                              src={selected.image_url}
                              alt={selected.name}
                              className="w-6 h-6 object-cover rounded shrink-0"
                            />
                          ) : (
                            <Package className="h-4 w-4 shrink-0 text-muted-foreground font-bold" />
                          )}
                          <span className="truncate">{selected.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-bold">Selecionar produto</span>
                      )}
                    </Button>
                  );
                })()}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  placeholder="Qtd."
                  value={quantidade}
                  onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                  min="1"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Valor Unitário</Label>
                <CurrencyInput
                  placeholder="0.00"
                  value={valorUnitario}
                  onChange={(e) => setValorUnitario(e.target.value)}
                />
              </div>

              <div className="col-span-2 sm:col-span-1 space-y-1">
                <Label className="text-xs opacity-0 hidden sm:block">Ação</Label>
                <Button type="button" onClick={addProduct} className="w-full">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Added Products List — one row per product (not per unit); quantity and unit
                price are editable inline, with a per-line total and an overall subtotal. */}
            {orderItems.length > 0 && (
              <div className="mt-4 space-y-2">
                {/* Column headers */}
                <div className="hidden sm:grid grid-cols-[1fr_112px_120px_92px_32px] gap-3 px-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <span>Produto</span>
                  <span className="text-center">Qtd</span>
                  <span className="text-right">Valor unit.</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>

                {orderItems.map((item, index) => (
                  !item.productId ? (
                    // Synced from eBay with no SKU match — ask the human to pick the product
                    // by hand instead of silently dropping the line.
                    <div key={index} className="flex items-center justify-between gap-3 p-3 rounded bg-destructive/10 border border-destructive/30">
                      <span className="text-sm font-medium text-destructive">
                        Produto não identificado{item.sku ? ` (SKU: ${item.sku})` : ''} — {item.quantidade}x ${(item.valorUnitario || 0).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => { setEditingItemIndex(index); setProductPickerOpen(true); setSelectedBrand(""); }}
                        >
                          Selecionar produto
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeProduct(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div key={index} className="grid grid-cols-2 sm:grid-cols-[1fr_112px_120px_92px_32px] gap-3 items-center py-1.5 pl-1.5 pr-3 rounded bg-muted min-h-[64px]">
                      {/* Product — image sits just inside the card, with a small breathing gap */}
                      <div className="col-span-2 sm:col-span-1 flex items-center gap-3 min-w-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.productName} className="w-14 h-14 object-cover rounded shrink-0" />
                        ) : (
                          <div className="w-14 h-14 bg-background/50 rounded shrink-0" />
                        )}
                        <div className="min-w-0 flex flex-col justify-center">
                          <p className="text-sm font-medium truncate">{item.productName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.marca}{item.custoUnitario > 0 ? ` · Custo $${item.custoUnitario.toFixed(2)}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Quantity stepper */}
                      <div className="flex items-center border rounded-md overflow-hidden h-9 bg-background">
                        <button type="button" onClick={() => updateItemQty(index, item.quantidade - 1)} className="w-8 h-full flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30" disabled={item.quantidade <= 1} aria-label="Diminuir">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input type="number" min="1" value={item.quantidade} onChange={(e) => updateItemQty(index, parseInt(e.target.value) || 1)} className="w-full h-full text-center text-sm bg-transparent border-x outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <button type="button" onClick={() => updateItemQty(index, item.quantidade + 1)} className="w-8 h-full flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Aumentar">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Unit price (editable) */}
                      <CurrencyInput
                        value={String(item.valorUnitario ?? "")}
                        onChange={(e) => updateItemPrice(index, e.target.value)}
                        className="h-9 text-right"
                      />

                      {/* Line total */}
                      <span className="text-sm font-semibold text-right tabular-nums">
                        ${(item.quantidade * (item.valorUnitario || 0)).toFixed(2)}
                      </span>

                      {/* Remove */}
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 justify-self-end" onClick={() => removeProduct(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                ))}

                {/* Subtotal */}
                <div className="flex justify-end gap-6 pt-2 text-sm">
                  <span className="text-muted-foreground">
                    Itens: <span className="font-semibold text-foreground tabular-nums">{orderItems.reduce((s, it) => s + (it.quantidade || 0), 0)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Subtotal produtos: <span className="font-semibold text-foreground tabular-nums">${valorProdutosSomados.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Resultado financeiro — layout: extrato editável à esquerda, lucro em destaque à direita.
              TAX é informativo (não entra em total nem lucro). */}
          <div className="border-t pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Resultado financeiro</p>

            {/* Aviso de divergência: total informado (salvo) não bate com a soma das partes */}
            {calc.totalDivergente && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-semibold">Conferir este pedido</p>
                  <p>
                    O total informado (${(editingOrder?.total || 0).toFixed(2)}) não bate com a soma dos itens
                    (${valorTotalVenda.toFixed(2)}) — diferença de ${Math.abs(calc.diferencaTotal).toFixed(2)}.
                    Provavelmente falta preencher algum valor à mão.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.95fr] gap-4 items-start">
              {/* Extrato editável */}
              <div className="rounded-xl border overflow-hidden">
                {/* Receita */}
                <div className="p-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-green-700 mb-1">▲ Receita</p>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground">Produtos (subtotal)</Label>
                    <span className="text-sm font-mono font-semibold text-green-700 tabular-nums">${valorProdutosSomados.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground shrink-0">Shipping pago pelo cliente</Label>
                    <CurrencyInput {...register("shippingPagoCliente")} readOnly={isEbay} className={`h-8 w-32 text-right ${isEbay ? "bg-muted cursor-not-allowed" : ""}`} title={isEbay ? "Importado do eBay — somente leitura" : undefined} />
                  </div>
                </div>

                {/* Deduções */}
                <div className="p-3 space-y-1 border-t">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-destructive mb-1">▼ Deduções</p>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground">Custo dos produtos</Label>
                    <span className="text-sm font-mono text-destructive tabular-nums">− ${valorCustoTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground shrink-0">Comissão plataforma</Label>
                    <CurrencyInput {...register("comissaoEbay")} readOnly={isEbay} className={`h-8 w-32 text-right ${isEbay ? "bg-muted cursor-not-allowed" : ""}`} title={isEbay ? "Comissão do eBay (Final Value Fee) — somente leitura" : undefined} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground shrink-0">Promoted Listings</Label>
                    <CurrencyInput {...register("promotedListings")} readOnly={isEbay} className={`h-8 w-32 text-right ${isEbay ? "bg-muted cursor-not-allowed" : ""}`} title={isEbay ? "Ad Fee — importado do eBay, somente leitura" : undefined} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground shrink-0">Valor pago pelo envio</Label>
                    <CurrencyInput {...register("custoTotalShipping")} className="h-8 w-32 text-right" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground shrink-0">Desconto</Label>
                    <CurrencyInput {...register("descontoPlataforma")} readOnly={isEbay} className={`h-8 w-32 text-right ${isEbay ? "bg-muted cursor-not-allowed" : ""}`} title={isEbay ? "Desconto do eBay — importado, somente leitura" : "Desconto aplicado nesta venda"} />
                  </div>
                </div>

                {/* Informativo (TAX) */}
                <div className="p-3 space-y-1 border-t bg-muted/40">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">● Informativo (não entra na conta)</p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Label className="text-xs text-muted-foreground shrink-0">TAX (base)</Label>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Preenche o TAX com 6.5% do subtotal dos produtos (Flórida)">
                        <Checkbox
                          checked={autoFloridaTax}
                          onCheckedChange={(v) => setAutoFloridaTax(v === true)}
                          disabled={isEbay}
                          className="h-4 w-4"
                        />
                        <span className="text-[11px] text-muted-foreground">6.5% FL</span>
                      </label>
                    </div>
                    <CurrencyInput {...register("tax")} readOnly={isEbay || autoFloridaTax} className={`h-8 w-32 text-right text-muted-foreground ${isEbay || autoFloridaTax ? "bg-muted cursor-not-allowed" : ""}`} title={autoFloridaTax ? "Calculado automaticamente (6.5% do subtotal). Desmarque para editar manualmente." : "Apenas referência — não soma ao total nem desconta do lucro"} />
                  </div>
                </div>
              </div>

              {/* Lucro em destaque */}
              <div className="rounded-xl border bg-muted/40 p-5 text-center lg:sticky lg:top-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Lucro Final</p>
                <p className="text-4xl font-serif font-semibold text-green-700 leading-none mt-2 mb-1 tabular-nums">${lucroFinal.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">
                  Margem de {valorTotalVenda > 0 ? ((lucroFinal / valorTotalVenda) * 100).toFixed(1) : "0.0"}%
                </p>
                <div className="mt-4 pt-3 border-t space-y-1.5 text-left">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Valor total da venda</span><span className="font-mono tabular-nums">${valorTotalVenda.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total deduções</span><span className="font-mono tabular-nums">${calc.totalDeducoes.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">TAX (base)</span><span className="font-mono tabular-nums text-muted-foreground">${tax.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Fields */}
          <div className="grid grid-cols-1 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Shipping Tracking</Label>
              <div className="flex gap-2 items-center">
                {carrier && getCarrierLogo(carrier) && (
                  <img src={getCarrierLogo(carrier)!} alt={carrier} className="h-8 w-auto object-contain" />
                )}
                <Input
                  {...register("shippingTracking")}
                  className="flex-1"
                  onChange={(e) => {
                    const val = e.target.value;
                    setValue("shippingTracking", val);
                    if (val.trim()) {
                      setCarrier(detectCarrier(val));
                    } else {
                      setCarrier("");
                    }
                  }}
                />
                <Select value={carrier} onValueChange={(v) => setCarrier(v as Carrier)}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue placeholder="Carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIER_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span className="flex items-center gap-2">
                          <img src={getCarrierLogo(c)!} alt={c} className="h-4 w-auto object-contain" />
                          {c}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {watch("shippingTracking") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const num = watch("shippingTracking")?.trim();
                      if (!num) return;
                      window.open(getTrackingUrl(num, carrier || undefined), '_blank');
                    }}
                    title="Rastrear pacote"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea {...register("observacoes")} />
            </div>
          </div>
          </div>

          {isCancelled && (
            <div className="text-center -mt-2">
              <p className="text-sm text-destructive font-medium">
                Este pedido foi cancelado e não pode mais ser editado.
              </p>
              {editingOrder?.estoque_devolvido && (
                <p className="text-sm text-destructive font-medium">
                  Os produtos foram enviados de volta ao estoque.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-4 flex-wrap gap-2">
            {/* Status + Funds dropdowns — bottom left */}
            <div className="flex items-center gap-3">
              {/* Live Shippo status — real carrier tracking */}
              {editingOrder?.shipping_tracking && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Shippo:</span>
                  {shippoLoading ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0 animate-pulse" />
                  ) : (
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${shippingDotColor(shippingToDot(shippoData?.tracking?.tracking_status?.status ?? null, true))}`}
                      title={shippingDotLabel(shippingToDot(shippoData?.tracking?.tracking_status?.status ?? null, true))}
                    />
                  )}
                  <span className="text-xs">{shippingDotLabel(shippingToDot(shippoData?.tracking?.tracking_status?.status ?? null, true))}</span>
                </div>
              )}

              {/* Platform link */}
              {editingOrder?.numero_pedido_canal && editingOrder?.canal && (() => {
                let url: string | null = null;
                if (editingOrder.canal === 'eBay')
                  url = `https://www.ebay.com/mesh/ord/details?orderId=${encodeURIComponent(editingOrder.numero_pedido_canal)}`;
                else if (editingOrder.canal === 'Amazon')
                  url = `https://sellercentral.amazon.com/orders-v3/order/${editingOrder.numero_pedido_canal}`;
                return url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-medium"
                    title={`Abrir pedido na ${editingOrder.canal}`}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Ver na {editingOrder.canal}
                  </a>
                ) : null;
              })()}

            </div>

            {/* Action buttons — bottom right, stacked in two rows: destructive/secondary
                actions on top, the primary save/status actions below. */}
            <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar Alterações
              </Button>
              {editingOrder && !isCancelled && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowCancelOrderDialog(true)}
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar Pedido
                </Button>
              )}
              {(() => {
                const isStripe = editingOrder?.forma_pagamento === 'Stripe' && !!editingOrder?.numero_pedido_canal;
                return (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    onClick={() => setShowRefundDialog(true)}
                    disabled={!isStripe || refunding}
                    title={isStripe ? "Reembolsar este pedido via Stripe" : "Disponível apenas para pedidos pagos via Stripe"}
                  >
                    {refunding ? <Loader2 className="h-4 w-4 animate-spin" /> : <StripeLogo className="h-4 w-4" />}
                    Reembolsar via Stripe
                  </Button>
                );
              })()}
            </div>
            <div className="flex gap-2">
              {!isCancelled && (!editingOrder || editingOrder.status !== 'Entregue') && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-green-600 text-green-700 hover:bg-green-50 hover:text-green-700"
                  onClick={handleSubmit((data) => saveOrder(data, { status: 'Entregue', manual: true }))}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Entregue
                </Button>
              )}
              {!isCancelled && (
                <Button type="submit" size="sm" className="gap-1.5">
                  <Save className="h-4 w-4" />
                  {editingOrder ? 'Salvar Alterações' : 'Criar Pedido'}
                </Button>
              )}
            </div>
            </div>
            <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <StripeLogo className="h-5 w-5" /> Reembolsar via Stripe
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <p>
                        Reembolsar o pedido de <strong className="text-foreground">{editingOrder?.clients?.nome_razao || "cliente"}</strong>
                        {valorTotalVenda > 0 && <> ({fmtUSD(valorTotalVenda)})</>}? Essa ação não pode ser desfeita.
                      </p>
                      {editingOrder?.numero_pedido_canal && (
                        <p className="text-xs font-mono truncate" title={editingOrder.numero_pedido_canal}>
                          #{editingOrder.numero_pedido_canal}
                        </p>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRefund}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Reembolsar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={showCancelOrderDialog} onOpenChange={setShowCancelOrderDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" /> Cancelar Pedido
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <p>
                        Cancelar o pedido de <strong className="text-foreground">{editingOrder?.clients?.nome_razao || "cliente"}</strong>
                        {valorTotalVenda > 0 && <> ({fmtUSD(valorTotalVenda)})</>}? O pedido ficará travado para edição.
                      </p>
                      {editingOrder?.numero_pedido_canal && (
                        <p className="text-xs font-mono truncate" title={editingOrder.numero_pedido_canal}>
                          #{editingOrder.numero_pedido_canal}
                        </p>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setShowCancelOrderDialog(false);
                      handleSubmit((data) => saveOrder(data, { status: 'Cancelado', manual: true }))();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Cancelar Pedido
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </form>
        </div>

        {activeTab === 'shipping' && (
          !editingOrder ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <Truck className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Shipping do pedido</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Salve o pedido primeiro para ver as informações de envio.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5 text-sm max-h-[65vh] overflow-y-auto pr-1">

              {/* ── Etapas do despacho ── */}
              {(() => {
                const st: string | null = shippoData?.tracking?.tracking_status?.status ?? null;
                const hasLabel = !!shippoData?.transaction?.label_url;
                const shipped = st === "TRANSIT" || st === "PRE_TRANSIT" || st === "DELIVERED";
                const delivered = st === "DELIVERED";
                const steps = [
                  { label: "Pago", done: true },
                  { label: "Etiqueta", done: hasLabel },
                  { label: "Enviado", done: shipped },
                  { label: "Entregue", done: delivered },
                ];
                return (
                  <div className="flex items-center">
                    {steps.map((s, i) => (
                      <div key={s.label} className="flex-1 flex flex-col items-center relative">
                        {i < steps.length - 1 && (
                          <div className={`absolute top-[7px] left-1/2 w-full h-0.5 ${steps[i + 1].done ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                        )}
                        <span className={`relative z-10 w-3.5 h-3.5 rounded-full border-2 ${s.done ? "bg-green-500 border-green-500" : "bg-background border-muted-foreground/40"}`} />
                        <span className={`mt-1.5 text-[11px] ${s.done ? "text-green-700 font-semibold" : "text-muted-foreground"}`}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── Cartões: Destino · Envio ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Destino */}
                <div className="rounded-lg border p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">📍 Destino</p>
                  <p className="font-semibold">{editingOrder.clients?.nome_razao || "—"}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                    {[editingOrder.clients?.endereco_rua, [editingOrder.clients?.endereco_cidade, editingOrder.clients?.endereco_estado, editingOrder.clients?.endereco_cep].filter(Boolean).join(", "), editingOrder.clients?.endereco_pais].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">{editingOrder.canal} · Nº {editingOrder.numero_pedido_canal || "—"}</p>
                </div>

                {/* Envio */}
                <div className="rounded-lg border p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Envio</p>
                  <div className="flex items-center gap-2 mb-1">
                    {carrier && getCarrierLogo(carrier) ? (
                      <img src={getCarrierLogo(carrier)!} alt={carrier} className="h-6 w-auto object-contain" />
                    ) : (
                      <span className="font-semibold">{carrier || editingOrder.carrier || "—"}</span>
                    )}
                    {shippoData?.transaction?.rate?.servicelevel?.name && (
                      <span className="text-xs text-muted-foreground">{shippoData.transaction.rate.servicelevel.name}</span>
                    )}
                  </div>
                  <p className="text-sm"><span className="text-muted-foreground">Custo do envio:</span>{" "}
                    <strong>{editingOrder.custo_total_shipping ? fmtUSD(editingOrder.custo_total_shipping)
                      : shippoData?.transaction?.rate?.amount ? `${shippoData.transaction.rate.currency || "USD"} ${parseFloat(shippoData.transaction.rate.amount).toFixed(2)}`
                      : "—"}</strong>
                  </p>
                  <p className="text-sm mt-1"><span className="text-muted-foreground">Rastreio:</span>{" "}
                    <code className="font-mono text-xs bg-muted px-1 rounded">{editingOrder.shipping_tracking || "—"}</code>
                  </p>
                  {/* Rastrear — flecha simples, desabilitado se sem tracking */}
                  <Button
                    type="button" size="sm" variant="outline"
                    disabled={!editingOrder.shipping_tracking}
                    onClick={() => editingOrder.shipping_tracking && window.open(getTrackingUrl(editingOrder.shipping_tracking, (carrier || editingOrder.carrier) || undefined), "_blank")}
                    className="mt-3 gap-2 disabled:opacity-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Rastrear
                  </Button>
                </div>
              </div>

              {/* ── Itens na caixa ── */}
              {(editingOrder.order_items || []).length > 0 && (
                <div className="rounded-lg border p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-3">
                    📦 Itens na caixa ({(editingOrder.order_items || []).reduce((s: number, i: any) => s + (i.quantidade || 0), 0)})
                  </p>
                  <div className="space-y-2">
                    {editingOrder.order_items.map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        {item.products?.image_url && (
                          <img src={item.products.image_url} className="h-9 w-9 rounded object-cover bg-muted shrink-0" alt="" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.products?.name || "—"}</p>
                          {item.products?.vin && <p className="text-xs text-muted-foreground">VIN {item.products.vin}</p>}
                        </div>
                        <span className="text-sm text-muted-foreground shrink-0">×{item.quantidade}</span>
                        <span className="text-sm font-medium tabular-nums shrink-0">{fmtUSD(item.preco_unitario)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Sem tracking ── */}
              {!editingOrder.shipping_tracking && (
                <div className="p-4 rounded-lg bg-muted/50 text-muted-foreground text-center text-xs">
                  Este pedido ainda não possui tracking. Compre a etiqueta (Buy Label) para gerar o rastreio.
                </div>
              )}

              {/* ── Carregando ── */}
              {editingOrder.shipping_tracking && shippoLoading && (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Carregando rastreio…</span>
                </div>
              )}

              {/* ── Histórico do tracking (abaixo de tudo, como já era) ── */}
              {shippoData?.tracking && !shippoData.tracking._error && (
                <section className="border-t pt-4">
                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Histórico do rastreio</p>
                    {(() => {
                      const s: string | null = shippoData.tracking.tracking_status?.status ?? null;
                      const d = shippingToDot(s, true);
                      return (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${shippingDotColor(d)}`} />
                          {s || "—"} <span className="text-muted-foreground">({shippingDotLabel(d)})</span>
                        </span>
                      );
                    })()}
                    {shippoData.tracking.eta && <span className="text-xs text-muted-foreground ml-auto">ETA: {new Date(shippoData.tracking.eta).toLocaleDateString("en-US")}</span>}
                  </div>
                  {shippoData.tracking.tracking_history?.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {shippoData.tracking.tracking_history.map((h: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`inline-block w-2 h-2 rounded-full mt-1 shrink-0 ${h.status === "DELIVERED" ? "bg-green-500" : h.status === "TRANSIT" ? "bg-yellow-400" : "bg-gray-300"}`} />
                          <div>
                            <span className="font-medium">{h.status}</span>
                            {h.status_details && <span className="text-muted-foreground"> — {h.status_details}</span>}
                            {h.location?.city && <span className="text-muted-foreground"> · {h.location.city}{h.location.state ? `, ${h.location.state}` : ""}</span>}
                            {h.status_date && <span className="text-muted-foreground ml-2">{new Date(h.status_date).toLocaleString("en-US")}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem eventos de rastreio ainda.</p>
                  )}
                </section>
              )}
            </div>
          )
        )}
      </DialogContent>

      {/* Product Picker Dialog */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Selecionar Produto</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground font-bold" />
              <Input
                autoFocus
                placeholder="Buscar por nome, marca, SKU ou ASIN..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center rounded-md border bg-background p-0.5">
              <Button
                type="button"
                size="sm"
                variant={productViewMode === "grid" ? "secondary" : "ghost"}
                onClick={() => setProductViewMode("grid")}
                className="h-8 px-2"
                title="Visualização em grade"
              >
                <LayoutGrid className="h-4 w-4 text-slate-50" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={productViewMode === "list" ? "secondary" : "ghost"}
                onClick={() => setProductViewMode("list")}
                className="h-8 px-2"
                title="Visualização em lista"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Brand Filter */}
          {(() => {
            const brands = [...new Set(products.map(p => p.make).filter(Boolean))].sort();
            if (brands.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedBrand === "" ? "default" : "outline"}
                  onClick={() => setSelectedBrand("")}
                  className="h-7 text-xs px-2.5"
                >
                  Todas
                </Button>
                {brands.map((brand) => (
                  <Button
                    key={brand}
                    type="button"
                    size="sm"
                    variant={selectedBrand === brand ? "default" : "outline"}
                    onClick={() => setSelectedBrand(selectedBrand === brand ? "" : brand)}
                    className="h-7 text-xs px-2.5"
                  >
                    {brand}
                  </Button>
                ))}
              </div>
            );
          })()}
          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            {(() => {
              const filtered = products.filter((p) => {
                if (selectedBrand && p.make !== selectedBrand) return false;
                const q = productSearch.toLowerCase().trim();
                if (!q) return true;
                return (
                  (p.name || "").toLowerCase().includes(q) ||
                  (p.make || "").toLowerCase().includes(q) ||
                  (p.vin || "").toLowerCase().includes(q) ||
                  (p.license_plate || "").toLowerCase().includes(q)
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground font-bold">
                    Nenhum produto encontrado
                  </div>
                );
              }

              if (productViewMode === "grid") {
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filtered.map((product) => {
                      const isSelected = product.id === selectedProduct;
                      return (
                        <button
                          type="button"
                          key={product.id}
                          onClick={() => handlePickProduct(product)}
                          className={cn(
                            "group relative flex flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left transition-all hover:border-primary hover:shadow-md",
                            isSelected && "border-primary ring-2 ring-primary"
                          )}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                          <div className="w-full aspect-square rounded-md bg-muted overflow-hidden flex items-center justify-center">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="h-10 w-10 text-muted-foreground font-bold" />
                            )}
                          </div>
                          <div className="w-full space-y-1">
                            <p className="text-sm font-medium line-clamp-2">
                              {product.name}
                            </p>
                            {product.make && (
                              <p className="text-xs text-muted-foreground font-bold">{product.make}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-1">
                  {filtered.map((product) => {
                    const isSelected = product.id === selectedProduct;
                    return (
                      <button
                        type="button"
                        key={product.id}
                        onClick={() => handlePickProduct(product)}
                        className={cn(
                          "group flex items-center gap-3 rounded-md border bg-card p-2 text-left transition-all hover:border-primary hover:bg-accent",
                          isSelected && "border-primary ring-1 ring-primary"
                        )}
                      >
                        <div className="h-12 w-12 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground font-bold" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
                            {product.make && <span>{product.make}</span>}
                            {product.vin && <span>· SKU: {product.vin}</span>}
                            {product.license_plate && <span>· ASIN: {product.license_plate}</span>}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="bg-primary text-primary-foreground rounded-full p-1 shrink-0">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <BuyLabelDialog
        order={editingOrder}
        labelTx={null}
        open={buyLabelOpen}
        onOpenChange={setBuyLabelOpen}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}
