"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DEFAULT_TEMPLATE,
  TEMPLATE_VARIABLES,
} from "@/lib/cumpleanos";
import type { CampaniaTarget } from "@/types/notificaciones";
import type { NotificacionCanal } from "@/types/notificaciones";

// ── Sub-components ────────────────────────────────────────────────────────────

function DiaBadge({ dias }: { dias: number }) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (dias === 0) return <span className={`${base} bg-purple-900/60 text-purple-300`}>¡Hoy!</span>;
  if (dias <= 7)  return <span className={`${base} bg-red-900/60 text-red-300`}>{dias}d</span>;
  if (dias <= 30) return <span className={`${base} bg-amber-900/60 text-amber-300`}>{dias}d</span>;
  return <span className={`${base} bg-gray-700 text-gray-400`}>{dias}d</span>;
}

function CanalIcon({ tiene, tipo }: { tiene: boolean; tipo: "wa" | "email" }) {
  const icon = tipo === "wa" ? "📱" : "✉️";
  return (
    <span title={tiene ? "Disponible" : "Sin dato"} className={tiene ? "opacity-100" : "opacity-25"}>
      {icon}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CampaniaCumpleanos() {
  const [dias, setDias] = useState(60);
  const [canal, setCanal] = useState<NotificacionCanal>("whatsapp");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [targets, setTargets] = useState<CampaniaTarget[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ enviados: number; omitidos: number; errores: string[] } | null>(null);

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const fetchTargets = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/campanias/cumpleanos?dias=${dias}`);
      if (!res.ok) throw new Error("Error al cargar los destinatarios");
      const data = await res.json();
      setTargets(data.targets ?? []);
      // Auto-select: everyone WITHOUT a future event AND with at least one contact channel
      const autoSelected = new Set<string>(
        (data.targets as CampaniaTarget[])
          .filter(
            (t) =>
              !t.tiene_evento_futuro &&
              ((canal === "whatsapp" && t.cliente_telefono) ||
                (canal === "email" && t.cliente_email) ||
                (canal === "ambos" && (t.cliente_telefono || t.cliente_email)))
          )
          .map((t) => t.hijo_id)
      );
      setSelected(autoSelected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [dias, canal]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  // ── Selection helpers ───────────────────────────────────────────────────────
  function toggleAll() {
    const contactable = targets.filter((t) => hasContact(t));
    if (selected.size === contactable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contactable.map((t) => t.hijo_id)));
    }
  }

  function hasContact(t: CampaniaTarget): boolean {
    if (canal === "whatsapp") return !!t.cliente_telefono;
    if (canal === "email") return !!t.cliente_email;
    return !!(t.cliente_telefono || t.cliente_email);
  }

  function toggleTarget(hijoId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(hijoId)) next.delete(hijoId);
      else next.add(hijoId);
      return next;
    });
  }

  // ── Preview ─────────────────────────────────────────────────────────────────
  function previewMessage(t: CampaniaTarget): string {
    return template
      .replace(/\{\{nombre_cliente\}\}/g, t.cliente_nombre)
      .replace(/\{\{nombre_hijo\}\}/g, t.hijo_nombre)
      .replace(/\{\{dias_hasta_cumple\}\}/g, String(t.dias_hasta_cumple))
      .replace(/\{\{fecha_cumple\}\}/g, formatDate(t.fecha_nacimiento));
  }

  function formatDate(iso: string): string {
    const [, mm, dd] = iso.split("-").map(Number);
    return new Date(2026, mm - 1, dd).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
    });
  }

  // ── Send ────────────────────────────────────────────────────────────────────
  async function handleSend() {
    if (selected.size === 0) return;
    setSending(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/campanias/cumpleanos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hijo_ids: Array.from(selected),
        template,
        canal,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error al enviar la campaña");
    } else {
      setResult(data);
      // Refresh list after sending
      await fetchTargets();
    }
    setSending(false);
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const sinEvento = targets.filter((t) => !t.tiene_evento_futuro).length;
  const contactables = targets.filter(hasContact).length;

  return (
    <div className="space-y-6">

      {/* ── Result / Error banners ─────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-lg border border-green-700 bg-green-900/30 px-4 py-3 text-sm text-green-300 space-y-1">
          <p className="font-semibold">
            ✅ Campaña enviada — {result.enviados} mensaje{result.enviados !== 1 ? "s" : ""} enviado{result.enviados !== 1 ? "s" : ""}
          </p>
          {result.omitidos > 0 && <p className="text-gray-400">{result.omitidos} omitido(s) (sin datos de contacto o desuscriptos)</p>}
          {result.errores.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-red-400">{result.errores.length} error(es)</summary>
              <ul className="mt-1 space-y-0.5 text-xs text-red-300">
                {result.errores.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Cumpleaños en ventana", value: targets.length, color: "text-white" },
          { label: "Sin evento reservado", value: sinEvento, color: "text-amber-400" },
          { label: "Con datos de contacto", value: contactables, color: "text-green-400" },
          { label: "Seleccionados", value: selected.size, color: "text-indigo-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Configuration panel ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 space-y-5">
        <h3 className="text-sm font-semibold text-white">Configuración de la campaña</h3>

        <div className="flex flex-wrap gap-6">
          {/* Days window */}
          <div>
            <label className="label mb-2">Ventana de búsqueda</label>
            <div className="flex gap-2">
              {[15, 30, 45, 60, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDias(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    dias === d
                      ? "bg-indigo-600 text-white"
                      : "border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
                  }`}
                >
                  {d} días
                </button>
              ))}
            </div>
          </div>

          {/* Canal */}
          <div>
            <label className="label mb-2">Canal de envío</label>
            <div className="flex gap-2">
              {(["whatsapp", "email", "ambos"] as NotificacionCanal[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCanal(c)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    canal === c
                      ? "bg-indigo-600 text-white"
                      : "border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
                  }`}
                >
                  {c === "whatsapp" ? "📱 WhatsApp" : c === "email" ? "✉️ Email" : "📱+✉️ Ambos"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Template editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label">Mensaje</label>
            <div className="flex gap-1.5">
              {TEMPLATE_VARIABLES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  title={label}
                  onClick={() => setTemplate((prev) => prev + ` {{${key}}}`)}
                  className="rounded bg-gray-800 border border-gray-700 px-2 py-0.5 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                >
                  {`{{${key}}}`}
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={6}
            className="input w-full font-mono text-sm resize-y"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          />
        </div>

        {/* Live preview */}
        {targets.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Vista previa (primer destinatario)</p>
            <div className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-xs text-gray-300 whitespace-pre-wrap font-mono">
              {previewMessage(targets[0])}
            </div>
          </div>
        )}
      </div>

      {/* ── Targets table ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Destinatarios</h3>
          <button
            type="button"
            onClick={fetchTargets}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
          >
            {loading ? "Cargando…" : "↻ Actualizar"}
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">Cargando destinatarios…</div>
        ) : targets.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            No hay cumpleaños en los próximos {dias} días.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800 bg-gray-900/60">
                <tr className="text-left text-xs text-gray-400">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === contactables}
                      ref={(el) => {
                        if (el) el.indeterminate = selected.size > 0 && selected.size < contactables;
                      }}
                      onChange={toggleAll}
                      className="rounded border-gray-600 bg-gray-800 accent-indigo-500"
                    />
                  </th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Festejado</th>
                  <th className="px-4 py-3 text-center">Cumple</th>
                  <th className="px-4 py-3 text-center">Días</th>
                  <th className="px-4 py-3 text-center">Evento</th>
                  <th className="px-4 py-3 text-center">Contacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {targets.map((t) => {
                  const canContact = hasContact(t);
                  const isSelected = selected.has(t.hijo_id);
                  return (
                    <tr
                      key={t.hijo_id}
                      onClick={() => canContact && toggleTarget(t.hijo_id)}
                      className={`transition-colors ${
                        canContact ? "cursor-pointer hover:bg-gray-800/40" : "opacity-50"
                      } ${isSelected ? "bg-indigo-950/30" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!canContact}
                          onChange={() => toggleTarget(t.hijo_id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-600 bg-gray-800 accent-indigo-500 disabled:opacity-30"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{t.cliente_nombre}</td>
                      <td className="px-4 py-3 text-gray-300">{t.hijo_nombre}</td>
                      <td className="px-4 py-3 text-center text-gray-400 text-xs">
                        {formatDate(t.fecha_nacimiento)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DiaBadge dias={t.dias_hasta_cumple} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.tiene_evento_futuro ? (
                          <span className="inline-flex items-center rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-400">
                            ✓ Reservado
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                            Sin reserva
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-center">
                          <CanalIcon tiene={!!t.cliente_telefono} tipo="wa" />
                          <CanalIcon tiene={!!t.cliente_email} tipo="email" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Action bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-gray-800 pt-4">
        <div className="text-sm text-gray-400">
          {selected.size === 0 ? (
            <span>Ningún destinatario seleccionado</span>
          ) : (
            <span>
              <span className="text-white font-medium">{selected.size}</span> destinatario{selected.size !== 1 ? "s" : ""} seleccionado{selected.size !== 1 ? "s" : ""}
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="ml-3 text-xs text-gray-500 hover:text-white transition-colors"
              >
                Limpiar
              </button>
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={selected.size === 0 || sending}
          onClick={handleSend}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {sending
            ? "Enviando…"
            : `Enviar campaña a ${selected.size} destinatario${selected.size !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
