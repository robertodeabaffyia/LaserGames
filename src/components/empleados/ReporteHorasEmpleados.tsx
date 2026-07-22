"use client";

import { useState, useEffect, useCallback } from "react";
import { formatearHoras } from "@/lib/registros-horas";
import { formatMoneda } from "@/lib/moneda";
import type { RegistroHorasConEmpleado, ResumenHorasEmpleado } from "@/types/empleados";

export default function ReporteHorasEmpleados() {
  const today = new Date();
  const defaultMes = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [mes, setMes] = useState(defaultMes);
  const [registros, setRegistros] = useState<RegistroHorasConEmpleado[]>([]);
  const [resumen, setResumen] = useState<ResumenHorasEmpleado[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/registros-horas?mes=${mes}`);
    const data: RegistroHorasConEmpleado[] = (await res.json()) ?? [];
    setRegistros(data);

    // Compute summary per employee
    const byEmp = new Map<
      string,
      { nombre: string; rol: string; tarifa: number | null; horas: number; dias: Set<string> }
    >();
    for (const r of data) {
      const id = r.empleado?.id ?? "unknown";
      if (!byEmp.has(id)) {
        byEmp.set(id, {
          nombre: r.empleado?.nombre ?? "—",
          rol: r.empleado?.rol ?? "—",
          tarifa: r.empleado?.tarifa_horaria ?? null,
          horas: 0,
          dias: new Set(),
        });
      }
      const e = byEmp.get(id)!;
      e.horas = Math.round((e.horas + Number(r.horas_trabajadas)) * 100) / 100;
      e.dias.add(r.fecha);
    }

    setResumen(
      Array.from(byEmp.entries()).map(([id, e]) => ({
        empleado_id: id,
        nombre: e.nombre,
        rol: e.rol as ResumenHorasEmpleado["rol"],
        total_horas: e.horas,
        total_dias: e.dias.size,
        total_costo: e.tarifa != null ? Math.round(e.tarifa * e.horas * 100) / 100 : 0,
      }))
    );

    setLoading(false);
  }, [mes]);

  // Deferred a tick so the loader's setState isn't called synchronously
  // inside the effect (react-hooks/set-state-in-effect); clearTimeout also
  // guards against setState after unmount.
  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  async function handleExportXlsx() {
    setDownloading(true);
    const res = await fetch(`/api/empleados/reporte?mes=${mes}&formato=xlsx`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_horas_${mes}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setDownloading(false);
  }

  async function handleExportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Reporte de horas — ${mes}`, 14, 20);

    doc.setFontSize(11);
    doc.text("Resumen por empleado", 14, 32);

    let y = 40;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Empleado", 14, y);
    doc.text("Rol", 70, y);
    doc.text("Días", 110, y);
    doc.text("Horas", 130, y);
    doc.text("Costo ($)", 155, y);
    y += 5;
    doc.setFont("helvetica", "normal");

    for (const e of resumen) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(e.nombre.slice(0, 30), 14, y);
      doc.text(e.rol, 70, y);
      doc.text(String(e.total_dias), 110, y);
      doc.text(formatearHoras(e.total_horas), 130, y);
      doc.text(e.total_costo > 0 ? formatMoneda(e.total_costo) : "—", 155, y);
      y += 6;
    }

    doc.save(`reporte_horas_${mes}.pdf`);
  }

  const totalHoras = resumen.reduce((s, e) => s + e.total_horas, 0);
  const totalCosto = resumen.reduce((s, e) => s + e.total_costo, 0);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="label">Mes</label>
          <input
            type="month"
            className="input max-w-[180px]"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleExportPdf}
            className="rounded-lg border border-gray-700 hover:border-gray-500 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white transition-colors"
          >
            ↓ PDF
          </button>
          <button
            onClick={handleExportXlsx}
            disabled={downloading}
            className="rounded-lg border border-gray-700 hover:border-gray-500 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white disabled:opacity-50 transition-colors"
          >
            {downloading ? "Descargando…" : "↓ Excel"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Cargando reporte…</div>
      ) : (
        <>
          {/* Summary table */}
          {resumen.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800">
                  <tr className="text-left text-xs text-gray-400">
                    <th className="px-4 py-3">Empleado</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3 text-center">Días</th>
                    <th className="px-4 py-3 text-right">Total horas</th>
                    <th className="px-4 py-3 text-right">Costo total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {resumen.map((e) => (
                    <tr key={e.empleado_id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{e.nombre}</td>
                      <td className="px-4 py-3 text-gray-400 capitalize">{e.rol}</td>
                      <td className="px-4 py-3 text-center text-gray-300">{e.total_dias}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        {formatearHoras(e.total_horas)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-400">
                        {e.total_costo > 0
                          ? formatMoneda(e.total_costo)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-700">
                  <tr className="text-xs text-gray-400 font-semibold">
                    <td className="px-4 py-2" colSpan={3}>Total</td>
                    <td className="px-4 py-2 text-right text-white">{formatearHoras(totalHoras)}</td>
                    <td className="px-4 py-2 text-right text-green-400">
                      {totalCosto > 0
                        ? formatMoneda(totalCosto)
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 py-10 text-center text-sm text-gray-500">
              No hay registros de horas para {mes}.
            </div>
          )}

          {/* Detail count */}
          {registros.length > 0 && (
            <p className="text-xs text-gray-500 text-right">
              {registros.length} registros en el período
            </p>
          )}
        </>
      )}
    </div>
  );
}
