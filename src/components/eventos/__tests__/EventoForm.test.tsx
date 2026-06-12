/**
 * EventoForm — precio adicionales sync tests
 *
 * Verifies that EventoForm ALWAYS uses the selected paquete's own prices for
 * niño/adulto adicionales, in both create and edit modes, never stale stored
 * evento prices or global config prices.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import EventoForm from "../EventoForm";
import type { Evento } from "@/types/eventos";

// ─── Mock ClienteAutocomplete (complex, not under test) ───────────────────────
jest.mock("@/components/clientes/ClienteAutocomplete", () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (c: null) => void }) => (
    <button onClick={() => onChange(null)}>select-client</button>
  ),
}));

// ─── Shared fixtures ──────────────────────────────────────────────────────────
const mockPaquete = {
  id: "pkg-1",
  nombre: "Paquete Estándar",
  precio: 5000,
  duracion_horas: 2,
  duracion_minutos: 0,
  cantidad_ninos_incluidos: 10,
  cantidad_adultos_incluidos: 5,
  precio_nino_adicional: 250,
  precio_adulto_adicional: 150,
};

function makeFetch(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

const noop = jest.fn();

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("EventoForm — precio adicionales sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn((url: string) => {
      if (url === "/api/paquetes") return makeFetch([mockPaquete]);
      // cliente fetch in edit mode
      if (typeof url === "string" && url.startsWith("/api/clientes/"))
        return makeFetch({ id: "cli-1", nombre: "Test Cliente", telefono: null, email: null });
      return makeFetch({});
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("new mode: fetches paquetes on mount", async () => {
    render(<EventoForm onSuccess={noop} onCancel={noop} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/paquetes");
    });

    // Config endpoint is no longer fetched by EventoForm
    expect(global.fetch).not.toHaveBeenCalledWith("/api/configuracion");
  });

  it("edit mode: uses paquete prices, ignores stored evento.precio_nino_extra and evento.precio_adulto", async () => {
    // Evento with stale stored prices that differ from the paquete's own prices
    const eventoWithStalePrice: Evento = {
      id: "evt-1",
      cliente_id: "cli-1",
      paquete_id: "pkg-1",
      promocion_id: null,
      fecha_evento: "2026-06-01T15:00:00Z",
      nombre_festejado: "Luisa",
      edad_festejado: 7,
      num_invitados: 14,
      cantidad_ninos_totales: 12,  // 2 extras above the 10 included
      cantidad_adultos_totales: 6, // 1 extra above the 5 included
      precio_nino_extra: 999,      // stale — paquete has 250
      precio_adulto: 888,          // stale — paquete has 150
      descuento: 0,
      duracion_horas: 2,
      duracion_minutos: 0,
      estado: "pendiente",
      precio_total: 5000,
      notas: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };

    render(
      <EventoForm
        evento={eventoWithStalePrice}
        onSuccess={noop}
        onCancel={noop}
        isAdmin={false}
      />
    );

    // Wait for init() to resolve; it fetches paquetes and sets prices from the paquete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/paquetes");
    });

    // The component should render the correct breakdown using paquete prices
    // (stale values 999 and 888 should NOT appear anywhere)
    await waitFor(() => {
      expect(screen.queryByText(/999/)).not.toBeInTheDocument();
      expect(screen.queryByText(/888/)).not.toBeInTheDocument();
    });
  });

  it("edit mode: breakdown uses paquete's precio_nino_adicional in additional price display", async () => {
    const eventoWithExtras: Evento = {
      id: "evt-2",
      cliente_id: "cli-1",
      paquete_id: "pkg-1",
      promocion_id: null,
      fecha_evento: "2026-06-01T15:00:00Z",
      nombre_festejado: "Carlos",
      edad_festejado: 8,
      num_invitados: 13,
      cantidad_ninos_totales: 13, // 3 extras above 10 included
      cantidad_adultos_totales: 5,
      precio_nino_extra: 0,       // stale: would show $0 in breakdown if used
      precio_adulto: 0,
      descuento: 0,
      duracion_horas: 2,
      duracion_minutos: 0,
      estado: "pendiente",
      precio_total: 5000,
      notas: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };

    render(
      <EventoForm
        evento={eventoWithExtras}
        onSuccess={noop}
        onCancel={noop}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/paquetes");
    });

    // With 3 extra niños at $250 each; paquete's price 250 should appear in the input
    // The editable input for precio_nino_adicional is pre-filled from the paquete
    await waitFor(() => {
      expect(screen.getByDisplayValue("250")).toBeInTheDocument();
    });
  });
});
