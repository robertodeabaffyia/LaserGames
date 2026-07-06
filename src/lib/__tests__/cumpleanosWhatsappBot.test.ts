/**
 * @jest-environment node
 */
import {
  procesarMensajeCumple,
  preguntarPaquetes,
  type CumpleContexto,
  type DatosCumple,
} from "../cumpleanosWhatsappBot";

const TELEFONO = "5493871234567";

const PAQUETE = {
  id: "p1",
  nombre: "Fiesta Full",
  precio: 50000,
  cantidad_ninos_incluidos: 10,
  cantidad_adultos_incluidos: 5,
  precio_nino_adicional: 2000,
  precio_adulto_adicional: 1500,
  max_invitados: 40,
};

function makeContexto(overrides: Partial<CumpleContexto> = {}): CumpleContexto {
  return {
    listarPaquetes: jest.fn().mockResolvedValue([
      PAQUETE,
      { ...PAQUETE, id: "p2", nombre: "Básico", precio: 30000 },
    ]),
    senaMinima: jest.fn().mockResolvedValue(15000),
    crearEvento: jest.fn().mockResolvedValue({
      ok: true,
      eventoId: "ev1",
      linkPago: "https://mpago.la/xyz",
    }),
    cancelarEvento: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("procesarMensajeCumple — flujo feliz completo", () => {
  it("recorre paquete → fecha → hora → festejado → ninos → adultos → nombre → confirmar → esperando_pago", async () => {
    const ctx = makeContexto();

    let r = await preguntarPaquetes(ctx, "¡Genial!");
    expect(r.estado).toBe("paquete");
    expect(r.respuesta).toContain("1. Fiesta Full");

    r = await procesarMensajeCumple("paquete", r.datos, "1", TELEFONO, ctx);
    expect(r.estado).toBe("fecha");
    expect(r.datos.paquete_id).toBe("p1");

    r = await procesarMensajeCumple("fecha", r.datos, "15/08/2026", TELEFONO, ctx);
    expect(r.estado).toBe("hora");
    expect(r.datos.fecha).toBe("2026-08-15");

    r = await procesarMensajeCumple("hora", r.datos, "16:30", TELEFONO, ctx);
    expect(r.estado).toBe("festejado");
    expect(r.datos.hora).toBe("16:30");

    r = await procesarMensajeCumple("festejado", r.datos, "Mateo", TELEFONO, ctx);
    expect(r.estado).toBe("ninos");

    r = await procesarMensajeCumple("ninos", r.datos, "12", TELEFONO, ctx);
    expect(r.estado).toBe("adultos");
    expect(r.datos.cantidad_ninos).toBe(12);

    r = await procesarMensajeCumple("adultos", r.datos, "6", TELEFONO, ctx);
    expect(r.estado).toBe("nombre");
    expect(r.datos.cantidad_adultos).toBe(6);

    r = await procesarMensajeCumple("nombre", r.datos, "Roberto", TELEFONO, ctx);
    expect(r.estado).toBe("confirmar");
    // precio: 50000 + 2 niños extra × 2000 + 1 adulto extra × 1500 = 55500
    expect(r.datos.precio_total).toBe(55500);
    expect(r.datos.sena).toBe(15000);
    expect(r.respuesta).toContain("55.500");
    expect(r.respuesta).toContain("Mateo");

    r = await procesarMensajeCumple("confirmar", r.datos, "1", TELEFONO, ctx);
    expect(r.estado).toBe("esperando_pago");
    expect(r.datos.evento_id).toBe("ev1");
    expect(r.respuesta).toContain("https://mpago.la/xyz");
    expect(ctx.crearEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        paquete_id: "p1",
        nombre_festejado: "Mateo",
        cantidad_ninos: 12,
        cantidad_adultos: 6,
        nombre_contacto: "Roberto",
        telefono: TELEFONO,
        precio_total: 55500,
        sena: 15000,
      })
    );
  });

  it("no cobra extras cuando la cantidad está dentro de lo incluido", async () => {
    const ctx = makeContexto();
    const datos: DatosCumple = {
      paquete_id: "p1",
      paquete_nombre: "Fiesta Full",
      precio_paquete: 50000,
      ninos_incluidos: 10,
      adultos_incluidos: 5,
      precio_nino_adicional: 2000,
      precio_adulto_adicional: 1500,
      fecha: "2026-08-15",
      hora: "16:30",
      festejado: "Mateo",
      cantidad_ninos: 8,
      cantidad_adultos: 3,
    };
    const r = await procesarMensajeCumple("nombre", datos, "Ana", TELEFONO, ctx);
    expect(r.datos.precio_total).toBe(50000);
  });

  it("recorta la seña al precio total cuando la configurada lo supera", async () => {
    const ctx = makeContexto({ senaMinima: jest.fn().mockResolvedValue(80000) });
    const datos: DatosCumple = {
      precio_paquete: 50000,
      ninos_incluidos: 10,
      adultos_incluidos: 5,
      precio_nino_adicional: 2000,
      precio_adulto_adicional: 1500,
      fecha: "2026-08-15",
      hora: "16:30",
      festejado: "Mateo",
      cantidad_ninos: 0,
      cantidad_adultos: 0,
    };
    const r = await procesarMensajeCumple("nombre", datos, "Ana", TELEFONO, ctx);
    expect(r.datos.sena).toBe(50000);
  });
});

describe("procesarMensajeCumple — entradas inválidas", () => {
  it("repite el menú de paquetes ante una opción inválida", async () => {
    const ctx = makeContexto();
    const r = await procesarMensajeCumple("paquete", {}, "99", TELEFONO, ctx);
    expect(r.estado).toBe("paquete");
    expect(r.respuesta).toContain("No entendí");
  });

  it("rechaza una fecha con formato inválido", async () => {
    const ctx = makeContexto();
    const r = await procesarMensajeCumple("fecha", { paquete_id: "p1" }, "mañana", TELEFONO, ctx);
    expect(r.estado).toBe("fecha");
    expect(r.respuesta).toContain("No pude leer esa fecha");
  });

  it("rechaza una fecha en el pasado", async () => {
    const ctx = makeContexto();
    const r = await procesarMensajeCumple("fecha", { paquete_id: "p1" }, "01/01/2020", TELEFONO, ctx);
    expect(r.estado).toBe("fecha");
    expect(r.respuesta).toContain("ya pasó");
  });

  it("rechaza una hora con formato inválido", async () => {
    const ctx = makeContexto();
    const r = await procesarMensajeCumple("hora", { fecha: "2026-08-15" }, "25:99", TELEFONO, ctx);
    expect(r.estado).toBe("hora");
    expect(r.respuesta).toContain("No pude leer esa hora");
  });

  it("rechaza una cantidad de niños no numérica", async () => {
    const ctx = makeContexto();
    const r = await procesarMensajeCumple("ninos", { festejado: "Mateo" }, "muchos", TELEFONO, ctx);
    expect(r.estado).toBe("ninos");
  });

  it("en confirmar, cualquier cosa distinta de 1/2 repite la pregunta", async () => {
    const ctx = makeContexto();
    const r = await procesarMensajeCumple("confirmar", { sena: 100 }, "quizás", TELEFONO, ctx);
    expect(r.estado).toBe("confirmar");
    expect(ctx.crearEvento).not.toHaveBeenCalled();
  });

  it("opción 2 en confirmar descarta y vuelve a los paquetes", async () => {
    const ctx = makeContexto();
    const r = await procesarMensajeCumple("confirmar", { sena: 100 }, "2", TELEFONO, ctx);
    expect(r.estado).toBe("paquete");
    expect(ctx.crearEvento).not.toHaveBeenCalled();
  });
});

describe("procesarMensajeCumple — error al crear el evento", () => {
  it("cuando crearEvento falla, vuelve al paso fecha conservando el paquete", async () => {
    const ctx = makeContexto({
      crearEvento: jest.fn().mockResolvedValue({ ok: false, error: "No se pudo generar el link de pago" }),
    });
    const datos: DatosCumple = {
      paquete_id: "p1",
      paquete_nombre: "Fiesta Full",
      precio_paquete: 50000,
      ninos_incluidos: 10,
      adultos_incluidos: 5,
      precio_nino_adicional: 2000,
      precio_adulto_adicional: 1500,
      fecha: "2026-08-15",
      hora: "16:30",
      festejado: "Mateo",
      cantidad_ninos: 12,
      cantidad_adultos: 6,
      precio_total: 55500,
      nombre: "Roberto",
      sena: 15000,
    };
    const r = await procesarMensajeCumple("confirmar", datos, "1", TELEFONO, ctx);
    expect(r.estado).toBe("fecha");
    expect(r.respuesta).toContain("No se pudo generar el link de pago");
    expect(r.datos.paquete_id).toBe("p1");
  });
});

describe("preguntarPaquetes — sin paquetes activos", () => {
  it("avisa que no hay paquetes", async () => {
    const ctx = makeContexto({ listarPaquetes: jest.fn().mockResolvedValue([]) });
    const r = await preguntarPaquetes(ctx, "¡Genial!");
    expect(r.estado).toBe("paquete");
    expect(r.respuesta).toContain("no hay paquetes disponibles");
  });
});
