"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calcularHorasTrabajadas, formatearHoras, validarHorario } from "@/lib/registros-horas";
import { formatFecha, formatHora } from "@/lib/fecha";
import type { EmpleadoRol, UsuarioRol, DiaDashboard } from "@/types/empleados";

// ─── helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initials(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

type Status = "completo" | "falta_salida" | "sin_cargar";

function getStatus(entrada: string, salida: string): Status {
  if (!entrada) return "sin_cargar";
  if (!salida) return "falta_salida";
  return "completo";
}

const ROL_COLORS: Record<EmpleadoRol, string> = {
  administrador: "text-amber-400",
  supervisor: "text-blue-400",
  general: "text-gray-400",
};

const STATUS_BADGE: Record<Status, { label: string; cls: string }> = {
  completo:     { label: "Completo",     cls: "bg-green-900/40 text-green-400 border-green-700" },
  falta_salida: { label: "Falta salida", cls: "bg-amber-900/40 text-amber-400 border-amber-700" },
  sin_cargar:   { label: "Sin cargar",   cls: "bg-gray-800 text-gray-500 border-gray-700" },
};

// ─── row state ───────────────────────────────────────────────────────────────

type Fila = {
  empleadoId: string;
  nombre: string;
  rol: EmpleadoRol;
  tarifaHoraria: number | null;
  registroId: string | null;
  horaEntrada: string;
  horaSalida: string;
  eventoIds: string[];
  saving: boolean;
  savedOk: boolean;
  error: string | null;
};

function buildFilas(dashboard: DiaDashboard): Fila[] {
  return dashboard.filas.map(({ empleado, registro, evento_ids }) => ({
    empleadoId: empleado.id,
    nombre: empleado.nombre,
    rol: empleado.rol,
    tarifaHoraria: empleado.tarifa_horaria,
    registroId: registro?.id ?? null,
    horaEntrada: registro?.hora_entrada ?? "",
    horaSalida: registro?.hora_salida ?? "",
    eventoIds: evento_ids,
    saving: false,
    savedOk: false,
    error: null,
  }));
}

// ─── component ───────────────────────────────────────────────────────────────

export default function RegistrosHorasPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [filas, setFilas] = useState<Fila[]>([]);
  const [eventos, setEventos] = useState<DiaDashboard["eventos"]>([]);
  const [loading, setLoading] = useState(true);
  const [guardandoTodos, setGuardandoTodos] = useState(false);
  const loadedDate = useRef<string>("");

  // ── auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const { data } = await supabase
        .from("usuarios").select("rol").eq("id", user.id).single();
      const rol = (data?.rol ?? "general") as UsuarioRol;
      if (rol !== "admin" && rol !== "supervisor") { router.replace("/dashboard"); return; }
      setAuthChecked(true);
    });
  }, [router]);

  // ── load day ───────────────────────────────────────────────────────────────
  const loadDia = useCallback(async (d: Date) => {
    const fecha = toDateStr(d);
    if (loadedDate.current === fecha) return;
    loadedDate.current = fecha;
    setLoading(true);
    try {
      const res = await fetch(`/api/registros-horas?fecha=${fecha}`);
      if (!res.ok) throw new Error("Error al cargar");
      const data: DiaDashboard = await res.json();
      setFilas(buildFilas(data));
      setEventos(data.eventos);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    loadDia(date);
  }, [authChecked, date, loadDia]);

  // ── row helpers ────────────────────────────────────────────────────────────
  function updateFila(empleadoId: string, patch: Partial<Fila>) {
    setFilas((prev) =>
      prev.map((f) => (f.empleadoId === empleadoId ? { ...f, ...patch } : f))
    );
  }

  async function saveRow(fila: Fila) {
    if (!fila.horaEntrada) return;
    if (
      fila.horaSalida &&
      !validarHorario(fila.horaEntrada, fila.horaSalida)
    ) {
      updateFila(fila.empleadoId, { error: "Salida debe ser posterior a entrada" });
      return;
    }

    updateFila(fila.empleadoId, { saving: true, error: null, savedOk: false });
    try {
      if (fila.registroId) {
        const res = await fetch(`/api/registros-horas/${fila.registroId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hora_entrada: fila.horaEntrada,
            hora_salida: fila.horaSalida || null,
            evento_ids: fila.eventoIds,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Error al guardar");
      } else {
        const res = await fetch("/api/registros-horas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empleado_id: fila.empleadoId,
            fecha: toDateStr(date),
            hora_entrada: fila.horaEntrada,
            hora_salida: fila.horaSalida || null,
            evento_ids: fila.eventoIds,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Error al guardar");
        const created = await res.json();
        updateFila(fila.empleadoId, { registroId: created.id });
      }
      updateFila(fila.empleadoId, { saving: false, savedOk: true });
    } catch (err) {
      updateFila(fila.empleadoId, { saving: false, error: String(err) });
    }
  }

  async function guardarTodos() {
    setGuardandoTodos(true);
    const dirtyFilas = filas.filter((f) => f.horaEntrada);
    await Promise.all(dirtyFilas.map((f) => saveRow(f)));
    setGuardandoTodos(false);
  }

  // ── date navigation ────────────────────────────────────────────────────────
  function navigate(delta: number) {
    loadedDate.current = ""; // force reload
    setDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  function goToday() {
    loadedDate.current = "";
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setDate(d);
  }

  // ── summary ────────────────────────────────────────────────────────────────
  const conHoras = filas.filter((f) => f.horaEntrada).length;
  const pendientes = filas.filter((f) => f.horaEntrada && !f.horaSalida).length;

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Verificando permisos…
      </div>
    );
  }

  const isToday = toDateStr(date) === toDateStr(new Date());

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Registros de Horas</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatFecha(date)}
            {isToday && <span className="ml-2 text-indigo-400 font-medium">Hoy</span>}
          </p>
        </div>

        {/* Day navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
          >
            ← Anterior
          </button>
          <button
            onClick={goToday}
            disabled={isToday}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-40 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => navigate(1)}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* ── Events of the day ── */}
      {eventos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 self-center">Eventos hoy:</span>
          {eventos.map((ev) => (
            <span
              key={ev.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-900/40 border border-indigo-700 px-3 py-1 text-xs text-indigo-300"
            >
              🎉 {ev.nombre_festejado}
              <span className="text-indigo-500">{formatHora(ev.hora_evento)}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border border-gray-800 overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">Cargando…</div>
        ) : filas.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">Sin empleados activos</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/60">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entrada</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salida</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Horas</th>
                {eventos.length > 0 && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eventos</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filas.map((fila) => (
                <FilaRow
                  key={fila.empleadoId}
                  fila={fila}
                  eventos={eventos}
                  onUpdate={(patch) => updateFila(fila.empleadoId, patch)}
                  onSave={() => saveRow(fila)}
                  showEventosCol={eventos.length > 0}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ── */}
      {!loading && filas.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            <span className="text-white font-medium">{conHoras}</span> empleado{conHoras !== 1 ? "s" : ""} con horas
            {pendientes > 0 && (
              <span className="ml-2 text-amber-400">
                · <span className="font-medium">{pendientes}</span> pendiente{pendientes !== 1 ? "s" : ""}
              </span>
            )}
          </p>
          <button
            onClick={guardarTodos}
            disabled={guardandoTodos || conHoras === 0}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-5 py-2 text-sm font-semibold text-white transition-colors"
          >
            {guardandoTodos ? "Guardando…" : "Guardar todos"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── FilaRow sub-component ────────────────────────────────────────────────────

interface FilaRowProps {
  fila: Fila;
  eventos: DiaDashboard["eventos"];
  onUpdate: (patch: Partial<Fila>) => void;
  onSave: () => void;
  showEventosCol: boolean;
}

function FilaRow({ fila, eventos, onUpdate, onSave, showEventosCol }: FilaRowProps) {
  const horasDisplay =
    fila.horaEntrada && fila.horaSalida && validarHorario(fila.horaEntrada, fila.horaSalida)
      ? formatearHoras(calcularHorasTrabajadas(fila.horaEntrada, fila.horaSalida))
      : "—";

  const status = getStatus(fila.horaEntrada, fila.horaSalida);
  const badge = STATUS_BADGE[status];

  function handleBlur() {
    if (fila.horaEntrada) onSave();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { (e.target as HTMLElement).blur(); }
  }

  function toggleEvento(id: string) {
    const next = fila.eventoIds.includes(id)
      ? fila.eventoIds.filter((x) => x !== id)
      : [...fila.eventoIds, id];
    onUpdate({ eventoIds: next });
  }

  return (
    <tr className="hover:bg-gray-800/30 transition-colors">
      {/* Empleado */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials(fila.nombre)}
          </div>
          <div>
            <p className="text-white font-medium leading-tight">{fila.nombre}</p>
            <p className={`text-xs capitalize leading-tight ${ROL_COLORS[fila.rol]}`}>
              {fila.rol}
            </p>
          </div>
        </div>
      </td>

      {/* Entrada */}
      <td className="px-4 py-3">
        <input
          type="time"
          value={fila.horaEntrada}
          onChange={(e) => onUpdate({ horaEntrada: e.target.value, savedOk: false })}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-28 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
      </td>

      {/* Salida */}
      <td className="px-4 py-3">
        <input
          type="time"
          value={fila.horaSalida}
          onChange={(e) => onUpdate({ horaSalida: e.target.value, savedOk: false })}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-28 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
      </td>

      {/* Horas */}
      <td className="px-4 py-3">
        <span className={`font-medium ${horasDisplay === "—" ? "text-gray-600" : "text-white"}`}>
          {horasDisplay}
        </span>
      </td>

      {/* Eventos checkboxes */}
      {showEventosCol && (
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {eventos.map((ev) => (
              <label
                key={ev.id}
                className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-white"
              >
                <input
                  type="checkbox"
                  checked={fila.eventoIds.includes(ev.id)}
                  onChange={() => toggleEvento(ev.id)}
                  className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                />
                {ev.nombre_festejado}
              </label>
            ))}
          </div>
        </td>
      )}

      {/* Estado */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {fila.saving ? (
            <span className="text-xs text-gray-500">Guardando…</span>
          ) : fila.error ? (
            <span className="text-xs text-red-400 max-w-[120px] truncate" title={fila.error}>
              {fila.error}
            </span>
          ) : (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badge.cls}`}>
              {fila.savedOk ? "✓ " : ""}{badge.label}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
