"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import PackageList from "@/components/packages/PackageList";
import ItemList from "@/components/items/ItemList";

type Tab = "paquetes" | "items";

function PaquetesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") ?? "paquetes") as Tab;

  function setTab(next: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.push(`/dashboard/paquetes?${params.toString()}`);
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-white">Paquetes</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-800 bg-gray-900/50 p-1 w-fit">
        {(["paquetes", "items"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "paquetes" ? "Paquetes" : "Items"}
          </button>
        ))}
      </div>

      {tab === "paquetes" ? <PackageList /> : <ItemList />}
    </div>
  );
}

export default function PaquetesPage() {
  return (
    <Suspense>
      <PaquetesPageInner />
    </Suspense>
  );
}
