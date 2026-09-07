const BREVO_BASE = "https://api.brevo.com/v3";

export class BrevoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function apiKey(): string {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new BrevoError(500, "BREVO_API_KEY is not configured");
  return key;
}

async function brevoFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BREVO_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey(),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new BrevoError(res.status, `Brevo API ${res.status}: ${body}`);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---- Account ----

export function getAccount() {
  return brevoFetch("/account");
}

// ---- Senders ----

export function getSenders() {
  return brevoFetch("/senders");
}

// ---- Contacts ----

export type UpsertContactInput = {
  email: string;
  attributes?: Record<string, string | number | boolean | null>;
  listIds?: number[];
};

export function upsertContact({ email, attributes, listIds }: UpsertContactInput) {
  return brevoFetch("/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      attributes,
      listIds,
      updateEnabled: true,
    }),
  });
}

export function getContacts({ limit = 50, offset = 0, listId }: { limit?: number; offset?: number; listId?: number } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (listId) params.set("listIds", String(listId));
  return brevoFetch(`/contacts?${params.toString()}`);
}

export function getContactsCount() {
  return brevoFetch("/contacts?limit=1&offset=0");
}

// ---- Lists ----

export function getLists({ limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}) {
  return brevoFetch(`/contacts/lists?limit=${limit}&offset=${offset}`);
}

export function createList({ name, folderId }: { name: string; folderId: number }) {
  return brevoFetch("/contacts/lists", {
    method: "POST",
    body: JSON.stringify({ name, folderId }),
  });
}

export function getFolders() {
  return brevoFetch("/contacts/folders?limit=50&offset=0");
}

export function createFolder(name: string) {
  return brevoFetch("/contacts/folders", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

// ---- Email campaigns ----

export type CreateCampaignInput = {
  name: string;
  subject: string;
  htmlContent: string;
  sender: { name: string; email: string };
  listIds: number[];
  scheduledAt?: string;
};

export function createCampaign(input: CreateCampaignInput) {
  return brevoFetch("/emailCampaigns", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      subject: input.subject,
      htmlContent: input.htmlContent,
      sender: input.sender,
      recipients: { listIds: input.listIds },
      scheduledAt: input.scheduledAt,
    }),
  });
}

export function getCampaigns({ limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}) {
  return brevoFetch(`/emailCampaigns?limit=${limit}&offset=${offset}&sort=desc`);
}

export function getCampaign(id: number) {
  return brevoFetch(`/emailCampaigns/${id}`);
}

export function sendCampaignNow(id: number) {
  return brevoFetch(`/emailCampaigns/${id}/sendNow`, { method: "POST" });
}

export function sendTestCampaign(id: number, emails: string[]) {
  return brevoFetch(`/emailCampaigns/${id}/sendTest`, {
    method: "POST",
    body: JSON.stringify({ emailTo: emails }),
  });
}

export function deleteCampaign(id: number) {
  return brevoFetch(`/emailCampaigns/${id}`, { method: "DELETE" });
}

// ---- Templates ----

export type CreateTemplateInput = {
  templateName: string;
  subject: string;
  htmlContent: string;
  sender: { name: string; email: string };
  isActive?: boolean;
};

export function createTemplate(input: CreateTemplateInput) {
  return brevoFetch("/smtp/templates", {
    method: "POST",
    body: JSON.stringify({ ...input, isActive: input.isActive ?? true }),
  });
}

export function getTemplates({ limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}) {
  return brevoFetch(`/smtp/templates?limit=${limit}&offset=${offset}&sort=desc`);
}

export function updateTemplate(id: number, input: Partial<CreateTemplateInput>) {
  return brevoFetch(`/smtp/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteTemplate(id: number) {
  return brevoFetch(`/smtp/templates/${id}`, { method: "DELETE" });
}

// ---- Transactional email ----

export type SendTransactionalEmailInput = {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  // Plain-text alternative — sending both parts (instead of HTML-only) is a basic
  // deliverability signal most spam filters check for.
  textContent?: string;
  sender?: { name: string; email: string };
};

export function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  return brevoFetch("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      sender: input.sender ?? { name: "Vertex Rental Cars", email: process.env.BREVO_SENDER_EMAIL },
      to: input.to,
      subject: input.subject,
      htmlContent: input.htmlContent,
      ...(input.textContent ? { textContent: input.textContent } : {}),
    }),
  });
}

// ---- Statistics ----

export function getAggregatedStats(params: { startDate?: string; endDate?: string } = {}) {
  const search = new URLSearchParams();
  if (params.startDate) search.set("startDate", params.startDate);
  if (params.endDate) search.set("endDate", params.endDate);
  const qs = search.toString();
  return brevoFetch(`/smtp/statistics/aggregatedReport${qs ? `?${qs}` : ""}`);
}

// ---- Events (used to feed Brevo marketing automations) ----

export function sendEvent(eventName: string, email: string, properties?: Record<string, unknown>) {
  return brevoFetch("/events", {
    method: "POST",
    body: JSON.stringify({ event_name: eventName, identifiers: { email_id: email }, event_properties: properties }),
  });
}
