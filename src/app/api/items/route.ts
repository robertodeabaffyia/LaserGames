import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  requireUser,
  unauthorizedResponse,
  forbiddenResponse,
  getUserRol,
  hasMinRole,
} from "@/lib/auth-helpers";
import type { ItemInsert } from "@/types/items";

export async function GET() {
  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user) return unauthorizedResponse();

  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "admin")) {
    return forbiddenResponse("Solo administradores pueden modificar el catálogo de items");
  }

  let body: ItemInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.nombre) {
    return NextResponse.json({ error: "nombre is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("items")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
