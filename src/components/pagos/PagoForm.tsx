"use client";

import { useState, useEffect } from "react";
import type { TarjetaRecargos, TarjetaNombre, CuotasClave } from "@/types/configuracion";
import { TARJETAS, CUOTAS } from "@/types/configuracion";
import type { TipoDescuento, MetodoPago } from "@/types/pagos";
import { formatMoneda } from "@/lib/moneda";
import { isoToDatetimeLocal } from "@/lib/fecha";

interface PagoFormProps {
  eventoId: string;
  precioTotal: number;
  totalPagado: number;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function PagoForm({
  eventoId,
  precioTotal,
  totalPagado,
  onSuccess,
  onCancel,
}: PagoFormProps) {
  const saldo = Math.max(0, precioTotal - totalPagado);

  const [monto, setMonto] = useState<string>(String(saldo));
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [tipoTarjeta, setTipoTarjeta] = useState<TarjetaNombre>("VISA");
  const [numCuotas, setNumCuotas] = useState<CuotasClave>("1");
  const [notas, setNotas] = useState("");
  const [quienRecibio, setQuienRecibio] = useState("");
  const [fechaPago, setFechaPago] = useState(
    () => isoToDatetimeLocal(new Date())
  );
  // discount state
  const [tieneDescuento, setTieneDescuento] = useState(false);
  const [tipoDescuento, setTipoDescuento] = useState<TipoDescuento>("porcentaje");
  const [valorDescuento, setValorDescuento] = useState<string>("");
  // config-loaded values
  const [recargos, setRecargos] = useState<TarjetaRecargos>({});
  const [recargoTransferenciaPct, setRecargoTransferenciaPct] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  // admin recargo override: null = use config value, string = manual value
  const [recargoOverride, setRecargoOverride] = useState<string | null>(null);
  // misc
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/configuracion").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/usuarios/me").then((r) => (r.ok ? r.json() : null)),
    ]).then(([cfg, me]) => {
      if (cfg) {
        setRecargos(cfg.tarjeta_recargos ?? {});
        setRecargoTransferenciaPct(cfg.recargo_transferencia_pct ?? 0);
      }
      if (me?.rol === "admin") setIsAdmin(true);
    });
  }, []);

  // Config-derived recargo for the currently selected metodo/tarjeta/cuotas
  const configRecargoPct: number =
    metodo === "tarjeta"
      ? (recargos[tipoTarjeta]?.[numCuotas] ?? 0)
      : metodo === "transferencia"
        ? recargoTransferenciaPct
        : 0;

  // Effective recargo: admin override takes precedence if set
  const recargoPct =
    isAdmin && recargoOverride !== null
      ? Math.max(0, Number(recargoOverride) || 0)
      : configRecargoPct;

  // Reset override when the payment method, card type, or cuotas changes
  function handleMetodoChange(m: MetodoPago) {
    setMetodo(m);
    setRecargoOverride(null);
  }
  function handleTipoTarjetaChange(t: TarjetaNombre) {
    setTipoTarjeta(t);
    setRecargoOverride(null);
  }
  function handleNumCuotasChange(c: CuotasClave) {
    setNumCuotas(c);
    setRecargoOverride(null);
  }

  const montoNum = Number(monto) || 0;
  const totalConRecargo = montoNum * (1 + recargoPct / 100);

  // Live discount preview
  const valorDescuentoNum = Number(valorDescuento) || 0;
  const descuentoAmount = tieneDescuento
    ? tipoDescuento === "porcentaje"
      ? montoNum * (valorDescuentoNum / 100)
      : valorDescuentoNum
    : 0;
  const montoFinal = montoNum - descuentoAmount;
  const montoFinalValido = !tieneDescuento || (valorDescuentoNum > 0 && montoFinal > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evento_id: eventoId,
        monto: montoNum,
        metodo,
        ...(metodo === "tarjeta"
          ? { tipo_tarjeta: tipoTarjeta, num_cuotas: Number(numCuotas) }
          : {}),
        notas: notas || null,
        quien_recibio: quienRecibio || null,
        fecha_pago: new Date(fechaPago).toISOString(),
        tiene_descuento: tieneDescuento,
        ...(tieneDescuento
          ? { tipo_descuento: tipoDescuento, valor_descuento: valorDescuentoNum }
          : {}),
        // Admin sends the effective recargo so the server can persist the override.
        // Non-admins omit this field; the server derives it from config.
        ...(isAdmin ? { recargo_pct: recargoPct } : {}),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al registrar el pago");
      setSaving(false);
      return;
    }

    onSuccess();
  }

  // Value shown in the admin recargo input (override if set, else config value)
  const adminRecargoDisplayValue =
    recargoOverride !== null ? recargoOverride : String(configRecargoPct);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Monto */}
        <div>
          <label className="label">Monto base ($)</label>
          <input
            type="number"
            className="input"
            min={0.01}
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
          />
        </div>

        {/* Método */}
        <div>
          <label className="label">Método de pago</label>
          <select
            className="input"
            value={metodo}
            onChange={(e) => handleMetodoChange(e.target.value as MetodoPago)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>

        {/* Fecha del pago */}
        <div>
          <label className="label">Fecha y hora del pago</label>
          <input
            type="datetime-local"
            className="input"
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
          />
        </div>

        {/* Quién lo recibió */}
        <div>
          <label className="label">Recibido por</label>
          <input
            type="text"
            className="input"
            placeholder="Nombre del empleado/a"
            value={quienRecibio}
            onChange={(e) => setQuienRecibio(e.target.value)}
          />
        </div>
      </div>

      {/* ── Tarjeta details ──────────────────────────────────────────────────────── */}
      {metodo === "tarjeta" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tarjeta</label>
            <select
              className="input"
              value={tipoTarjeta}
              onChange={(e) => handleTipoTarjetaChange(e.target.value as TarjetaNombre)}
            >
              {TARJETAS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cuotas</label>
            <select
              className="input"
              value={numCuotas}
              onChange={(e) => handleNumCuotasChange(e.target.value as CuotasClave)}
            >
              {CUOTAS.map((c) => (
                <option key={c} value={c}>{c === "1" ? "Contado" : `${c} cuotas`}</option>
              ))}
            </select>
          </div>

          {/* Recargo preview / admin override — cards */}
          {(configRecargoPct > 0 || isAdmin) && (
            <div className="col-span-2">
              <RecargoSection
                isAdmin={isAdmin}
                configRecargoPct={configRecargoPct}
                adminRecargoDisplayValue={adminRecargoDisplayValue}
                recargoPct={recargoPct}
                montoNum={montoNum}
                totalConRecargo={totalConRecargo}
                onRecargoChange={setRecargoOverride}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Transferencia recargo ─────────────────────────────────────────────── */}
      {metodo === "transferencia" && (configRecargoPct > 0 || isAdmin) && (
        <RecargoSection
          isAdmin={isAdmin}
          configRecargoPct={configRecargoPct}
          adminRecargoDisplayValue={adminRecargoDisplayValue}
          recargoPct={recargoPct}
          montoNum={montoNum}
          totalConRecargo={totalConRecargo}
          onRecargoChange={setRecargoOverride}
        />
      )}

      {/* ── Descuento ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <label className="flex items-center gap-2.5 cursor-pointer w-fit">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-indigo-500"
            checked={tieneDescuento}
            onChange={(e) => {
              setTieneDescuento(e.target.checked);
              if (!e.target.checked) setValorDescuento("");
            }}
          />
          <span className="text-sm text-gray-300">Aplicar descuento</span>
        </label>

        {tieneDescuento && (
          <div className="rounded-xl border border-indigo-800 bg-indigo-900/20 p-4 space-y-3">
            <div className="flex gap-5">
              {(["porcentaje", "monto"] as TipoDescuento[]).map((tipo) => (
                <label key={tipo} className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                  <input
                    type="radio"
                    name="tipo_descuento"
                    value={tipo}
                    checked={tipoDescuento === tipo}
                    onChange={() => { setTipoDescuento(tipo); setValorDescuento(""); }}
                    className="accent-indigo-500"
                  />
                  {tipo === "porcentaje" ? "Porcentaje (%)" : "Monto fijo ($)"}
                </label>
              ))}
            </div>

            <div>
              <label className="label">
                {tipoDescuento === "porcentaje" ? "Porcentaje de descuento (%)" : "Monto a descontar ($)"}
              </label>
              <input
                type="number"
                className="input max-w-[160px]"
                min={0.01}
                step={tipoDescuento === "porcentaje" ? "0.1" : "0.01"}
                max={tipoDescuento === "porcentaje" ? 100 : montoNum - 0.01}
                value={valorDescuento}
                onChange={(e) => setValorDescuento(e.target.value)}
                placeholder={tipoDescuento === "porcentaje" ? "ej. 10" : "ej. 200"}
                required={tieneDescuento}
              />
            </div>

            {valorDescuentoNum > 0 && (
              <div className={`rounded-lg px-4 py-2.5 text-sm border ${
                montoFinal > 0
                  ? "bg-green-900/20 border-green-800 text-green-300"
                  : "bg-red-900/20 border-red-800 text-red-300"
              }`}>
                {montoFinal > 0 ? (
                  <>
                    Descuento:{" "}
                    <span className="font-semibold">
                      −{formatMoneda(descuentoAmount)}
                    </span>
                    {" · "}Acreditado:{" "}
                    <span className="font-bold text-white">
                      {formatMoneda(montoFinal)}
                    </span>
                  </>
                ) : (
                  "El descuento no puede ser mayor o igual al monto base."
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notas */}
      <div>
        <label className="label">Notas / referencia</label>
        <input
          type="text"
          className="input"
          placeholder="Número de transferencia, comprobante…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-400">
          Saldo restante:{" "}
          <span className="font-semibold text-white">
            {formatMoneda(saldo)}
          </span>
        </p>
        <div className="flex gap-3">
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
            disabled={saving || !montoFinalValido}
            className="rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-60 px-5 py-2 text-sm font-semibold text-white transition-colors"
          >
            {saving ? "Registrando…" : "Registrar pago"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Shared recargo section (used for both tarjeta and transferencia) ──────────

interface RecargoSectionProps {
  isAdmin: boolean;
  configRecargoPct: number;
  adminRecargoDisplayValue: string;
  recargoPct: number;
  montoNum: number;
  totalConRecargo: number;
  onRecargoChange: (value: string) => void;
}

function RecargoSection({
  isAdmin,
  configRecargoPct,
  adminRecargoDisplayValue,
  recargoPct,
  montoNum,
  totalConRecargo,
  onRecargoChange,
}: RecargoSectionProps) {
  return (
    <div className="space-y-2">
      {isAdmin ? (
        <div className="flex items-center gap-3">
          <label className="label whitespace-nowrap">Recargo (%)</label>
          <input
            type="number"
            className="input w-24 text-center"
            min={0}
            max={100}
            step="0.1"
            value={adminRecargoDisplayValue}
            onChange={(e) => onRecargoChange(e.target.value)}
          />
          <span className="text-xs text-gray-500">
            Config: {configRecargoPct}%
          </span>
        </div>
      ) : null}
      {recargoPct > 0 && montoNum > 0 && (
        <div className="rounded-lg bg-amber-900/30 border border-amber-700 px-4 py-2.5 text-sm text-amber-300">
          Recargo {recargoPct}%: el cliente paga{" "}
          <span className="font-semibold">{formatMoneda(totalConRecargo)}</span>
        </div>
      )}
    </div>
  );
}
