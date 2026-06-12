"use client";

import { useState, useEffect } from "react";
import { formatFecha } from "@/lib/fecha";
import { formatMoneda } from "@/lib/moneda";

interface EventoResumen {
  id: string;
  nombre_festejado: string;
  fecha_evento: string;
  estado: string;
  precio_total: number;
  total_pagado: number;
  saldo_pendiente: number;
}

interface Totales {
  total_eventos: number;
  total_precio: number;
  total_pagado: number;
  total_pendiente: number;
}

export default function PagosWidget() {
  const [totales, setTotales] = useState<Totales | null>(null);
  const [eventos, setEventos] = useState<EventoResumen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/pagos-resumen")
      .then((r) => r.json())
      .then((d) => {
        setTotales(d.totales);
        setEventos(d.eventos ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 animate-pulse h-48" />
    );
  }

  const pctCobrado =
    totales && totales.total_precio > 0
      ? Math.round((totales.total_pagado / totales.total_precio) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Estado de cobros</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Eventos activos ({totales?.total_eventos ?? 0})
          </p>
        </div>
        <span className="text-xs font-medium text-indigo-400">{pctCobrado}% cobrado</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${pctCobrado}%` }}
        />
      </div>

      {/* Summary numbers */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] text-gray-500">Total</p>
          <p className="text-sm font-semibold text-white">
            {formatMoneda(totales?.total_precio ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500">Cobrado</p>
          <p className="text-sm font-semibold text-green-400">
            {formatMoneda(totales?.total_pagado ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500">Pendiente</p>
          <p className="text-sm font-semibold text-yellow-400">
            {formatMoneda(totales?.total_pendiente ?? 0)}
          </p>
        </div>
      </div>

      {/* Top pending events */}
      {eventos.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-gray-800">
          {eventos.slice(0, 3).map((ev) => (
            <div
              key={ev.id}
              className="flex items-center justify-between text-xs"
            >
              <div className="min-w-0">
                <span className="truncate text-gray-200 font-medium">
                  {ev.nombre_festejado}
                </span>
                <span className="text-gray-500 ml-1.5">
                  {formatFecha(ev.fecha_evento)}
                </span>
              </div>
              <div className="text-right shrink-0 ml-3">
                {ev.saldo_pendiente > 0 ? (
                  <span className="text-yellow-400">
                    -{formatMoneda(ev.saldo_pendiente)}
                  </span>
                ) : (
                  <span className="text-green-400">✓ pagado</span>
                )}
              </div>
            </div>
          ))}
          {eventos.length > 3 && (
            <p className="text-[11px] text-gray-500 text-right">
              +{eventos.length - 3} más
            </p>
          )}
        </div>
      )}
    </div>
  );
}
