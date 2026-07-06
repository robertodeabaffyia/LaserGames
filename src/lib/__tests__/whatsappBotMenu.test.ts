/**
 * @jest-environment node
 */
import { parseFlujo, esCancelar, MENU_PRINCIPAL } from "../whatsappBotMenu";

describe("parseFlujo", () => {
  it("mapea 1 a cumpleanos", () => {
    expect(parseFlujo("1")).toBe("cumpleanos");
  });

  it("mapea 2 a escape", () => {
    expect(parseFlujo("2")).toBe("escape");
  });

  it("ignora espacios alrededor", () => {
    expect(parseFlujo("  1 ")).toBe("cumpleanos");
  });

  it("devuelve null para opciones desconocidas", () => {
    expect(parseFlujo("3")).toBeNull();
    expect(parseFlujo("hola")).toBeNull();
    expect(parseFlujo("")).toBeNull();
  });
});

describe("esCancelar", () => {
  it("detecta 'cancelar' en cualquier capitalización", () => {
    expect(esCancelar("cancelar")).toBe(true);
    expect(esCancelar("Cancelar")).toBe(true);
    expect(esCancelar("  CANCELAR  ")).toBe(true);
  });

  it("no confunde otras palabras", () => {
    expect(esCancelar("cancelá")).toBe(false);
    expect(esCancelar("1")).toBe(false);
  });
});

describe("MENU_PRINCIPAL", () => {
  it("ofrece ambas opciones", () => {
    expect(MENU_PRINCIPAL).toContain("Cumpleaños");
    expect(MENU_PRINCIPAL).toContain("Escape Room");
  });
});
