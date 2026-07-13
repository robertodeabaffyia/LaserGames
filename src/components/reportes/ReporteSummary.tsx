"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import type { ReporteResumen } from "@/types/reportes";
import type { Periodo } from "./PeriodoPicker";
import { rangoFromPeriodo } from "./PeriodoPicker";
import PeriodoPicker from "./PeriodoPicker";
import ExportPDF from "./ExportPDF";
import ExportExcel from "./ExportExcel";
import { formatMoneda } from "@/lib/moneda";

function fmt(n: number) {
  return formatMoneda(n);
}

export default function ReporteSummary() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [customRango, setCustomRango] = useState({ desde: "", hasta: "" });
  const [data, setData] = useState<ReporteResumen | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { desde, hasta } = rangoFromPeriodo(periodo, customRango);
    let active = true;
    fetch(`/api/reportes/resumen?desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then((d) => { if (active) setData(d); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [periodo, customRango]);

  const chartData = (data?.por_dia ?? []).map((d) => ({
    fecha: d.fecha.slice(5), // MM-DD
    Ingresos: d.ingresos,
    Egresos: d.egresos,
    Ganancia: d.ingresos - d.egresos,
  }));

  const exportRows = chartData.map((r) => ({
    Fecha: r.fecha,
    Ingresos: r.Ingresos,
    Egresos: r.Egresos,
    Ganancia: r.Ganancia,
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
            <ExportExcel filename="resumen-financiero" data={exportRows} />
            <ExportPDF
              filename="resumen-financiero"
              title="Resumen Financiero"
              columns={["Fecha", "Ingresos", "Egresos", "Ganancia"]}
              rows={exportRows.map((r) => [r.Fecha, fmt(r.Ingresos), fmt(r.Egresos), fmt(r.Ganancia)])}
              summary={[
                ["Total Ingresos", fmt(data.total_ingresos)],
                ["Total Egresos", fmt(data.total_egresos)],
                ["Ganancia Neta", fmt(data.ganancia_neta)],
              ]}
            />
          </div>
        )}
      </div>

      {/* KPI chips */}
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
          <div className={`rounded-lg px-4 py-2 ${
            data.ganancia_neta >= 0
              ? "bg-indigo-900/20 border border-indigo-800"
              : "bg-red-900/20 border border-red-800"
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
      ) : chartData.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-12 text-center text-sm text-gray-500">
          Sin movimientos en el período.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Ingresos vs Egresos</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="fecha" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  formatter={(v) => [fmt(Number(v))]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Ingresos" fill="#4ade80" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Egresos"  fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Ganancia Neta</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="fecha" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  formatter={(v) => [fmt(Number(v))]}
                />
                <Line type="monotone" dataKey="Ganancia" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
