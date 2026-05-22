"use client";

import { useState } from "react";
import type { Hijo, HijoInsert } from "@/types/hijos";

interface HijoFormProps {
  clienteId: string;
  hijo?: Hijo | null;
  onClose: (saved: boolean) => void;
}

export default function HijoForm({ clienteId, hijo, onClose }: HijoFormProps) {
  const isEdit = !!hijo;

  const [nombre, setNombre] = useState(hijo?.nombre ?? "");
  const [fechaNacimiento, setFechaNacimiento] = useState(
    hijo?.fecha_nacimiento ?? ""
  );
  const [colegio, setColegio] = useState(hijo?.colegio ?? "");
  const [notas, setNotas] = useState(hijo?.notas ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: HijoInsert = {
      cliente_id: clienteId,
      nombre,
      fecha_nacimiento: fechaNacimiento,
      colegio: colegio || null,
      notas: notas || null,
    };

    try {
      const url = isEdit ? `/api/hijos/${hijo.id}` : "/api/hijos";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { nombre, fecha_nacimiento: fechaNacimiento, colegio: colegio || null, notas: notas || null }
            : payload
        ),
      });

      if (!res.ok) {
        const body: { error?: string } = await res.json();
        throw new Error(body.error ?? "Error al guardar");
      }

      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 rounded-2xl p-6 shadow-xl space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          {isEdit ? "Editar hijo/a" : "Agregar hijo/a"}
        </h2>
        <button
          type="button"
          onClick={() => onClose(false)}
          className="text-gray-500 hover:text-gray-300 text-xl"
        >
          ✕
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label className="label">Nombre *</label>
        <input
          required
          className="input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Fecha de nacimiento *</label>
        <input
          required
          type="date"
          className="input"
          value={fechaNacimiento}
          onChange={(e) => setFechaNacimiento(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Colegio</label>
        <input
          type="text"
          className="input"
          placeholder="Nombre del colegio…"
          value={colegio}
          onChange={(e) => setColegio(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Notas</label>
        <textarea
          rows={2}
          className="input resize-none"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => onClose(false)}
          className="flex-1 rounded-lg border border-gray-600 text-gray-300 hover:border-gray-400 py-2.5 text-sm transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition-colors"
        >
          {submitting ? "Guardando…" : isEdit ? "Guardar" : "Agregar"}
        </button>
      </div>
    </form>
  );
}
