// Every phone (ntfy) notification Vertex can send, with its default text and on/off state.
// Single source of truth for the Settings page, the push API and the sender: a trigger
// works with these defaults until someone edits or toggles it in Settings, which saves a
// row in push_notifications (and that row then wins).
import type { PushTriggerKey } from "@/lib/notify";

export type PushGroup = "reservas" | "turo" | "site";

export type PushCatalogEntry = {
  key: PushTriggerKey;
  group: PushGroup;
  label: string;
  description: string;
  defaultEnabled: boolean;
  title: string;
  message: string;
  tags: string[];
  /** Placeholders available in title/message, with sample values for preview and test. */
  sample: Record<string, string | number>;
};

export const PUSH_GROUPS: { id: PushGroup; label: string; description: string }[] = [
  { id: "reservas", label: "Reservas do site", description: "Pagamentos e movimentos das reservas feitas no site." },
  { id: "turo", label: "Turo", description: "O que muda na Turo, pela sincronização." },
  { id: "site", label: "Site e relatórios", description: "Atendimento, acessos e resumo do dia." },
];

export const PUSH_CATALOG: PushCatalogEntry[] = [
  {
    key: "new_booking",
    group: "reservas",
    label: "Nova reserva paga",
    description: "Assim que um cliente paga uma reserva no site (20% ou total).",
    defaultEnabled: true,
    title: "Nova reserva: {car}",
    message: "{customer} · {dates} · {paid}",
    tags: ["red_car", "tada"],
    sample: { car: "2020 Kia Rio", customer: "Jane Doe", dates: "Dec 20 → Dec 23", paid: "$62.40 pago (20%)", total: "$312.00" },
  },
  {
    key: "checkout_started",
    group: "reservas",
    label: "Cliente na tela de pagamento",
    description: "Quando alguém assina o contrato e chega no pagamento. Bom para acompanhar quem está prestes a reservar.",
    defaultEnabled: false,
    title: "Cliente no pagamento: {car}",
    message: "{customer} · {dates} · {amount}",
    tags: ["credit_card"],
    sample: { car: "2020 Kia Rio", customer: "Jane Doe", dates: "Dec 20 → Dec 23", amount: "$312.00" },
  },
  {
    key: "booking_checkout_abandoned",
    group: "reservas",
    label: "Pagamento não concluído",
    description: "Quando um cliente chegou no pagamento e não pagou em 30 minutos (o carro é liberado). Traz o contato para você retomar.",
    defaultEnabled: true,
    title: "Reserva não paga: {car}",
    message: "{customer} ({email}) · {dates} · {amount}",
    tags: ["hourglass"],
    sample: { car: "2020 Kia Rio", customer: "Jane Doe", email: "jane@example.com", dates: "Dec 20 → Dec 23", amount: "$312.00" },
  },
  {
    key: "booking_balance_paid",
    group: "reservas",
    label: "Saldo de 80% cobrado",
    description: "Quando o restante da reserva é cobrado com sucesso (automático 5 dias antes, pelo admin ou pelo link do cliente).",
    defaultEnabled: true,
    title: "Saldo pago: {car}",
    message: "{customer} · {amount} · retirada {pickup}",
    tags: ["white_check_mark"],
    sample: { car: "2020 Kia Rio", customer: "Jane Doe", amount: "$249.60", pickup: "Dec 20" },
  },
  {
    key: "booking_payment_failed",
    group: "reservas",
    label: "Cobrança do saldo falhou",
    description: "Quando o cartão do cliente recusa os 80%. O cliente recebe um link para pagar e tentamos de novo em 24h.",
    defaultEnabled: true,
    title: "Cobrança falhou: {car}",
    message: "{customer} · {amount} · {reason}",
    tags: ["warning"],
    sample: { car: "2020 Kia Rio", customer: "Jane Doe", amount: "$249.60", reason: "your card was declined" },
  },
  {
    key: "booking_hold_failed",
    group: "reservas",
    label: "Caução de dano não bloqueou",
    description: "Quando o bloqueio da caução ($99) no cartão do cliente é recusado no dia da retirada (ou a renovação durante a locação falha). O cliente recebe um link para autorizar com outro cartão.",
    defaultEnabled: true,
    title: "Caução falhou: {car}",
    message: "{customer} · {amount} · {reason}",
    tags: ["warning"],
    sample: { car: "2020 Kia Rio", customer: "Jane Doe", amount: "$99.00", reason: "your card was declined" },
  },
  {
    key: "pickup_tomorrow",
    group: "reservas",
    label: "Retiradas e devoluções de amanhã",
    description: "Todo dia às 8h (horário da Flórida), a lista de carros que saem e voltam amanhã, do site e da Turo. Não envia se não houver nada.",
    defaultEnabled: true,
    title: "Amanhã: {pickups} retirada(s), {returns} devolução(ões)",
    message: "{list}",
    tags: ["calendar"],
    sample: { pickups: 2, returns: 1, list: "Sai: Kia Rio 10:00 (site), Corolla 14:00 (Turo)\nVolta: Jeep Wrangler 09:00 (Turo)" },
  },
  {
    key: "turo_new_trip",
    group: "turo",
    label: "Nova viagem na Turo",
    description: "Quando a sincronização encontra uma reserva nova na Turo.",
    defaultEnabled: true,
    title: "Nova viagem Turo: {car}",
    message: "{guest} · {dates}",
    tags: ["red_car"],
    sample: { car: "2022 Hyundai Elantra", guest: "John Smith", dates: "Dec 20 → Dec 23" },
  },
  {
    key: "turo_trip_cancelled",
    group: "turo",
    label: "Viagem cancelada na Turo",
    description: "Quando uma viagem da Turo é cancelada. As datas voltam a ficar livres no site.",
    defaultEnabled: true,
    title: "Turo cancelada: {car}",
    message: "{guest} · {dates}",
    tags: ["x"],
    sample: { car: "2022 Hyundai Elantra", guest: "John Smith", dates: "Dec 20 → Dec 23" },
  },
  {
    key: "turo_sync_stale",
    group: "turo",
    label: "Turo sem sincronizar",
    description: "Quando a Turo fica mais de 6h sem sincronizar (o site pode mostrar livre um carro alugado). No máximo um aviso a cada 6h.",
    defaultEnabled: true,
    title: "Turo sem sincronizar há {hours}h",
    message: "Abra a extensão do Chrome ou rode o sync no admin.",
    tags: ["warning"],
    sample: { hours: 14 },
  },
  {
    key: "new_chat_message",
    group: "site",
    label: "Nova mensagem no chat",
    description: "Quando um visitante manda mensagem pelo chat do site.",
    defaultEnabled: true,
    title: "Mensagem de {who}",
    message: "{preview}",
    tags: ["speech_balloon"],
    sample: { who: "Jane Doe", preview: "Hi! Is the Kia Rio available next weekend?" },
  },
  {
    key: "new_visit",
    group: "site",
    label: "Visita no site",
    description: "A cada página aberta por um visitante. Chega muito aviso; deixe desligado no dia a dia.",
    defaultEnabled: false,
    title: "Visita no site",
    message: "{path} · {location}",
    tags: ["eyes"],
    sample: { path: "/products", location: "Orlando, FL, US" },
  },
  {
    key: "daily_report",
    group: "site",
    label: "Resumo diário",
    description: "Toda manhã, com o link para o resumo do dia anterior (vendas e acessos).",
    defaultEnabled: true,
    title: "Resumo diário",
    message: "Receita {revenue} · {sessions} acessos",
    tags: ["bar_chart"],
    sample: { revenue: "$624.00", sessions: 87 },
  },
];

export const PUSH_CATALOG_BY_KEY = new Map(PUSH_CATALOG.map((e) => [e.key, e]));
