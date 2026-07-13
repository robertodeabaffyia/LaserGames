"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import type { ReporteMovimientos as TReporteMovimientos } from "@/types/reportes";
import type { Periodo } from "./PeriodoPicker";
import { rangoFromPeriodo } from "./PeriodoPicker";
import PeriodoPicker from "./PeriodoPicker";
import ExportPDF from "./ExportPDF";
import ExportExcel from "./ExportExcel";
import { formatMoneda } from "@/lib/moneda";
import { categoriaLabel } from "@/types/caja";

const COLORS_ING = ["#4ade80", "#34d399", "#6ee7b7"];
const COLORS_EGR = ["#f87171", "#fb923c", "#fbbf24", "#a78bfa", "#f472b6", "#94a3b8"];

const fmt = formatMoneda;

export default function ReporteMovimientos() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [customRango, setCustomRango] = useState({ desde: "", hasta: "" });
  const [data, setData] = useState<TReporteMovimientos | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { desde, hasta } = rangoFromPeriodo(periodo, customRango);
    let active = true;
    fetch(`/api/reportes/movimientos?desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then((d) => { if (active) setData(d); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [periodo, customRango]);

  const ingresosCats = (data?.por_categoria ?? []).filter((c) => c.tipo === "ingreso");
  const egresosCats  = (data?.por_categoria ?? []).filter((c) => c.tipo === "egreso");

  const barData = (data?.por_categoria ?? []).map((c) => ({
    name: categoriaLabel(c.categoria),
    Total: c.total,
    tipo: c.tipo,
  }));

  const exportRows = (data?.por_categoria ?? []).map((c) => ({
    Tipo: c.tipo,
    Categoría: categoriaLabel(c.categoria),
    Total: c.total,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodoPicker
          value={periodo}
          onChange={setPeriodo}
          customRango={customRango}
          onCustomRango={setCustomRango}
        />
        {data && (
          <div className="flex gap-2">
            <ExportExcel filename="reporte-movimientos" data={exportRows} />
            <ExportPDF
              filename="reporte-movimientos"
              title="Desglose de Movimientos"
              columns={["Tipo", "Categoría", "Total"]}
              rows={exportRows.map((r) => [r.Tipo, r.Categoría, fmt(r.Total)])}
              summary={[
                ["Total Ingresos", fmt(data.total_ingresos)],
                ["Total Egresos", fmt(data.total_egresos)],
                ["Ganancia Neta", fmt(data.ganancia_neta)],
              ]}
            />
          </div>
        )}
      </div>

      {data && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg bg-green-900/20 border border-green-800 px-4 py-2">
            <div className="text-xs text-green-400 font-medium">Total Ingresos</div>
            <div className="text-lg font-bold text-green-300">{fmt(data.total_ingresos)}</div>
          </div>
          <div className="rounded-lg bg-red-900/20 border border-red-800 px-4 py-2">
            <div className="text-xs text-red-400 font-medium">Total Egresos</div>
            <div className="text-lg font-bold text-red-300">{fmt(data.total_egresos)}</div>
          </div>
          <div className={`rounded-lg px-4 py-2 border ${
            data.ganancia_neta >= 0 ? "bg-indigo-900/20 border-indigo-800" : "bg-red-900/20 border-red-800"
          }`}>
            <div className="text-xs text-indigo-400 font-medium">Ganancia Neta</div>
            <div className={`text-lg font-bold ${data.ganancia_neta >= 0 ? "text-indigo-300" : "text-red-300"}`}>
              {fmt(data.ganancia_neta)}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-64 rounded-xl border border-gray-800 animate-pulse bg-gray-900/30" />
      ) : !data || data.por_categoria.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-12 text-center text-sm text-gray-500">
          Sin movimientos en el período.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
              <p className="text-xs text-green-400 mb-3 font-medium uppercase tracking-wider">Ingresos por categoría</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={ingresosCats.map((c) => ({ name: categoriaLabel(c.categoria), value: c.total }))}
                    cx="50%" cy="50%" outerRadius={75} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {ingresosCats.map((_, i) => <Cell key={i} fill={COLORS_ING[i % COLORS_ING.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    formatter={(v) => [fmt(Number(v))]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
              <p className="text-xs text-red-400 mb-3 font-medium uppercase tracking-wider">Egresos por categoría</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={egresosCats.map((c) => ({ name: categoriaLabel(c.categoria), value: c.total }))}
                    cx="50%" cy="50%" outerRadius={75} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {egresosCats.map((_, i) => <Cell key={i} fill={COLORS_EGR[i % COLORS_EGR.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    formatter={(v) => [fmt(Number(v))]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Comparativa por categoría</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  formatter={(v) => [fmt(Number(v))]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Total" radius={[3, 3, 0, 0]}
                  fill="#818cf8"
                  label={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
