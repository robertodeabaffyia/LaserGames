"use client";

import { useState } from "react";
import type { Pago, PagoAuditoria } from "@/types/pagos";
import { montoEfectivo, calcularEstadoPago } from "@/types/pagos";
import { formatMoneda } from "@/lib/moneda";
import { formatFechaHora } from "@/lib/fecha";

interface HistorialPagosProps {
  pagos: Pago[];
  precioTotal: number;
  montoSena?: number; // from config
  onDelete?: (id: string) => void;
  onEdited?: () => void; // refresh parent after edit
  /** Optional event context printed on payment receipts */
  eventoNombre?: string;
  eventoFecha?: string;
}

const METODO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

const ACCION_LABELS: Record<string, string> = {
  crear: "Creado",
  editar: "Editado",
  eliminar: "Eliminado",
};

function fmtCurrency(n: number) {
  return formatMoneda(n);
}

function fmtDate(iso: string) {
  return formatFechaHora(iso);
}

function descuentoLabel(p: Pago): string | null {
  if (!p.tiene_descuento || !p.tipo_descuento || !p.valor_descuento) return null;
  if (p.tipo_descuento === "porcentaje") return `−${p.valor_descuento}%`;
  return `−${fmtCurrency(p.valor_descuento)}`;
}

// ── Edit modal (notas + quien_recibio + fecha) ─────────────────────────────────

interface EditModalProps {
  pago: Pago;
  onClose: (refreshed: boolean) => void;
}

function EditModal({ pago, onClose }: EditModalProps) {
  const [notas, setNotas] = useState(pago.notas ?? "");
  const [quienRecibio, setQuienRecibio] = useState(pago.quien_recibio ?? "");
  const [fechaPago, setFechaPago] = useState(
    new Date(pago.fecha_pago).toISOString().slice(0, 16)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/pagos/${pago.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notas: notas || null,
        quien_recibio: quienRecibio || null,
        fecha_pago: new Date(fechaPago).toISOString(),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al actualizar");
      setSaving(false);
      return;
    }

    onClose(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Editar pago</h3>
          <button onClick={() => onClose(false)} className="text-gray-500 hover:text-gray-300 text-xl">✕</button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Fecha y hora</label>
            <input
              type="datetime-local"
              className="input"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Recibido por</label>
            <input
              type="text"
              className="input"
              placeholder="Nombre del empleado/a"
              value={quienRecibio}
              onChange={(e) => setQuienRecibio(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Notas / referencia</label>
            <input
              type="text"
              className="input"
              placeholder="Número de transferencia, comprobante…"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1 justify-end">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-5 py-2 text-sm font-semibold text-white transition-colors"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Audit trail row ────────────────────────────────────────────────────────────

function AuditRow({ pagoId }: { pagoId: string }) {
  const [entries, setEntries] = useState<PagoAuditoria[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (entries !== null) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pagos/${pagoId}/auditoria`);
      if (!res.ok) throw new Error("Error al cargar auditoría");
      setEntries(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  // Load on mount
  if (entries === null && !loading && !error) {
    load();
  }

  if (loading) {
    return (
      <div className="px-6 py-3 text-xs text-gray-500">Cargando historial…</div>
    );
  }

  if (error) {
    return <div className="px-6 py-3 text-xs text-red-400">{error}</div>;
  }

  if (!entries || entries.length === 0) {
    return <div className="px-6 py-3 text-xs text-gray-600">Sin registros de auditoría.</div>;
  }

  return (
    <div className="px-6 py-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Historial de cambios
      </p>
      {entries.map((a) => (
        <div key={a.id} className="flex items-start gap-3 text-xs">
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
              a.accion === "crear"
                ? "bg-green-900/40 text-green-400"
                : a.accion === "eliminar"
                ? "bg-red-900/40 text-red-400"
                : "bg-indigo-900/40 text-indigo-400"
            }`}
          >
            {ACCION_LABELS[a.accion] ?? a.accion}
          </span>
          <span className="text-gray-500">{fmtDate(a.fecha)}</span>
          {a.accion === "editar" && (
            <details className="text-gray-600 cursor-pointer">
              <summary className="hover:text-gray-400 transition-colors">Ver cambios</summary>
              <pre className="mt-1 text-gray-500 whitespace-pre-wrap break-all max-w-sm">
                {JSON.stringify(a.cambios, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function HistorialPagos({
  pagos,
  precioTotal,
  montoSena = 0,
  onDelete,
  onEdited,
  eventoNombre,
  eventoFecha,
}: HistorialPagosProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingPago, setEditingPago] = useState<Pago | null>(null);

  /** Generates a one-page PDF receipt for a single payment. */
  async function handleRecibo(p: Pago) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const efectivo = montoEfectivo(p);

    doc.setFontSize(18);
    doc.text("Laser Games", 14, 22);
    doc.setFontSize(12);
    doc.text("Comprobante de pago", 14, 30);
    doc.setDrawColor(120);
    doc.line(14, 34, 196, 34);

    doc.setFontSize(10);
    let y = 44;
    const row = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, 70, y);
      y += 7;
    };

    if (eventoNombre) row("Evento:", eventoNombre);
    if (eventoFecha) row("Fecha del evento:", fmtDate(eventoFecha));
    row("Fecha de pago:", fmtDate(p.fecha_pago));
    row(
      "Método:",
      `${METODO_LABELS[p.metodo] ?? p.metodo}${
        p.tipo_tarjeta
          ? ` — ${p.tipo_tarjeta} ${p.num_cuotas === 1 ? "contado" : `${p.num_cuotas} cuotas`}${
              p.recargo_pct ? ` (+${p.recargo_pct}%)` : ""
            }`
          : ""
      }`
    );
    if (p.quien_recibio) row("Recibido por:", p.quien_recibio);
    row("Monto base:", fmtCurrency(p.monto));
    const descLabel = descuentoLabel(p);
    if (descLabel) row("Descuento:", descLabel);
    doc.setFontSize(12);
    row("Acreditado:", fmtCurrency(efectivo));
    doc.setFontSize(10);
    if (p.notas) row("Notas:", p.notas);

    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Comprobante generado el ${fmtDate(new Date().toISOString())} — Pago N° ${p.id}`, 14, y);

    doc.save(`recibo_${p.id.slice(0, 8)}.pdf`);
  }

  const totalPagado = pagos.reduce((sum, p) => sum + montoEfectivo(p), 0);
  const saldo = precioTotal - totalPagado;
  const credito = saldo < 0 ? Math.abs(saldo) : 0;
  const estadoPago = calcularEstadoPago(totalPagado, precioTotal, montoSena);

  // ── Summary colours ──
  const saldoColor =
    estadoPago === "pagado"
      ? "border-green-700 bg-green-900/20"
      : estadoPago === "con_sena"
      ? "border-yellow-700 bg-yellow-900/20"
      : "border-red-800 bg-red-900/15";

  const saldoTextColor =
    estadoPago === "pagado"
      ? "text-green-400"
      : estadoPago === "con_sena"
      ? "text-yellow-400"
      : "text-red-400";

  const saldoLabel =
    credito > 0
      ? "Crédito a favor"
      : estadoPago === "pagado"
      ? "Saldo"
      : estadoPago === "con_sena"
      ? "Pendiente (seña OK)"
      : "Pendiente";

  return (
    <>
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {/* Total */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400 mb-1">Total evento</p>
          <p className="text-lg font-bold text-white">{fmtCurrency(precioTotal)}</p>
        </div>

        {/* Seña */}
        {montoSena > 0 && (
          <div
            className={`rounded-xl border p-4 ${
              totalPagado >= montoSena
                ? "border-green-800 bg-green-900/15"
                : "border-gray-800 bg-gray-900/50"
            }`}
          >
            <p className="text-xs text-gray-400 mb-1">Seña mínima</p>
            <p
              className={`text-lg font-bold ${
                totalPagado >= montoSena ? "text-green-400" : "text-gray-300"
              }`}
            >
              {fmtCurrency(montoSena)}
            </p>
          </div>
        )}

        {/* Pagado */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400 mb-1">Pagado</p>
          <p className="text-lg font-bold text-green-400">{fmtCurrency(totalPagado)}</p>
        </div>

        {/* Saldo / pendiente */}
        <div className={`rounded-xl border p-4 ${saldoColor}`}>
          <p className="text-xs text-gray-400 mb-1">{saldoLabel}</p>
          <p className={`text-lg font-bold ${saldoTextColor}`}>
            {fmtCurrency(credito > 0 ? credito : Math.max(0, saldo))}
          </p>
        </div>
      </div>

      {/* ── Payments table ── */}
      {pagos.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-8 text-center text-sm text-gray-500">
          Sin pagos registrados.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3 w-5"></th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Recibido por</th>
                <th className="px-4 py-3">Descuento</th>
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3 text-right">Acreditado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {pagos.map((p) => {
                const efectivo = montoEfectivo(p);
                const descLabel = descuentoLabel(p);
                const isExpanded = expandedId === p.id;

                return (
                  <>
                    <tr
                      key={p.id}
                      className="hover:bg-gray-800/30 transition-colors"
                    >
                      {/* Expand toggle */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                          className="text-gray-600 hover:text-gray-400 transition-colors text-xs"
                          title="Ver auditoría"
                        >
                          {isExpanded ? "▼" : "▶"}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {fmtDate(p.fecha_pago)}
                      </td>

                      <td className="px-4 py-3 text-gray-200">
                        <span>
                          {METODO_LABELS[p.metodo] ?? p.metodo}
                          {p.tipo_tarjeta && (
                            <span className="ml-1 text-xs text-gray-500">
                              · {p.tipo_tarjeta}{" "}
                              {p.num_cuotas === 1
                                ? "contado"
                                : `${p.num_cuotas}c`}
                              {p.recargo_pct ? ` (+${p.recargo_pct}%)` : ""}
                            </span>
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {p.quien_recibio ?? <span className="text-gray-600">—</span>}
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

                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {p.notas ?? <span className="text-gray-600">—</span>}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-white">
                        {fmtCurrency(efectivo)}
                        {p.tiene_descuento && (
                          <span className="block text-xs text-gray-500 font-normal">
                            base: {fmtCurrency(p.monto)}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 justify-end">
                          <button
                            type="button"
                            onClick={() => handleRecibo(p)}
                            className="text-xs text-gray-400 hover:text-white transition-colors"
                            title="Descargar comprobante PDF"
                          >
                            🧾 Recibo
                          </button>
                          {onEdited && (
                            <button
                              type="button"
                              onClick={() => setEditingPago(p)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              Editar
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete(p.id)}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Audit trail expanded row */}
                    {isExpanded && (
                      <tr key={`${p.id}-audit`} className="bg-gray-900/70">
                        <td colSpan={8} className="border-t border-gray-800/60">
                          <AuditRow pagoId={p.id} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editingPago && (
        <EditModal
          pago={editingPago}
          onClose={(refreshed) => {
            setEditingPago(null);
            if (refreshed) onEdited?.();
          }}
        />
      )}
    </>
  );
}
