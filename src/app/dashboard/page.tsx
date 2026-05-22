"use client";

import BirthdayWidget from "@/components/dashboard/BirthdayWidget";
import PendingEventsWidget from "@/components/dashboard/PendingEventsWidget";
import PagosWidget from "@/components/dashboard/PagosWidget";
import dynamic from "next/dynamic";

const KPIsPanel = dynamic(() => import("@/components/reportes/KPIsPanel"), { ssr: false });

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* KPI cards */}
      <KPIsPanel />

      {/* Existing widgets */}
      <div className="grid gap-6 sm:grid-cols-3">
        <BirthdayWidget />
        <PendingEventsWidget />
        <PagosWidget />
      </div>
    </div>
  );
}
