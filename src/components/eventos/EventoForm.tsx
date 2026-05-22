"use client";

import { useState, useEffect } from "react";
import { EVENTO_ESTADOS, type EventoEstado, type Evento } from "@/types/eventos";
import { calcularEdad, MIN_EDAD_FESTEJADO } from "@/lib/validaciones";
import { formatDuration } from "@/lib/duration";
import ClienteAutocomplete, {
  type ClienteResumen,
} from "@/components/clientes/ClienteAutocomplete";

interface Paquete {
  id: string;
  nombre: string;
  precio: number;
  duracion_horas: number;
  duracion_minutos: number;
  cantidad_ninos_incluidos: number;
  cantidad_adultos_incluidos: number;
}

interface EventoFormProps {
  evento?: Evento;
  onSuccess: () => void;
  onCancel: () => void;
  isAdmin?: boolean;
}

const EDITABLE_ESTADOS: EventoEstado[] = ["pendiente", "cotizacion", "confirmado", "en_curso"];
const ADMIN_ESTADOS: EventoEstado[] = ["completado", "cancelado"];

export default function EventoForm({
  evento,
  onSuccess,
  onCancel,
  isAdmin = false,
}: EventoFormProps) {
  const isEditing = !!evento;

  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<ClienteResumen | null>(null);
  const [selectedHijoId, setSelectedHijoId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [precioNinoAdicional, setPrecioNinoAdicional] = useState(0);
  const [precioAdultoAdicional, setPrecioAdultoAdicional] = useState(0);

  const [form, setForm] = useState({
    paquete_id: evento?.paquete_id ?? "",
    fecha_evento: evento?.fecha_evento
      ? new Date(evento.fecha_evento).toISOString().slice(0, 16)
      : "",
    nombre_festejado: evento?.nombre_festejado ?? "",
    edad_festejado: evento?.edad_festejado?.toString() ?? "",
    cantidad_ninos_totales: evento?.cantidad_ninos_totales?.toString() ?? "0",
    cantidad_adultos_totales: evento?.cantidad_adultos_totales?.toString() ?? "0",
    descuento: evento?.descuento?.toString() ?? "0",
    estado: evento?.estado ?? ("pendiente" as EventoEstado),
    notas: evento?.notas ?? "",
  });

  // Price preview
  const selectedPaquete = paquetes.find((p) => p.id === form.paquete_id);
  const precioBase = selectedPaquete?.precio ?? 0;
  const ninosIncluidos = selectedPaquete?.cantidad_ninos_incluidos ?? 0;
  const adultosIncluidos = selectedPaquete?.cantidad_adultos_incluidos ?? 0;
  const ninosAdicionales = Math.max(0, Number(form.cantidad_ninos_totales) - ninosIncluidos);
  const adultosAdicionales = Math.max(0, Number(form.cantidad_adultos_totales) - adultosIncluidos);
  const precioPreview =
    precioBase +
    ninosAdicionales * precioNinoAdicional +
    adultosAdicionales * precioAdultoAdicional -
    Number(form.descuento);

  // Initial data fetch
  useEffect(() => {
    async function init() {
      const [paquetesRes, configRes] = await Promise.all([
        fetch("/api/paquetes"),
        fetch("/api/configuracion"),
      ]);

      const paquetesData = paquetesRes.ok ? await paquetesRes.json() : [];
      setPaquetes(paquetesData ?? []);

      if (configRes.ok) {
        const cfg = await configRes.json();
        setPrecioNinoAdicional(cfg?.precio_nino_adicional ?? 0);
        setPrecioAdultoAdicional(cfg?.precio_adulto_adicional ?? 0);
      }

      // Edit mode: preserve stored prices from the evento record
      if (evento) {
        setPrecioNinoAdicional(evento.precio_nino_extra ?? 0);
        setPrecioAdultoAdicional(evento.precio_adulto ?? 0);
      }

      // Edit mode: load current client for display (no auto-fill — values come from the evento)
      if (evento?.cliente_id) {
        const cliRes = await fetch(`/api/clientes/${evento.cliente_id}`);
        if (cliRes.ok) {
          const c = await cliRes.json();
          setSelectedCliente(c);
        }
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Called only when user actively selects a client via autocomplete
  function handleClienteChange(cliente: ClienteResumen | null) {
    setSelectedCliente(cliente);
    setSelectedHijoId("");

    if (!cliente) return;

    const hijos = cliente.hijos ?? [];
    if (hijos.length === 1) {
      // Single child: auto-fill immediately
      const hijo = hijos[0];
      set("nombre_festejado", hijo.nombre);
      const edad = calcularEdad(hijo.fecha_nacimiento);
      if (edad >= 0) set("edad_festejado", String(edad));
      setSelectedHijoId(hijo.id);
    }
    // Multiple children: dropdown will appear, no auto-fill yet
  }

  // Called when user picks a specific hijo from the dropdown
  function handleHijoSelect(hijoId: string) {
    setSelectedHijoId(hijoId);
    if (!hijoId) return; // "Otro" selected — leave fields editable

    const hijo = selectedCliente?.hijos.find((h) => h.id === hijoId);
    if (!hijo) return;

    set("nombre_festejado", hijo.nombre);
    const edad = calcularEdad(hijo.fecha_nacimiento);
    if (edad >= 0) set("edad_festejado", String(edad));
  }

  const availableEstados = isAdmin ? EVENTO_ESTADOS : EDITABLE_ESTADOS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate edad mínima
    const edadNum = form.edad_festejado ? Number(form.edad_festejado) : null;
    if (edadNum !== null && edadNum < MIN_EDAD_FESTEJADO) {
      setError(`La edad mínima del festejado es ${MIN_EDAD_FESTEJADO} años`);
      return;
    }

    if (!selectedCliente) {
      setError("Selecciona un cliente");
      return;
    }

    setLoading(true);

    const ninosTotales = Number(form.cantidad_ninos_totales);
    const adultosTotales = Number(form.cantidad_adultos_totales);

    const payload = {
      cliente_id: selectedCliente.id,
      paquete_id: form.paquete_id,
      fecha_evento: new Date(form.fecha_evento).toISOString(),
      nombre_festejado: form.nombre_festejado,
      edad_festejado: edadNum,
      num_invitados: ninosTotales + adultosTotales,
      cantidad_ninos_totales: ninosTotales,
      cantidad_adultos_totales: adultosTotales,
      precio_nino_extra: precioNinoAdicional,
      precio_adulto: precioAdultoAdicional,
      descuento: Number(form.descuento),
      estado: form.estado,
      notas: form.notas || null,
    };

    const url = isEditing ? `/api/eventos/${evento!.id}` : "/api/eventos";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al guardar el evento");
      setLoading(false);
      return;
    }

    onSuccess();
  }

  const hijos = selectedCliente?.hijos ?? [];
  const showHijoSelector = hijos.length > 1;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Cliente autocomplete */}
        <div className="sm:col-span-2">
          <label className="label">Cliente *</label>
          <ClienteAutocomplete
            value={selectedCliente}
            onChange={handleClienteChange}
            required
          />
        </div>

        {/* Hijo selector (only when client has multiple children) */}
        {showHijoSelector && (
          <div className="sm:col-span-2">
            <label className="label">¿Quién es el/la festejado/a?</label>
            <select
              className="input"
              value={selectedHijoId}
              onChange={(e) => handleHijoSelect(e.target.value)}
            >
              <option value="">— Selecciona o escribe el nombre abajo —</option>
              {hijos.map((h) => {
                const edad = calcularEdad(h.fecha_nacimiento);
                return (
                  <option key={h.id} value={h.id}>
                    {h.nombre} {edad >= 0 ? `(${edad} años)` : ""}
                  </option>
                );
              })}
              <option value="">Otro / ninguno</option>
            </select>
          </div>
        )}

        {/* Paquete */}
        <div>
          <label className="label">Paquete *</label>
          <select
            className="input"
            value={form.paquete_id}
            onChange={(e) => set("paquete_id", e.target.value)}
            required
          >
            <option value="">Selecciona un paquete</option>
            {paquetes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — ${p.precio.toLocaleString("es-MX")} ({formatDuration(p.duracion_horas, p.duracion_minutos)})
              </option>
            ))}
          </select>
        </div>

        {/* Fecha y hora */}
        <div>
          <label className="label">Fecha y hora *</label>
          <input
            type="datetime-local"
            className="input"
            value={form.fecha_evento}
            onChange={(e) => set("fecha_evento", e.target.value)}
            required
          />
        </div>

        {/* Estado */}
        <div>
          <label className="label">Estado</label>
          <select
            className="input"
            value={form.estado}
            onChange={(e) => set("estado", e.target.value as EventoEstado)}
          >
            {availableEstados.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
              </option>
            ))}
            {!isAdmin &&
              ADMIN_ESTADOS.map((s) => (
                <option key={s} value={s} disabled>
                  {s.charAt(0).toUpperCase() + s.slice(1)} (solo admin)
                </option>
              ))}
          </select>
        </div>

        {/* Nombre festejado */}
        <div>
          <label className="label">
            Nombre del festejado *
            {hijos.length === 1 && (
              <span className="ml-1 text-xs text-gray-500 font-normal">(auto-completado)</span>
            )}
          </label>
          <input
            type="text"
            className="input"
            placeholder="Nombre del festejado"
            value={form.nombre_festejado}
            onChange={(e) => set("nombre_festejado", e.target.value)}
            required
          />
        </div>

        {/* Edad festejado */}
        <div>
          <label className="label">
            Edad del festejado
            <span className="ml-1 text-xs text-gray-500 font-normal">(mín. {MIN_EDAD_FESTEJADO} años)</span>
          </label>
          <input
            type="number"
            className="input"
            min={MIN_EDAD_FESTEJADO}
            max={99}
            placeholder="Edad"
            value={form.edad_festejado}
            onChange={(e) => set("edad_festejado", e.target.value)}
          />
        </div>

      </div>

      {/* Invitados & pricing section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Invitados</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Niños totales</label>
            <input
              type="number"
              className="input"
              min={0}
              value={form.cantidad_ninos_totales}
              onChange={(e) => set("cantidad_ninos_totales", e.target.value)}
            />
            {selectedPaquete && (
              <p className="mt-1 text-xs text-gray-500">
                Incluidos: <span className="text-gray-400">{ninosIncluidos}</span>
                {ninosAdicionales > 0 && (
                  <span className="ml-2 text-yellow-400">
                    + {ninosAdicionales} adicionales
                    {precioNinoAdicional > 0 && (
                      <> × ${precioNinoAdicional.toLocaleString("es-MX")} = ${(ninosAdicionales * precioNinoAdicional).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</>
                    )}
                  </span>
                )}
              </p>
            )}
          </div>
          <div>
            <label className="label">Adultos totales</label>
            <input
              type="number"
              className="input"
              min={0}
              value={form.cantidad_adultos_totales}
              onChange={(e) => set("cantidad_adultos_totales", e.target.value)}
            />
            {selectedPaquete && (
              <p className="mt-1 text-xs text-gray-500">
                Incluidos: <span className="text-gray-400">{adultosIncluidos}</span>
                {adultosAdicionales > 0 && (
                  <span className="ml-2 text-yellow-400">
                    + {adultosAdicionales} adicionales
                    {precioAdultoAdicional > 0 && (
                      <> × ${precioAdultoAdicional.toLocaleString("es-MX")} = ${(adultosAdicionales * precioAdultoAdicional).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</>
                    )}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-end gap-4">
          <div className="w-48">
            <label className="label">Descuento ($)</label>
            <input
              type="number"
              className="input"
              min={0}
              step="0.01"
              value={form.descuento}
              onChange={(e) => set("descuento", e.target.value)}
            />
          </div>
          <div className="flex-1 rounded-lg bg-gray-800/60 border border-gray-700 px-4 py-2.5">
            <span className="text-xs text-gray-400">Total estimado</span>
            <p className="text-lg font-bold text-white">
              ${Math.max(0, precioPreview).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="label">Notas</label>
        <textarea
          className="input min-h-[80px] resize-y"
          placeholder="Observaciones..."
          value={form.notas}
          onChange={(e) => set("notas", e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-5 py-2 text-sm font-semibold text-white transition-colors"
        >
          {loading ? "Guardando…" : isEditing ? "Actualizar evento" : "Crear evento"}
        </button>
      </div>
    </form>
  );
}
