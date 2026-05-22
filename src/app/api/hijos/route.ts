import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { HijoInsert } from "@/types/hijos";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  let body: HijoInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.cliente_id || !body.nombre || !body.fecha_nacimiento) {
    return NextResponse.json(
      { error: "cliente_id, nombre, and fecha_nacimiento are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("hijos")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
