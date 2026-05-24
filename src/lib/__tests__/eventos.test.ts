/**
 * @jest-environment node
 */
import { calcularPrecioTotal, fechaEventoToISO, combineFechaHora, eventoFechaToLocal, hayConflicto, type EventoSlot } from "../eventos";

describe("calcularPrecioTotal", () => {
  it("returns paquete price when no extras (all within included counts)", () => {
    expect(
      calcularPrecioTotal({
        precioPaquete: 3000,
        cantidadNinosTotales: 5,
        ninosIncluidos: 10,
        precioNinoExtra: 0,
        cantidadAdultosTotales: 2,
        adultosIncluidos: 5,
        precioAdulto: 0,
        descuento: 0,
      })
    ).toBe(3000);
  });

  it("adds extra children cost (total exceeds included)", () => {
    // 10 total - 5 included = 5 extra x 100 = 500
    expect(
      calcularPrecioTotal({
        precioPaquete: 2000,
        cantidadNinosTotales: 10,
        ninosIncluidos: 5,
        precioNinoExtra: 100,
        cantidadAdultosTotales: 0,
        adultosIncluidos: 5,
        precioAdulto: 0,
        descuento: 0,
      })
    ).toBe(2500);
  });

  it("adds adult cost (total exceeds included)", () => {
    // 5 total - 2 included = 3 extra x 200 = 600
    expect(
      calcularPrecioTotal({
        precioPaquete: 2000,
        cantidadNinosTotales: 0,
        ninosIncluidos: 10,
        precioNinoExtra: 0,
        cantidadAdultosTotales: 5,
        adultosIncluidos: 2,
        precioAdulto: 200,
        descuento: 0,
      })
    ).toBe(2600);
  });

  it("subtracts discount from total", () => {
    // ninos: 4 total - 2 included = 2 extra x 150 = 300
    // adultos: 3 total - 2 included = 1 extra x 100 = 100
    // 3000 + 300 + 100 - 500 = 2900
    expect(
      calcularPrecioTotal({
        precioPaquete: 3000,
        cantidadNinosTotales: 4,
        ninosIncluidos: 2,
        precioNinoExtra: 150,
        cantidadAdultosTotales: 3,
        adultosIncluidos: 2,
        precioAdulto: 100,
        descuento: 500,
      })
    ).toBe(2900);
  });

  it("clamps to 0 when discount exceeds subtotal", () => {
    expect(
      calcularPrecioTotal({
        precioPaquete: 500,
        cantidadNinosTotales: 0,
        ninosIncluidos: 10,
        precioNinoExtra: 0,
        cantidadAdultosTotales: 0,
        adultosIncluidos: 5,
        precioAdulto: 0,
        descuento: 1000,
      })
    ).toBe(0);
  });

  it("calculates full price with all params", () => {
    // ninos: 9 total - 5 included = 4 extra x 120 = 480
    // adultos: 4 total - 2 included = 2 extra x 80 = 160
    // 1500 + 480 + 160 - 200 = 1940
    expect(
      calcularPrecioTotal({
        precioPaquete: 1500,
        cantidadNinosTotales: 9,
        ninosIncluidos: 5,
        precioNinoExtra: 120,
        cantidadAdultosTotales: 4,
        adultosIncluidos: 2,
        precioAdulto: 80,
        descuento: 200,
      })
    ).toBe(1940);
  });

  it("does not charge for guests within included counts (no negative extras)", () => {
    expect(
      calcularPrecioTotal({
        precioPaquete: 2000,
        cantidadNinosTotales: 3,
        ninosIncluidos: 10,
        precioNinoExtra: 500,
        cantidadAdultosTotales: 1,
        adultosIncluidos: 5,
        precioAdulto: 300,
        descuento: 0,
      })
    ).toBe(2000);
  });
});

// ── fechaEventoToISO ──────────────────────────────────────────────────────────

describe("fechaEventoToISO", () => {
  it("converts a datetime-local string to a valid ISO-8601 string", () => {
    const result = fechaEventoToISO("2026-06-15T14:30");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("preserves the correct date part", () => {
    const result = fechaEventoToISO("2026-06-15T00:00");
    expect(result).toMatch(/^2026-06-15/);
  });

  it("returns different ISO strings for different datetime-local inputs", () => {
    const a = fechaEventoToISO("2026-06-15T10:00");
    const b = fechaEventoToISO("2026-06-15T12:00");
    expect(a).not.toBe(b);
  });

  it("does not mutate the input string", () => {
    const input = "2026-07-04T09:00";
    fechaEventoToISO(input);
    expect(input).toBe("2026-07-04T09:00");
  });
});

// ── eventoFechaToLocal ────────────────────────────────────────────────────────
// All assertions are timezone-agnostic: we test the round-trip identity
//   combineFechaHora(eventoFechaToLocal(ts)) === original timestamp
// rather than asserting specific UTC digits, which would break in CI
// environments with a different UTC offset.

describe("eventoFechaToLocal", () => {
  it("returns an object with fecha and hora string keys", () => {
    const result = eventoFechaToLocal("2026-05-23T18:30:00.000Z");
    expect(typeof result.fecha).toBe("string");
    expect(typeof result.hora).toBe("string");
  });

  it("fecha is formatted as YYYY-MM-DD", () => {
    const { fecha } = eventoFechaToLocal("2026-05-23T18:30:00.000Z");
    expect(fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("hora is formatted as HH:MM", () => {
    const { hora } = eventoFechaToLocal("2026-05-23T18:30:00.000Z");
    expect(hora).toMatch(/^\d{2}:\d{2}$/);
  });

  it("round-trips losslessly through combineFechaHora (core timezone correctness)", () => {
    // Simulates the full edit-form cycle:
    //   DB timestamp → eventoFechaToLocal → user sees local time in form
    //   → user saves → combineFechaHora → same UTC timestamp back in DB
    const original = "2026-05-23T18:30:00.000Z";
    const { fecha, hora } = eventoFechaToLocal(original);
    const roundTripped = combineFechaHora(fecha, hora);
    expect(new Date(roundTripped).getTime()).toBe(new Date(original).getTime());
  });

  it("round-trip holds for midnight UTC", () => {
    const original = "2026-12-31T00:00:00.000Z";
    const { fecha, hora } = eventoFechaToLocal(original);
    expect(new Date(combineFechaHora(fecha, hora)).getTime())
      .toBe(new Date(original).getTime());
  });

  it("round-trip holds for an arbitrary timestamp with non-zero minutes", () => {
    const original = "2026-07-04T21:45:00.000Z";
    const { fecha, hora } = eventoFechaToLocal(original);
    expect(new Date(combineFechaHora(fecha, hora)).getTime())
      .toBe(new Date(original).getTime());
  });

  it("does NOT use UTC digits directly (regression guard for the 3h-shift bug)", () => {
    // If the machine running this test is not UTC, and we were naively slicing
    // .toISOString(), the hora would differ from the local-time value.
    // The round-trip test above already catches this; this test makes it explicit.
    const original = "2026-05-23T18:30:00.000Z";
    const { fecha, hora } = eventoFechaToLocal(original);
    const localDate = new Date(original);
    const expectedHora = [
      String(localDate.getHours()).padStart(2, "0"),
      String(localDate.getMinutes()).padStart(2, "0"),
    ].join(":");
    expect(hora).toBe(expectedHora);
  });
});

// ── combineFechaHora ──────────────────────────────────────────────────────────

describe("combineFechaHora", () => {
  it("combines date and time strings into a valid ISO timestamp", () => {
    const result = combineFechaHora("2026-06-15", "14:30");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("preserves the correct date when combining", () => {
    const result = combineFechaHora("2026-06-15", "10:00");
    expect(result).toMatch(/^2026-06-15/);
  });

  it("produces different timestamps for different hora values (hour editing works)", () => {
    const morning = combineFechaHora("2026-06-15", "09:00");
    const evening = combineFechaHora("2026-06-15", "19:00");
    expect(morning).not.toBe(evening);
  });

  it("produces different timestamps for different minute values", () => {
    const t1 = combineFechaHora("2026-06-15", "10:00");
    const t2 = combineFechaHora("2026-06-15", "10:30");
    expect(t1).not.toBe(t2);
  });

  it("falls back to midnight local time when hora is empty", () => {
    const result = combineFechaHora("2026-06-15", "");
    // Must be a valid ISO-8601 string.
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // The local-midnight timestamp must equal what fechaEventoToISO produces for the same date+00:00.
    expect(result).toBe(fechaEventoToISO("2026-06-15T00:00"));
  });

  it("is equivalent to fechaEventoToISO for the same combined string", () => {
    expect(combineFechaHora("2026-06-15", "14:30")).toBe(
      fechaEventoToISO("2026-06-15T14:30")
    );
  });
});

// ── calcularPrecioTotal — EventoForm preview scenarios ────────────────────────
// Verify that changing fecha_evento does NOT affect the price calculation
// (pricing depends only on paquete, guest counts, and descuento).

describe("calcularPrecioTotal — price is independent of fecha_evento", () => {
  const baseParams = {
    precioPaquete: 3000,
    cantidadNinosTotales: 8,
    ninosIncluidos: 5,
    precioNinoExtra: 150,
    cantidadAdultosTotales: 3,
    adultosIncluidos: 2,
    precioAdulto: 100,
    descuento: 200,
  };
  // 3 extra ninos × 150 = 450; 1 extra adulto × 100 = 100; 3000+450+100-200 = 3350
  const expectedPrice = 3350;

  it("returns the correct preview for the base scenario", () => {
    expect(calcularPrecioTotal(baseParams)).toBe(expectedPrice);
  });

  it("returns the same price regardless of which fecha_evento is chosen (price is fecha-independent)", () => {
    // Simulate user changing the date picker — price should not change.
    const fechas = [
      "2026-06-15T10:00",
      "2026-12-31T23:59",
      "2027-01-01T00:00",
    ];
    for (const _ of fechas) {
      // calcularPrecioTotal has no fecha_evento param — this asserts the
      // contract that fecha changes cannot silently corrupt pricing.
      expect(calcularPrecioTotal(baseParams)).toBe(expectedPrice);
    }
  });

  it("recalculates correctly when guest counts change (simulates form re-render)", () => {
    // Add 2 more ninos → 5 extra total
    const updated = { ...baseParams, cantidadNinosTotales: 10 };
    // 5 extra ninos × 150 = 750; 1 extra adulto × 100 = 100; 3000+750+100-200 = 3650
    expect(calcularPrecioTotal(updated)).toBe(3650);
  });

  it("recalculates correctly when descuento changes (simulates form re-render)", () => {
    const updated = { ...baseParams, descuento: 500 };
    // 3000+450+100-500 = 3050
    expect(calcularPrecioTotal(updated)).toBe(3050);
  });

  it("recalculates correctly when paquete changes (simulates paquete dropdown change)", () => {
    const updated = { ...baseParams, precioPaquete: 5000, ninosIncluidos: 10, adultosIncluidos: 5 };
    // No extras (8<=10, 3<=5) → 5000-200 = 4800
    expect(calcularPrecioTotal(updated)).toBe(4800);
  });
});

describe("hayConflicto", () => {
  const makeSlot = (
    id: string,
    fecha_evento: string,
    duracion_horas: number,
    duracion_minutos = 0
  ): EventoSlot => ({ id, fecha_evento, duracion_horas, duracion_minutos });

  const prop = (fecha_evento: string, duracion_horas: number, duracion_minutos = 0) => ({
    fecha_evento,
    duracion_horas,
    duracion_minutos,
  });

  it("returns false when no existing events", () => {
    expect(hayConflicto(prop("2026-06-01T10:00:00Z", 2), [])).toBe(false);
  });

  it("returns true for exact overlap (same start time)", () => {
    const existing = [makeSlot("e1", "2026-06-01T10:00:00Z", 2)];
    expect(hayConflicto(prop("2026-06-01T10:00:00Z", 2), existing)).toBe(true);
  });

  it("returns true when proposed starts inside existing event", () => {
    const existing = [makeSlot("e1", "2026-06-01T10:00:00Z", 2)];
    expect(hayConflicto(prop("2026-06-01T11:00:00Z", 2), existing)).toBe(true);
  });

  it("returns true when proposed ends inside existing event", () => {
    const existing = [makeSlot("e1", "2026-06-01T12:00:00Z", 2)];
    expect(hayConflicto(prop("2026-06-01T10:00:00Z", 3), existing)).toBe(true);
  });

  it("returns false when events are adjacent (no overlap)", () => {
    const existing = [makeSlot("e1", "2026-06-01T10:00:00Z", 2)];
    expect(hayConflicto(prop("2026-06-01T12:00:00Z", 2), existing)).toBe(false);
  });

  it("returns false when proposed is completely before existing", () => {
    const existing = [makeSlot("e1", "2026-06-01T14:00:00Z", 2)];
    expect(hayConflicto(prop("2026-06-01T10:00:00Z", 2), existing)).toBe(false);
  });

  it("excludes the specified id (self-edit scenario)", () => {
    const existing = [makeSlot("self", "2026-06-01T10:00:00Z", 2)];
    expect(hayConflicto(prop("2026-06-01T10:00:00Z", 2), existing, "self")).toBe(false);
  });

  it("still detects conflict with other events when excludeId is set", () => {
    const existing = [
      makeSlot("self", "2026-06-01T10:00:00Z", 2),
      makeSlot("other", "2026-06-01T11:00:00Z", 2),
    ];
    expect(hayConflicto(prop("2026-06-01T10:00:00Z", 2), existing, "self")).toBe(true);
  });

  it("detects overlap using duracion_minutos (minute-level precision)", () => {
    // Existing: 10:00-12:30 (2h30m); Proposed: 12:00-14:00 -> overlap 12:00-12:30
    const existing = [makeSlot("e1", "2026-06-01T10:00:00Z", 2, 30)];
    expect(hayConflicto(prop("2026-06-01T12:00:00Z", 2, 0), existing)).toBe(true);
  });

  it("returns false when gap is exactly filled by duracion_minutos", () => {
    // Existing: 10:00-12:30; Proposed: 12:30-14:30 -> adjacent, no overlap
    const existing = [makeSlot("e1", "2026-06-01T10:00:00Z", 2, 30)];
    expect(hayConflicto(prop("2026-06-01T12:30:00Z", 2, 0), existing)).toBe(false);
  });
});
