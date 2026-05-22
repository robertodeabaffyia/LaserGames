"use client";

import type { Pago } from "@/types/pagos";
import { montoEfectivo } from "@/types/pagos";

interface HistorialPagosProps {
  pagos: Pago[];
  precioTotal: number;
  onDelete?: (id: string) => void;
}

const METODO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

function fmtCurrency(n: number) {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

function descuentoLabel(p: Pago): string | null {
  if (!p.tiene_descuento || !p.tipo_descuento || !p.valor_descuento) return null;
  if (p.tipo_descuento === "porcentaje") return `−${p.valor_descuento}%`;
  return `−${fmtCurrency(p.valor_descuento)}`;
}

export default function HistorialPagos({
  pagos,
  precioTotal,
  onDelete,
}: HistorialPagosProps) {
  // Use monto_final when available (discounted payments), else fall back to monto
  const totalPagado = pagos.reduce((sum, p) => sum + montoEfectivo(p), 0);
  const saldo = precioTotal - totalPagado;
  const credito = saldo < 0 ? Math.abs(saldo) : 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400 mb-1">Total</p>
          <p className="text-lg font-bold text-white">{fmtCurrency(precioTotal)}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400 mb-1">Pagado</p>
          <p className="text-lg font-bold text-green-400">{fmtCurrency(totalPagado)}</p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            credito > 0
              ? "border-purple-700 bg-purple-900/20"
              : saldo > 0
              ? "border-yellow-700 bg-yellow-900/20"
              : "border-gray-800 bg-gray-900/50"
          }`}
        >
          {credito > 0 ? (
            <>
              <p className="text-xs text-purple-300 mb-1">Crédito a favor</p>
              <p className="text-lg font-bold text-purple-300">{fmtCurrency(credito)}</p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-1">Pendiente</p>
              <p className={`text-lg font-bold ${saldo > 0 ? "text-yellow-400" : "text-gray-400"}`}>
                {fmtCurrency(Math.max(0, saldo))}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Payments table */}
      {pagos.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-8 text-center text-sm text-gray-500">
          Sin pagos registrados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Detalle</th>
                <th className="px-4 py-3">Descuento</th>
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3 text-right">Monto base</th>
                <th className="px-4 py-3 text-right">Acreditado</th>
                {onDelete && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {pagos.map((p) => {
                const efectivo = montoEfectivo(p);
                const descLabel = descuentoLabel(p);
                return (
                  <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {new Date(p.fecha_pago).toLocaleString("es-MX", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-200">
                      {METODO_LABELS[p.metodo] ?? p.metodo}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {p.tipo_tarjeta
                        ? `${p.tipo_tarjeta} · ${p.num_cuotas === 1 ? "contado" : `${p.num_cuotas} cuotas`}${p.recargo_pct ? ` (+${p.recargo_pct}%)` : ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {descLabel ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-900/40 border border-indigo-700 px-2 py-0.5 text-indigo-300 font-medium">
                          {descLabel}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{p.notas ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {p.tiene_descuento
                        ? fmtCurrency(p.monto)
                        : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">
                      {fmtCurrency(efectivo)}
                    </td>
                    {onDelete && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onDelete(p.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
