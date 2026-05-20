import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PaqueteUpdate, ItemInput } from "@/types/paquetes";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("paquetes")
    .select("*, paquete_items(*, item:items(*))")
    .eq("id", id)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  let body: PaqueteUpdate & { items?: ItemInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { items, ...paqueteData } = body;

  const { data: paquete, error } = await supabase
    .from("paquetes")
    .update(paqueteData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  if (items !== undefined) {
    await supabase.from("paquete_items").delete().eq("paquete_id", id);

    if (items.length > 0) {
      const paqueteItems = items.map((i) => ({
        paquete_id: id,
        item_id: i.item_id,
        cantidad: i.cantidad,
      }));
      await supabase.from("paquete_items").insert(paqueteItems);
    }
  }

  return NextResponse.json(paquete);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("paquetes").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
