"use client";

import PackageList from "@/components/packages/PackageList";

export default function PaquetesPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-white">Paquetes</h1>
      <PackageList />
    </div>
  );
}
