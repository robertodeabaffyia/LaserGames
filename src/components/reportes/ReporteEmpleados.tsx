"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { ReporteEmpleados as TReporteEmpleados } from "@/types/reportes";
import type { Periodo } from "./PeriodoPicker";
import { rangoFromPeriodo } from "./PeriodoPicker";
import PeriodoPicker from "./PeriodoPicker";
import ExportPDF from "./ExportPDF";
import ExportExcel from "./ExportExcel";
import { formatMoneda } from "@/lib/moneda";

const fmt = formatMoneda;
function fmtH(n: number) {
  return `${Math.floor(n)}h ${Math.round((n % 1) * 60)}m`;
}

export default function ReporteEmpleados() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [customRango, setCustomRango] = useState({ desde: "", hasta: "" });
  const [data, setData] = useState<TReporteEmpleados | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { desde, hasta } = rangoFromPeriodo(periodo, customRango);
    let active = true;
    fetch(`/api/reportes/empleados?desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then((d) => { if (active) setData(d); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [periodo, customRango]);

  const resumen = data?.resumen ?? [];
  const chartData = resumen.map((e) => ({
    name: e.nombre.split(" ")[0],
    Horas: Math.round(e.horas_trabajadas * 10) / 10,
    Salario: e.salario_total,
    Bonos: e.bonos_total,
  }));

  const exportRows = resumen.map((e) => ({
    Empleado: e.nombre,
    "Horas trabajadas": e.horas_trabajadas,
    "Salario total": e.salario_total,
    "Bonos total": e.bonos_total,
    "Costo total": e.total_costo,
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
        {resumen.length > 0 && (
          <div className="flex gap-2">
            <ExportExcel filename="reporte-empleados" data={exportRows} />
            <ExportPDF
              filename="reporte-empleados"
              title="Reporte de Empleados"
              columns={["Empleado", "Horas", "Salario", "Bonos", "Costo total"]}
              rows={resumen.map((e) => [
                e.nombre,
                fmtH(e.horas_trabajadas),
                fmt(e.salario_total),
                fmt(e.bonos_total),
                fmt(e.total_costo),
              ])}
              summary={[
                ["Total horas", fmtH(data?.total_horas ?? 0)],
                ["Costo total", fmt(data?.total_costo ?? 0)],
                ...(data?.top_empleado ? [["Top empleado", data.top_empleado] as [string, string]] : []),
              ]}
            />
          </div>
        )}
      </div>

      {data && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg bg-indigo-900/20 border border-indigo-800 px-4 py-2">
            <div className="text-xs text-indigo-400 font-medium">Total horas</div>
            <div className="text-lg font-bold text-indigo-300">{fmtH(data.total_horas)}</div>
          </div>
          <div className="rounded-lg bg-red-900/20 border border-red-800 px-4 py-2">
            <div className="text-xs text-red-400 font-medium">Costo total</div>
            <div className="text-lg font-bold text-red-300">{fmt(data.total_costo)}</div>
          </div>
          {data.top_empleado && (
            <div className="rounded-lg bg-amber-900/20 border border-amber-800 px-4 py-2">
              <div className="text-xs text-amber-400 font-medium">Top empleado</div>
              <div className="text-sm font-bold text-amber-300">{data.top_empleado}</div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="h-64 rounded-xl border border-gray-800 animate-pulse bg-gray-900/30" />
      ) : resumen.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-12 text-center text-sm text-gray-500">
          Sin registros de horas en el período.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Horas trabajadas por empleado</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  formatter={(v, key) => [key === "Horas" ? `${Number(v)}h` : fmt(Number(v)), key]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Horas"   fill="#818cf8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Salario" fill="#f87171" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Bonos"   fill="#fbbf24" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr className="text-left text-xs text-gray-400">
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3 text-right">Horas</th>
                  <th className="px-4 py-3 text-right">Salario</th>
                  <th className="px-4 py-3 text-right">Bonos</th>
                  <th className="px-4 py-3 text-right">Costo total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {resumen.map((e) => (
                  <tr key={e.empleado_id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{e.nombre}</td>
                    <td className="px-4 py-3 text-right text-indigo-400 text-xs">{fmtH(e.horas_trabajadas)}</td>
                    <td className="px-4 py-3 text-right text-gray-300 text-xs">{fmt(e.salario_total)}</td>
                    <td className="px-4 py-3 text-right text-amber-400 text-xs">{fmt(e.bonos_total)}</td>
                    <td className="px-4 py-3 text-right text-red-400 font-medium text-xs">{fmt(e.total_costo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-700 bg-gray-900/50">
                <tr>
                  <td className="px-4 py-2 text-xs text-gray-400 font-semibold">TOTAL</td>
                  <td className="px-4 py-2 text-right text-xs text-indigo-400 font-semibold">{fmtH(data?.total_horas ?? 0)}</td>
                  <td className="px-4 py-2 text-right text-xs text-gray-300 font-semibold">
                    {fmt(resumen.reduce((s, e) => s + e.salario_total, 0))}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-amber-400 font-semibold">
                    {fmt(resumen.reduce((s, e) => s + e.bonos_total, 0))}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-red-400 font-semibold">{fmt(data?.total_costo ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
