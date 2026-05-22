import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NotificacionTipo, NotificacionCanal } from "@/types/notificaciones";

const VALID_TIPOS: NotificacionTipo[] = [
  "evento_recordatorio",
  "promocion_cumpleanos",
  "confirmacion_evento",
];
const VALID_CANALES: NotificacionCanal[] = ["email", "whatsapp", "ambos"];

/** GET — list all notification configs */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notificaciones_config")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — create a custom notification config */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    tipo?: string;
    descripcion?: string;
    habilitada?: boolean;
    canal?: string;
    dias_anticipacion?: number;
    contenido_template?: string;
    variables_disponibles?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.tipo || !VALID_TIPOS.includes(body.tipo as NotificacionTipo)) {
    return NextResponse.json(
      { error: `tipo must be one of: ${VALID_TIPOS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!body.descripcion?.trim()) {
    return NextResponse.json({ error: "descripcion is required" }, { status: 400 });
  }

  if (!body.canal || !VALID_CANALES.includes(body.canal as NotificacionCanal)) {
    return NextResponse.json(
      { error: `canal must be one of: ${VALID_CANALES.join(", ")}` },
      { status: 400 }
    );
  }

  if (!body.contenido_template?.trim()) {
    return NextResponse.json(
      { error: "contenido_template is required" },
      { status: 400 }
    );
  }

  if (
    body.dias_anticipacion !== undefined &&
    (body.dias_anticipacion < 0 || !Number.isInteger(body.dias_anticipacion))
  ) {
    return NextResponse.json(
      { error: "dias_anticipacion must be a non-negative integer" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("notificaciones_config")
    .insert({
      tipo: body.tipo,
      descripcion: body.descripcion.trim(),
      habilitada: body.habilitada ?? true,
      canal: body.canal,
      dias_anticipacion: body.dias_anticipacion ?? 1,
      contenido_template: body.contenido_template.trim(),
      variables_disponibles: body.variables_disponibles ?? [],
      creado_por: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
