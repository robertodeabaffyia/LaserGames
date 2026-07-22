"use client";

import { useState, useEffect } from "react";
import type { NotificacionConfig } from "@/types/notificaciones";
import { NOTIFICACION_TIPO_LABELS, CANAL_LABELS } from "@/types/notificaciones";
import NotificacionConfigForm from "./NotificacionConfigForm";

export default function NotificacionesList() {
  const [configs, setConfigs] = useState<NotificacionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<NotificacionConfig | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/notificaciones-config");
    const data = await res.json();
    setConfigs(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  // Deferred a tick so the loader's setState isn't called synchronously
  // inside the effect (react-hooks/set-state-in-effect); clearTimeout also
  // guards against setState after unmount.
  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, []);

  async function toggleHabilitada(config: NotificacionConfig) {
    await fetch(`/api/notificaciones-config/${config.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habilitada: !config.habilitada }),
    });
    load();
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-gray-400">Cargando…</div>;
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <h3 className="text-base font-semibold text-white mb-5">
          Editar: {NOTIFICACION_TIPO_LABELS[editing.tipo]}
        </h3>
        <NotificacionConfigForm
          config={editing}
          onSaved={() => { setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {configs.map((cfg) => (
        <div
          key={cfg.id}
          className={`rounded-xl border p-5 transition-colors ${
            cfg.habilitada ? "border-gray-800 bg-gray-900/50" : "border-gray-800/50 bg-gray-900/20 opacity-60"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">
                  {NOTIFICACION_TIPO_LABELS[cfg.tipo]}
                </h3>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    cfg.habilitada
                      ? "bg-green-900/40 text-green-400"
                      : "bg-gray-700/40 text-gray-500"
                  }`}
                >
                  {cfg.habilitada ? "Activa" : "Inactiva"}
                </span>
              </div>
              <p className="text-xs text-gray-400">{cfg.descripcion}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>Canal: <span className="text-gray-300">{CANAL_LABELS[cfg.canal]}</span></span>
                <span>
                  Anticipación:{" "}
                  <span className="text-gray-300">
                    {cfg.dias_anticipacion === 0
                      ? "Inmediata"
                      : `${cfg.dias_anticipacion} día${cfg.dias_anticipacion !== 1 ? "s" : ""}`}
                  </span>
                </span>
              </div>
              <div className="mt-2 rounded-lg bg-gray-800/50 px-3 py-2 text-xs font-mono text-gray-400 line-clamp-2">
                {cfg.contenido_template}
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => setEditing(cfg)}
                className="rounded-lg border border-gray-700 hover:border-gray-500 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => toggleHabilitada(cfg)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  cfg.habilitada
                    ? "border-red-800 text-red-400 hover:bg-red-900/20"
                    : "border-green-800 text-green-400 hover:bg-green-900/20"
                }`}
              >
                {cfg.habilitada ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        </div>
      ))}

      {configs.length === 0 && (
        <div className="rounded-xl border border-gray-800 py-10 text-center text-sm text-gray-500">
          No hay configuraciones de notificaciones.
        </div>
      )}
    </div>
  );
}
