import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validarEmail, validarTelefono } from "@/lib/validaciones";
import { unauthorizedResponse } from "@/lib/auth-helpers";
import type { EscapeContactoInsert } from "@/types/escapeRoom";

/** Escapes ILIKE metacharacters to prevent pattern amplification. */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

/** GET — search escape_contactos by nombre/telefono/email, or list all when no query. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : null;

  let query = supabase
    .from("escape_contactos")
    .select("*")
    .order("nombre", { ascending: true });

  if (q) {
    const escaped = escapeLike(q);
    query = query.or(
      `nombre.ilike.%${escaped}%,telefono.ilike.%${escaped}%,email.ilike.%${escaped}%`
    );
  }

  if (limit && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — create a contacto. Requires nombre and at least one of telefono/email. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  let body: EscapeContactoInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.nombre) {
    return NextResponse.json({ error: "nombre is required" }, { status: 400 });
  }
  if (!body.telefono && !body.email) {
    return NextResponse.json(
      { error: "Debe indicar al menos un teléfono o email de contacto" },
      { status: 400 }
    );
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
    .from("escape_contactos")
    .insert({
      nombre: body.nombre,
      telefono: body.telefono ?? null,
      email: body.email ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
