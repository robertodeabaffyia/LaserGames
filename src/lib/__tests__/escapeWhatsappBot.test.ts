/**
 * @jest-environment node
 */
import {
  procesarMensaje,
  type BotContexto,
  type DatosConversacion,
} from "../escapeWhatsappBot";

const TELEFONO = "5493871234567";

function makeContexto(overrides: Partial<BotContexto> = {}): BotContexto {
  return {
    listarSalas: jest.fn().mockResolvedValue([
      { id: "s1", nombre: "Qué pasó ayer" },
      { id: "s2", nombre: "El Conjuro" },
    ]),
    turnosDisponibles: jest.fn().mockResolvedValue(["18:00", "19:30", "21:00"]),
    precioPorPersona: jest.fn().mockResolvedValue(5000),
    senaMinima: jest.fn().mockResolvedValue(10000),
    crearReserva: jest.fn().mockResolvedValue({
      ok: true,
      reservaId: "r1",
      linkPago: "https://mpago.la/abc",
    }),
    cancelarReserva: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("procesarMensaje — flujo feliz completo", () => {
  it("recorre inicio → sala → fecha → turno → personas → nombre → confirmar → esperando_pago", async () => {
    const ctx = makeContexto();

    let r = await procesarMensaje("inicio", {}, "hola", TELEFONO, ctx);
    expect(r.estado).toBe("sala");
    expect(r.respuesta).toContain("1. Qué pasó ayer");
    expect(r.respuesta).toContain("2. El Conjuro");

    r = await procesarMensaje(r.estado, r.datos, "2", TELEFONO, ctx);
    expect(r.estado).toBe("fecha");
    expect(r.datos.sala_id).toBe("s2");
    expect(r.respuesta).toContain("El Conjuro");

    r = await procesarMensaje(r.estado, r.datos, "15/08/2026", TELEFONO, ctx);
    expect(r.estado).toBe("turno");
    expect(r.datos.fecha).toBe("2026-08-15");
    expect(r.respuesta).toContain("1. 18:00 hs");
    expect(r.respuesta).toContain("3. 21:00 hs");

    r = await procesarMensaje(r.estado, r.datos, "2", TELEFONO, ctx);
    expect(r.estado).toBe("personas");
    expect(r.datos.hora_inicio).toBe("19:30");

    r = await procesarMensaje(r.estado, r.datos, "4", TELEFONO, ctx);
    expect(r.estado).toBe("nombre");
    expect(r.datos.cantidad_personas).toBe(4);
    expect(r.datos.precio_total).toBe(20000);

    r = await procesarMensaje(r.estado, r.datos, "Roberto", TELEFONO, ctx);
    expect(r.estado).toBe("confirmar");
    // resumen con desglose y seña
    expect(r.respuesta).toContain("4 × $5.000 = $20.000");
    expect(r.respuesta).toContain("$10.000");
    expect(r.respuesta).toContain("15/08/2026");

    r = await procesarMensaje(r.estado, r.datos, "1", TELEFONO, ctx);
    expect(r.estado).toBe("esperando_pago");
    expect(r.datos.reserva_id).toBe("r1");
    expect(r.respuesta).toContain("https://mpago.la/abc");
    expect(ctx.crearReserva).toHaveBeenCalledWith(
      expect.objectContaining({
        sala_id: "s2",
        fecha: "2026-08-15",
        hora_inicio: "19:30",
        cantidad_personas: 4,
        nombre: "Roberto",
        telefono: TELEFONO,
        precio_total: 20000,
        sena: 10000,
      })
    );
  });

  it("la seña se recorta al precio total cuando la seña configurada lo supera", async () => {
    const ctx = makeContexto({
      senaMinima: jest.fn().mockResolvedValue(50000),
      precioPorPersona: jest.fn().mockResolvedValue(5000),
    });
    const datos: DatosConversacion = {
      sala_id: "s1",
      sala_nombre: "Qué pasó ayer",
      fecha: "2026-08-15",
      hora_inicio: "18:00",
      cantidad_personas: 2,
      precio_por_persona: 5000,
      precio_total: 10000,
    };

    const r = await procesarMensaje("nombre", datos, "Ana", TELEFONO, ctx);
    expect(r.datos.sena).toBe(10000);
  });
});

describe("procesarMensaje — entradas inválidas", () => {
  it("repite el menú de salas ante una opción inválida", async () => {
    const ctx = makeContexto();
    const r = await procesarMensaje("sala", {}, "99", TELEFONO, ctx);
    expect(r.estado).toBe("sala");
    expect(r.respuesta).toContain("No entendí");
  });

  it("rechaza una fecha con formato inválido", async () => {
    const ctx = makeContexto();
    const datos = { sala_id: "s1", sala_nombre: "Qué pasó ayer" };
    const r = await procesarMensaje("fecha", datos, "mañana", TELEFONO, ctx);
    expect(r.estado).toBe("fecha");
    expect(r.respuesta).toContain("No pude leer esa fecha");
  });

  it("rechaza una fecha en el pasado", async () => {
    const ctx = makeContexto();
    const datos = { sala_id: "s1", sala_nombre: "Qué pasó ayer" };
    const r = await procesarMensaje("fecha", datos, "01/01/2020", TELEFONO, ctx);
    expect(r.estado).toBe("fecha");
    expect(r.respuesta).toContain("ya pasó");
  });

  it("pide otra fecha cuando no hay turnos disponibles", async () => {
    const ctx = makeContexto({ turnosDisponibles: jest.fn().mockResolvedValue([]) });
    const datos = { sala_id: "s1", sala_nombre: "Qué pasó ayer" };
    const r = await procesarMensaje("fecha", datos, "15/08/2026", TELEFONO, ctx);
    expect(r.estado).toBe("fecha");
    expect(r.respuesta).toContain("No quedan turnos");
  });

  it("rechaza cantidad de personas fuera de 2..10", async () => {
    const ctx = makeContexto();
    const datos = { sala_id: "s1", turnos: ["18:00"], hora_inicio: "18:00" };
    for (const texto of ["1", "11", "abc", "2.5"]) {
      const r = await procesarMensaje("personas", datos, texto, TELEFONO, ctx);
      expect(r.estado).toBe("personas");
    }
  });

  it("informa cuando no hay precio configurado para esa cantidad", async () => {
    const ctx = makeContexto({ precioPorPersona: jest.fn().mockResolvedValue(null) });
    const datos = { sala_id: "s1", hora_inicio: "18:00" };
    const r = await procesarMensaje("personas", datos, "7", TELEFONO, ctx);
    expect(r.estado).toBe("personas");
    expect(r.respuesta).toContain("No tenemos precio configurado");
  });

  it("en confirmar, cualquier cosa distinta de 1/2 repite la pregunta", async () => {
    const ctx = makeContexto();
    const r = await procesarMensaje("confirmar", { sena: 100 }, "si", TELEFONO, ctx);
    expect(r.estado).toBe("confirmar");
    expect(ctx.crearReserva).not.toHaveBeenCalled();
  });
});

describe("procesarMensaje — cancelar", () => {
  it("'cancelar' en cualquier paso reinicia la conversación", async () => {
    const ctx = makeContexto();
    const r = await procesarMensaje(
      "personas",
      { sala_id: "s1", hora_inicio: "18:00" },
      "Cancelar",
      TELEFONO,
      ctx
    );
    expect(r.estado).toBe("sala");
    expect(r.datos).toEqual({});
    expect(ctx.cancelarReserva).not.toHaveBeenCalled();
  });

  it("'cancelar' en esperando_pago cancela la reserva pendiente", async () => {
    const ctx = makeContexto();
    const r = await procesarMensaje(
      "esperando_pago",
      { reserva_id: "r1" },
      "cancelar",
      TELEFONO,
      ctx
    );
    expect(ctx.cancelarReserva).toHaveBeenCalledWith("r1");
    expect(r.estado).toBe("sala");
  });

  it("opción 2 en confirmar descarta y reinicia", async () => {
    const ctx = makeContexto();
    const r = await procesarMensaje("confirmar", { sena: 100 }, "2", TELEFONO, ctx);
    expect(r.estado).toBe("sala");
    expect(ctx.crearReserva).not.toHaveBeenCalled();
  });
});

describe("procesarMensaje — errores al crear la reserva", () => {
  it("cuando crearReserva falla (turno tomado), vuelve al paso fecha", async () => {
    const ctx = makeContexto({
      crearReserva: jest.fn().mockResolvedValue({ ok: false, error: "El turno ya no está disponible" }),
    });
    const datos: DatosConversacion = {
      sala_id: "s1",
      sala_nombre: "Qué pasó ayer",
      fecha: "2026-08-15",
      hora_inicio: "18:00",
      cantidad_personas: 4,
      precio_total: 20000,
      nombre: "Ana",
      sena: 10000,
    };
    const r = await procesarMensaje("confirmar", datos, "1", TELEFONO, ctx);
    expect(r.estado).toBe("fecha");
    expect(r.respuesta).toContain("El turno ya no está disponible");
    // conserva la sala elegida para no arrancar de cero
    expect(r.datos.sala_id).toBe("s1");
  });
});

describe("procesarMensaje — esperando_pago", () => {
  it("responde recordando el pago pendiente sin cambiar de estado", async () => {
    const ctx = makeContexto();
    const r = await procesarMensaje("esperando_pago", { reserva_id: "r1" }, "hola?", TELEFONO, ctx);
    expect(r.estado).toBe("esperando_pago");
    expect(r.datos.reserva_id).toBe("r1");
    expect(r.respuesta).toContain("esperando el pago");
  });
});

describe("procesarMensaje — sin salas activas", () => {
  it("avisa que no hay salas y queda en inicio", async () => {
    const ctx = makeContexto({ listarSalas: jest.fn().mockResolvedValue([]) });
    const r = await procesarMensaje("inicio", {}, "hola", TELEFONO, ctx);
    expect(r.estado).toBe("inicio");
    expect(r.respuesta).toContain("no hay salas disponibles");
  });
});
