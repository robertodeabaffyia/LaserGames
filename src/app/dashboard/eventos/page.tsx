"use client";

import { useState, useEffect } from "react";
import EventoForm from "@/components/eventos/EventoForm";
import EventoList from "@/components/eventos/EventoList";
import CalendarioMes from "@/components/eventos/CalendarioMes";
import CalendarioSemana from "@/components/eventos/CalendarioSemana";
import CalendarioDia from "@/components/eventos/CalendarioDia";
import type { EventoConRelaciones } from "@/types/eventos";

type Vista = "lista" | "mes" | "semana" | "dia";

export default function EventosPage() {
  const [vista, setVista] = useState<Vista>("lista");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<EventoConRelaciones | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [allEventos, setAllEventos] = useState<EventoConRelaciones[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Load all events for calendar views
  useEffect(() => {
    if (vista !== "lista") {
      fetch("/api/eventos")
        .then((r) => r.json())
        .then((d) => setAllEventos(d ?? []));
    }
  }, [vista, refreshKey]);

  function handleSuccess() {
    setShowForm(false);
    setEditando(null);
    setRefreshKey((k) => k + 1);
  }

  function handleEdit(evento: EventoConRelaciones) {
    setEditando(evento);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este evento?")) return;
    await fetch(`/api/eventos/${id}`, { method: "DELETE" });
    setRefreshKey((k) => k + 1);
  }

  const VISTAS: { key: Vista; label: string }[] = [
    { key: "lista", label: "Lista" },
    { key: "mes", label: "Mes" },
    { key: "semana", label: "Semana" },
    { key: "dia", label: "Día" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Eventos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Gestión de fiestas y reservaciones
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditando(null); setShowForm(true); }}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            + Nuevo evento
          </button>
        )}
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/60 p-6">
          <h2 className="text-lg font-semibold text-white mb-5">
            {editando ? "Editar evento" : "Nuevo evento"}
          </h2>
          <EventoForm
            evento={editando ?? undefined}
            onSuccess={handleSuccess}
            onCancel={() => { setShowForm(false); setEditando(null); }}
          />
        </div>
      )}

      {/* View switcher */}
      <div className="flex gap-1 mb-5 rounded-lg border border-gray-800 bg-gray-900/50 p-1 w-fit">
        {VISTAS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setVista(key)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              vista === key
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Views */}
      {vista === "lista" && (
        <EventoList
          onEdit={handleEdit}
          onDelete={handleDelete}
          refreshKey={refreshKey}
        />
      )}

      {vista === "mes" && (
        <CalendarioMes
          eventos={allEventos}
          onSelectDay={(d) => { setSelectedDay(d); setVista("dia"); }}
        />
      )}

      {vista === "semana" && (
        <CalendarioSemana
          eventos={allEventos}
          onSelectEvento={handleEdit}
        />
      )}

      {vista === "dia" && (
        <CalendarioDia
          eventos={allEventos}
          initialDate={selectedDay ?? undefined}
          onSelectEvento={handleEdit}
        />
      )}
    </div>
  );
}
