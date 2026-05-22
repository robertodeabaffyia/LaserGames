"use client";

import { useState } from "react";
import type { Cliente, ClienteInsert } from "@/types/clientes";

interface ClienteFormProps {
  cliente?: Cliente | null;
  onClose: (saved: boolean) => void;
}

export default function ClienteForm({ cliente, onClose }: ClienteFormProps) {
  const isEdit = !!cliente;

  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  const [telefono, setTelefono] = useState(cliente?.telefono ?? "");
  const [email, setEmail] = useState(cliente?.email ?? "");
  const [fechaCumpleanos, setFechaCumpleanos] = useState(
    cliente?.fecha_cumpleanos ?? ""
  );
  const [notas, setNotas] = useState(cliente?.notas ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: ClienteInsert = {
      nombre,
      telefono: telefono || null,
      email: email || null,
      fecha_cumpleanos: fechaCumpleanos || null,
      notas: notas || null,
    };

    try {
      const url = isEdit ? `/api/clientes/${cliente.id}` : "/api/clientes";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
          {isEdit ? "Editar cliente" : "Nuevo cliente"}
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Teléfono</label>
          <input
            className="input"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+52 55 0000 0000"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Fecha de cumpleaños</label>
        <input
          className="input"
          type="date"
          value={fechaCumpleanos}
          onChange={(e) => setFechaCumpleanos(e.target.value)}
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
          {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
