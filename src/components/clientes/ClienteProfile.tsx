"use client";

import { useEffect, useState } from "react";
import type { ClientePerfil } from "@/types/clientes";
import type { Hijo } from "@/types/hijos";
import ClienteForm from "./ClienteForm";
import HijoForm from "@/components/hijos/HijoForm";
import { formatFecha, formatDiaMes } from "@/lib/fecha";
import { formatMoneda } from "@/lib/moneda";

interface ClienteProfileProps {
  clienteId: string;
}

const ESTADO_COLORS: Record<string, string> = {
  cotizacion: "bg-yellow-500/20 text-yellow-400",
  confirmado: "bg-green-500/20 text-green-400",
  en_curso: "bg-blue-500/20 text-blue-400",
  completado: "bg-gray-600/50 text-gray-400",
  cancelado: "bg-red-500/20 text-red-400",
};

export default function ClienteProfile({ clienteId }: ClienteProfileProps) {
  const [perfil, setPerfil] = useState<ClientePerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCliente, setEditingCliente] = useState(false);
  const [hijoEditing, setHijoEditing] = useState<Hijo | null>(null);
  const [showHijoForm, setShowHijoForm] = useState(false);

  async function fetchPerfil() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clientes/${clienteId}`);
      if (!res.ok) throw new Error("Cliente no encontrado");
      const data: ClientePerfil = await res.json();
      setPerfil(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPerfil();
  }, [clienteId]);

  async function handleDeleteHijo(hijoId: string) {
    if (!confirm("¿Eliminar este hijo/a?")) return;
    const res = await fetch(`/api/hijos/${hijoId}`, { method: "DELETE" });
    if (res.ok) {
      setPerfil((prev) =>
        prev ? { ...prev, hijos: prev.hijos.filter((h) => h.id !== hijoId) } : null
      );
    }
  }

  function handleEditHijo(hijo: Hijo) {
    setHijoEditing(hijo);
    setShowHijoForm(true);
  }

  if (loading) return <p className="text-gray-500 text-sm">Cargando perfil…</p>;
  if (error || !perfil)
    return (
      <p className="text-red-400 text-sm">{error ?? "Error al cargar perfil"}</p>
    );

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{perfil.nombre}</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
              {perfil.telefono && <span>📞 {perfil.telefono}</span>}
              {perfil.email && <span>✉️ {perfil.email}</span>}
              {perfil.fecha_cumpleanos && (
                <span>🎂 {formatDiaMes(perfil.fecha_cumpleanos)}</span>
              )}
            </div>
            {perfil.notas && (
              <p className="mt-2 text-sm text-gray-500">{perfil.notas}</p>
            )}
          </div>
          <button
            onClick={() => setEditingCliente(true)}
            className="shrink-0 text-sm rounded-lg border border-gray-600 text-gray-300 hover:border-indigo-500 hover:text-indigo-400 px-3 py-1.5 transition-colors"
          >
            Editar
          </button>
        </div>
      </div>

      {/* ── Hijos ── */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-700 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Hijos/as</h3>
          <button
            onClick={() => { setHijoEditing(null); setShowHijoForm(true); }}
            className="text-sm rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 px-3 py-1.5 transition-colors"
          >
            + Agregar
          </button>
        </div>

        {perfil.hijos.length === 0 ? (
          <p className="text-sm text-gray-500">Sin hijos/as registrados.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {perfil.hijos.map((h) => {
              const edad = Math.floor(
                (Date.now() - new Date(h.fecha_nacimiento + "T12:00:00").getTime()) /
                  (365.25 * 24 * 3600 * 1000)
              );
              return (
                <li key={h.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{h.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {edad} años ·{" "}
                      {formatFecha(h.fecha_nacimiento)}
                      {h.colegio && <> · {h.colegio}</>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditHijo(h)}
                      className="text-xs text-gray-400 hover:text-indigo-400 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteHijo(h.id)}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Eventos ── */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-700 space-y-4">
        <h3 className="font-semibold text-white">Historial de eventos</h3>

        {perfil.eventos.length === 0 ? (
          <p className="text-sm text-gray-500">Sin eventos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                  <th className="pb-2 font-medium">Festejado/a</th>
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Paquete</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {perfil.eventos.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-2.5 text-white">{ev.nombre_festejado}</td>
                    <td className="py-2.5 text-gray-400">
                      {formatFecha(ev.fecha_evento)}
                    </td>
                    <td className="py-2.5 text-gray-400">
                      {ev.paquete?.nombre ?? "—"}
                    </td>
                    <td className="py-2.5 text-gray-400 text-right">
                      {formatMoneda(ev.precio_total)}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          ESTADO_COLORS[ev.estado] ?? "bg-gray-600/50 text-gray-400"
                        }`}
                      >
                        {ev.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {editingCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md">
            <ClienteForm
              cliente={perfil}
              onClose={(saved) => {
                setEditingCliente(false);
                if (saved) fetchPerfil();
              }}
            />
          </div>
        </div>
      )}

      {showHijoForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm">
            <HijoForm
              clienteId={clienteId}
              hijo={hijoEditing}
              onClose={(saved) => {
                setShowHijoForm(false);
                setHijoEditing(null);
                if (saved) fetchPerfil();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
