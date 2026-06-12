"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import type { ReporteEventos as TReporteEventos } from "@/types/reportes";
import type { Periodo } from "./PeriodoPicker";
import { rangoFromPeriodo } from "./PeriodoPicker";
import PeriodoPicker from "./PeriodoPicker";
import ExportPDF from "./ExportPDF";
import ExportExcel from "./ExportExcel";
import { formatMoneda } from "@/lib/moneda";

const COLORS = ["#818cf8", "#4ade80", "#fbbf24", "#f87171", "#34d399", "#a78bfa"];
function fmt(n: number) { return formatMoneda(n); }

export default function ReporteEventos() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [customRango, setCustomRango] = useState({ desde: "", hasta: "" });
  const [data, setData] = useState<TReporteEventos | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { desde, hasta } = rangoFromPeriodo(periodo, customRango);
    setLoading(true);
    fetch(`/api/reportes/eventos?desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [periodo, customRango]);

  const paqueteData = (data?.por_paquete ?? []).map((p) => ({
    name: p.paquete_nombre,
    Eventos: p.count,
    Ingresos: p.total_ingresos,
  }));

  const estadoData = (data?.por_estado ?? []).map((e) => ({
    name: e.estado,
    value: e.count,
  }));

  const exportRows = (data?.por_paquete ?? []).map((p) => ({
    Paquete: p.paquete_nombre,
    Eventos: p.count,
    Ingresos: p.total_ingresos,
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
            <ExportExcel filename="reporte-eventos" data={exportRows} />
            <ExportPDF
              filename="reporte-eventos"
              title="Reporte de Eventos"
              columns={["Paquete", "Eventos", "Ingresos"]}
              rows={exportRows.map((r) => [r.Paquete, String(r.Eventos), fmt(r.Ingresos)])}
              summary={[
                ["Total Eventos", String(data.total_eventos)],
                ["Total Ingresos", fmt(data.total_ingresos)],
                ["Paquete más vendido", data.paquete_mas_vendido ?? "—"],
              ]}
            />
          </div>
        )}
      </div>

      {data && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg bg-indigo-900/20 border border-indigo-800 px-4 py-2">
            <div className="text-xs text-indigo-400 font-medium">Total Eventos</div>
            <div className="text-lg font-bold text-indigo-300">{data.total_eventos}</div>
          </div>
          <div className="rounded-lg bg-green-900/20 border border-green-800 px-4 py-2">
            <div className="text-xs text-green-400 font-medium">Total Ingresos</div>
            <div className="text-lg font-bold text-green-300">{fmt(data.total_ingresos)}</div>
          </div>
          {data.paquete_mas_vendido && (
            <div className="rounded-lg bg-amber-900/20 border border-amber-800 px-4 py-2">
              <div className="text-xs text-amber-400 font-medium">Paquete más vendido</div>
              <div className="text-sm font-bold text-amber-300">{data.paquete_mas_vendido}</div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="h-64 rounded-xl border border-gray-800 animate-pulse bg-gray-900/30" />
      ) : !data || data.total_eventos === 0 ? (
        <div className="rounded-xl border border-gray-800 py-12 text-center text-sm text-gray-500">
          Sin eventos en el período.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Eventos por paquete</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={paqueteData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Eventos" fill="#818cf8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Distribución por estado</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={estadoData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {estadoData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
