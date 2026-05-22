import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET — list notification history with optional filters */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const tipo   = searchParams.get("tipo");
  const status = searchParams.get("status");
  const canal  = searchParams.get("canal");
  const desde  = searchParams.get("desde"); // ISO date
  const hasta  = searchParams.get("hasta"); // ISO date
  const limite = parseInt(searchParams.get("limite") ?? "100", 10);

  let query = supabase
    .from("historial_notificaciones")
    .select("*")
    .order("fecha_envio", { ascending: false })
    .limit(isNaN(limite) || limite < 1 ? 100 : Math.min(limite, 500));

  if (tipo)   query = query.eq("tipo_notificacion", tipo);
  if (status) query = query.eq("status", status);
  if (canal)  query = query.eq("canal", canal);
  if (desde)  query = query.gte("fecha_envio", desde);
  if (hasta)  query = query.lte("fecha_envio", hasta);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
