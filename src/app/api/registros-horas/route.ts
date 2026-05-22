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
  const empleado_id = searchParams.get("empleado_id");
  const mes = searchParams.get("mes"); // YYYY-MM
  const fecha_inicio = searchParams.get("fecha_inicio");
  const fecha_fin = searchParams.get("fecha_fin");

  let query = supabase
    .from("registros_horas")
    .select(
      `*, empleado:empleados(id, nombre, rol, tarifa_horaria)`
    )
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  if (!body.hora_salida)
    return NextResponse.json({ error: "hora_salida is required" }, { status: 400 });

  // Validation: no future dates
  if (!validarFechaNoFutura(body.fecha)) {
    return NextResponse.json(
      { error: "No se pueden registrar horas en fechas futuras" },
      { status: 422 }
    );
  }

  // Validation: hora_salida > hora_entrada
  if (!validarHorario(body.hora_entrada, body.hora_salida)) {
    return NextResponse.json(
      { error: "hora_salida debe ser posterior a hora_entrada" },
      { status: 422 }
    );
  }

  const horas_trabajadas = calcularHorasTrabajadas(
    body.hora_entrada,
    body.hora_salida
  );

  const { data, error } = await supabase
    .from("registros_horas")
    .insert({
      empleado_id: body.empleado_id,
      fecha: body.fecha,
      hora_entrada: body.hora_entrada,
      hora_salida: body.hora_salida,
      horas_trabajadas,
      notas: body.notas ?? null,
      creado_por: user?.id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
