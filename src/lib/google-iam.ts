import { getProjectId, mintScopedAccessToken } from "@/lib/google-cloud-auth";

// Cloud Resource Manager API — who/what has access to this GCP project. Requires the
// service account to have a role that includes resourcemanager.projects.getIamPolicy
// (e.g. roles/viewer or roles/browser) at the PROJECT level — one manual IAM grant the
// user needs to do once in the real GCP Console; the API itself (Resource Manager) is
// enabled by default on essentially every GCP project already.
const RESOURCE_MANAGER_BASE = "https://cloudresourcemanager.googleapis.com/v3";
const IAM_SCOPE = "https://www.googleapis.com/auth/cloud-platform.read-only";

export type IamBinding = { role: string; members: string[] };

/** Project-level IAM policy: every (role, [members]) binding — e.g. who has
 *  roles/owner, roles/editor, which service accounts have which narrower roles. */
export async function getProjectIamPolicy(): Promise<IamBinding[]> {
  const projectId = getProjectId();
  const accessToken = await mintScopedAccessToken(IAM_SCOPE);

  const res = await fetch(`${RESOURCE_MANAGER_BASE}/projects/${projectId}:getIamPolicy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao buscar a política de IAM do projeto (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  return (data.bindings ?? []) as IamBinding[];
}
