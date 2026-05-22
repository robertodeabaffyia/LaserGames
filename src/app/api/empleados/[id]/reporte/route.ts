import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/empleados/[id]/reporte?formato=xlsx
 * Returns an Excel workbook with the employee profile and hours history.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const formato = searchParams.get("formato") ?? "xlsx";

  if (formato !== "xlsx") {
    return NextResponse.json(
      { error: "Formato no soportado. Use: xlsx" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: empleado, error } = await supabase
    .from("empleados")
    .select(
      `id, nombre, dni, telefono, email, rol, tarifa_horaria, fecha_contratacion, es_activo,
      registros_horas(fecha, hora_entrada, hora_salida, horas_trabajadas, notas)`
    )
    .eq("id", id)
    .order("fecha", { referencedTable: "registros_horas", ascending: true })
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  const registros = (empleado.registros_horas ?? []) as {
    fecha: string;
    hora_entrada: string;
    hora_salida: string;
    horas_trabajadas: number;
    notas: string | null;
  }[];

  const totalHoras = registros.reduce(
    (s, r) => s + Number(r.horas_trabajadas),
    0
  );

  // Sheet 1 – profile info
  const infoSheet = XLSX.utils.aoa_to_sheet([
    ["Campo", "Valor"],
    ["Nombre", empleado.nombre],
    ["DNI", empleado.dni ?? ""],
    ["Teléfono", empleado.telefono ?? ""],
    ["Email", empleado.email ?? ""],
    ["Rol", empleado.rol],
    ["Tarifa/hora ($)", empleado.tarifa_horaria ?? ""],
    ["Fecha contratación", empleado.fecha_contratacion ?? ""],
    ["Estado", empleado.es_activo ? "Activo" : "Inactivo"],
  ]);

  // Sheet 2 – hours history
  const horasRows = registros.map((r) => ({
    Fecha: r.fecha,
    "Hora entrada": r.hora_entrada,
    "Hora salida": r.hora_salida,
    "Horas trabajadas": Number(r.horas_trabajadas),
    Notas: r.notas ?? "",
  }));

  // Append totals row
  const horasSheet = XLSX.utils.json_to_sheet(horasRows);
  const lastRow = horasRows.length + 2;
  XLSX.utils.sheet_add_aoa(
    horasSheet,
    [["", "", "TOTAL", Math.round(totalHoras * 100) / 100, ""]],
    { origin: `A${lastRow}` }
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, infoSheet, "Perfil");
  XLSX.utils.book_append_sheet(wb, horasSheet, "Historial horas");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const filename = `empleado_${empleado.nombre.replace(/\s+/g, "_")}_historial.xlsx`;

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
