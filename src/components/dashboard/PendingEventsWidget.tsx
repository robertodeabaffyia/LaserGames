"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatFecha } from "@/lib/fecha";

interface EventoPendiente {
  id: string;
  fecha_evento: string;
  estado: "cotizacion" | "confirmado";
  nombre_festejado: string;
  precio_total: number;
  cliente: { id: string; nombre: string; telefono: string | null } | null;
  paquete: { nombre: string } | null;
}

interface PendingData {
  total: number;
  eventos: EventoPendiente[];
}

const ESTADO_COLORS: Record<string, string> = {
  cotizacion: "bg-yellow-500/20 text-yellow-400",
  confirmado: "bg-green-500/20 text-green-400",
};

export default function PendingEventsWidget() {
  const [data, setData] = useState<PendingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/eventos-pendientes")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ total: 0, eventos: [] }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-700 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">📅</span>
        <h3 className="font-semibold text-white">Eventos pendientes</h3>
        {!loading && (data?.total ?? 0) > 0 && (
          <span className="ml-auto text-xs bg-indigo-600 text-white rounded-full px-2 py-0.5">
            {data!.total}
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando…</p>}

      {!loading && (data?.total ?? 0) === 0 && (
        <p className="text-sm text-gray-500">Sin eventos pendientes.</p>
      )}

      {!loading &&
        data?.eventos.map((ev) => {
          const fecha = formatFecha(ev.fecha_evento);
          return (
            <div
              key={ev.id}
              className="flex items-start justify-between gap-2 py-2 border-b border-gray-800 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {ev.nombre_festejado}
                </p>
                <p className="text-xs text-gray-500">
                  {ev.cliente?.nombre} · {fecha}
                </p>
                {ev.paquete && (
                  <p className="text-xs text-gray-600 truncate">{ev.paquete.nombre}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    ESTADO_COLORS[ev.estado] ?? "bg-gray-600/50 text-gray-400"
                  }`}
                >
                  {ev.estado}
                </span>
                <span className="text-xs text-gray-400">
                  ${ev.precio_total.toLocaleString("es-MX")}
                </span>
              </div>
            </div>
          );
        })}

      {!loading && (data?.total ?? 0) > 0 && (
        <Link
          href="/dashboard/eventos"
          className="block text-center text-xs text-indigo-400 hover:text-indigo-300 pt-1"
        >
          Ver todos →
        </Link>
      )}
    </div>
  );
}
