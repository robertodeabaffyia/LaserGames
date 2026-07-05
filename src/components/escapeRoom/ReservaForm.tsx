"use client";

import { useState, useEffect, useCallback } from "react";
import type { SalaEscape, EscapeContacto, ModoCobro } from "@/types/escapeRoom";
import { calcularPrecioReserva, validarTurnoPersonalizado, type ReservaExistente } from "@/lib/escapeRoom";
import { formatMoneda } from "@/lib/moneda";
import EscapeContactoAutocomplete from "./EscapeContactoAutocomplete";

interface ReservaFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

function todayLocalISO(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

const TODAY = todayLocalISO();

export default function ReservaForm({ onSuccess, onCancel }: ReservaFormProps) {
  const [salas, setSalas] = useState<SalaEscape[]>([]);
  const [salaId, setSalaId] = useState("");
  const [fecha, setFecha] = useState(TODAY);
  const [turnos, setTurnos] = useState<string[]>([]);
  const [loadingTurnos, setLoadingTurnos] = useState(false);
  const [horaInicio, setHoraInicio] = useState("");
  const [reservasExistentes, setReservasExistentes] = useState<ReservaExistente[]>([]);

  const [contacto, setContacto] = useState<EscapeContacto | null>(null);
  const [cantidadPersonas, setCantidadPersonas] = useState("2");
  const [modoCobro, setModoCobro] = useState<ModoCobro>("por_persona");
  const [notas, setNotas] = useState("");

  const [horaInicioReservas, setHoraInicioReservas] = useState("18:00");
  const [horaFinReservas, setHoraFinReservas] = useState("23:00");
  const [duracionBloqueMin, setDuracionBloqueMin] = useState(90);
  const [precioSalaCompleta, setPrecioSalaCompleta] = useState(0);
  const [preciosPorPersona, setPreciosPorPersona] = useState<Record<number, number>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load salas + pricing/horario config once
  useEffect(() => {
    Promise.all([
      fetch("/api/escape/salas").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/escape/config").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/escape/precios").then((r) => (r.ok ? r.json() : [])),
    ]).then(([salasData, cfg, precioRows]) => {
      setSalas(salasData ?? []);
      if (salasData?.[0]) setSalaId((prev) => prev || salasData[0].id);
      if (cfg) {
        setPrecioSalaCompleta(cfg.precio_sala_completa ?? 0);
        setHoraInicioReservas(String(cfg.hora_inicio_reservas).slice(0, 5));
        setHoraFinReservas(String(cfg.hora_fin_reservas).slice(0, 5));
        setDuracionBloqueMin(cfg.duracion_bloque_min ?? 90);
      }
      const map: Record<number, number> = {};
      for (const row of precioRows ?? []) {
        map[row.cantidad] = row.precio_por_persona;
      }
      setPreciosPorPersona(map);
    });
  }, []);

  const loadTurnos = useCallback(async (sala: string, dia: string) => {
    if (!sala || !dia) {
      setTurnos([]);
      setReservasExistentes([]);
      return;
    }
    setLoadingTurnos(true);
    setHoraInicio("");
    try {
      const [turnosRes, reservasRes] = await Promise.all([
        fetch(`/api/escape/turnos-disponibles?sala_id=${sala}&fecha=${dia}`),
        fetch(`/api/escape/reservas?sala_id=${sala}&fecha=${dia}`),
      ]);
      setTurnos(turnosRes.ok ? await turnosRes.json() : []);
      setReservasExistentes(reservasRes.ok ? await reservasRes.json() : []);
    } finally {
      setLoadingTurnos(false);
    }
  }, []);

  useEffect(() => {
    loadTurnos(salaId, fecha);
  }, [salaId, fecha, loadTurnos]);

  function handleSalaChange(id: string) {
    setSalaId(id);
  }

  function handleFechaChange(dia: string) {
    setFecha(dia);
  }

  const cantidadNum = Number(cantidadPersonas) || 0;

  let precioPreview: number | null = null;
  let precioPorPersonaPreview: number | null = null;
  let precioError: string | null = null;
  try {
    precioPreview = calcularPrecioReserva({
      modo_cobro: modoCobro,
      cantidad_personas: cantidadNum,
      preciosPorPersona,
      precioSalaCompleta,
    });
    if (modoCobro === "por_persona") {
      precioPorPersonaPreview = preciosPorPersona[cantidadNum] ?? null;
    }
  } catch (e) {
    precioError = e instanceof Error ? e.message : "No se pudo calcular el precio";
  }

  // Validates the chosen horaInicio (whether picked from the grid or typed as
  // a custom time) against the configured horario and existing reservations —
  // grid picks are always valid by construction, this mainly catches custom
  // off-grid times. The server re-validates the same way; this is preview only.
  let turnoError: string | null = null;
  if (horaInicio) {
    try {
      validarTurnoPersonalizado({
        fecha,
        sala_id: salaId,
        horaInicio,
        horaInicioReservas,
        horaFinReservas,
        duracionBloqueMin,
        reservasExistentes,
      });
    } catch (e) {
      turnoError = e instanceof Error ? e.message : "Horario inválido";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contacto || !horaInicio || turnoError) return;

    setSaving(true);
    setError(null);

    const res = await fetch("/api/escape/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sala_id: salaId,
        contacto_id: contacto.id,
        fecha,
        hora_inicio: horaInicio,
        cantidad_personas: cantidadNum,
        modo_cobro: modoCobro,
        notas: notas || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al crear la reserva");
      setSaving(false);
      // The slot may have just been taken by someone else — refresh the list.
      loadTurnos(salaId, fecha);
      return;
    }

    onSuccess();
  }

  const canSubmit = !!contacto && !!horaInicio && !turnoError && !precioError && !saving;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="reserva-sala">Sala</label>
          <select
            id="reserva-sala"
            className="input"
            value={salaId}
            onChange={(e) => handleSalaChange(e.target.value)}
            required
          >
            {salas.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="reserva-fecha">Fecha</label>
          <input
            id="reserva-fecha"
            type="date"
            className="input"
            min={TODAY}
            value={fecha}
            onChange={(e) => handleFechaChange(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="label">Turno disponible</label>
        {loadingTurnos ? (
          <p className="text-sm text-gray-400">Buscando turnos…</p>
        ) : turnos.length === 0 ? (
          <p className="text-sm text-amber-400">No hay turnos disponibles para esa sala/fecha.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {turnos.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setHoraInicio(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                  horaInicio === t
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "border-gray-700 text-gray-300 hover:border-gray-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <label className="label mb-0 whitespace-nowrap" htmlFor="reserva-hora-custom">
            O ingresar horario personalizado:
          </label>
          <input
            id="reserva-hora-custom"
            type="time"
            className="input w-32"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
          />
        </div>
        {turnoError && (
          <p className="mt-1.5 text-xs text-red-400">{turnoError}</p>
        )}
      </div>

      <div>
        <label className="label">Contacto</label>
        <EscapeContactoAutocomplete value={contacto} onChange={setContacto} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="reserva-modo-cobro">Modo de cobro</label>
          <select
            id="reserva-modo-cobro"
            className="input"
            value={modoCobro}
            onChange={(e) => setModoCobro(e.target.value as ModoCobro)}
          >
            <option value="por_persona">Por persona</option>
            <option value="sala_completa">Sala completa</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="reserva-cantidad">Cantidad de personas</label>
          <input
            id="reserva-cantidad"
            type="number"
            className="input"
            min={1}
            value={cantidadPersonas}
            onChange={(e) => setCantidadPersonas(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-4 py-2.5 text-sm">
        {precioError ? (
          <span className="text-amber-400">{precioError}</span>
        ) : modoCobro === "por_persona" ? (
          <>
            {cantidadNum} persona{cantidadNum !== 1 ? "s" : ""} × {formatMoneda(precioPorPersonaPreview)} ={" "}
            <span className="font-semibold text-white">{formatMoneda(precioPreview)}</span>
          </>
        ) : (
          <>
            Precio sala completa:{" "}
            <span className="font-semibold text-white">{formatMoneda(precioPreview)}</span>
          </>
        )}
      </div>

      <div>
        <label className="label">Notas</label>
        <input
          type="text"
          className="input"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-60 px-5 py-2 text-sm font-semibold text-white transition-colors"
        >
          {saving ? "Reservando…" : "Crear reserva"}
        </button>
      </div>
    </form>
  );
}
