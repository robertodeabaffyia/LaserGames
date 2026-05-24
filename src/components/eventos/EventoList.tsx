"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { EVENTO_ESTADOS, type EventoEstado, type EventoConRelaciones } from "@/types/eventos";

const ESTADO_COLORS: Record<EventoEstado, string> = {
  pendiente: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  cotizacion: "bg-blue-900/40 text-blue-300 border-blue-700",
  confirmado: "bg-green-900/40 text-green-300 border-green-700",
  en_curso: "bg-purple-900/40 text-purple-300 border-purple-700",
  completado: "bg-gray-700/60 text-gray-300 border-gray-600",
  cancelado: "bg-red-900/40 text-red-300 border-red-700",
};

interface EventoListProps {
  onDelete: (id: string) => void;
  refreshKey?: number;
}

export default function EventoList({ onDelete, refreshKey }: EventoListProps) {
  const router = useRouter();
  const [eventos, setEventos] = useState<EventoConRelaciones[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<EventoEstado | "">("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (estadoFilter) params.set("estado", estadoFilter);
    if (fechaInicio) params.set("fecha_inicio", new Date(fechaInicio).toISOString());
    if (fechaFin) params.set("fecha_fin", new Date(fechaFin).toISOString());

    const res = await fetch(`/api/eventos?${params}`);
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) {
      setFetchError(data?.error ?? "Error al cargar los eventos");
      setEventos([]);
    } else {
      setFetchError(null);
      setEventos(data);
    }
    setLoading(false);
  }, [estadoFilter, fechaInicio, fechaFin, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        Cargando eventos…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-900/20 px-6 py-8 text-center">
        <p className="text-sm font-medium text-red-300">No se pudieron cargar los eventos</p>
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
        <select
          className="input max-w-[180px]"
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value as EventoEstado | "")}
        >
          <option value="">Todos los estados</option>
          {EVENTO_ESTADOS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
            </option>
          ))}
        </select>

        <input
          type="date"
          className="input max-w-[180px]"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          placeholder="Desde"
        />
        <input
          type="date"
          className="input max-w-[180px]"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          placeholder="Hasta"
        />
        <button
          onClick={() => { setEstadoFilter(""); setFechaInicio(""); setFechaFin(""); }}
          className="rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors"
        >
          Limpiar
        </button>
      </div>

      {eventos.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 py-12 text-center text-sm text-gray-500">
          No hay eventos para los filtros seleccionados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Festejado</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Paquete</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {eventos.map((ev) => (
                <tr key={ev.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3 text-gray-200">
                    {new Date(ev.fecha_evento).toLocaleString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{ev.nombre_festejado}</td>
                  <td className="px-4 py-3 text-gray-300">{ev.cliente?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-300">{ev.paquete?.nombre ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[ev.estado]}`}
                    >
                      {ev.estado.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-white">
                    ${ev.precio_total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => router.push(`/dashboard/eventos/${ev.id}`)}
                        className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
                      >
                        Ver/Editar
                      </button>
                      <button
                        onClick={() => onDelete(ev.id)}
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
