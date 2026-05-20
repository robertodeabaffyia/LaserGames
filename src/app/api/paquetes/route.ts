import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PaqueteInsert, ItemInput } from "@/types/paquetes";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("paquetes")
    .select("*, paquete_items(*, item:items(*))")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  let body: PaqueteInsert & { items?: ItemInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { items, ...paqueteData } = body as PaqueteInsert & { items?: ItemInput[] };

  if (!paqueteData.nombre || paqueteData.precio === undefined || paqueteData.precio === null) {
    return NextResponse.json(
      { error: "nombre and precio are required" },
      { status: 400 }
    );
  }

  const { data: paquete, error } = await supabase
    .from("paquetes")
    .insert(paqueteData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (items?.length) {
    const paqueteItems = items.map((i) => ({
      paquete_id: (paquete as { id: string }).id,
      item_id: i.item_id,
      cantidad: i.cantidad,
    }));

    const { error: itemsError } = await supabase
      .from("paquete_items")
      .insert(paqueteItems);

    if (itemsError)
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  return NextResponse.json(paquete, { status: 201 });
}
