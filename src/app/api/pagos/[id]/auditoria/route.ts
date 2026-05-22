import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/** GET /api/pagos/[id]/auditoria — fetch the full audit trail for one pago */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the pago exists (and belongs to an event the user can access)
  const { data: pago, error: pagoError } = await supabase
    .from("pagos")
    .select("id")
    .eq("id", id)
    .single();

  if (pagoError || !pago) {
    return NextResponse.json({ error: "Pago not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("pagos_auditoria")
    .select("*")
    .eq("pago_id", id)
    .order("fecha", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
