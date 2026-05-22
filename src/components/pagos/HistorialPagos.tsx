"use client";

import type { Pago } from "@/types/pagos";

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

export default function HistorialPagos({
  pagos,
  precioTotal,
  onDelete,
}: HistorialPagosProps) {
  const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
  const saldo = precioTotal - totalPagado;
  const credito = saldo < 0 ? Math.abs(saldo) : 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400 mb-1">Total</p>
          <p className="text-lg font-bold text-white">
            ${precioTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400 mb-1">Pagado</p>
          <p className="text-lg font-bold text-green-400">
            ${totalPagado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
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
              <p className="text-lg font-bold text-purple-300">
                ${credito.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-1">Pendiente</p>
              <p
                className={`text-lg font-bold ${
                  saldo > 0 ? "text-yellow-400" : "text-gray-400"
                }`}
              >
                ${Math.max(0, saldo).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
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
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3 text-right">Monto</th>
                {onDelete && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {pagos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-300">
                    {new Date(p.fecha_pago).toLocaleString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
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
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.notas ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">
                    ${p.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
