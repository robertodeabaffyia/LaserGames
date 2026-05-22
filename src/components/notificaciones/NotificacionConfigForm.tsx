"use client";

import { useState, useRef } from "react";
import type { NotificacionConfig, NotificacionCanal } from "@/types/notificaciones";
import { CANAL_LABELS } from "@/types/notificaciones";

interface NotificacionConfigFormProps {
  config: NotificacionConfig;
  onSaved: () => void;
  onCancel: () => void;
}

const CANAL_OPTIONS: NotificacionCanal[] = ["email", "whatsapp", "ambos"];

export default function NotificacionConfigForm({
  config,
  onSaved,
  onCancel,
}: NotificacionConfigFormProps) {
  const [form, setForm] = useState({
    descripcion: config.descripcion,
    habilitada: config.habilitada,
    canal: config.canal,
    dias_anticipacion: String(config.dias_anticipacion),
    contenido_template: config.contenido_template,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /** Insert {{varname}} at cursor position in textarea */
  function insertVariable(varName: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = form.contenido_template.slice(0, start);
    const after = form.contenido_template.slice(end);
    const insertion = `{{${varName}}}`;
    const newValue = before + insertion + after;
    set("contenido_template", newValue);
    // Restore cursor after insertion
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + insertion.length;
      ta.focus();
    });
  }

  /** Replace variables in preview */
  function buildPreview(): string {
    const sampleVars: Record<string, string> = {
      nombre_cliente: "Ana García",
      nombre_festejado: "Pepito",
      nombre_hijo: "Sofía",
      fecha_evento: "15 de junio de 2026",
      hora_evento: "16:00",
      nombre_paquete: "Paquete Gold",
      fecha_nacimiento: "2020-05-28",
      dias_hasta_cumpleanos: "7",
      monto_pagado: "$2,000.00",
      saldo_pendiente: "$3,000.00",
    };
    return form.contenido_template.replace(
      /\{\{(\w+)\}\}/g,
      (_, k) => `<mark class="bg-yellow-900/40 text-yellow-300 px-0.5 rounded">${sampleVars[k] ?? k}</mark>`
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const dias = parseInt(form.dias_anticipacion, 10);
    if (isNaN(dias) || dias < 0) {
      setError("Días de anticipación debe ser un número ≥ 0");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/notificaciones-config/${config.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descripcion: form.descripcion,
        habilitada: form.habilitada,
        canal: form.canal,
        dias_anticipacion: dias,
        contenido_template: form.contenido_template,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
      setLoading(false);
      return;
    }

    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Meta fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Descripción *</label>
          <input
            type="text"
            className="input"
            required
            value={form.descripcion}
            onChange={(e) => set("descripcion", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Canal *</label>
          <select
            className="input"
            value={form.canal}
            onChange={(e) => set("canal", e.target.value as NotificacionCanal)}
          >
            {CANAL_OPTIONS.map((c) => (
              <option key={c} value={c}>{CANAL_LABELS[c]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Días de anticipación *</label>
          <input
            type="number"
            className="input"
            min="0"
            step="1"
            value={form.dias_anticipacion}
            onChange={(e) => set("dias_anticipacion", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="habilitada"
          type="checkbox"
          className="rounded border-gray-600"
          checked={form.habilitada}
          onChange={(e) => set("habilitada", e.target.checked)}
        />
        <label htmlFor="habilitada" className="text-sm text-gray-300">
          Habilitada
        </label>
      </div>

      {/* Template editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Plantilla de contenido *</label>
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {preview ? "✎ Editar" : "👁 Vista previa"}
          </button>
        </div>

        {preview ? (
          <div
            className="min-h-[120px] rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2.5 text-sm text-gray-200 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: buildPreview() }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            required
            rows={5}
            className="input resize-none font-mono text-sm"
            value={form.contenido_template}
            onChange={(e) => set("contenido_template", e.target.value)}
          />
        )}

        {/* Variables picker */}
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1.5">Variables disponibles (click para insertar):</p>
          <div className="flex flex-wrap gap-1.5">
            {config.variables_disponibles.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="rounded border border-indigo-800 bg-indigo-900/30 px-2 py-0.5 text-xs font-mono text-indigo-300 hover:bg-indigo-800/50 transition-colors"
              >
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white transition-colors"
        >
          {loading ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
