/**
 * GET /api/reportes/[tipo]
 *
 * Authentication: required (401 if no session).
 * Authorization:  admin only (403 for supervisor / general).
 *
 * Supported tipos: kpis | resumen | eventos | clientes | empleados | movimientos | tendencia
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getUserRol,
  hasMinRole,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth-helpers";
import type {
  KPIs,
  ReporteResumen,
  ReporteEventos,
  ReporteClientes,
  ReporteEmpleados,
  ReporteMovimientos,
  ResumenDia,
  PaqueteStat,
  EstadoStat,
  ClienteRanking,
  EmpleadoStat,
  CategoriaStat,
  ReporteTendencia,
  TendenciaMes,
} from "@/types/reportes";

type Params = { params: Promise<{ tipo: string }> };

// ── helpers ───────────────────────────────────────────────────────────────────

function currentMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const desde = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const hasta = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { desde, hasta };
}

function defaultRange(searchParams: URLSearchParams) {
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (desde && hasta) return { desde, hasta };
  return currentMonthRange();
}

function birthdayInNext30(fechaCumpleanos: string | null, today: Date): boolean {
  if (!fechaCumpleanos) return false;
  const bday = new Date(fechaCumpleanos);
  const y = today.getFullYear();
  let candidate = new Date(y, bday.getMonth(), bday.getDate());
  if (candidate < today) candidate = new Date(y + 1, bday.getMonth(), bday.getDate());
  const diff = (candidate.getTime() - today.getTime()) / 86400000;
  return diff >= 0 && diff <= 30;
}

// ── handlers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleKpis(supabase: any): Promise<KPIs> {
  const { desde, hasta } = currentMonthRange();
  const today = new Date();

  // ingresos_mes: sum from pagos table (accurate; immune to stale movimientos from deleted payments)
  const { data: pagosDelMes, error: pagosErr } = await supabase
    .from("pagos")
    .select("monto, monto_final")
    .gte("fecha_pago", `${desde}T00:00:00`)
    .lte("fecha_pago", `${hasta}T23:59:59`);

  if (pagosErr) throw new Error(pagosErr.message);

  const ingresos_pagos = (pagosDelMes ?? []).reduce(
    (s: number, p: { monto: number; monto_final: number | null }) =>
      s + (p.monto_final ?? p.monto),
    0
  );

  // Escape señas are tracked on escape_reservas (not `pagos`), so add the
  // paid ones of this month so "Ingresos del mes" reflects the whole business.
  const { data: escapePagadas } = await supabase
    .from("escape_reservas")
    .select("sena_monto")
    .eq("sena_pagada", true)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  const ingresos_escape = (escapePagadas ?? []).reduce(
    (s: number, r: { sena_monto: number | null }) => s + (r.sena_monto ?? 0),
    0
  );

  const ingresos_mes = ingresos_pagos + ingresos_escape;

  // egresos_mes: manual expense entries stay in movimientos_caja
  const { data: egresosDelMes, error: egresosErr } = await supabase
    .from("movimientos_caja")
    .select("monto")
    .eq("tipo", "egreso")
    .gte("fecha", desde)
    .lte("fecha", hasta);

  if (egresosErr) throw new Error(egresosErr.message);

  const egresos_mes = (egresosDelMes ?? []).reduce(
    (s: number, m: { monto: number }) => s + m.monto,
    0
  );

  const { count: eventos_mes } = await supabase
    .from("eventos")
    .select("id", { count: "exact", head: true })
    .gte("fecha_evento", `${desde}T00:00:00`)
    .lte("fecha_evento", `${hasta}T23:59:59`);

  const { count: reservas_escape_mes } = await supabase
    .from("escape_reservas")
    .select("id", { count: "exact", head: true })
    .not("estado", "eq", "cancelada")
    .gte("fecha", desde)
    .lte("fecha", hasta);

  const { data: pendientes } = await supabase
    .from("eventos")
    .select("id")
    .in("estado", ["pendiente", "confirmado", "en_curso"]);

  const { data: clientes } = await supabase
    .from("clientes")
    .select("fecha_cumpleanos");

  const { data: hijos } = await supabase
    .from("hijos")
    .select("fecha_cumpleanos");

  const cumpleanos_proximos = [
    ...(clientes ?? []).map((c: { fecha_cumpleanos: string | null }) => c.fecha_cumpleanos),
    ...(hijos ?? []).map((h: { fecha_cumpleanos: string | null }) => h.fecha_cumpleanos),
  ].filter((f) => birthdayInNext30(f, today)).length;

  return {
    ingresos_mes,
    egresos_mes,
    ganancia_neta: ingresos_mes - egresos_mes,
    eventos_mes: eventos_mes ?? 0,
    pagos_pendientes: (pendientes ?? []).length,
    cumpleanos_proximos,
    reservas_escape_mes: reservas_escape_mes ?? 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleResumen(supabase: any, desde: string, hasta: string): Promise<ReporteResumen> {
  const { data, error } = await supabase
    .from("movimientos_caja")
    .select("tipo, monto, fecha")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: true });

  if (error) throw new Error(error.message);

  const rows: { tipo: string; monto: number; fecha: string }[] = data ?? [];

  const byDate = new Map<string, ResumenDia>();
  for (const r of rows) {
    if (!byDate.has(r.fecha)) byDate.set(r.fecha, { fecha: r.fecha, ingresos: 0, egresos: 0 });
    const d = byDate.get(r.fecha)!;
    if (r.tipo === "ingreso") d.ingresos += r.monto;
    else d.egresos += r.monto;
  }

  const total_ingresos = rows.filter((r) => r.tipo === "ingreso").reduce((s, r) => s + r.monto, 0);
  const total_egresos = rows.filter((r) => r.tipo === "egreso").reduce((s, r) => s + r.monto, 0);

  return {
    total_ingresos,
    total_egresos,
    ganancia_neta: total_ingresos - total_egresos,
    por_dia: Array.from(byDate.values()),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleEventos(supabase: any, desde: string, hasta: string): Promise<ReporteEventos> {
  const { data, error } = await supabase
    .from("eventos")
    .select("id, estado, precio_total, paquete_id, paquete:paquetes(id, nombre)")
    .gte("fecha_evento", `${desde}T00:00:00`)
    .lte("fecha_evento", `${hasta}T23:59:59`);

  if (error) throw new Error(error.message);

  const rows: {
    id: string;
    estado: string;
    precio_total: number;
    paquete_id: string;
    paquete: { id: string; nombre: string } | null;
  }[] = data ?? [];

  const byPaquete = new Map<string, PaqueteStat>();
  const byEstado = new Map<string, EstadoStat>();
  let total_ingresos = 0;

  for (const r of rows) {
    const pid = r.paquete_id;
    const pnombre = r.paquete?.nombre ?? "Sin paquete";
    if (!byPaquete.has(pid)) byPaquete.set(pid, { paquete_id: pid, paquete_nombre: pnombre, count: 0, total_ingresos: 0 });
    const ps = byPaquete.get(pid)!;
    ps.count++;
    if (r.estado === "completado") { ps.total_ingresos += r.precio_total; total_ingresos += r.precio_total; }

    if (!byEstado.has(r.estado)) byEstado.set(r.estado, { estado: r.estado, count: 0 });
    byEstado.get(r.estado)!.count++;
  }

  const por_paquete = Array.from(byPaquete.values()).sort((a, b) => b.count - a.count);
  const paquete_mas_vendido = por_paquete[0]?.paquete_nombre ?? null;

  return {
    total_eventos: rows.length,
    total_ingresos,
    por_paquete,
    paquete_mas_vendido,
    por_estado: Array.from(byEstado.values()),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleClientes(supabase: any, desde: string, hasta: string): Promise<ReporteClientes> {
  const { data, error } = await supabase
    .from("eventos")
    .select("cliente_id, fecha_evento, precio_total, estado, cliente:clientes(id, nombre)")
    .gte("fecha_evento", `${desde}T00:00:00`)
    .lte("fecha_evento", `${hasta}T23:59:59`)
    .order("fecha_evento", { ascending: true });

  if (error) throw new Error(error.message);

  const rows: {
    cliente_id: string;
    fecha_evento: string;
    precio_total: number;
    estado: string;
    cliente: { id: string; nombre: string } | null;
  }[] = data ?? [];

  const byCliente = new Map<string, ClienteRanking>();
  const now = new Date().toISOString();

  for (const r of rows) {
    const cid = r.cliente_id;
    if (!byCliente.has(cid)) {
      byCliente.set(cid, {
        cliente_id: cid,
        nombre: r.cliente?.nombre ?? cid,
        total_eventos: 0,
        primer_evento: null,
        ultimo_evento: null,
        proximo_evento: null,
        total_gastado: 0,
      });
    }
    const cr = byCliente.get(cid)!;
    cr.total_eventos++;
    if (!cr.primer_evento || r.fecha_evento < cr.primer_evento) cr.primer_evento = r.fecha_evento;
    if (r.fecha_evento < now) {
      if (!cr.ultimo_evento || r.fecha_evento > cr.ultimo_evento) cr.ultimo_evento = r.fecha_evento;
    } else {
      if (!cr.proximo_evento || r.fecha_evento < cr.proximo_evento) cr.proximo_evento = r.fecha_evento;
    }
    if (r.estado === "completado") cr.total_gastado += r.precio_total;
  }

  const ranking = Array.from(byCliente.values()).sort((a, b) => b.total_eventos - a.total_eventos);
  return { ranking };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleEmpleados(supabase: any, desde: string, hasta: string): Promise<ReporteEmpleados> {
  const { data: registros, error: regErr } = await supabase
    .from("registros_horas")
    .select("empleado_id, horas_trabajadas, empleado:empleados(id, nombre, tarifa_horaria)")
    .gte("fecha", desde)
    .lte("fecha", hasta);

  if (regErr) throw new Error(regErr.message);

  const mesDesdeParts = desde.slice(0, 7);
  const mesHastaParts = hasta.slice(0, 7);

  const { data: bonos } = await supabase
    .from("bonos_empleados")
    .select("empleado_id, monto_bono")
    .gte("mes", mesDesdeParts)
    .lte("mes", mesHastaParts);

  const rows: {
    empleado_id: string;
    horas_trabajadas: number;
    empleado: { id: string; nombre: string; tarifa_horaria: number | null } | null;
  }[] = registros ?? [];

  const bonoRows: { empleado_id: string; monto_bono: number }[] = bonos ?? [];

  const byEmp = new Map<string, EmpleadoStat>();

  for (const r of rows) {
    const eid = r.empleado_id;
    if (!byEmp.has(eid)) {
      byEmp.set(eid, {
        empleado_id: eid,
        nombre: r.empleado?.nombre ?? eid,
        horas_trabajadas: 0,
        salario_total: 0,
        bonos_total: 0,
        total_costo: 0,
      });
    }
    const es = byEmp.get(eid)!;
    es.horas_trabajadas += r.horas_trabajadas;
    es.salario_total += r.horas_trabajadas * (r.empleado?.tarifa_horaria ?? 0);
  }

  for (const b of bonoRows) {
    if (!byEmp.has(b.empleado_id)) continue;
    byEmp.get(b.empleado_id)!.bonos_total += b.monto_bono;
  }

  for (const es of byEmp.values()) es.total_costo = es.salario_total + es.bonos_total;

  const resumen = Array.from(byEmp.values()).sort((a, b) => b.horas_trabajadas - a.horas_trabajadas);
  const total_horas = resumen.reduce((s, e) => s + e.horas_trabajadas, 0);
  const total_costo = resumen.reduce((s, e) => s + e.total_costo, 0);

  return {
    resumen,
    top_empleado: resumen[0]?.nombre ?? null,
    total_horas,
    total_costo,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleMovimientos(supabase: any, desde: string, hasta: string): Promise<ReporteMovimientos> {
  const { data, error } = await supabase
    .from("movimientos_caja")
    .select("tipo, categoria, monto")
    .gte("fecha", desde)
    .lte("fecha", hasta);

  if (error) throw new Error(error.message);

  const rows: { tipo: string; categoria: string; monto: number }[] = data ?? [];

  const byCat = new Map<string, CategoriaStat>();
  for (const r of rows) {
    const key = `${r.tipo}::${r.categoria}`;
    if (!byCat.has(key)) byCat.set(key, { categoria: r.categoria, tipo: r.tipo as "ingreso" | "egreso", total: 0 });
    byCat.get(key)!.total += r.monto;
  }

  const total_ingresos = rows.filter((r) => r.tipo === "ingreso").reduce((s, r) => s + r.monto, 0);
  const total_egresos = rows.filter((r) => r.tipo === "egreso").reduce((s, r) => s + r.monto, 0);

  return {
    total_ingresos,
    total_egresos,
    ganancia_neta: total_ingresos - total_egresos,
    por_categoria: Array.from(byCat.values()).sort((a, b) => b.total - a.total),
  };
}

/**
 * Tendencia mensual: aggregates the last `meses` months (default 12, max 24)
 * of movimientos_caja plus completed-event counts, producing the month-over-
 * month series and summary stats used for decision-making.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTendencia(supabase: any, mesesParam: number): Promise<ReporteTendencia> {
  const numMeses = Math.min(Math.max(mesesParam, 3), 24);

  // Window: first day of (current month - numMeses + 1) … today
  const now = new Date();
  const desdeDate = new Date(now.getFullYear(), now.getMonth() - numMeses + 1, 1);
  const desde = `${desdeDate.getFullYear()}-${String(desdeDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: movimientos, error: movErr } = await supabase
    .from("movimientos_caja")
    .select("tipo, monto, fecha")
    .gte("fecha", desde);

  if (movErr) throw new Error(movErr.message);

  const { data: eventos, error: evErr } = await supabase
    .from("eventos")
    .select("fecha_evento")
    .eq("estado", "completado")
    .gte("fecha_evento", `${desde}T00:00:00`);

  if (evErr) throw new Error(evErr.message);

  // Seed every month in the window so gaps render as zero instead of disappearing
  const byMes = new Map<string, TendenciaMes>();
  for (let i = 0; i < numMeses; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - numMeses + 1 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMes.set(key, { mes: key, ingresos: 0, egresos: 0, ganancia: 0, eventos: 0, ticket_promedio: 0 });
  }

  for (const m of (movimientos ?? []) as { tipo: string; monto: number; fecha: string }[]) {
    const key = m.fecha.slice(0, 7);
    const row = byMes.get(key);
    if (!row) continue;
    if (m.tipo === "ingreso") row.ingresos += Number(m.monto);
    else row.egresos += Number(m.monto);
  }

  for (const e of (eventos ?? []) as { fecha_evento: string }[]) {
    const row = byMes.get(e.fecha_evento.slice(0, 7));
    if (row) row.eventos++;
  }

  const meses = Array.from(byMes.values());
  for (const r of meses) {
    r.ganancia = r.ingresos - r.egresos;
    r.ticket_promedio = r.eventos > 0 ? r.ingresos / r.eventos : 0;
  }

  const totalIngresos = meses.reduce((s, m) => s + m.ingresos, 0);
  const totalGanancia = meses.reduce((s, m) => s + m.ganancia, 0);
  const mejor = meses.reduce<TendenciaMes | null>(
    (best, m) => (best === null || m.ganancia > best.ganancia ? m : best),
    null
  );

  // MoM variation: last full pair of months in the window
  const ultimo = meses[meses.length - 1];
  const anterior = meses[meses.length - 2];
  const variacion_ingresos_pct =
    anterior && anterior.ingresos > 0
      ? ((ultimo.ingresos - anterior.ingresos) / anterior.ingresos) * 100
      : null;

  return {
    meses,
    mejor_mes: mejor && mejor.ganancia !== 0 ? mejor.mes : null,
    promedio_ingresos: totalIngresos / numMeses,
    promedio_ganancia: totalGanancia / numMeses,
    variacion_ingresos_pct,
    margen_promedio_pct: totalIngresos > 0 ? (totalGanancia / totalIngresos) * 100 : null,
  };
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  const { tipo } = await params;
  const sp = request.nextUrl.searchParams;
  const supabase = await createClient();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  // ── Admin-only: financial reports contain sensitive business data ─────────
  const rol = await getUserRol(supabase, user.id);
  if (!hasMinRole(rol, "admin")) {
    return forbiddenResponse("Solo administradores pueden acceder a los reportes");
  }

  // ── Tipo validation ───────────────────────────────────────────────────────
  const VALID_TIPOS = ["kpis", "resumen", "eventos", "clientes", "empleados", "movimientos", "tendencia"];
  if (!VALID_TIPOS.includes(tipo)) {
    return NextResponse.json({ error: `Tipo inválido: ${tipo}` }, { status: 400 });
  }

  try {
    if (tipo === "kpis") {
      return NextResponse.json(await handleKpis(supabase));
    }

    if (tipo === "tendencia") {
      const meses = parseInt(sp.get("meses") ?? "12", 10);
      return NextResponse.json(await handleTendencia(supabase, isNaN(meses) ? 12 : meses));
    }

    const { desde, hasta } = defaultRange(sp);

    switch (tipo) {
      case "resumen":
        return NextResponse.json(await handleResumen(supabase, desde, hasta));
      case "eventos":
        return NextResponse.json(await handleEventos(supabase, desde, hasta));
      case "clientes":
        return NextResponse.json(await handleClientes(supabase, desde, hasta));
      case "empleados":
        return NextResponse.json(await handleEmpleados(supabase, desde, hasta));
      case "movimientos":
        return NextResponse.json(await handleMovimientos(supabase, desde, hasta));
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
