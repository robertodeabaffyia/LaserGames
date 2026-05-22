import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

/**
 * GET /api/empleados/reporte?mes=YYYY-MM&formato=xlsx
 * Monthly report of hours worked for all active employees.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mes = searchParams.get("mes"); // e.g. "2026-06"
  const formato = searchParams.get("formato") ?? "xlsx";

  if (formato !== "xlsx") {
    return NextResponse.json(
      { error: "Formato no soportado. Use: xlsx" },
      { status: 400 }
    );
  }

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json(
      { error: "mes is required in YYYY-MM format" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Build date range for the month
  const [year, month] = mes.split("-").map(Number);
  const fechaInicio = `${mes}-01`;
  const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
  const fechaFin = `${mes}-${String(lastDay).padStart(2, "0")}`;

  const { data: registros, error } = await supabase
    .from("registros_horas")
    .select(
      `id, fecha, hora_entrada, hora_salida, horas_trabajadas, notas,
      empleado:empleados(id, nombre, rol, tarifa_horaria)`
    )
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build flat rows for the detailed sheet
  type Registro = {
    id: string;
    fecha: string;
    hora_entrada: string;
    hora_salida: string;
    horas_trabajadas: number;
    notas: string | null;
    empleado: { id: string; nombre: string; rol: string; tarifa_horaria: number | null } | null;
  };

  const rows = (registros as Registro[]).map((r) => ({
    Empleado: r.empleado?.nombre ?? "—",
    Rol: r.empleado?.rol ?? "—",
    Fecha: r.fecha,
    "Hora entrada": r.hora_entrada,
    "Hora salida": r.hora_salida,
    "Horas trabajadas": Number(r.horas_trabajadas),
    "Costo ($)":
      r.empleado?.tarifa_horaria != null
        ? Math.round(r.empleado.tarifa_horaria * Number(r.horas_trabajadas) * 100) / 100
        : "",
    Notas: r.notas ?? "",
  }));

  // Build summary per employee
  const byEmpleado = new Map<
    string,
    { nombre: string; rol: string; tarifa: number | null; horas: number; costo: number }
  >();
  for (const r of registros as Registro[]) {
    const empId = r.empleado?.id ?? "unknown";
    if (!byEmpleado.has(empId)) {
      byEmpleado.set(empId, {
        nombre: r.empleado?.nombre ?? "—",
        rol: r.empleado?.rol ?? "—",
        tarifa: r.empleado?.tarifa_horaria ?? null,
        horas: 0,
        costo: 0,
      });
    }
    const entry = byEmpleado.get(empId)!;
    entry.horas = Math.round((entry.horas + Number(r.horas_trabajadas)) * 100) / 100;
    if (entry.tarifa != null) {
      entry.costo =
        Math.round((entry.costo + entry.tarifa * Number(r.horas_trabajadas)) * 100) / 100;
    }
  }

  const summaryRows = Array.from(byEmpleado.values()).map((e) => ({
    Empleado: e.nombre,
    Rol: e.rol,
    "Tarifa/h ($)": e.tarifa ?? "",
    "Total horas": e.horas,
    "Costo total ($)": e.costo || "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(summaryRows),
    "Resumen"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows),
    "Detalle"
  );

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const filename = `reporte_horas_${mes}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
