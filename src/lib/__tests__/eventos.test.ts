/**
 * @jest-environment node
 */
import { calcularPrecioTotal, hayConflicto, type EventoSlot } from "../eventos";

describe("calcularPrecioTotal", () => {
  it("returns paquete price when no extras or discount", () => {
    expect(
      calcularPrecioTotal({
        precioPaquete: 3000,
        numNinosExtra: 0,
        precioNinoExtra: 0,
        numAdultos: 0,
        precioAdulto: 0,
        descuento: 0,
      })
    ).toBe(3000);
  });

  it("adds extra children cost", () => {
    expect(
      calcularPrecioTotal({
        precioPaquete: 2000,
        numNinosExtra: 5,
        precioNinoExtra: 100,
        numAdultos: 0,
        precioAdulto: 0,
        descuento: 0,
      })
    ).toBe(2500);
  });

  it("adds adult cost", () => {
    expect(
      calcularPrecioTotal({
        precioPaquete: 2000,
        numNinosExtra: 0,
        precioNinoExtra: 0,
        numAdultos: 3,
        precioAdulto: 200,
        descuento: 0,
      })
    ).toBe(2600);
  });

  it("subtracts discount from total", () => {
    expect(
      calcularPrecioTotal({
        precioPaquete: 3000,
        numNinosExtra: 2,
        precioNinoExtra: 150,
        numAdultos: 1,
        precioAdulto: 100,
        descuento: 500,
      })
    ).toBe(2900); // 3000 + 300 + 100 - 500 = 2900
  });

  it("clamps to 0 when discount exceeds subtotal", () => {
    expect(
      calcularPrecioTotal({
        precioPaquete: 500,
        numNinosExtra: 0,
        precioNinoExtra: 0,
        numAdultos: 0,
        precioAdulto: 0,
        descuento: 1000,
      })
    ).toBe(0);
  });

  it("calculates full price with all params", () => {
    // 1500 + (4 × 120) + (2 × 80) - 200 = 1500 + 480 + 160 - 200 = 1940
    expect(
      calcularPrecioTotal({
        precioPaquete: 1500,
        numNinosExtra: 4,
        precioNinoExtra: 120,
        numAdultos: 2,
        precioAdulto: 80,
        descuento: 200,
      })
    ).toBe(1940);
  });
});

describe("hayConflicto", () => {
  const makeSlot = (id: string, fecha_evento: string, duracion_horas: number): EventoSlot => ({
    id,
    fecha_evento,
    duracion_horas,
  });

  it("returns false when no existing events", () => {
    expect(
      hayConflicto({ fecha_evento: "2026-06-01T10:00:00Z", duracion_horas: 2 }, [])
    ).toBe(false);
  });

  it("returns true for exact overlap (same start time)", () => {
    const existing = [makeSlot("e1", "2026-06-01T10:00:00Z", 2)];
    expect(
      hayConflicto({ fecha_evento: "2026-06-01T10:00:00Z", duracion_horas: 2 }, existing)
    ).toBe(true);
  });

  it("returns true when proposed starts inside existing event", () => {
    // Existing: 10:00–12:00; Proposed: 11:00–13:00
    const existing = [makeSlot("e1", "2026-06-01T10:00:00Z", 2)];
    expect(
      hayConflicto({ fecha_evento: "2026-06-01T11:00:00Z", duracion_horas: 2 }, existing)
    ).toBe(true);
  });

  it("returns true when proposed ends inside existing event", () => {
    // Existing: 12:00–14:00; Proposed: 10:00–13:00
    const existing = [makeSlot("e1", "2026-06-01T12:00:00Z", 2)];
    expect(
      hayConflicto({ fecha_evento: "2026-06-01T10:00:00Z", duracion_horas: 3 }, existing)
    ).toBe(true);
  });

  it("returns false when events are adjacent (no overlap)", () => {
    // Existing: 10:00–12:00; Proposed: 12:00–14:00
    const existing = [makeSlot("e1", "2026-06-01T10:00:00Z", 2)];
    expect(
      hayConflicto({ fecha_evento: "2026-06-01T12:00:00Z", duracion_horas: 2 }, existing)
    ).toBe(false);
  });

  it("returns false when proposed is completely before existing", () => {
    // Existing: 14:00–16:00; Proposed: 10:00–12:00
    const existing = [makeSlot("e1", "2026-06-01T14:00:00Z", 2)];
    expect(
      hayConflicto({ fecha_evento: "2026-06-01T10:00:00Z", duracion_horas: 2 }, existing)
    ).toBe(false);
  });

  it("excludes the specified id (self-edit scenario)", () => {
    // Would normally conflict, but excluded
    const existing = [makeSlot("self", "2026-06-01T10:00:00Z", 2)];
    expect(
      hayConflicto({ fecha_evento: "2026-06-01T10:00:00Z", duracion_horas: 2 }, existing, "self")
    ).toBe(false);
  });

  it("still detects conflict with other events when excludeId is set", () => {
    const existing = [
      makeSlot("self", "2026-06-01T10:00:00Z", 2),
      makeSlot("other", "2026-06-01T11:00:00Z", 2),
    ];
    expect(
      hayConflicto({ fecha_evento: "2026-06-01T10:00:00Z", duracion_horas: 2 }, existing, "self")
    ).toBe(true);
  });
});
