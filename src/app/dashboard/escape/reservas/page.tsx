"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import ReservaForm from "@/components/escapeRoom/ReservaForm";
import ReservaList from "@/components/escapeRoom/ReservaList";
import AgendaDia from "@/components/escapeRoom/AgendaDia";
import ReservaEditModal from "@/components/escapeRoom/ReservaEditModal";
import ErrorBoundary from "@/components/ErrorBoundary";
import type { EscapeReservaConRelaciones } from "@/types/escapeRoom";

type Vista = "lista" | "agenda";

export default function EscapeReservasPage() {
  const [vista, setVista] = useState<Vista>("lista");
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<EscapeReservaConRelaciones | null>(null);

  function handleSuccess() {
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  function handleEditClose(saved: boolean) {
    setEditing(null);
    if (saved) setRefreshKey((k) => k + 1);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta reserva?")) return;
    await fetch(`/api/escape/reservas/${id}`, { method: "DELETE" });
    setRefreshKey((k) => k + 1);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Escape Room — Reservas</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Agenda de turnos por sala
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            + Nueva reserva
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/60 p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Nueva reserva</h2>
          <ReservaForm onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* View switcher */}
      <div className="flex gap-1 mb-5 rounded-lg border border-gray-800 bg-gray-900/50 p-1 w-fit">
        {(["lista", "agenda"] as Vista[]).map((v) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              vista === v ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {v === "lista" ? "Lista" : "Agenda del día"}
          </button>
        ))}
      </div>

      <ErrorBoundary>
        {vista === "lista" ? (
          <ReservaList onEdit={setEditing} onDelete={handleDelete} refreshKey={refreshKey} />
        ) : (
          <AgendaDia onEdit={setEditing} refreshKey={refreshKey} />
        )}
      </ErrorBoundary>

      {editing && <ReservaEditModal reserva={editing} onClose={handleEditClose} />}
    </div>
  );
}
