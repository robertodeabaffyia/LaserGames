"use client";

import { useState, useEffect } from "react";
import { formatMoneda } from "@/lib/moneda";
import {
  ESCAPE_PRECIO_MIN_CANTIDAD,
  ESCAPE_PRECIO_MAX_CANTIDAD,
  type EscapePrecioPersona,
  type EscapeConfig,
} from "@/types/escapeRoom";
import { TARJETAS, CUOTAS, type TarjetaRecargos } from "@/types/configuracion";
import { horarioEsValido, ESCAPE_DURACION_BLOQUE_MIN_MINUTOS } from "@/lib/escapeRoom";

const CANTIDADES = Array.from(
  { length: ESCAPE_PRECIO_MAX_CANTIDAD - ESCAPE_PRECIO_MIN_CANTIDAD + 1 },
  (_, i) => ESCAPE_PRECIO_MIN_CANTIDAD + i
);

export default function EscapeConfigForm() {
  const [horaInicio, setHoraInicio] = useState("18:00");
  const [horaFin, setHoraFin] = useState("23:00");
  const [duracionBloque, setDuracionBloque] = useState("90");
  const [senaMinima, setSenaMinima] = useState("0");
  const [recargoTransferenciaPct, setRecargoTransferenciaPct] = useState("0");
  const [precioSalaCompleta, setPrecioSalaCompleta] = useState("0");
  const [precios, setPrecios] = useState<Record<number, string>>({});
  const [tarjetaRecargos, setTarjetaRecargos] = useState<TarjetaRecargos>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/escape/config").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/escape/precios").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/usuarios/me").then((r) => (r.ok ? r.json() : null)),
    ]).then(([cfg, precioRows, me]: [EscapeConfig | null, EscapePrecioPersona[], { rol?: string } | null]) => {
      if (me?.rol === "admin") setIsAdmin(true);
      if (cfg) {
        setHoraInicio(String(cfg.hora_inicio_reservas).slice(0, 5));
        setHoraFin(String(cfg.hora_fin_reservas).slice(0, 5));
        setDuracionBloque(String(cfg.duracion_bloque_min));
        setSenaMinima(String(cfg.sena_minima));
        setRecargoTransferenciaPct(String(cfg.recargo_transferencia_pct));
        setPrecioSalaCompleta(String(cfg.precio_sala_completa));
        setTarjetaRecargos(cfg.tarjeta_recargos ?? {});
      }
      const map: Record<number, string> = {};
      for (const row of precioRows) {
        map[row.cantidad] = String(row.precio_por_persona);
      }
      setPrecios(map);
      setLoading(false);
    });
  }, []);

  function setPrecio(cantidad: number, value: string) {
    setPrecios((prev) => ({ ...prev, [cantidad]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!horarioEsValido(horaInicio, horaFin)) {
      setError("El horario \"hasta\" debe ser posterior al horario \"desde\".");
      return;
    }
    if (!Number.isInteger(Number(duracionBloque)) || Number(duracionBloque) < ESCAPE_DURACION_BLOQUE_MIN_MINUTOS) {
      setError(`La duración del bloque debe ser un entero de al menos ${ESCAPE_DURACION_BLOQUE_MIN_MINUTOS} minutos.`);
      return;
    }

    setSaving(true);

    const configRes = await fetch("/api/escape/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hora_inicio_reservas: horaInicio,
        hora_fin_reservas: horaFin,
        duracion_bloque_min: Number(duracionBloque),
        sena_minima: Number(senaMinima),
        recargo_transferencia_pct: Number(recargoTransferenciaPct),
        precio_sala_completa: Number(precioSalaCompleta),
      }),
    });

    if (!configRes.ok) {
      const data = await configRes.json();
      setError(data.error ?? "Error al guardar la configuración");
      setSaving(false);
      return;
    }

    const preciosBody = Object.fromEntries(
      CANTIDADES.map((c) => [c, Number(precios[c] ?? 0)])
    );
    const preciosRes = await fetch("/api/escape/precios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precios: preciosBody }),
    });

    if (!preciosRes.ok) {
      const data = await preciosRes.json();
      setError(data.error ?? "Error al guardar los precios");
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        Cargando configuración…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-900/40 border border-green-700 px-4 py-3 text-sm text-green-300">
          Configuración guardada correctamente.
        </div>
      )}
      {!isAdmin && (
        <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-4 py-3 text-sm text-gray-400">
          Solo lectura. Solo los administradores pueden modificar esta configuración.
        </div>
      )}

      {/* Horario de reservas */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Horario de reservas</h2>
        <p className="text-xs text-gray-500 mb-3">
          Rango horario en el que se pueden tomar turnos para las salas.
        </p>
        <div className="flex items-center gap-4">
          <div>
            <label className="label">Desde</label>
            <input
              type="time"
              className="input w-32"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              disabled={!isAdmin}
              required
            />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input
              type="time"
              className="input w-32"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              disabled={!isAdmin}
              required
            />
          </div>
        </div>
      </div>

      {/* Duración del bloque */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Duración del bloque</h2>
        <p className="text-xs text-gray-500 mb-3">
          Minutos que ocupa cada reserva en el calendario de la sala (mínimo {ESCAPE_DURACION_BLOQUE_MIN_MINUTOS} min).
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="input w-28 text-center"
            min={ESCAPE_DURACION_BLOQUE_MIN_MINUTOS}
            step={1}
            value={duracionBloque}
            onChange={(e) => setDuracionBloque(e.target.value)}
            disabled={!isAdmin}
            required
          />
          <span className="text-gray-500 text-sm">min</span>
        </div>
      </div>

      {/* Seña mínima */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Seña mínima</h2>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">$</span>
          <input
            type="number"
            className="input max-w-[200px]"
            min={0}
            step="0.01"
            value={senaMinima}
            onChange={(e) => setSenaMinima(e.target.value)}
            disabled={!isAdmin}
            required
          />
        </div>
      </div>

      {/* Recargos por tarjeta — read-only, shared with Configuración (cumpleaños) */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">
          Recargos por tarjeta (%)
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Los recargos por tarjeta se configuran en{" "}
          <a href="/admin/configuracion" className="text-indigo-400 hover:text-indigo-300 underline">
            Configuración (cumpleaños)
          </a>{" "}
          y aplican también acá.
        </p>

        <div className="overflow-x-auto rounded-xl border border-gray-800 opacity-80">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">Tarjeta</th>
                {CUOTAS.map((c) => (
                  <th key={c} className="px-4 py-3 font-medium text-center">
                    {c === "1" ? "Contado" : `${c} cuotas`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {TARJETAS.map((tarjeta) => (
                <tr key={tarjeta}>
                  <td className="px-4 py-3 font-medium text-white">{tarjeta}</td>
                  {CUOTAS.map((cuota) => (
                    <td key={cuota} className="px-4 py-3 text-center text-gray-400">
                      {tarjetaRecargos[tarjeta]?.[cuota] ?? 0}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recargo por transferencia */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">
          Recargo por transferencia (%)
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Porcentaje adicional cobrado al cliente cuando paga por transferencia bancaria.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="input w-28 text-center"
            min={0}
            max={50}
            step="0.1"
            value={recargoTransferenciaPct}
            onChange={(e) => setRecargoTransferenciaPct(e.target.value)}
            disabled={!isAdmin}
          />
          <span className="text-gray-500 text-sm">%</span>
        </div>
      </div>

      {/* Precio sala completa */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Precio sala completa</h2>
        <p className="text-xs text-gray-500 mb-3">
          Precio fijo cuando se reserva la sala entera, sin importar la cantidad de personas.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">$</span>
          <input
            type="number"
            className="input max-w-[200px]"
            min={0}
            step="0.01"
            value={precioSalaCompleta}
            onChange={(e) => setPrecioSalaCompleta(e.target.value)}
            disabled={!isAdmin}
          />
          {Number(precioSalaCompleta) > 0 && (
            <span className="text-xs text-gray-500">
              {formatMoneda(Number(precioSalaCompleta))}
            </span>
          )}
        </div>
      </div>

      {/* Precio por persona */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Precio por persona</h2>
        <p className="text-xs text-gray-500 mb-4">
          Precio por persona según la cantidad de jugadores en el grupo.
        </p>

        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">Personas</th>
                <th className="px-4 py-3 font-medium">Precio por persona</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {CANTIDADES.map((cantidad) => (
                <tr key={cantidad} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{cantidad}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        className="input w-28 text-center"
                        min={0}
                        step="0.01"
                        value={precios[cantidad] ?? ""}
                        onChange={(e) => setPrecio(cantidad, e.target.value)}
                        disabled={!isAdmin}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      )}
    </form>
  );
}
