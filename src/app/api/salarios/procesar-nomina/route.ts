import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NominaResultado } from "@/types/caja";

/** POST — process payroll for a given month.
 *  Body: { mes: "YYYY-MM" }
 *  For each active employee with tarifa_horaria:
 *    - Sums registros_horas for the month
 *    - Sums bonos_empleados for the month
 *    - Creates egreso movimiento_caja (categoria: "salario") for salary
 *    - Creates egreso movimiento_caja (categoria: "bono") for bonos (if any)
 *  Returns array of NominaResultado.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { mes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { mes } = body;

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json(
      { error: "mes is required and must be in format YYYY-MM" },
      { status: 400 }
    );
  }

  const [year, month] = mes.split("-").map(Number);
  const fechaInicio = `${mes}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const fechaFin = `${mes}-${String(lastDay).padStart(2, "0")}`;

  // Fetch all active employees with a tarifa_horaria
  const { data: empleados, error: empError } = await supabase
    .from("empleados")
    .select("id, nombre, tarifa_horaria")
    .eq("es_activo", true)
    .not("tarifa_horaria", "is", null);

  if (empError) {
    return NextResponse.json({ error: empError.message }, { status: 500 });
  }

  if (!empleados || empleados.length === 0) {
    return NextResponse.json({ procesados: [], mensaje: "No hay empleados activos con tarifa" });
  }

  // Fetch all registros_horas for the month in one query
  const { data: registros, error: regError } = await supabase
    .from("registros_horas")
    .select("empleado_id, horas_trabajadas")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin);

  if (regError) {
    return NextResponse.json({ error: regError.message }, { status: 500 });
  }

  // Fetch all bonos for the month in one query
  const { data: bonos, error: bonosError } = await supabase
    .from("bonos_empleados")
    .select("empleado_id, monto_bono")
    .eq("mes", mes);

  if (bonosError) {
    return NextResponse.json({ error: bonosError.message }, { status: 500 });
  }

  // Build lookup maps
  const horasMap = new Map<string, number>();
  for (const r of registros ?? []) {
    horasMap.set(
      r.empleado_id,
      (horasMap.get(r.empleado_id) ?? 0) + Number(r.horas_trabajadas)
    );
  }

  const bonosMap = new Map<string, number>();
  for (const b of bonos ?? []) {
    bonosMap.set(
      b.empleado_id,
      (bonosMap.get(b.empleado_id) ?? 0) + Number(b.monto_bono)
    );
  }

  const hoy = new Date();
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  const procesados: NominaResultado[] = [];

  for (const emp of empleados) {
    const horas = Math.round((horasMap.get(emp.id) ?? 0) * 100) / 100;
    const tarifa = Number(emp.tarifa_horaria);
    const totalSalario = Math.round(horas * tarifa * 100) / 100;
    const totalBonos = Math.round((bonosMap.get(emp.id) ?? 0) * 100) / 100;
    const totalEgreso = Math.round((totalSalario + totalBonos) * 100) / 100;

    if (totalSalario > 0) {
      await supabase.from("movimientos_caja").insert({
        usuario_id: user.id,
        tipo: "egreso",
        categoria: "salario",
        descripcion: `Salario ${emp.nombre} — ${mes} (${horas}h × $${tarifa}/h)`,
        monto: totalSalario,
        fecha: fechaHoy,
        es_repetible: false,
        frecuencia_repeticion: null,
        evento_id: null,
        empleado_id: emp.id,
      });
    }

    if (totalBonos > 0) {
      await supabase.from("movimientos_caja").insert({
        usuario_id: user.id,
        tipo: "egreso",
        categoria: "bono",
        descripcion: `Bonos ${emp.nombre} — ${mes}`,
        monto: totalBonos,
        fecha: fechaHoy,
        es_repetible: false,
        frecuencia_repeticion: null,
        evento_id: null,
        empleado_id: emp.id,
      });
    }

    procesados.push({
      empleado_id: emp.id,
      nombre: emp.nombre,
      horas,
      tarifa,
      total_salario: totalSalario,
      total_bonos: totalBonos,
      total_egreso: totalEgreso,
    });
  }

  return NextResponse.json({ procesados, mes });
}
