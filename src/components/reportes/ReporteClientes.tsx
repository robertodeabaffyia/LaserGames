"use client";

import { useEffect, useState } from "react";
import type { ReporteClientes as TReporteClientes, ClienteRanking } from "@/types/reportes";
import type { Periodo } from "./PeriodoPicker";
import { rangoFromPeriodo } from "./PeriodoPicker";
import PeriodoPicker from "./PeriodoPicker";
import ExportPDF from "./ExportPDF";
import ExportExcel from "./ExportExcel";
import { formatFecha } from "@/lib/fecha";
import { formatMoneda } from "@/lib/moneda";

const fmt = formatMoneda;
function fmtDate(s: string | null) {
  return formatFecha(s);
}

export default function ReporteClientes() {
  const [periodo, setPeriodo] = useState<Periodo>("anio");
  const [customRango, setCustomRango] = useState({ desde: "", hasta: "" });
  const [data, setData] = useState<TReporteClientes | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { desde, hasta } = rangoFromPeriodo(periodo, customRango);
    setLoading(true);
    fetch(`/api/reportes/clientes?desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [periodo, customRango]);

  const ranking: ClienteRanking[] = data?.ranking ?? [];

  const exportRows = ranking.map((c, i) => ({
    "#": i + 1,
    Cliente: c.nombre,
    "Total eventos": c.total_eventos,
    "Total gastado": c.total_gastado,
    "Primer evento": fmtDate(c.primer_evento),
    "Último evento": fmtDate(c.ultimo_evento),
    "Próximo evento": fmtDate(c.proximo_evento),
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
        {ranking.length > 0 && (
          <div className="flex gap-2">
            <ExportExcel filename="reporte-clientes" data={exportRows} />
            <ExportPDF
              filename="reporte-clientes"
              title="Ranking de Clientes"
              columns={["#", "Cliente", "Eventos", "Total gastado", "Próximo evento"]}
              rows={ranking.map((c, i) => [
                String(i + 1),
                c.nombre,
                String(c.total_eventos),
                fmt(c.total_gastado),
                fmtDate(c.proximo_evento),
              ])}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 rounded-xl border border-gray-800 animate-pulse bg-gray-900/30" />
      ) : ranking.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-12 text-center text-sm text-gray-500">
          Sin eventos en el período.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">Eventos</th>
                <th className="px-4 py-3 text-right">Total gastado</th>
                <th className="px-4 py-3">Primer evento</th>
                <th className="px-4 py-3">Último evento</th>
                <th className="px-4 py-3">Próximo evento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {ranking.map((c, i) => (
                <tr key={c.cliente_id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 text-white font-medium">{c.nombre}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-indigo-400 font-semibold">{c.total_eventos}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-green-400 font-medium text-xs">
                    {fmt(c.total_gastado)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(c.primer_evento)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(c.ultimo_evento)}</td>
                  <td className="px-4 py-3 text-xs">
                    {c.proximo_evento ? (
                      <span className="text-amber-400">{fmtDate(c.proximo_evento)}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-500 text-right">
            {ranking.length} clientes
          </div>
        </div>
      )}
    </div>
  );
}
