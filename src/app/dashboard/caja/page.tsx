"use client";

import { useState } from "react";
import MovimientoForm from "@/components/caja/MovimientoForm";
import MovimientosList from "@/components/caja/MovimientosList";
import BonoPago from "@/components/caja/BonoPago";
import FlujoCaja from "@/components/caja/FlujoCaja";

type Tab = "flujo" | "movimientos" | "bonos";

export default function CajaPage() {
  const [tab, setTab] = useState<Tab>("flujo");
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleSuccess() {
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Caja</h1>
          <p className="text-sm text-gray-400 mt-0.5">Movimientos de ingresos y egresos</p>
        </div>
        {!showForm && tab === "movimientos" && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            + Nuevo movimiento
          </button>
        )}
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/60 p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Nuevo movimiento</h2>
          <MovimientoForm onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-lg border border-gray-800 bg-gray-900/50 p-1 w-fit">
        {([
          { key: "flujo",      label: "Flujo de caja" },
          { key: "movimientos",label: "Movimientos" },
          { key: "bonos",      label: "Bonos" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "flujo" && <FlujoCaja />}
      {tab === "movimientos" && (
        <MovimientosList
          refreshKey={refreshKey}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
      )}
      {tab === "bonos" && (
        <BonoPago onBonoPagado={() => setRefreshKey((k) => k + 1)} />
      )}
    </div>
  );
}
