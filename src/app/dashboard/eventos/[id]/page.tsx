"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import PagoForm from "@/components/pagos/PagoForm";
import HistorialPagos from "@/components/pagos/HistorialPagos";
import type { EventoConRelaciones } from "@/types/eventos";
import type { Pago } from "@/types/pagos";

const ESTADO_COLORS: Record<string, string> = {
  pendiente: "text-yellow-400",
  cotizacion: "text-blue-400",
  confirmado: "text-green-400",
  en_curso: "text-purple-400",
  completado: "text-gray-300",
  cancelado: "text-red-400",
};

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [evento, setEvento] = useState<EventoConRelaciones | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPagoForm, setShowPagoForm] = useState(false);

  const loadEvento = useCallback(async () => {
    const [evRes, pagoRes] = await Promise.all([
      fetch(`/api/eventos/${id}`),
      fetch(`/api/pagos?evento_id=${id}`),
    ]);
    if (!evRes.ok) { router.push("/dashboard/eventos"); return; }
    const [ev, ps] = await Promise.all([evRes.json(), pagoRes.json()]);
    setEvento(ev);
    setPagos(ps ?? []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { loadEvento(); }, [loadEvento]);

  async function handleDeletePago(pagoId: string) {
    if (!confirm("¿Eliminar este pago?")) return;
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

  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
  const saldo = evento.precio_total - totalPagado;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
      >
        ← Volver
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{evento.nombre_festejado}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date(evento.fecha_evento).toLocaleString("es-MX", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span
          className={`text-sm font-semibold capitalize ${ESTADO_COLORS[evento.estado] ?? "text-gray-400"}`}
        >
          {evento.estado.replace("_", " ")}
        </span>
      </div>

      {/* Details card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500">Cliente</dt>
            <dd className="text-white font-medium mt-0.5">{evento.cliente?.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Teléfono</dt>
            <dd className="text-gray-300 mt-0.5">{evento.cliente?.telefono ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Paquete</dt>
            <dd className="text-white font-medium mt-0.5">{evento.paquete?.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Duración</dt>
            <dd className="text-gray-300 mt-0.5">{evento.duracion_horas}h</dd>
          </div>
          {evento.notas && (
            <div className="col-span-2">
              <dt className="text-xs text-gray-500">Notas</dt>
              <dd className="text-gray-300 mt-0.5">{evento.notas}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Pagos section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Historial de pagos</h2>
          {saldo > 0 && !showPagoForm && (
            <button
              onClick={() => setShowPagoForm(true)}
              className="rounded-lg bg-green-700 hover:bg-green-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors"
            >
              + Registrar pago
            </button>
          )}
        </div>

        {showPagoForm && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 mb-4">
            <h3 className="text-sm font-semibold text-white mb-4">Nuevo pago</h3>
            <PagoForm
              eventoId={id}
              precioTotal={evento.precio_total}
              totalPagado={totalPagado}
              onSuccess={() => { setShowPagoForm(false); loadEvento(); }}
            />
          </div>
        )}

        <HistorialPagos
          pagos={pagos}
          precioTotal={evento.precio_total}
          onDelete={handleDeletePago}
        />
      </div>
    </div>
  );
}
