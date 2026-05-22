"use client";

import { useEffect, useState } from "react";
import type { BirthdayEntry } from "@/lib/birthday";

interface BirthdayData {
  esta_semana: BirthdayEntry[];
  proximo_mes: BirthdayEntry[];
}

function BirthdayRow({ entry }: { entry: BirthdayEntry }) {
  const label =
    entry.dias_restantes === 0
      ? "¡Hoy! 🎉"
      : entry.dias_restantes === 1
      ? "Mañana"
      : `En ${entry.dias_restantes} días`;

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{entry.nombre}</p>
        {entry.tipo === "hijo" && entry.cliente_nombre && (
          <p className="text-xs text-gray-500">hijo/a de {entry.cliente_nombre}</p>
        )}
      </div>
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          entry.dias_restantes === 0
            ? "bg-yellow-500/20 text-yellow-400"
            : entry.dias_restantes <= 3
            ? "bg-orange-500/20 text-orange-400"
            : "bg-indigo-500/20 text-indigo-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function BirthdayWidget() {
  const [data, setData] = useState<BirthdayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/cumpleanos")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ esta_semana: [], proximo_mes: [] }))
      .finally(() => setLoading(false));
  }, []);

  const total = (data?.esta_semana.length ?? 0) + (data?.proximo_mes.length ?? 0);

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-700 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎂</span>
        <h3 className="font-semibold text-white">Cumpleaños</h3>
        {!loading && total > 0 && (
          <span className="ml-auto text-xs bg-indigo-600 text-white rounded-full px-2 py-0.5">
            {total}
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando…</p>}

      {!loading && total === 0 && (
        <p className="text-sm text-gray-500">Sin cumpleaños próximos.</p>
      )}

      {!loading && (data?.esta_semana.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Esta semana
          </p>
          {data!.esta_semana.map((e) => (
            <BirthdayRow key={`${e.tipo}-${e.id}`} entry={e} />
          ))}
        </div>
      )}

      {!loading && (data?.proximo_mes.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Próximo mes
          </p>
          {data!.proximo_mes.map((e) => (
            <BirthdayRow key={`${e.tipo}-${e.id}`} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}
