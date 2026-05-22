import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify pago exists before deleting
  const { data: pago, error: fetchError } = await supabase
    .from("pagos")
    .select("id, evento_id")
    .eq("id", id)
    .single();

  if (fetchError || !pago) {
    return NextResponse.json({ error: "Pago not found" }, { status: 404 });
  }

  const { error } = await supabase.from("pagos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
}
