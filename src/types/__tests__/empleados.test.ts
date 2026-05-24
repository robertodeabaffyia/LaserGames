/**
 * @jest-environment node
 */
import { getRolesDisponibles, EMPLEADO_ROLES } from "../empleados";

describe("getRolesDisponibles", () => {
  it("admin sees all roles", () => {
    expect(getRolesDisponibles("admin")).toEqual(EMPLEADO_ROLES);
    expect(getRolesDisponibles("admin")).toContain("administrador");
    expect(getRolesDisponibles("admin")).toContain("supervisor");
    expect(getRolesDisponibles("admin")).toContain("general");
  });

  it("supervisor cannot assign administrador", () => {
    const roles = getRolesDisponibles("supervisor");
    expect(roles).not.toContain("administrador");
    expect(roles).toContain("supervisor");
    expect(roles).toContain("general");
  });

  it("general cannot assign administrador", () => {
    const roles = getRolesDisponibles("general");
    expect(roles).not.toContain("administrador");
  });

  it("general can still assign general", () => {
    expect(getRolesDisponibles("general")).toContain("general");
  });

  it("supervisor returns exactly [supervisor, general]", () => {
    expect(getRolesDisponibles("supervisor")).toEqual(["supervisor", "general"]);
  });

  it("general returns exactly [supervisor, general]", () => {
    expect(getRolesDisponibles("general")).toEqual(["supervisor", "general"]);
  });

  it("admin returns all 3 roles in original order", () => {
    expect(getRolesDisponibles("admin")).toEqual(["administrador", "supervisor", "general"]);
  });
});
