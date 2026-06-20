"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import PagoForm from "@/components/pagos/PagoForm";
import HistorialPagos from "@/components/pagos/HistorialPagos";
import EventoForm from "@/components/eventos/EventoForm";
import type { EventoConRelaciones } from "@/types/eventos";
import type { Pago } from "@/types/pagos";
import { montoEfectivo, calcularEstadoPago } from "@/types/pagos";
import { formatDuration } from "@/lib/duration";
import { formatFecha, formatFechaHora, formatHora } from "@/lib/fecha";
import { formatMoneda } from "@/lib/moneda";
import { buildWhatsAppLink } from "@/lib/whatsapp";

// ── Colour maps ────────────────────────────────────────────────────────────────

const ESTADO_COLORS: Record<string, string> = {
  pendiente:  "text-yellow-400 bg-yellow-900/20 border-yellow-700",
  cotizacion: "text-blue-400 bg-blue-900/20 border-blue-700",
  confirmado: "text-green-400 bg-green-900/20 border-green-700",
  en_curso:   "text-purple-400 bg-purple-900/20 border-purple-700",
  completado: "text-gray-300 bg-gray-800/50 border-gray-600",
  cancelado:  "text-red-400 bg-red-900/20 border-red-700",
};

const PAGO_STATUS_COLORS = {
  pagado:   "text-green-400",
  con_sena: "text-yellow-400",
  sin_pago: "text-red-400",
} as const;

const PAGO_STATUS_LABELS = {
  pagado:   "✅ Pagado",
  con_sena: "🟡 Seña confirmada",
  sin_pago: "🔴 Sin pago",
} as const;

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = "detalle" | "pagos";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [evento, setEvento] = useState<EventoConRelaciones | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [montoSena, setMontoSena] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("detalle");

  const loadEvento = useCallback(async () => {
    const [evRes, pagoRes, configRes] = await Promise.all([
      fetch(`/api/eventos/${id}`),
      fetch(`/api/pagos?evento_id=${id}`),
      fetch("/api/configuracion"),
    ]);

    if (!evRes.ok) {
      router.push("/dashboard/eventos");
      return;
    }

    const [ev, ps, cfg] = await Promise.all([
      evRes.json(),
      pagoRes.json(),
      configRes.ok ? configRes.json() : null,
    ]);

    setEvento(ev);
    setPagos(ps ?? []);
    setMontoSena(cfg?.monto_seña ?? 0);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { loadEvento(); }, [loadEvento]);

  async function handleDeletePago(pagoId: string) {
    if (!confirm("¿Eliminar este pago? Esta acción no se puede deshacer.")) return;
    await fetch(`/api/pagos/${pagoId}`, { method: "DELETE" });
    loadEvento();
  }

  if (loading || !evento) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Cargando evento…
      </div>
    );
  }

  const totalPagado = pagos.reduce((s, p) => s + montoEfectivo(p), 0);
  const saldo = Math.max(0, evento.precio_total - totalPagado);
  const estadoPago = calcularEstadoPago(totalPagado, evento.precio_total, montoSena);

  // WhatsApp click-to-chat with a pre-filled event summary
  const waMensaje =
    `¡Hola ${evento.cliente?.nombre ?? ""}! Te escribimos de Laser Games por el evento de ` +
    `${evento.nombre_festejado} (${formatFechaHora(evento.fecha_evento)}).` +
    (saldo > 0 ? ` Saldo pendiente: ${formatMoneda(saldo)}.` : "");
  const waLink = buildWhatsAppLink(evento.cliente?.telefono, waMensaje);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
      >
        ← Volver
      </button>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{evento.cliente?.nombre ?? "—"}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{evento.nombre_festejado}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatFechaHora(evento.fecha_evento)}
          </p>
          <p className={`text-sm font-semibold mt-1.5 ${PAGO_STATUS_COLORS[estadoPago]}`}>
            {PAGO_STATUS_LABELS[estadoPago]}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start">
          <span
            className={`text-xs font-semibold capitalize px-3 py-1.5 rounded-full border ${
              ESTADO_COLORS[evento.estado] ?? "text-gray-400 border-gray-600"
            }`}
          >
            {evento.estado.replace("_", " ")}
          </span>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-green-700 hover:bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors"
              title={`Escribir a ${evento.cliente?.nombre} por WhatsApp`}
            >
              💬 WhatsApp
            </a>
          )}
          <button
            onClick={() => setShowEditModal(true)}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            ✏️ Editar evento
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-gray-800">
        {(["detalle", "pagos"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-indigo-500 text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab === "detalle" ? "Información" : "Pagos"}
            {tab === "pagos" && (
              <span
                className={`ml-2 text-xs font-semibold rounded-full px-1.5 py-0.5 ${
                  estadoPago === "pagado"
                    ? "bg-green-900/50 text-green-400"
                    : estadoPago === "con_sena"
                    ? "bg-yellow-900/50 text-yellow-400"
                    : "bg-red-900/50 text-red-400"
                }`}
              >
                {pagos.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Detalle ── */}
      {activeTab === "detalle" && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Cliente</dt>
              <dd className="text-white font-medium mt-0.5">{evento.cliente?.nombre}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Teléfono</dt>
              <dd className="text-gray-300 mt-0.5">{evento.cliente?.telefono ?? "—"}</dd>
            </div>
            {evento.edad_festejado && (
              <div>
                <dt className="text-xs text-gray-500">Edad festejado/a</dt>
                <dd className="text-gray-300 mt-0.5">{evento.edad_festejado} años</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-gray-500">Paquete</dt>
              <dd className="text-white font-medium mt-0.5">{evento.paquete?.nombre}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Hora</dt>
              <dd className="text-gray-300 mt-0.5">
                {formatHora(evento.fecha_evento)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Estado</dt>
              <dd className="mt-0.5">
                <span
                  className={`text-xs font-semibold capitalize px-2 py-0.5 rounded-full border ${
                    ESTADO_COLORS[evento.estado] ?? "text-gray-400 border-gray-600"
                  }`}
                >
                  {evento.estado.replace("_", " ")}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Duración</dt>
              <dd className="text-gray-300 mt-0.5">
                {formatDuration(evento.duracion_horas, evento.duracion_minutos)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Invitados</dt>
              <dd className="text-gray-300 mt-0.5">{evento.num_invitados ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Niños totales</dt>
              <dd className="text-gray-300 mt-0.5">{evento.cantidad_ninos_totales}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Adultos totales</dt>
              <dd className="text-gray-300 mt-0.5">{evento.cantidad_adultos_totales}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Precio total</dt>
              <dd className="text-white font-bold mt-0.5">
                {formatMoneda(evento.precio_total)}
              </dd>
            </div>
            {evento.descuento > 0 && (
              <div>
                <dt className="text-xs text-gray-500">Descuento</dt>
                <dd className="text-green-400 font-medium mt-0.5">
                  -{formatMoneda(evento.descuento)}
                </dd>
              </div>
            )}
            {evento.notas && (
              <div className="col-span-2">
                <dt className="text-xs text-gray-500">Notas</dt>
                <dd className="text-gray-300 mt-0.5">{evento.notas}</dd>
              </div>
            )}
          </dl>

          {/* ── Pagos Realizados ── */}
          <div className="mt-6 pt-5 border-t border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
              Pagos Realizados
            </h3>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm mb-4">
              <div>
                <dt className="text-xs text-gray-500">Total pagado</dt>
                <dd className="text-white font-bold mt-0.5">
                  {formatMoneda(totalPagado)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Saldo pendiente</dt>
                <dd className={`font-bold mt-0.5 ${saldo > 0 ? "text-red-400" : "text-green-400"}`}>
                  {formatMoneda(saldo)}
                </dd>
              </div>
            </div>

            {pagos.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Sin pagos registrados</p>
            ) : (
              <ul className="space-y-2">
                {pagos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-2.5 text-sm"
                  >
                    <span className="text-gray-400">
                      {formatFecha(p.fecha_pago)}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{p.metodo}</span>
                    <span className="text-white font-medium">
                      {formatMoneda(montoEfectivo(p))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Pagos ── */}
      {activeTab === "pagos" && (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {saldo > 0
                ? `Saldo pendiente: ${formatMoneda(saldo)}`
                : "Evento completamente pagado"}
            </p>
            {saldo > 0 && (
              <button
                onClick={() => setShowPagoModal(true)}
                className="rounded-lg bg-green-700 hover:bg-green-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors"
              >
                + Agregar pago
              </button>
            )}
          </div>

          <HistorialPagos
            pagos={pagos}
            precioTotal={evento.precio_total}
            montoSena={montoSena}
            onDelete={handleDeletePago}
            onEdited={loadEvento}
            eventoNombre={evento.nombre_festejado}
            eventoFecha={evento.fecha_evento}
          />
        </div>
      )}

      {/* ── Pago modal ── */}
      {showPagoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl bg-gray-900 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">Registrar pago</h3>
              <button
                onClick={() => setShowPagoModal(false)}
                className="text-gray-500 hover:text-gray-300 text-xl"
              >
                ✕
              </button>
            </div>
            <PagoForm
              eventoId={id}
              precioTotal={evento.precio_total}
              totalPagado={totalPagado}
              onSuccess={() => {
                setShowPagoModal(false);
                loadEvento();
              }}
              onCancel={() => setShowPagoModal(false)}
            />
          </div>
        </div>
      )}
      {/* ── Edit modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl bg-gray-900 rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">Editar evento</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-300 text-xl"
              >
                ✕
              </button>
            </div>
            <EventoForm
              evento={evento}
              onSuccess={() => {
                setShowEditModal(false);
                loadEvento();
              }}
              onCancel={() => setShowEditModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
