"use client";

import { useState, useEffect, useCallback } from "react";
import type { MovimientoCaja, MovimientoCategoria } from "@/types/caja";
import { MOVIMIENTO_CATEGORIAS } from "@/types/caja";
import { formatearHoras } from "@/lib/registros-horas";
import { formatMoneda } from "@/lib/moneda";

const CATEGORIA_LABELS: Record<MovimientoCategoria, string> = {
  pago_evento: "Pago evento",
  salario: "Salario",
  bono: "Bono",
  compras: "Compras",
  servicios: "Servicios",
  mantenimiento: "Mantenimiento",
  otros: "Otros",
};

interface NominaResultado {
  empleado_id: string;
  nombre: string;
  horas: number;
  tarifa: number;
  total_salario: number;
  total_bonos: number;
  total_egreso: number;
}

export default function FlujoCaja() {
  const today = new Date();
  const defaultMes = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [mes, setMes] = useState(defaultMes);
  const [categoriaFiltro, setCategoriaFiltro] = useState<MovimientoCategoria | "">("");
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [loading, setLoading] = useState(false);
  const [procesandoNomina, setProcesandoNomina] = useState(false);
  const [nominaResultados, setNominaResultados] = useState<NominaResultado[] | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ mes });
    if (categoriaFiltro) params.set("categoria", categoriaFiltro);
    const res = await fetch(`/api/movimientos-caja?${params}`);
    const data = await res.json();
    setMovimientos(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [mes, categoriaFiltro]);

  useEffect(() => { load(); }, [load]);

  const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
  const egresos  = movimientos.filter((m) => m.tipo === "egreso");
  const totalIngresos = ingresos.reduce((s, m) => s + Number(m.monto), 0);
  const totalEgresos  = egresos.reduce((s, m) => s + Number(m.monto), 0);
  const gananciaNeta  = totalIngresos - totalEgresos;

  async function handleProcesarNomina() {
    if (!confirm(`¿Procesar nómina para ${mes}? Se crearán egresos de salario y bonos.`)) return;
    setProcesandoNomina(true);
    setNominaResultados(null);

    const res = await fetch("/api/salarios/procesar-nomina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mes }),
    });

    const data = await res.json();
    if (res.ok) {
      setNominaResultados(data.procesados ?? []);
      load(); // refresh movimientos
    } else {
      alert(data.error ?? "Error al procesar nómina");
    }
    setProcesandoNomina(false);
  }

  async function handleExportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Flujo de Caja — ${mes}`, 14, 20);

    doc.setFontSize(11);
    doc.text(`Ingresos: ${formatMoneda(totalIngresos)}`, 14, 32);
    doc.text(`Egresos:  ${formatMoneda(totalEgresos)}`, 14, 39);
    doc.setFont("helvetica", "bold");
    doc.text(`Ganancia neta: ${formatMoneda(gananciaNeta)}`, 14, 46);
    doc.setFont("helvetica", "normal");

    let y = 58;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Fecha", 14, y);
    doc.text("Tipo", 42, y);
    doc.text("Categoría", 62, y);
    doc.text("Descripción", 100, y);
    doc.text("Monto", 170, y);
    y += 5;
    doc.setFont("helvetica", "normal");

    for (const m of movimientos) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(m.fecha, 14, y);
      doc.text(m.tipo, 42, y);
      doc.text(CATEGORIA_LABELS[m.categoria], 62, y);
      doc.text(m.descripcion.slice(0, 35), 100, y);
      const prefix = m.tipo === "egreso" ? "-" : "+";
      doc.text(`${prefix}${formatMoneda(Number(m.monto))}`, 170, y);
      y += 6;
    }

    doc.save(`flujo_caja_${mes}.pdf`);
  }

  async function handleExportXlsx() {
    setDownloading(true);
    const res = await fetch(`/api/movimientos-caja/reporte?mes=${mes}&formato=xlsx`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flujo_caja_${mes}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Fallback: client-side xlsx via dynamic import
      const XLSX = await import("xlsx");
      const rows = movimientos.map((m) => ({
        Fecha: m.fecha,
        Tipo: m.tipo,
        Categoría: CATEGORIA_LABELS[m.categoria],
        Descripción: m.descripcion,
        Monto: Number(m.monto),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
      XLSX.writeFile(wb, `flujo_caja_${mes}.xlsx`);
    }
    setDownloading(false);
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Mes</label>
          <input
            type="month"
            className="input max-w-[180px]"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Categoría</label>
          <select
            className="input max-w-[160px]"
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value as MovimientoCategoria | "")}
          >
            <option value="">Todas</option>
            {MOVIMIENTO_CATEGORIAS.map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABELS[c]}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pb-0.5">
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
          <button
            onClick={handleProcesarNomina}
            disabled={procesandoNomina}
            className="rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 px-3 py-2 text-xs font-semibold text-white transition-colors"
          >
            {procesandoNomina ? "Procesando…" : "Procesar nómina"}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400 mb-1">Total ingresos</p>
          <p className="text-xl font-bold text-green-400">
            {formatMoneda(totalIngresos)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{ingresos.length} movimientos</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400 mb-1">Total egresos</p>
          <p className="text-xl font-bold text-red-400">
            {formatMoneda(totalEgresos)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{egresos.length} movimientos</p>
        </div>
        <div className={`rounded-xl border p-4 ${
          gananciaNeta >= 0
            ? "border-green-800 bg-green-900/10"
            : "border-red-800 bg-red-900/10"
        }`}>
          <p className="text-xs text-gray-400 mb-1">Ganancia neta</p>
          <p className={`text-xl font-bold ${gananciaNeta >= 0 ? "text-green-400" : "text-red-400"}`}>
            {gananciaNeta < 0 ? "−" : ""}{formatMoneda(Math.abs(gananciaNeta))}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {gananciaNeta >= 0 ? "Superávit" : "Déficit"}
          </p>
        </div>
      </div>

      {/* Nómina result */}
      {nominaResultados && (
        <div className="rounded-xl border border-purple-800 bg-purple-900/10 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">
            Nómina procesada — {nominaResultados.length} empleado(s)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 text-left border-b border-gray-700">
                  <th className="pb-2">Empleado</th>
                  <th className="pb-2 text-right">Horas</th>
                  <th className="pb-2 text-right">Salario</th>
                  <th className="pb-2 text-right">Bonos</th>
                  <th className="pb-2 text-right">Total egreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {nominaResultados.map((r) => (
                  <tr key={r.empleado_id}>
                    <td className="py-2 text-white">{r.nombre}</td>
                    <td className="py-2 text-right text-gray-400">{formatearHoras(r.horas)}</td>
                    <td className="py-2 text-right text-gray-300">
                      {formatMoneda(r.total_salario)}
                    </td>
                    <td className="py-2 text-right text-yellow-400">
                      {r.total_bonos > 0 ? formatMoneda(r.total_bonos) : "—"}
                    </td>
                    <td className="py-2 text-right font-semibold text-red-400">
                      {formatMoneda(r.total_egreso)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail table */}
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Cargando movimientos…</div>
      ) : movimientos.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-10 text-center text-sm text-gray-500">
          Sin movimientos para {mes}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {movimientos.map((m) => (
                <tr key={m.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-300">{m.fecha}</td>
                  <td className={`px-4 py-3 capitalize font-medium ${
                    m.tipo === "ingreso" ? "text-green-400" : "text-red-400"
                  }`}>
                    {m.tipo}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{CATEGORIA_LABELS[m.categoria]}</td>
                  <td className="px-4 py-3 text-gray-200 max-w-[220px] truncate">{m.descripcion}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${
                    m.tipo === "ingreso" ? "text-green-400" : "text-red-400"
                  }`}>
                    {m.tipo === "egreso" ? "−" : "+"}{formatMoneda(Number(m.monto))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-700">
              <tr className="text-xs text-gray-400 font-semibold">
                <td className="px-4 py-2" colSpan={4}>Ganancia neta del período</td>
                <td className={`px-4 py-2 text-right ${gananciaNeta >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {gananciaNeta < 0 ? "−" : "+"}{formatMoneda(Math.abs(gananciaNeta))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
