import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getLists, createList, getFolders, createFolder } from "@/lib/brevo";

const DEFAULT_FOLDER_NAME = "Vertex Rental Cars";

async function getOrCreateDefaultFolderId(): Promise<number> {
  const folders = await getFolders();
  const existing = folders?.folders?.find((f: any) => f.name === DEFAULT_FOLDER_NAME);
  if (existing) return existing.id;
  const created = await createFolder(DEFAULT_FOLDER_NAME);
  return created.id;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const data = await getLists({ limit: 50 });
    return NextResponse.json({ lists: data?.lists ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to fetch lists" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { name } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Missing list name" }, { status: 400 });
  }

  try {
    const folderId = await getOrCreateDefaultFolderId();
    const list = await createList({ name: name.trim(), folderId });
    return NextResponse.json({ list });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to create list" }, { status: 500 });
  }
}
