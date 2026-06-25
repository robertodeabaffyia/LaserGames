import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorizedResponse } from "@/lib/auth-helpers";
import { generarTurnosDisponibles, type ReservaExistente } from "@/lib/escapeRoom";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** GET — available slot start times for a room/date, given escape_config's horario + duracion. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const sala_id = searchParams.get("sala_id");
  const fecha = searchParams.get("fecha");

  if (!sala_id) {
    return NextResponse.json({ error: "sala_id is required" }, { status: 400 });
  }
  if (!fecha || !FECHA_RE.test(fecha)) {
    return NextResponse.json({ error: "fecha must be a valid YYYY-MM-DD date" }, { status: 400 });
  }

  const { data: config, error: configError } = await supabase
    .from("escape_config")
    .select("hora_inicio_reservas, hora_fin_reservas, duracion_bloque_min")
    .eq("id", 1)
    .single();

  if (configError || !config) {
    return NextResponse.json({ error: "Escape Room config not found" }, { status: 404 });
  }

  const { data: reservasExistentes, error: reservasError } = await supabase
    .from("escape_reservas")
    .select("sala_id, fecha, hora_inicio, estado")
    .eq("sala_id", sala_id)
    .eq("fecha", fecha);

  if (reservasError) {
    return NextResponse.json({ error: reservasError.message }, { status: 500 });
  }

  const turnos = generarTurnosDisponibles({
    fecha,
    sala_id,
    horaInicio: config.hora_inicio_reservas,
    horaFin: config.hora_fin_reservas,
    duracionBloqueMin: config.duracion_bloque_min,
    reservasExistentes: (reservasExistentes ?? []) as ReservaExistente[],
  });

  return NextResponse.json(turnos);
}
