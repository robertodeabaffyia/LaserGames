/**
 * @jest-environment node
 */
import {
  calcularPrecioReserva,
  generarTurnosDisponibles,
  horarioEsValido,
  validarTurnoPersonalizado,
  type ReservaExistente,
} from "../escapeRoom";

describe("calcularPrecioReserva", () => {
  const preciosPorPersona = { 2: 5000, 3: 4500, 4: 4000, 5: 3800, 10: 3000 };

  it("modo sala_completa returns the flat price regardless of cantidad_personas", () => {
    expect(
      calcularPrecioReserva({
        modo_cobro: "sala_completa",
        cantidad_personas: 6,
        preciosPorPersona,
        precioSalaCompleta: 30000,
      })
    ).toBe(30000);
  });

  it("modo sala_completa ignores preciosPorPersona entirely", () => {
    expect(
      calcularPrecioReserva({
        modo_cobro: "sala_completa",
        cantidad_personas: 2,
        preciosPorPersona: {},
        precioSalaCompleta: 25000,
      })
    ).toBe(25000);
  });

  it("modo por_persona multiplies cantidad by the configured price for that group size", () => {
    expect(
      calcularPrecioReserva({
        modo_cobro: "por_persona",
        cantidad_personas: 4,
        preciosPorPersona,
        precioSalaCompleta: 30000,
      })
    ).toBe(16000);
  });

  it("modo por_persona at the minimum boundary (2)", () => {
    expect(
      calcularPrecioReserva({
        modo_cobro: "por_persona",
        cantidad_personas: 2,
        preciosPorPersona,
        precioSalaCompleta: 30000,
      })
    ).toBe(10000);
  });

  it("modo por_persona at the maximum boundary (10)", () => {
    expect(
      calcularPrecioReserva({
        modo_cobro: "por_persona",
        cantidad_personas: 10,
        preciosPorPersona,
        precioSalaCompleta: 30000,
      })
    ).toBe(30000);
  });

  it("rejects cantidad_personas below 2 for por_persona", () => {
    expect(() =>
      calcularPrecioReserva({
        modo_cobro: "por_persona",
        cantidad_personas: 1,
        preciosPorPersona,
        precioSalaCompleta: 30000,
      })
    ).toThrow(/entre 2 y 10/);
  });

  it("rejects cantidad_personas above 10 for por_persona", () => {
    expect(() =>
      calcularPrecioReserva({
        modo_cobro: "por_persona",
        cantidad_personas: 11,
        preciosPorPersona,
        precioSalaCompleta: 30000,
      })
    ).toThrow(/entre 2 y 10/);
  });

  it("rejects a non-integer cantidad_personas for por_persona", () => {
    expect(() =>
      calcularPrecioReserva({
        modo_cobro: "por_persona",
        cantidad_personas: 3.5,
        preciosPorPersona,
        precioSalaCompleta: 30000,
      })
    ).toThrow(/entre 2 y 10/);
  });

  it("throws when there is no configured price for that exact cantidad", () => {
    expect(() =>
      calcularPrecioReserva({
        modo_cobro: "por_persona",
        cantidad_personas: 7,
        preciosPorPersona: { 2: 5000 },
        precioSalaCompleta: 30000,
      })
    ).toThrow(/No hay precio configurado/);
  });
});

describe("generarTurnosDisponibles", () => {
  const base = {
    fecha: "2026-07-01",
    sala_id: "sala-1",
    horaInicio: "18:00",
    horaFin: "23:00",
    duracionBloqueMin: 90,
  };

  it("steps by duracionBloqueMin from horaInicio, stopping once a slot wouldn't fit before horaFin", () => {
    const turnos = generarTurnosDisponibles({ ...base, reservasExistentes: [] });
    // 18:00, 19:30, 21:00 fit (21:00+90=22:30 <= 23:00); 22:30+90=00:00 > 23:00 so excluded
    expect(turnos).toEqual(["18:00", "19:30", "21:00"]);
  });

  it("excludes a slot that exactly matches an existing non-cancelled reservation", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "19:30", estado: "reservada" },
    ];
    const turnos = generarTurnosDisponibles({ ...base, reservasExistentes });
    expect(turnos).toEqual(["18:00", "21:00"]);
  });

  it("excludes a slot within duracionBloqueMin of an existing reservation, even if not grid-aligned", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "19:00", estado: "reservada" },
    ];
    const turnos = generarTurnosDisponibles({ ...base, reservasExistentes });
    // 19:00 is 60min from 18:00 and 30min from 19:30 — both within the 90min block, so both excluded
    expect(turnos).toEqual(["21:00"]);
  });

  it("ignores cancelled reservations — that slot stays available", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "19:30", estado: "cancelada" },
    ];
    const turnos = generarTurnosDisponibles({ ...base, reservasExistentes });
    expect(turnos).toEqual(["18:00", "19:30", "21:00"]);
  });

  it("ignores reservations for a different room", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-2", fecha: "2026-07-01", hora_inicio: "19:30", estado: "reservada" },
    ];
    const turnos = generarTurnosDisponibles({ ...base, reservasExistentes });
    expect(turnos).toEqual(["18:00", "19:30", "21:00"]);
  });

  it("ignores reservations for a different date", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-1", fecha: "2026-07-02", hora_inicio: "19:30", estado: "reservada" },
    ];
    const turnos = generarTurnosDisponibles({ ...base, reservasExistentes });
    expect(turnos).toEqual(["18:00", "19:30", "21:00"]);
  });

  it("returns an empty list when every slot is booked", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "18:00", estado: "reservada" },
      { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "19:30", estado: "reservada" },
      { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "21:00", estado: "reservada" },
    ];
    const turnos = generarTurnosDisponibles({ ...base, reservasExistentes });
    expect(turnos).toEqual([]);
  });

  it("returns an empty list when duracionBloqueMin is zero or negative", () => {
    expect(generarTurnosDisponibles({ ...base, duracionBloqueMin: 0, reservasExistentes: [] })).toEqual([]);
    expect(generarTurnosDisponibles({ ...base, duracionBloqueMin: -10, reservasExistentes: [] })).toEqual([]);
  });

  it("handles HH:MM:SS time strings from Postgres TIME columns", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "19:30:00", estado: "reservada" },
    ];
    const turnos = generarTurnosDisponibles({
      ...base,
      horaInicio: "18:00:00",
      horaFin: "23:00:00",
      reservasExistentes,
    });
    expect(turnos).toEqual(["18:00", "21:00"]);
  });

  // A horario that closes at/after midnight (e.g. 18:00 → 00:00) is a valid
  // overnight range, not an inverted/empty one — this is the real config a
  // user hit in production: 18:00 → 00:00 was producing zero turnos before
  // this was treated as "18:00 today → 00:00 (24:00) today", a 6h window.
  it("treats horaFin of 00:00 as midnight — end of an overnight window, not the start", () => {
    const turnos = generarTurnosDisponibles({
      ...base,
      horaInicio: "18:00",
      horaFin: "00:00",
      duracionBloqueMin: 90,
      reservasExistentes: [],
    });
    expect(turnos).toEqual(["18:00", "19:30", "21:00", "22:30"]);
  });

  it("generates turnos past midnight for a horario like 23:00 → 02:00, wrapping the displayed time", () => {
    const turnos = generarTurnosDisponibles({
      ...base,
      horaInicio: "23:00",
      horaFin: "02:00",
      duracionBloqueMin: 60,
      reservasExistentes: [],
    });
    expect(turnos).toEqual(["23:00", "00:00", "01:00"]);
  });

  it("excludes a post-midnight slot that conflicts with an existing overnight reservation", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "00:00", estado: "reservada" },
    ];
    const turnos = generarTurnosDisponibles({
      ...base,
      horaInicio: "23:00",
      horaFin: "02:00",
      duracionBloqueMin: 60,
      reservasExistentes,
    });
    expect(turnos).toEqual(["23:00", "01:00"]);
  });
});

describe("horarioEsValido", () => {
  it("returns true when horaFin is later than horaInicio (same day)", () => {
    expect(horarioEsValido("18:00", "23:00")).toBe(true);
  });

  it("returns false when horaFin equals horaInicio", () => {
    expect(horarioEsValido("18:00", "18:00")).toBe(false);
  });

  it("returns true for an overnight range where horaFin is midnight", () => {
    expect(horarioEsValido("18:00", "00:00")).toBe(true);
  });

  it("returns true for an overnight range that closes after midnight", () => {
    expect(horarioEsValido("23:00", "02:00")).toBe(true);
  });

  it("handles HH:MM:SS strings from Postgres TIME columns", () => {
    expect(horarioEsValido("18:00:00", "23:00:00")).toBe(true);
    expect(horarioEsValido("18:00:00", "00:00:00")).toBe(true);
  });
});

describe("validarTurnoPersonalizado", () => {
  const base = {
    fecha: "2026-07-01",
    sala_id: "sala-1",
    horaInicioReservas: "18:00",
    horaFinReservas: "23:00",
    duracionBloqueMin: 90,
  };

  it("does not throw for a valid, non-conflicting custom time", () => {
    expect(() =>
      validarTurnoPersonalizado({ ...base, horaInicio: "18:45", reservasExistentes: [] })
    ).not.toThrow();
  });

  it("throws when the custom time starts before horaInicioReservas", () => {
    expect(() =>
      validarTurnoPersonalizado({ ...base, horaInicio: "17:30", reservasExistentes: [] })
    ).toThrow(/debe estar entre/);
  });

  it("throws when the slot would extend past horaFinReservas", () => {
    expect(() =>
      validarTurnoPersonalizado({ ...base, horaInicio: "22:00", reservasExistentes: [] })
    ).toThrow(/debe estar entre/);
  });

  it("throws when the custom time overlaps an existing reservation, even off-grid", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "19:00", estado: "reservada" },
    ];
    // 18:45 + 90min = 20:15, overlaps the 19:00-20:30 existing booking
    expect(() =>
      validarTurnoPersonalizado({ ...base, horaInicio: "18:45", reservasExistentes })
    ).toThrow(/se superpone/);
  });

  it("allows a custom time that exactly abuts an existing reservation with no overlap", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "19:30", estado: "reservada" },
    ];
    // 18:00-19:30 ends exactly when the existing 19:30 booking starts — no overlap
    expect(() =>
      validarTurnoPersonalizado({ ...base, horaInicio: "18:00", reservasExistentes })
    ).not.toThrow();
  });

  it("ignores cancelled reservations when checking for overlap", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "19:00", estado: "cancelada" },
    ];
    expect(() =>
      validarTurnoPersonalizado({ ...base, horaInicio: "18:45", reservasExistentes })
    ).not.toThrow();
  });

  it("ignores reservations in a different room", () => {
    const reservasExistentes: ReservaExistente[] = [
      { sala_id: "sala-2", fecha: "2026-07-01", hora_inicio: "19:00", estado: "reservada" },
    ];
    expect(() =>
      validarTurnoPersonalizado({ ...base, horaInicio: "18:45", reservasExistentes })
    ).not.toThrow();
  });

  describe("overnight horario (closes at/after midnight)", () => {
    const overnightBase = {
      fecha: "2026-07-01",
      sala_id: "sala-1",
      horaInicioReservas: "18:00",
      horaFinReservas: "00:00",
      duracionBloqueMin: 90,
    };

    it("allows a custom time that ends exactly at midnight", () => {
      expect(() =>
        validarTurnoPersonalizado({ ...overnightBase, horaInicio: "22:30", reservasExistentes: [] })
      ).not.toThrow();
    });

    it("rejects a custom time that would extend past midnight", () => {
      expect(() =>
        validarTurnoPersonalizado({ ...overnightBase, horaInicio: "23:00", reservasExistentes: [] })
      ).toThrow(/debe estar entre/);
    });

    it("accepts a post-midnight custom time when the horario extends past 00:00", () => {
      // horario 18:00→02:00 (duracion 90): the last valid post-midnight start is 00:30.
      expect(() =>
        validarTurnoPersonalizado({
          ...overnightBase,
          horaFinReservas: "02:00",
          horaInicio: "00:15",
          reservasExistentes: [],
        })
      ).not.toThrow();
    });

    it("detects an overlap with an existing post-midnight reservation", () => {
      const reservasExistentes: ReservaExistente[] = [
        { sala_id: "sala-1", fecha: "2026-07-01", hora_inicio: "00:15", estado: "reservada" },
      ];
      expect(() =>
        validarTurnoPersonalizado({
          ...overnightBase,
          horaFinReservas: "02:00",
          horaInicio: "00:00",
          reservasExistentes,
        })
      ).toThrow(/se superpone/);
    });
  });
});
