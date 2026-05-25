"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TARJETAS,
  CUOTAS,
  DEFAULT_RECARGOS,
  type TarjetaRecargos,
  type TarjetaNombre,
  type CuotasClave,
} from "@/types/configuracion";

interface ConfiguracionFormProps {
  onSuccess?: () => void;
}

export default function ConfiguracionForm({ onSuccess }: ConfiguracionFormProps) {
  const router = useRouter();
  const [montoSeña, setMontoSeña] = useState<string>("0");
  const [precioNinoAdicional, setPrecioNinoAdicional] = useState<string>("0");
  const [precioAdultoAdicional, setPrecioAdultoAdicional] = useState<string>("0");
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string>("");
  const [recargos, setRecargos] = useState<TarjetaRecargos>(DEFAULT_RECARGOS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setMontoSeña(String(data.monto_seña));
          setPrecioNinoAdicional(String(data.precio_nino_adicional ?? 0));
          setPrecioAdultoAdicional(String(data.precio_adulto_adicional ?? 0));
          setGoogleMapsUrl(data.google_maps_url ?? "");
          setRecargos(data.tarjeta_recargos ?? DEFAULT_RECARGOS);
        }
        setLoading(false);
      });
  }, []);

  function setRecargo(tarjeta: TarjetaNombre, cuota: CuotasClave, value: string) {
    setRecargos((prev) => ({
      ...prev,
      [tarjeta]: {
        ...(prev[tarjeta] ?? {}),
        [cuota]: value === "" ? 0 : Number(value),
      },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monto_seña: Number(montoSeña),
        precio_nino_adicional: Number(precioNinoAdicional),
        precio_adulto_adicional: Number(precioAdultoAdicional),
        google_maps_url: googleMapsUrl.trim() || null,
        tarjeta_recargos: recargos,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
    } else {
      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard");
      }
    }

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

      {/* Seña */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Seña mínima</h2>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">$</span>
          <input
            type="number"
            className="input max-w-[200px]"
            min={0}
            step="0.01"
            value={montoSeña}
            onChange={(e) => setMontoSeña(e.target.value)}
            required
          />
          <span className="text-xs text-gray-500">
            El primer pago debe ser ≥ a este monto para confirmar la reserva.
          </span>
        </div>
      </div>

      {/* Precios adicionales por invitado */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Precios adicionales por invitado</h2>
        <p className="text-xs text-gray-500 mb-4">
          Precio cobrado por cada niño o adulto que supere los incluidos en el paquete.
        </p>
        <div className="flex flex-wrap gap-6">
          <div>
            <label className="label">Precio niño adicional</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">$</span>
              <input
                type="number"
                className="input w-36"
                min={0}
                step="0.01"
                value={precioNinoAdicional}
                onChange={(e) => setPrecioNinoAdicional(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Precio adulto adicional</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">$</span>
              <input
                type="number"
                className="input w-36"
                min={0}
                step="0.01"
                value={precioAdultoAdicional}
                onChange={(e) => setPrecioAdultoAdicional(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Google Maps URL */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Reseñas en Google Maps</h2>
        <p className="text-xs text-gray-500 mb-3">
          Link directo a tu página de reseñas de Google. Se incluye automáticamente en los
          mensajes de solicitud de reseña post-evento.
        </p>
        <div className="flex items-center gap-2 max-w-lg">
          <span className="text-gray-400 text-sm shrink-0">🔗</span>
          <input
            type="url"
            className="input flex-1"
            placeholder="https://maps.google.com/..."
            value={googleMapsUrl}
            onChange={(e) => setGoogleMapsUrl(e.target.value)}
          />
        </div>
        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Verificar link ↗
          </a>
        )}
      </div>

      {/* Recargos por tarjeta */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">
          Recargos por tarjeta (%)
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Porcentaje adicional cobrado al cliente según tarjeta y número de cuotas.
        </p>

        <div className="overflow-x-auto rounded-xl border border-gray-800">
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
                <tr key={tarjeta} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{tarjeta}</td>
                  {CUOTAS.map((cuota) => (
                    <td key={cuota} className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-center">
                        <input
                          type="number"
                          className="input w-20 text-center"
                          min={0}
                          max={50}
                          step="0.1"
                          value={recargos[tarjeta]?.[cuota] ?? ""}
                          onChange={(e) =>
                            setRecargo(tarjeta, cuota, e.target.value)
                          }
                        />
                        <span className="text-gray-500 text-xs">%</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {saving ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>
    </form>
  );
}
