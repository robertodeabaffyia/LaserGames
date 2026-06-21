import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ConfiguracionUpdate } from "@/types/configuracion";

const CONFIG_COOKIE = "x-config-ok";

/** GET — return config for the authenticated user. Sets x-config-ok cookie if config exists. */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("configuraciones")
    .select("*")
    .eq("usuario_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(null, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Stamp the config-ok cookie so proxy.ts doesn't redirect anymore
  const res = NextResponse.json(data);
  res.cookies.set(CONFIG_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    // Only sent over HTTPS in production; left off in dev so http://localhost works.
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

/** PUT — upsert config. Admin only. Sets x-config-ok cookie on success. */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin guard
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (!usuario || usuario.rol !== "admin") {
    return NextResponse.json(
      { error: "Solo administradores pueden modificar la configuración" },
      { status: 403 }
    );
  }

  let body: ConfiguracionUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.monto_seña === undefined || body.monto_seña === null) {
    return NextResponse.json({ error: "monto_seña is required" }, { status: 400 });
  }
  if (body.monto_seña < 0) {
    return NextResponse.json(
      { error: "monto_seña must be >= 0" },
      { status: 400 }
    );
  }
  if (!body.tarjeta_recargos || typeof body.tarjeta_recargos !== "object") {
    return NextResponse.json(
      { error: "tarjeta_recargos is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("configuraciones")
    .upsert(
      {
        usuario_id: user.id,
        monto_seña: body.monto_seña,
        tarjeta_recargos: body.tarjeta_recargos,
        ...(body.precio_nino_adicional !== undefined && { precio_nino_adicional: body.precio_nino_adicional }),
        ...(body.precio_adulto_adicional !== undefined && { precio_adulto_adicional: body.precio_adulto_adicional }),
        ...(body.google_maps_url !== undefined && { google_maps_url: body.google_maps_url ?? null }),
      },
      { onConflict: "usuario_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const res = NextResponse.json(data);
  res.cookies.set(CONFIG_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    // Only sent over HTTPS in production; left off in dev so http://localhost works.
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
