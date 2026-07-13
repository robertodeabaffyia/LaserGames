"use client";

import { useState, useEffect, useCallback } from "react";
import type { EscapeReservaConRelaciones, EstadoReserva, SalaEscape } from "@/types/escapeRoom";
import { formatMoneda } from "@/lib/moneda";
import { formatHora } from "@/lib/fecha";

const ESTADO_COLORS: Record<EstadoReserva, string> = {
  pendiente_sena: "border-amber-700 bg-amber-900/20",
  reservada: "border-yellow-700 bg-yellow-900/20",
  completada: "border-green-700 bg-green-900/20",
  cancelada: "border-red-800 bg-red-900/10 opacity-60",
};

const ESTADO_LABELS: Record<EstadoReserva, string> = {
  pendiente_sena: "pendiente seña",
  reservada: "reservada",
  completada: "completada",
  cancelada: "cancelada",
};

interface AgendaDiaProps {
  onEdit: (reserva: EscapeReservaConRelaciones) => void;
  refreshKey?: number;
}

function todayLocalISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function AgendaDia({ onEdit, refreshKey }: AgendaDiaProps) {
  const [fecha, setFecha] = useState(todayLocalISO());
  const [salas, setSalas] = useState<SalaEscape[]>([]);
  const [reservas, setReservas] = useState<EscapeReservaConRelaciones[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/escape/salas")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSalas(d ?? []));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/escape/reservas?fecha=${fecha}`);
    const data = res.ok ? await res.json() : [];
    setReservas(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [fecha, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  function cambiarDia(deltaDias: number) {
    const [y, m, d] = fecha.split("-").map(Number);
    const dt = new Date(y, m - 1, d + deltaDias);
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    setFecha(`${dt.getFullYear()}-${mm}-${dd}`);
  }

  // Only rooms shown; cancelled reservations are dimmed but still visible.
  const salasActivas = salas.filter((s) => s.activa);

  return (
    <div>
      {/* Day navigation */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => cambiarDia(-1)}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-gray-500 transition-colors"
        >
          ← Día anterior
        </button>
        <input
          type="date"
          className="input max-w-[180px]"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <button
          onClick={() => cambiarDia(1)}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-gray-500 transition-colors"
        >
          Día siguiente →
        </button>
        <button
          onClick={() => setFecha(todayLocalISO())}
          className="rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors"
        >
          Hoy
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Cargando agenda…</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, salasActivas.length)}, minmax(0, 1fr))` }}>
          {salasActivas.map((sala) => {
            const delSala = reservas
              .filter((r) => r.sala_id === sala.id)
              .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
            return (
              <div key={sala.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
                <h3 className="text-sm font-semibold text-white mb-3 px-1">{sala.nombre}</h3>
                {delSala.length === 0 ? (
                  <p className="text-xs text-gray-600 px-1 py-4 text-center">Sin reservas</p>
                ) : (
                  <div className="space-y-2">
                    {delSala.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => onEdit(r)}
                        className={`w-full text-left rounded-lg border px-3 py-2 transition-colors hover:brightness-125 ${ESTADO_COLORS[r.estado]}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white">
                            {formatHora(`2000-01-01T${r.hora_inicio}`)} hs
                          </span>
                          <span className="text-xs text-gray-400">{r.cantidad_personas}👤</span>
                        </div>
                        <div className="text-xs text-gray-300 truncate mt-0.5">
                          {r.contacto?.nombre ?? "—"}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[11px] text-gray-500">{ESTADO_LABELS[r.estado]}</span>
                          <span className="text-xs text-gray-400">{formatMoneda(r.precio_total)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
