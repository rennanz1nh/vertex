import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const BUCKET = "vertex-product-images";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const userToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const carId = formData.get("carId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  const isVideo = file.type.startsWith("video/");
  const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `Arquivo muito grande (máximo ${isVideo ? "100MB" : "10MB"})` },
      { status: 400 }
    );
  }

  const allowedImages = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const allowedVideos = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
  if (!allowedImages.includes(file.type) && !allowedVideos.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de arquivo não permitido." }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const prefix = carId ? `${carId}-` : "";
  const fileName = `${prefix}${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const storageEndpoint = `${supabaseUrl}/storage/v1/object/${BUCKET}/${fileName}`;
  const uploadRes = await fetch(storageEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken ?? supabaseAnonKey}`,
      apikey: supabaseAnonKey,
      "Content-Type": file.type,
      "x-upsert": "true",
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const errBody = await uploadRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: (errBody as { message?: string }).message ?? "Erro no upload" },
      { status: 500 }
    );
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${fileName}`;
  return NextResponse.json({ url: publicUrl });
}
