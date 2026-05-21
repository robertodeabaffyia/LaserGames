"use client";

import { useState, useEffect } from "react";
import type { TarjetaRecargos, TarjetaNombre, CuotasClave } from "@/types/configuracion";
import { TARJETAS, CUOTAS } from "@/types/configuracion";

interface PagoFormProps {
  eventoId: string;
  precioTotal: number;
  totalPagado: number;
  onSuccess: () => void;
}

export default function PagoForm({
  eventoId,
  precioTotal,
  totalPagado,
  onSuccess,
}: PagoFormProps) {
  const saldo = Math.max(0, precioTotal - totalPagado);

  const [monto, setMonto] = useState<string>(String(saldo));
  const [metodo, setMetodo] = useState<"efectivo" | "tarjeta" | "transferencia">("efectivo");
  const [tipoTarjeta, setTipoTarjeta] = useState<TarjetaNombre>("VISA");
  const [numCuotas, setNumCuotas] = useState<CuotasClave>("1");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recargos, setRecargos] = useState<TarjetaRecargos>({});

  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRecargos(d.tarjeta_recargos ?? {}));
  }, []);

  // Live recargo preview
  const recargoPct =
    metodo === "tarjeta"
      ? (recargos[tipoTarjeta]?.[numCuotas] ?? 0)
      : 0;
  const montoNum = Number(monto) || 0;
  const totalConRecargo = montoNum * (1 + recargoPct / 100);

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
            max={saldo}
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
            onChange={(e) =>
              setMetodo(e.target.value as typeof metodo)
            }
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
      </div>

      {/* Tarjeta details */}
      {metodo === "tarjeta" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tarjeta</label>
            <select
              className="input"
              value={tipoTarjeta}
              onChange={(e) => setTipoTarjeta(e.target.value as TarjetaNombre)}
            >
              {TARJETAS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cuotas</label>
            <select
              className="input"
              value={numCuotas}
              onChange={(e) => setNumCuotas(e.target.value as CuotasClave)}
            >
              {CUOTAS.map((c) => (
                <option key={c} value={c}>
                  {c === "1" ? "Contado" : `${c} cuotas`}
                </option>
              ))}
            </select>
          </div>

          {recargoPct > 0 && (
            <div className="col-span-2 rounded-lg bg-amber-900/30 border border-amber-700 px-4 py-2.5 text-sm text-amber-300">
              Recargo {recargoPct}%: el cliente paga{" "}
              <span className="font-semibold">
                ${totalConRecargo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Notas */}
      <div>
        <label className="label">Notas</label>
        <input
          type="text"
          className="input"
          placeholder="Referencia, número de operación…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-400">
          Saldo restante:{" "}
          <span className="font-semibold text-white">
            ${saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </span>
        </p>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-60 px-5 py-2 text-sm font-semibold text-white transition-colors"
        >
          {saving ? "Registrando…" : "Registrar pago"}
        </button>
      </div>
    </form>
  );
}
