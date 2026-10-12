// Gates the Turo integration to a single master-admin account "for now".
// Overridable via env so the owner can change the gated account without a code change.
export const MASTER_ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL || "renantadeu94@gmail.com"
).trim().toLowerCase();

export function isMasterAdminEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}
