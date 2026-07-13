"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatFecha, formatHora } from "@/lib/fecha";
import { formatMoneda } from "@/lib/moneda";

interface ReservaProxima {
  id: string;
  fecha: string;
  hora_inicio: string;
  estado: "pendiente_sena" | "reservada" | "completada";
  cantidad_personas: number;
  precio_total: number;
  sala: { nombre: string } | null;
  contacto: { nombre: string; telefono: string | null } | null;
}

interface EscapeData {
  total: number;
  reservas: ReservaProxima[];
}

const ESTADO_COLORS: Record<string, string> = {
  pendiente_sena: "bg-amber-500/20 text-amber-400",
  reservada: "bg-yellow-500/20 text-yellow-400",
  completada: "bg-green-500/20 text-green-400",
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente_sena: "pendiente seña",
  reservada: "reservada",
  completada: "completada",
};

export default function EscapeReservasWidget() {
  const [data, setData] = useState<EscapeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/escape-proximas")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ total: 0, reservas: [] }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-700 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🗝️</span>
        <h3 className="font-semibold text-white">Reservas Escape</h3>
        {!loading && (data?.total ?? 0) > 0 && (
          <span className="ml-auto text-xs bg-indigo-600 text-white rounded-full px-2 py-0.5">
            {data!.total}
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando…</p>}

      {!loading && (data?.total ?? 0) === 0 && (
        <p className="text-sm text-gray-500">Sin reservas próximas.</p>
      )}

      {!loading &&
        data?.reservas.slice(0, 6).map((r) => (
          <div
            key={r.id}
            className="flex items-start justify-between gap-2 py-2 border-b border-gray-800 last:border-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {r.contacto?.nombre ?? "—"}
              </p>
              <p className="text-xs text-gray-500">
                {r.sala?.nombre ?? "—"} · {formatFecha(r.fecha)} {formatHora(`2000-01-01T${r.hora_inicio}`)} hs
              </p>
              <p className="text-xs text-gray-600">{r.cantidad_personas} personas</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  ESTADO_COLORS[r.estado] ?? "bg-gray-600/50 text-gray-400"
                }`}
              >
                {ESTADO_LABELS[r.estado] ?? r.estado}
              </span>
              <span className="text-xs text-gray-400">{formatMoneda(r.precio_total)}</span>
            </div>
          </div>
        ))}

      {!loading && (data?.total ?? 0) > 0 && (
        <Link
          href="/dashboard/escape/reservas"
          className="block text-center text-xs text-indigo-400 hover:text-indigo-300 pt-1"
        >
          Ver todas →
        </Link>
      )}
    </div>
  );
}
