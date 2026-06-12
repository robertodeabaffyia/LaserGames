"use client";

import { useState } from "react";
import type { Cliente, ClienteInsert } from "@/types/clientes";
import { validarEmail, validarTelefono } from "@/lib/validaciones";

interface ClienteFormProps {
  cliente?: Cliente | null;
  /** Called with (true, savedCliente) on success, (false) on cancel. */
  onClose: (saved: boolean, cliente?: Cliente) => void;
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
  const [fieldErrors, setFieldErrors] = useState<{ nombre?: string; email?: string; telefono?: string }>({});

  function validate(): boolean {
    const errors: { nombre?: string; email?: string; telefono?: string } = {};

    if (!nombre.trim()) {
      errors.nombre = "El nombre es requerido";
    }
    if (email && !validarEmail(email)) {
      errors.email = "Formato de email inválido";
    }
    if (telefono && !validarTelefono(telefono)) {
      errors.telefono = "Debe tener 7–15 dígitos (ej. +54 9 387 1234567)";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

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

      const saved: Cliente = await res.json();
      onClose(true, saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  // Rendered as <div> intentionally — this component is used inside modals that
  // can themselves be inside another <form> (e.g. EventoForm). Nested <form>
  // elements are invalid HTML and break browser submit behaviour.
  return (
    <div className="bg-gray-900 rounded-2xl p-6 shadow-xl space-y-4">
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
          className={`input ${fieldErrors.nombre ? "border-red-500" : ""}`}
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            if (fieldErrors.nombre) setFieldErrors((p) => ({ ...p, nombre: undefined }));
          }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
        />
        {fieldErrors.nombre && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.nombre}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Teléfono</label>
          <input
            className={`input ${fieldErrors.telefono ? "border-red-500" : ""}`}
            type="tel"
            value={telefono}
            onChange={(e) => {
              setTelefono(e.target.value);
              if (fieldErrors.telefono) setFieldErrors((p) => ({ ...p, telefono: undefined }));
            }}
            placeholder="+54 9 387 1234567"
          />
          {fieldErrors.telefono && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.telefono}</p>
          )}
        </div>
        <div>
          <label className="label">Email</label>
          <input
            className={`input ${fieldErrors.email ? "border-red-500" : ""}`}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
          )}
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
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition-colors"
        >
          {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cliente"}
        </button>
      </div>
    </div>
  );
}
