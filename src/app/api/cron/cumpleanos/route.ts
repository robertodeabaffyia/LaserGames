import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderTemplate, enviarEmail, enviarWhatsApp } from "@/lib/notificaciones";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function birthdayMatchesDate(fecha: string, target: Date): boolean {
  const parts = fecha.split("-");
  const mes = parseInt(parts[1], 10);
  const dia = parseInt(parts[2], 10);
  return mes === target.getMonth() + 1 && dia === target.getDate();
}

/**
 * POST /api/cron/cumpleanos
 * Finds clients/hijos with birthdays in `dias_anticipacion` days and sends promo.
 */
export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: config, error: configError } = await supabase
    .from("notificaciones_config")
    .select("*")
    .eq("tipo", "promocion_cumpleanos")
    .eq("habilitada", true)
    .single();

  if (configError || !config) {
    return NextResponse.json({ mensaje: "Configuración deshabilitada o no encontrada", enviados: 0 });
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + config.dias_anticipacion);
  const diasAnticipacion = String(config.dias_anticipacion);

  // Fetch all clients with their children
  const { data: clientes, error: clienteError } = await supabase
    .from("clientes")
    .select("id, nombre, email, telefono, fecha_cumpleanos, hijos(id, nombre, fecha_nacimiento)");

  if (clienteError) {
    return NextResponse.json({ error: clienteError.message }, { status: 500 });
  }

  let enviados = 0;
  const errores: string[] = [];

  for (const cliente of clientes ?? []) {
    // Check unsubscribe once per client
    const { data: desuscrito } = await supabase
      .from("cliente_desuscripciones")
      .select("desuscrito")
      .eq("cliente_id", cliente.id)
      .eq("tipo_notificacion", "promocion_cumpleanos")
      .single();

    if (desuscrito?.desuscrito) continue;

    // Collect birthday subjects: client + each hijo
    type BirthdaySubject = { id: string; nombre: string; fecha: string; isHijo: boolean };
    const subjects: BirthdaySubject[] = [];

    if (cliente.fecha_cumpleanos && birthdayMatchesDate(cliente.fecha_cumpleanos, targetDate)) {
      subjects.push({ id: cliente.id, nombre: cliente.nombre, fecha: cliente.fecha_cumpleanos, isHijo: false });
    }

    for (const hijo of (cliente.hijos as { id: string; nombre: string; fecha_nacimiento: string }[]) ?? []) {
      if (birthdayMatchesDate(hijo.fecha_nacimiento, targetDate)) {
        subjects.push({ id: hijo.id, nombre: hijo.nombre, fecha: hijo.fecha_nacimiento, isHijo: true });
      }
    }

    for (const subject of subjects) {
      // Check already notified this year
      const thisYear = new Date().getFullYear().toString();
      const { data: yaNotificado } = await supabase
        .from("historial_notificaciones")
        .select("id")
        .eq("tipo_notificacion", "promocion_cumpleanos")
        .eq("entidad_id", subject.id)
        .gte("fecha_envio", `${thisYear}-01-01`)
        .limit(1);

      if (yaNotificado && yaNotificado.length > 0) continue;

      const vars: Record<string, string> = {
        nombre_cliente: cliente.nombre,
        nombre_hijo: subject.nombre,
        fecha_nacimiento: subject.fecha,
        dias_hasta_cumpleanos: diasAnticipacion,
      };

      const contenido = renderTemplate(config.contenido_template, vars);

      if ((config.canal === "email" || config.canal === "ambos") && cliente.email) {
        const result = await enviarEmail(cliente.email, config.descripcion, contenido.replace(/\n/g, "<br>"));
        await supabase.from("historial_notificaciones").insert({
          notificacion_config_id: config.id,
          tipo_notificacion: "promocion_cumpleanos",
          entidad_id: subject.id,
          destinatario: cliente.email,
          canal: "email",
          contenido_enviado: contenido,
          status: result.ok ? "enviado" : "fallido",
          error_detalle: result.error ?? null,
        });
        if (result.ok) enviados++;
        else errores.push(`Email ${cliente.email}: ${result.error}`);
      }

      if ((config.canal === "whatsapp" || config.canal === "ambos") && cliente.telefono) {
        const result = await enviarWhatsApp(cliente.telefono, contenido);
        await supabase.from("historial_notificaciones").insert({
          notificacion_config_id: config.id,
          tipo_notificacion: "promocion_cumpleanos",
          entidad_id: subject.id,
          destinatario: cliente.telefono,
          canal: "whatsapp",
          contenido_enviado: contenido,
          status: result.ok ? "enviado" : "fallido",
          error_detalle: result.error ?? null,
        });
        if (result.ok) enviados++;
        else errores.push(`WhatsApp ${cliente.telefono}: ${result.error}`);
      }
    }
  }

  return NextResponse.json({ enviados, errores, fecha_objetivo: targetDate.toISOString().split("T")[0] });
}
