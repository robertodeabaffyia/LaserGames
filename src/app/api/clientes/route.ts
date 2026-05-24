import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validarEmail, validarTelefono } from "@/lib/validaciones";
import { unauthorizedResponse } from "@/lib/auth-helpers";
import type { ClienteInsert } from "@/types/clientes";

/** Escapes ILIKE metacharacters to prevent pattern amplification. */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const colegio = searchParams.get("colegio");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : null;

  let query = supabase
    .from("clientes")
    .select("*, hijos(id, nombre, fecha_nacimiento, colegio)")
    .order("nombre", { ascending: true });

  if (q) {
    const escaped = escapeLike(q);
    query = query.or(
      `nombre.ilike.%${escaped}%,telefono.ilike.%${escaped}%,email.ilike.%${escaped}%`
    );
  }

  if (colegio) {
    query = query.filter("hijos.colegio", "ilike", `%${colegio}%`);
  }

  if (limit && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  let body: ClienteInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.nombre) {
    return NextResponse.json({ error: "nombre is required" }, { status: 400 });
  }

  if (body.email && !validarEmail(body.email)) {
    return NextResponse.json({ error: "El formato de email es inválido" }, { status: 400 });
  }

  if (body.telefono && !validarTelefono(body.telefono)) {
    return NextResponse.json(
      { error: "El teléfono debe tener entre 7 y 15 dígitos (formato internacional)" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
