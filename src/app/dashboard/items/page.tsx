"use client";

import ItemList from "@/components/items/ItemList";

export default function ItemsPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-white">Items</h1>
      <ItemList />
    </div>
  );
}
