/**
 * GET  /api/registros-horas
 *   ?fecha=YYYY-MM-DD          → DiaDashboard (all active employees + their registro for the day)
 *   ?empleado_id=X             → list filtered by employee
 *   ?mes=YYYY-MM               → list filtered by month
 *   ?fecha_inicio=X&fecha_fin=Y → list filtered by range
 *
 * POST /api/registros-horas
 *   Creates a new registro. hora_salida is optional (partial entry allowed).
 *   Accepts evento_ids[] to link to registros_horas_eventos.
 *
 * Migration required (run once in Supabase):
 *   CREATE TABLE IF NOT EXISTS registros_horas_eventos (
 *     registro_id uuid NOT NULL REFERENCES registros_horas(id) ON DELETE CASCADE,
 *     evento_id   uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
 *     PRIMARY KEY (registro_id, evento_id)
 *   );
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  validarHorario,
  validarFechaNoFutura,
  calcularHorasTrabajadas,
} from "@/lib/registros-horas";
import type { RegistroHorasInsert } from "@/types/empleados";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const fecha = searchParams.get("fecha"); // YYYY-MM-DD — day dashboard mode
  const empleado_id = searchParams.get("empleado_id");
  const mes = searchParams.get("mes"); // YYYY-MM
  const fecha_inicio = searchParams.get("fecha_inicio");
  const fecha_fin = searchParams.get("fecha_fin");

  // ── Day-dashboard mode ──────────────────────────────────────────────────────
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    // 1. All active employees
    const { data: empleados, error: empErr } = await supabase
      .from("empleados")
      .select("id, nombre, rol, tarifa_horaria")
      .eq("es_activo", true)
      .order("nombre", { ascending: true });

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

    // 2. Registros for this date (with linked evento_ids)
    const { data: registros, error: regErr } = await supabase
      .from("registros_horas")
      .select("*, registros_horas_eventos(evento_id)")
      .eq("fecha", fecha);

    if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

    // 3. Eventos on this day
    const nextDay = new Date(fecha);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().slice(0, 10);

    const { data: eventos, error: evErr } = await supabase
      .from("eventos")
      .select("id, nombre_festejado, fecha_evento")
      .gte("fecha_evento", `${fecha}T00:00:00`)
      .lt("fecha_evento", `${nextDayStr}T00:00:00`)
      .order("fecha_evento", { ascending: true });

    if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

    // 4. Build filas: one per employee
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regByEmp = new Map<string, any>(
      (registros ?? []).map((r) => [r.empleado_id, r])
    );

    const filas = (empleados ?? []).map((emp) => {
      const reg = regByEmp.get(emp.id) ?? null;
      const evento_ids: string[] = reg
        ? (reg.registros_horas_eventos ?? []).map(
            (rhe: { evento_id: string }) => rhe.evento_id
          )
        : [];
      // Strip the junction rows from the registro before returning
      let registro = null;
      if (reg) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { registros_horas_eventos: _junc, ...rest } = reg;
        registro = rest;
      }
      return { empleado: emp, registro, evento_ids };
    });

    return NextResponse.json({
      filas,
      eventos: (eventos ?? []).map((ev) => ({
        id: ev.id,
        nombre_festejado: ev.nombre_festejado,
        hora_evento: ev.fecha_evento,
      })),
    });
  }

  // ── List mode (existing behavior) ───────────────────────────────────────────
  let query = supabase
    .from("registros_horas")
    .select(`*, empleado:empleados(id, nombre, rol, tarifa_horaria)`)
    .order("fecha", { ascending: false });

  if (empleado_id) query = query.eq("empleado_id", empleado_id);

  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [year, month] = mes.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    query = query
      .gte("fecha", `${mes}-01`)
      .lte("fecha", `${mes}-${String(lastDay).padStart(2, "0")}`);
  } else {
    if (fecha_inicio) query = query.gte("fecha", fecha_inicio);
    if (fecha_fin) query = query.lte("fecha", fecha_fin);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let body: RegistroHorasInsert;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Required fields
  if (!body.empleado_id)
    return NextResponse.json({ error: "empleado_id is required" }, { status: 400 });
  if (!body.fecha)
    return NextResponse.json({ error: "fecha is required" }, { status: 400 });
  if (!body.hora_entrada)
    return NextResponse.json({ error: "hora_entrada is required" }, { status: 400 });

  // Validation: no future dates
  if (!validarFechaNoFutura(body.fecha)) {
    return NextResponse.json(
      { error: "No se pueden registrar horas en fechas futuras" },
      { status: 422 }
    );
  }

  // Validate hora_salida only when both are present
  if (body.hora_salida && !validarHorario(body.hora_entrada, body.hora_salida)) {
    return NextResponse.json(
      { error: "hora_salida debe ser posterior a hora_entrada" },
      { status: 422 }
    );
  }

  const horas_trabajadas =
    body.hora_salida
      ? calcularHorasTrabajadas(body.hora_entrada, body.hora_salida)
      : 0;

  const { data: registro, error } = await supabase
    .from("registros_horas")
    .insert({
      empleado_id: body.empleado_id,
      fecha: body.fecha,
      hora_entrada: body.hora_entrada,
      hora_salida: body.hora_salida ?? null,
      horas_trabajadas,
      notas: body.notas ?? null,
      creado_por: user?.id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Link eventos if provided
  if (body.evento_ids?.length) {
    const links = body.evento_ids.map((eid) => ({
      registro_id: registro.id,
      evento_id: eid,
    }));
    const { error: linkErr } = await supabase
      .from("registros_horas_eventos")
      .insert(links);
    if (linkErr) {
      // Non-fatal: registro was saved, just log the link failure
      console.error("[registros-horas POST] Failed to link eventos:", linkErr.message);
    }
  }

  return NextResponse.json(registro, { status: 201 });
}
