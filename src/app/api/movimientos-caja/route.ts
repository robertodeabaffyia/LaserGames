import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getUserRol,
  hasMinRole,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth-helpers";
import type { MovimientoCajaInsert } from "@/types/caja";

const VALID_TIPOS = ["ingreso", "egreso"] as const;
const VALID_CATEGORIAS = [
  "pago_evento", "salario", "bono", "compras", "servicios", "mantenimiento", "otros",
] as const;

const FORBIDDEN_MSG = "Acceso restringido a supervisores o administradores";

/** GET — list movimientos, filterable by mes/dia/desde-hasta/tipo/categoria */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // ── Auth + role guard ─────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) return forbiddenResponse(FORBIDDEN_MSG);

  const { searchParams } = new URL(request.url);

  const mes       = searchParams.get("mes");
  const dia       = searchParams.get("dia");
  const desde     = searchParams.get("desde");
  const hasta     = searchParams.get("hasta");
  const tipo      = searchParams.get("tipo");
  const categoria = searchParams.get("categoria");

  let query = supabase
    .from("movimientos_caja")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (dia) {
    query = query.eq("fecha", dia);
  } else if (mes) {
    const [year, month] = mes.split("-").map(Number);
    const fechaInicio = `${mes}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const fechaFin = `${mes}-${String(lastDay).padStart(2, "0")}`;
    query = query.gte("fecha", fechaInicio).lte("fecha", fechaFin);
  } else if (desde || hasta) {
    if (desde) query = query.gte("fecha", desde);
    if (hasta) query = query.lte("fecha", hasta);
  }

  if (tipo && VALID_TIPOS.includes(tipo as "ingreso" | "egreso")) {
    query = query.eq("tipo", tipo);
  }

  if (categoria && VALID_CATEGORIAS.includes(categoria as typeof VALID_CATEGORIAS[number])) {
    query = query.eq("categoria", categoria);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — create a manual movimiento */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // ── Auth + role guard ─────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "supervisor")) return forbiddenResponse(FORBIDDEN_MSG);

  let body: MovimientoCajaInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.tipo || !VALID_TIPOS.includes(body.tipo)) {
    return NextResponse.json(
      { error: "tipo must be 'ingreso' or 'egreso'" },
      { status: 400 }
    );
  }

  if (!body.categoria || !VALID_CATEGORIAS.includes(body.categoria)) {
    return NextResponse.json(
      { error: `categoria must be one of: ${VALID_CATEGORIAS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!body.descripcion?.trim()) {
    return NextResponse.json({ error: "descripcion is required" }, { status: 400 });
  }

  if (!body.monto || body.monto <= 0) {
    return NextResponse.json({ error: "monto must be > 0" }, { status: 400 });
  }

  const hoy = new Date();
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("movimientos_caja")
    .insert({
      usuario_id: user.id,
      tipo: body.tipo,
      categoria: body.categoria,
      descripcion: body.descripcion.trim(),
      monto: body.monto,
      fecha: body.fecha ?? fechaHoy,
      es_repetible: body.es_repetible ?? false,
      frecuencia_repeticion: body.frecuencia_repeticion ?? null,
      evento_id: body.evento_id ?? null,
      empleado_id: body.empleado_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
