"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { EVENTO_ESTADOS, type EventoEstado, type EventoConRelaciones } from "@/types/eventos";
import { formatMoneda } from "@/lib/moneda";
import { formatFechaHora } from "@/lib/fecha";
import { montoEfectivo } from "@/types/pagos";
import { filtrarEventos } from "@/lib/eventos";

const MESES_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ESTADO_COLORS: Record<EventoEstado, string> = {
  pendiente:  "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  cotizacion: "bg-blue-900/40 text-blue-300 border-blue-700",
  confirmado: "bg-green-900/40 text-green-300 border-green-700",
  en_curso:   "bg-purple-900/40 text-purple-300 border-purple-700",
  completado: "bg-gray-700/60 text-gray-300 border-gray-600",
  cancelado:  "bg-red-900/40 text-red-300 border-red-700",
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
  const [mesFilter, setMesFilter] = useState<number | "">("");
  const [añoFilter, setAñoFilter] = useState<number | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (estadoFilter) params.set("estado", estadoFilter);

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
  }, [estadoFilter, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // Distinct years present in the loaded data, ascending
  const años = useMemo(
    () =>
      Array.from(
        new Set(eventos.map((e) => new Date(e.fecha_evento).getFullYear()))
      ).sort((a, b) => a - b),
    [eventos]
  );

  // Apply mes/año filter client-side (avoids UTC→local conversion issues with API ranges)
  const eventosFiltrados = useMemo(
    () => filtrarEventos(eventos, mesFilter, añoFilter),
    [eventos, mesFilter, añoFilter]
  );

  function handleLimpiar() {
    setEstadoFilter("");
    setMesFilter("");
    setAñoFilter("");
  }

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

        <select
          className="input max-w-[150px]"
          value={mesFilter}
          onChange={(e) => setMesFilter(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Todos los meses</option>
          {MESES_LABEL.map((label, i) => (
            <option key={i + 1} value={i + 1}>{label}</option>
          ))}
        </select>

        <select
          className="input max-w-[120px]"
          value={añoFilter}
          onChange={(e) => setAñoFilter(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Todos los años</option>
          {años.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <button
          onClick={handleLimpiar}
          className="rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors"
        >
          Limpiar
        </button>
      </div>

      {eventosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 py-12 text-center text-sm text-gray-500">
          No hay eventos para los filtros seleccionados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Cumpleaños</th>
                <th className="px-4 py-3">Paquete</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {eventosFiltrados.map((ev) => (
                <tr key={ev.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                    {formatFechaHora(ev.fecha_evento)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{ev.cliente?.nombre ?? "—"}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{ev.nombre_festejado}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{ev.paquete?.nombre ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[ev.estado]}`}
                    >
                      {ev.estado.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-white">
                    {formatMoneda(ev.precio_total)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {(() => {
                      const saldo = ev.precio_total - (ev.pagos ?? []).reduce((s, p) => s + montoEfectivo(p), 0);
                      return (
                        <span className={saldo > 0 ? "text-red-400" : "text-green-400"}>
                          {formatMoneda(saldo)}
                        </span>
                      );
                    })()}
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
