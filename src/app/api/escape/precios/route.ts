import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ESCAPE_PRECIO_MIN_CANTIDAD,
  ESCAPE_PRECIO_MAX_CANTIDAD,
  type EscapePreciosUpdate,
} from "@/types/escapeRoom";

/** GET — list the global (sala_id = null) per-person price tiers, ordered by cantidad. */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("escape_precios_persona")
    .select("*")
    .is("sala_id", null)
    .order("cantidad", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** PUT — upsert the global per-person price tiers. Admin only. */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (!usuario || usuario.rol !== "admin") {
    return NextResponse.json(
      { error: "Solo administradores pueden modificar los precios" },
      { status: 403 }
    );
  }

  let body: EscapePreciosUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.precios || typeof body.precios !== "object") {
    return NextResponse.json({ error: "precios is required" }, { status: 400 });
  }

  const rows: { sala_id: null; cantidad: number; precio_por_persona: number }[] = [];
  for (const [cantidadStr, precio] of Object.entries(body.precios)) {
    const cantidad = Number(cantidadStr);
    if (
      !Number.isInteger(cantidad) ||
      cantidad < ESCAPE_PRECIO_MIN_CANTIDAD ||
      cantidad > ESCAPE_PRECIO_MAX_CANTIDAD
    ) {
      return NextResponse.json(
        {
          error: `cantidad must be an integer between ${ESCAPE_PRECIO_MIN_CANTIDAD} and ${ESCAPE_PRECIO_MAX_CANTIDAD}`,
        },
        { status: 400 }
      );
    }
    if (typeof precio !== "number" || precio < 0) {
      return NextResponse.json(
        { error: "precio_por_persona must be a non-negative number" },
        { status: 400 }
      );
    }
    rows.push({ sala_id: null, cantidad, precio_por_persona: precio });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "precios cannot be empty" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("escape_precios_persona")
    .upsert(rows, { onConflict: "cantidad" })
    .select()
    .order("cantidad", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
