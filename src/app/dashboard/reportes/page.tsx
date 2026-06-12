"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Dynamic imports — all use Recharts (client-only)
const ReporteSummary    = dynamic(() => import("@/components/reportes/ReporteSummary"),    { ssr: false, loading: () => <Skeleton /> });
const ReporteTendencia  = dynamic(() => import("@/components/reportes/ReporteTendencia"),  { ssr: false, loading: () => <Skeleton /> });
const ReporteEventos    = dynamic(() => import("@/components/reportes/ReporteEventos"),    { ssr: false, loading: () => <Skeleton /> });
const ReporteClientes   = dynamic(() => import("@/components/reportes/ReporteClientes"),   { ssr: false, loading: () => <Skeleton /> });
const ReporteEmpleados  = dynamic(() => import("@/components/reportes/ReporteEmpleados"),  { ssr: false, loading: () => <Skeleton /> });
const ReporteMovimientos = dynamic(() => import("@/components/reportes/ReporteMovimientos"), { ssr: false, loading: () => <Skeleton /> });

function Skeleton() {
  return <div className="h-64 rounded-xl border border-gray-800 animate-pulse bg-gray-900/30" />;
}

type Tab = "resumen" | "tendencia" | "eventos" | "clientes" | "empleados" | "movimientos";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "resumen",      label: "Resumen",     icon: "📊" },
  { key: "tendencia",    label: "Tendencia",   icon: "📈" },
  { key: "eventos",      label: "Eventos",     icon: "🎉" },
  { key: "clientes",     label: "Clientes",    icon: "👥" },
  { key: "empleados",    label: "Empleados",   icon: "👤" },
  { key: "movimientos",  label: "Movimientos", icon: "💰" },
];

export default function ReportesPage() {
  const [tab, setTab] = useState<Tab>("resumen");

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reportes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Análisis y exportación de datos del negocio</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-800 bg-gray-900/50 p-1 w-fit">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === "resumen"      && <ReporteSummary />}
        {tab === "tendencia"    && <ReporteTendencia />}
        {tab === "eventos"      && <ReporteEventos />}
        {tab === "clientes"     && <ReporteClientes />}
        {tab === "empleados"    && <ReporteEmpleados />}
        {tab === "movimientos"  && <ReporteMovimientos />}
      </div>
    </div>
  );
}
