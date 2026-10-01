import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";

async function requireAdminRole(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.userId) return { ok: false as const, status: auth.status };
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", auth.userId)
    .single();
  if (!profile || profile.role !== "admin") return { ok: false as const, status: 403 };
  return { ok: true as const, userId: auth.userId };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRole(request);
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, display_name, role");
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const result = users.users.map((u) => {
    const p = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      display_name: p?.display_name ?? "",
      role: p?.role ?? "user",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    };
  });

  return NextResponse.json({ users: result });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminRole(request);
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const body = await request.json();
  const { email, password, role, display_name } = body as {
    email?: string;
    password?: string;
    role?: string;
    display_name?: string;
  };

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 });
  }
  if (password.length < 3) {
    return NextResponse.json({ error: "Senha deve ter pelo menos 3 caracteres" }, { status: 400 });
  }
  const validRole = role === "admin" ? "admin" : "user";

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: display_name || email.split("@")[0], role: validRole },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ user: { id: data.user.id, email: data.user.email } });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminRole(request);
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const body = await request.json();
  const { user_id, action, role, password } = body as {
    user_id?: string;
    action?: string;
    role?: string;
    password?: string;
  };

  if (!user_id) return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });

  if (action === "reset_password") {
    if (!password || password.length < 3) {
      return NextResponse.json({ error: "Nova senha deve ter pelo menos 3 caracteres" }, { status: 400 });
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "change_role") {
    const validRole = role === "admin" ? "admin" : "user";
    const { error } = await supabaseAdmin.rpc("admin_set_user_role", {
      target_user_id: user_id,
      new_role: validRole,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, role: validRole });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
