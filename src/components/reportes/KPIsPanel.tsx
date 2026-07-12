"use client";

import { useEffect, useState } from "react";
import KPICard from "./KPICard";
import type { KPIs } from "@/types/reportes";
import { formatMoneda } from "@/lib/moneda";

const fmt = formatMoneda;

export default function KPIsPanel() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reportes/kpis")
      .then((r) => r.json())
      .then(setKpis)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-gray-800 bg-gray-900/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const gananciaNeta = kpis.ganancia_neta;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KPICard
        label="Ingresos (mes)"
        value={fmt(kpis.ingresos_mes)}
        color="green"
        icon="💵"
      />
      <KPICard
        label="Egresos (mes)"
        value={fmt(kpis.egresos_mes)}
        color="red"
        icon="💸"
      />
      <KPICard
        label="Ganancia neta"
        value={fmt(gananciaNeta)}
        color={gananciaNeta >= 0 ? "green" : "red"}
        icon="📊"
      />
      <KPICard
        label="Eventos (mes)"
        value={kpis.eventos_mes}
        color="blue"
        icon="🎉"
      />
      <KPICard
        label="Pagos pendientes"
        value={kpis.pagos_pendientes}
        color="amber"
        icon="⏳"
        sub="eventos sin completar"
      />
      <KPICard
        label="Cumpleaños próx."
        value={kpis.cumpleanos_proximos}
        color="amber"
        icon="🎂"
        sub="próximos 30 días"
      />
      <KPICard
        label="Reservas Escape (mes)"
        value={kpis.reservas_escape_mes}
        color="blue"
        icon="🗝️"
      />
    </div>
  );
}
