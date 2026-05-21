import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  // Verify exists first
  const { data: registro, error: fetchError } = await supabase
    .from("registros_horas")
    .select("id")
    .eq("id", id)
    .single();

  if (fetchError || !registro) {
    return NextResponse.json({ error: "Registro not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("registros_horas")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
