"use client";

/**
 * Tendencia mensual — vista de decisión del negocio.
 *
 * Muestra la evolución de ingresos/egresos/ganancia de los últimos N meses,
 * cantidad de eventos completados y ticket promedio por evento. Pensado para
 * responder: ¿crecemos o caemos?, ¿qué meses son fuertes (estacionalidad)?,
 * ¿cuánto deja cada evento en promedio?
 */
import { useEffect, useState } from "react";
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import type { ReporteTendencia as TReporteTendencia } from "@/types/reportes";
import { formatMoneda } from "@/lib/moneda";
import ExportPDF from "./ExportPDF";
import ExportExcel from "./ExportExcel";

const MESES_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** "2026-06" → "Jun 26" for compact chart axis labels. */
function mesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES_LABELS[m - 1]} ${String(y).slice(2)}`;
}

const VENTANAS = [6, 12, 24] as const;

export default function ReporteTendencia() {
  const [meses, setMeses] = useState<(typeof VENTANAS)[number]>(12);
  const [data, setData] = useState<TReporteTendencia | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reportes/tendencia?meses=${meses}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [meses]);

  const chartData = (data?.meses ?? []).map((m) => ({
    mes: mesLabel(m.mes),
    Ingresos: m.ingresos,
    Egresos: m.egresos,
    Ganancia: m.ganancia,
    Eventos: m.eventos,
    "Ticket promedio": Math.round(m.ticket_promedio),
  }));

  const exportRows = (data?.meses ?? []).map((m) => ({
    Mes: m.mes,
    Ingresos: m.ingresos,
    Egresos: m.egresos,
    Ganancia: m.ganancia,
    Eventos: m.eventos,
    "Ticket promedio": Math.round(m.ticket_promedio),
  }));

  const variacion = data?.variacion_ingresos_pct;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Window selector */}
        <div className="flex gap-1 rounded-lg border border-gray-800 bg-gray-900/50 p-1">
          {VENTANAS.map((v) => (
            <button
              key={v}
              onClick={() => setMeses(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                meses === v ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {v} meses
            </button>
          ))}
        </div>

        {data && (
          <div className="flex gap-2">
            <ExportExcel filename="tendencia-mensual" data={exportRows} />
            <ExportPDF
              filename="tendencia-mensual"
              title={`Tendencia Mensual (últimos ${meses} meses)`}
              columns={["Mes", "Ingresos", "Egresos", "Ganancia", "Eventos", "Ticket prom."]}
              rows={exportRows.map((r) => [
                r.Mes,
                formatMoneda(r.Ingresos),
                formatMoneda(r.Egresos),
                formatMoneda(r.Ganancia),
                String(r.Eventos),
                formatMoneda(r["Ticket promedio"]),
              ])}
              summary={[
                ["Promedio ingresos/mes", formatMoneda(data.promedio_ingresos)],
                ["Promedio ganancia/mes", formatMoneda(data.promedio_ganancia)],
                ["Mejor mes", data.mejor_mes ?? "—"],
                ["Margen promedio", data.margen_promedio_pct !== null ? `${data.margen_promedio_pct.toFixed(1)}%` : "—"],
              ]}
            />
          </div>
        )}
      </div>

      {/* Decision KPI chips */}
      {data && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg bg-green-900/20 border border-green-800 px-4 py-2">
            <div className="text-xs text-green-400 font-medium">Ingresos promedio /mes</div>
            <div className="text-lg font-bold text-green-300">{formatMoneda(data.promedio_ingresos)}</div>
          </div>
          <div className={`rounded-lg px-4 py-2 border ${
            data.promedio_ganancia >= 0 ? "bg-indigo-900/20 border-indigo-800" : "bg-red-900/20 border-red-800"
          }`}>
            <div className="text-xs text-indigo-400 font-medium">Ganancia promedio /mes</div>
            <div className={`text-lg font-bold ${data.promedio_ganancia >= 0 ? "text-indigo-300" : "text-red-300"}`}>
              {formatMoneda(data.promedio_ganancia)}
            </div>
          </div>
          {variacion !== null && variacion !== undefined && (
            <div className={`rounded-lg px-4 py-2 border ${
              variacion >= 0 ? "bg-green-900/20 border-green-800" : "bg-red-900/20 border-red-800"
            }`}>
              <div className="text-xs text-gray-400 font-medium">Ingresos vs mes anterior</div>
              <div className={`text-lg font-bold ${variacion >= 0 ? "text-green-300" : "text-red-300"}`}>
                {variacion >= 0 ? "▲" : "▼"} {Math.abs(variacion).toFixed(1)}%
              </div>
            </div>
          )}
          {data.margen_promedio_pct !== null && (
            <div className="rounded-lg bg-amber-900/20 border border-amber-800 px-4 py-2">
              <div className="text-xs text-amber-400 font-medium">Margen promedio</div>
              <div className="text-lg font-bold text-amber-300">{data.margen_promedio_pct.toFixed(1)}%</div>
            </div>
          )}
          {data.mejor_mes && (
            <div className="rounded-lg bg-purple-900/20 border border-purple-800 px-4 py-2">
              <div className="text-xs text-purple-400 font-medium">Mejor mes (ganancia)</div>
              <div className="text-lg font-bold text-purple-300">{mesLabel(data.mejor_mes)}</div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="h-64 rounded-xl border border-gray-800 animate-pulse bg-gray-900/30" />
      ) : chartData.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-12 text-center text-sm text-gray-500">
          Sin datos en el período.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Ingresos / Egresos bars + Ganancia line */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">
              Evolución mensual — Ingresos, Egresos y Ganancia
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  formatter={(v, name) =>
                    name === "Eventos" ? [v] : [formatMoneda(Number(v))]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Ingresos" fill="#4ade80" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Egresos" fill="#f87171" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="Ganancia" stroke="#818cf8" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Eventos count + ticket promedio */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">
              Eventos completados y ticket promedio
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  formatter={(v, name) =>
                    name === "Eventos" ? [v] : [formatMoneda(Number(v))]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="Eventos" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="Ticket promedio" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
