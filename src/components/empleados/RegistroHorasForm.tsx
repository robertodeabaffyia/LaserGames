"use client";

import { useState } from "react";

interface RegistroHorasFormProps {
  empleadoId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function RegistroHorasForm({
  empleadoId,
  onSuccess,
  onCancel,
}: RegistroHorasFormProps) {
  // Default fecha to today
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    fecha: today,
    hora_entrada: "08:00",
    hora_salida: "16:00",
    notas: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview of hours
  function minutesFrom(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }
  const diffMin = minutesFrom(form.hora_salida) - minutesFrom(form.hora_entrada);
  const horasPreview = diffMin > 0 ? (diffMin / 60).toFixed(2) : null;

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/registros-horas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empleado_id: empleadoId,
        fecha: form.fecha,
        hora_entrada: form.hora_entrada,
        hora_salida: form.hora_salida,
        notas: form.notas || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al registrar horas");
      setLoading(false);
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Fecha *</label>
          <input
            type="date"
            className="input"
            max={today}
            value={form.fecha}
            onChange={(e) => set("fecha", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Hora entrada *</label>
          <input
            type="time"
            className="input"
            value={form.hora_entrada}
            onChange={(e) => set("hora_entrada", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Hora salida *</label>
          <input
            type="time"
            className="input"
            value={form.hora_salida}
            onChange={(e) => set("hora_salida", e.target.value)}
            required
          />
        </div>
      </div>

      {horasPreview !== null && (
        <div className="text-sm text-gray-400">
          Horas a registrar:{" "}
          <span className="font-semibold text-white">{horasPreview}h</span>
        </div>
      )}

      {diffMin <= 0 && (
        <p className="text-xs text-red-400">
          La hora de salida debe ser posterior a la de entrada.
        </p>
      )}

      <div>
        <label className="label">Notas</label>
        <input
          type="text"
          className="input"
          placeholder="Tarea, observación…"
          value={form.notas}
          onChange={(e) => set("notas", e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || diffMin <= 0}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white transition-colors"
        >
          {loading ? "Guardando…" : "Registrar horas"}
        </button>
      </div>
    </form>
  );
}
