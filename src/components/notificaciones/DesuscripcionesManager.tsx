"use client";

import { useState, useEffect } from "react";
import type { ClienteDesuscripcion, NotificacionTipo } from "@/types/notificaciones";
import { NOTIFICACION_TIPOS, NOTIFICACION_TIPO_LABELS } from "@/types/notificaciones";

interface DesuscripcionConCliente extends ClienteDesuscripcion {
  cliente?: { id: string; nombre: string };
}

export default function DesuscripcionesManager() {
  const [desuscripciones, setDesuscripciones] = useState<DesuscripcionConCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoFiltro, setTipoFiltro] = useState<NotificacionTipo | "">("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (tipoFiltro) params.set("tipo", tipoFiltro);
    const res = await fetch(`/api/desuscripciones?${params}`);
    const data = await res.json();
    setDesuscripciones(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [tipoFiltro]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleReactivar(d: DesuscripcionConCliente) {
    if (!confirm(`¿Reactivar notificaciones de "${NOTIFICACION_TIPO_LABELS[d.tipo_notificacion]}" para ${d.cliente?.nombre ?? d.cliente_id}?`)) return;
    await fetch(`/api/desuscripciones?cliente_id=${d.cliente_id}&tipo=${d.tipo_notificacion}`, {
      method: "DELETE",
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <label className="label">Filtrar por tipo</label>
          <select
            className="input max-w-[200px]"
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as NotificacionTipo | "")}
          >
            <option value="">Todos</option>
            {NOTIFICACION_TIPOS.map((t) => (
              <option key={t} value={t}>{NOTIFICACION_TIPO_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Cargando…</div>
      ) : desuscripciones.filter((d) => d.desuscrito).length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-10 text-center text-sm text-gray-500">
          No hay clientes desuscritos.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {desuscripciones
                .filter((d) => d.desuscrito)
                .map((d) => (
                  <tr key={d.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">
                      {d.cliente?.nombre ?? d.cliente_id}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {NOTIFICACION_TIPO_LABELS[d.tipo_notificacion]}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(d.updated_at).toLocaleDateString("es-MX")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleReactivar(d)}
                        className="text-xs text-green-400 hover:text-green-300 transition-colors"
                      >
                        Reactivar
                      </button>
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
