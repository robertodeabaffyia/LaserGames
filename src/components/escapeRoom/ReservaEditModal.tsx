"use client";

import { useState } from "react";
import type { EscapeReservaConRelaciones, ModoCobro, EstadoReserva } from "@/types/escapeRoom";
import { ESTADOS_RESERVA } from "@/types/escapeRoom";
import { formatFecha, formatHora } from "@/lib/fecha";

interface ReservaEditModalProps {
  reserva: EscapeReservaConRelaciones;
  onClose: (saved: boolean) => void;
}

export default function ReservaEditModal({ reserva, onClose }: ReservaEditModalProps) {
  const [cantidadPersonas, setCantidadPersonas] = useState(String(reserva.cantidad_personas));
  const [modoCobro, setModoCobro] = useState<ModoCobro>(reserva.modo_cobro);
  const [estado, setEstado] = useState<EstadoReserva>(reserva.estado);
  const [notas, setNotas] = useState(reserva.notas ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/escape/reservas/${reserva.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cantidad_personas: Number(cantidadPersonas),
        modo_cobro: modoCobro,
        estado,
        notas: notas || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al guardar los cambios");
      setSaving(false);
      return;
    }

    onClose(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Editar reserva</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {reserva.sala?.nombre} · {formatFecha(reserva.fecha)} · {formatHora(`2000-01-01T${reserva.hora_inicio}`)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="text-gray-500 hover:text-gray-300 text-xl"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Modo de cobro</label>
            <select
              className="input"
              value={modoCobro}
              onChange={(e) => setModoCobro(e.target.value as ModoCobro)}
            >
              <option value="por_persona">Por persona</option>
              <option value="sala_completa">Sala completa</option>
            </select>
          </div>
          <div>
            <label className="label">Cantidad de personas</label>
            <input
              type="number"
              className="input"
              min={1}
              value={cantidadPersonas}
              onChange={(e) => setCantidadPersonas(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Estado</label>
          <select
            className="input"
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoReserva)}
          >
            {ESTADOS_RESERVA.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Notas</label>
          <input
            type="text"
            className="input"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="flex-1 rounded-lg border border-gray-600 text-gray-300 hover:border-gray-400 py-2.5 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition-colors"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
