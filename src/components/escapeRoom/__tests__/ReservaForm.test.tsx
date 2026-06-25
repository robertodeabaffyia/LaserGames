import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReservaForm from "../ReservaForm";

jest.mock("../EscapeContactoAutocomplete", () => ({
  __esModule: true,
  default: () => <div>contacto-autocomplete</div>,
}));

function makeFetch(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
}

const mockSalas = [{ id: "s1", nombre: "Sala 1", activa: true, created_at: "x" }];
const mockConfig = {
  hora_inicio_reservas: "18:00:00",
  hora_fin_reservas: "23:00:00",
  duracion_bloque_min: 90,
  precio_sala_completa: 30000,
};
const mockPrecios = [
  { cantidad: 2, precio_por_persona: 5000 },
  { cantidad: 4, precio_por_persona: 4000 },
];

const noop = jest.fn();

function setupFetchMock(reservasExistentes: unknown[] = [], turnos: string[] = ["18:00", "19:30"]) {
  global.fetch = jest.fn((url: string) => {
    if (url === "/api/escape/salas") return makeFetch(mockSalas);
    if (url === "/api/escape/config") return makeFetch(mockConfig);
    if (url === "/api/escape/precios") return makeFetch(mockPrecios);
    if (typeof url === "string" && url.startsWith("/api/escape/turnos-disponibles")) return makeFetch(turnos);
    if (typeof url === "string" && url.startsWith("/api/escape/reservas")) return makeFetch(reservasExistentes);
    return makeFetch({});
  }) as jest.Mock;
}

describe("ReservaForm — fecha selector (FIX 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lets the user pick a different date, refetching turnos for it", async () => {
    setupFetchMock();
    const { container } = render(<ReservaForm onSuccess={noop} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/escape/turnos-disponibles"));
    });

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-09-15" } });

    expect(dateInput.value).toBe("2026-09-15");
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("fecha=2026-09-15"));
    });
  });

  it("has a min attribute preventing past dates", async () => {
    setupFetchMock();
    const { container } = render(<ReservaForm onSuccess={noop} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput.min).toBeTruthy();
  });
});

describe("ReservaForm — turno personalizado (FIX 4)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("accepts a custom time with no conflicts", async () => {
    setupFetchMock([]);
    render(<ReservaForm onSuccess={noop} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("turnos-disponibles")));

    const customInput = screen.getByLabelText(/horario personalizado/i) as HTMLInputElement;
    fireEvent.change(customInput, { target: { value: "18:45" } });

    await waitFor(() => {
      expect(screen.queryByText(/superpone|debe estar entre/)).not.toBeInTheDocument();
    });
  });

  it("shows an inline error for a custom time that overlaps an existing reservation", async () => {
    setupFetchMock([
      { sala_id: "s1", fecha: "2026-06-25", hora_inicio: "19:00:00", estado: "reservada" },
    ]);
    render(<ReservaForm onSuccess={noop} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("turnos-disponibles")));

    const customInput = screen.getByLabelText(/horario personalizado/i) as HTMLInputElement;
    // 18:45 + 90min = 20:15, overlaps the 19:00-20:30 existing booking
    fireEvent.change(customInput, { target: { value: "18:45" } });

    await waitFor(() => {
      expect(screen.getByText(/se superpone/)).toBeInTheDocument();
    });
  });

  it("shows an inline error for a custom time outside the configured horario", async () => {
    setupFetchMock([]);
    render(<ReservaForm onSuccess={noop} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("turnos-disponibles")));

    const customInput = screen.getByLabelText(/horario personalizado/i) as HTMLInputElement;
    fireEvent.change(customInput, { target: { value: "23:30" } });

    await waitFor(() => {
      expect(screen.getByText(/debe estar entre/)).toBeInTheDocument();
    });
  });

  it("disables submit while the custom time is invalid", async () => {
    setupFetchMock([
      { sala_id: "s1", fecha: "2026-06-25", hora_inicio: "19:00:00", estado: "reservada" },
    ]);
    render(<ReservaForm onSuccess={noop} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("turnos-disponibles")));

    const customInput = screen.getByLabelText(/horario personalizado/i) as HTMLInputElement;
    fireEvent.change(customInput, { target: { value: "18:45" } });

    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: /crear reserva/i });
      expect(submitBtn).toBeDisabled();
    });
  });
});

describe("ReservaForm — desglose de precio (FIX 5)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the per-person breakdown for modo por_persona", async () => {
    setupFetchMock();
    render(<ReservaForm onSuccess={noop} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("turnos-disponibles")));

    // default cantidad is 2, price for 2 is 5000 => 2 x $5.000 = $10.000
    await waitFor(() => {
      expect(screen.getByText(/2 personas/)).toBeInTheDocument();
      expect(screen.getByText(/\$\s?5\.000/)).toBeInTheDocument();
      expect(screen.getByText(/\$\s?10\.000/)).toBeInTheDocument();
    });
  });

  it("shows the flat room price for modo sala_completa", async () => {
    setupFetchMock();
    render(<ReservaForm onSuccess={noop} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("turnos-disponibles")));

    const modoSelect = screen.getByLabelText(/modo de cobro/i);
    fireEvent.change(modoSelect, { target: { value: "sala_completa" } });

    await waitFor(() => {
      expect(screen.getByText(/precio sala completa/i)).toBeInTheDocument();
      expect(screen.getByText(/\$\s?30\.000/)).toBeInTheDocument();
    });
  });
});
