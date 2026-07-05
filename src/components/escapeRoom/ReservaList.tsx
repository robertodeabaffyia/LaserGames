"use client";

import { useState, useEffect, useCallback } from "react";
import type { EscapeReservaConRelaciones, EstadoReserva, SalaEscape } from "@/types/escapeRoom";
import { ESTADOS_RESERVA } from "@/types/escapeRoom";
import { formatMoneda } from "@/lib/moneda";
import { formatFecha, formatHora } from "@/lib/fecha";

const ESTADO_COLORS: Record<EstadoReserva, string> = {
  pendiente_sena: "bg-amber-900/40 text-amber-300 border-amber-700",
  reservada: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  completada: "bg-green-900/40 text-green-300 border-green-700",
  cancelada: "bg-red-900/40 text-red-300 border-red-700",
};

const ESTADO_LABELS: Record<EstadoReserva, string> = {
  pendiente_sena: "pendiente seña",
  reservada: "reservada",
  completada: "completada",
  cancelada: "cancelada",
};

interface ReservaListProps {
  onEdit: (reserva: EscapeReservaConRelaciones) => void;
  onDelete: (id: string) => void;
  refreshKey?: number;
}

export default function ReservaList({ onEdit, onDelete, refreshKey }: ReservaListProps) {
  const [reservas, setReservas] = useState<EscapeReservaConRelaciones[]>([]);
  const [salas, setSalas] = useState<SalaEscape[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [fechaFilter, setFechaFilter] = useState("");
  const [salaFilter, setSalaFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoReserva | "">("");

  useEffect(() => {
    fetch("/api/escape/salas").then((r) => (r.ok ? r.json() : [])).then((d) => setSalas(d ?? []));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fechaFilter) params.set("fecha", fechaFilter);
    if (salaFilter) params.set("sala_id", salaFilter);
    if (estadoFilter) params.set("estado", estadoFilter);

    const res = await fetch(`/api/escape/reservas?${params}`);
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) {
      setFetchError(data?.error ?? "Error al cargar las reservas");
      setReservas([]);
    } else {
      setFetchError(null);
      setReservas(data);
    }
    setLoading(false);
  }, [fechaFilter, salaFilter, estadoFilter, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  function handleLimpiar() {
    setFechaFilter("");
    setSalaFilter("");
    setEstadoFilter("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        Cargando reservas…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-900/20 px-6 py-8 text-center">
        <p className="text-sm font-medium text-red-300">No se pudieron cargar las reservas</p>
        <p className="text-xs text-red-500 mt-1">{fetchError}</p>
        <button
          onClick={load}
          className="mt-4 rounded-lg border border-red-700 px-4 py-1.5 text-xs text-red-300 hover:text-white hover:border-red-500 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="date"
          className="input max-w-[180px]"
          value={fechaFilter}
          onChange={(e) => setFechaFilter(e.target.value)}
        />

        <select
          className="input max-w-[180px]"
          value={salaFilter}
          onChange={(e) => setSalaFilter(e.target.value)}
        >
          <option value="">Todas las salas</option>
          {salas.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>

        <select
          className="input max-w-[160px]"
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value as EstadoReserva | "")}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_RESERVA.map((s) => (
            <option key={s} value={s}>
              {ESTADO_LABELS[s].charAt(0).toUpperCase() + ESTADO_LABELS[s].slice(1)}
            </option>
          ))}
        </select>

        <button
          onClick={handleLimpiar}
          className="rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors"
        >
          Limpiar
        </button>
      </div>

      {reservas.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 py-12 text-center text-sm text-gray-500">
          No hay reservas para los filtros seleccionados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Sala</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3 text-center">Personas</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {reservas.map((r) => (
                <tr key={r.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                    {formatFecha(r.fecha)}
                  </td>
                  <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                    {formatHora(`2000-01-01T${r.hora_inicio}`)}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{r.sala?.nombre ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{r.contacto?.nombre ?? "—"}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {r.contacto?.telefono ?? r.contacto?.email ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">{r.cantidad_personas}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[r.estado]}`}
                    >
                      {ESTADO_LABELS[r.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-white">
                    {formatMoneda(r.precio_total)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => onEdit(r)}
                        className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onDelete(r.id)}
                        className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
