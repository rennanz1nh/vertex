import { supabaseAdmin } from "@/lib/supabase-admin";

export interface AuditEvent {
  tableName: string;
  recordId: string;
  action: string;
  userId?: string | null;
  source: "hub_ui" | "mcp_tool" | "cron" | "system";
  mcpToolName?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

/** Writes to the existing audit_logs table (spec section 21/35 — reuse, don't recreate). Never throws: a lost audit entry must not block the action it's recording. */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    table_name: event.tableName,
    record_id: event.recordId,
    action: event.action,
    user_id: event.userId ?? null,
    source: event.source,
    mcp_tool_name: event.mcpToolName ?? null,
    old_values: event.oldValues ?? null,
    new_values: event.newValues ?? null,
  });
  if (error) {
    console.error("Failed to write audit log", { event, error: error.message });
  }
}
