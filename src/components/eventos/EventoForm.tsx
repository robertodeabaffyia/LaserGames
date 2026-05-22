"use client";

import { useState, useEffect } from "react";
import { EVENTO_ESTADOS, type EventoEstado, type Evento } from "@/types/eventos";

interface Paquete {
  id: string;
  nombre: string;
  precio: number;
  duracion_horas: number;
  duracion_minutos: number;
  cantidad_ninos_incluidos: number;
  cantidad_adultos_incluidos: number;
}

interface Cliente {
  id: string;
  nombre: string;
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

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    cliente_id: evento?.cliente_id ?? "",
    paquete_id: evento?.paquete_id ?? "",
    fecha_evento: evento?.fecha_evento
      ? new Date(evento.fecha_evento).toISOString().slice(0, 16)
      : "",
    nombre_festejado: evento?.nombre_festejado ?? "",
    edad_festejado: evento?.edad_festejado?.toString() ?? "",
    num_invitados: evento?.num_invitados?.toString() ?? "0",
    cantidad_ninos_totales: evento?.cantidad_ninos_totales?.toString() ?? "0",
    cantidad_adultos_totales: evento?.cantidad_adultos_totales?.toString() ?? "0",
    precio_nino_extra: evento?.precio_nino_extra?.toString() ?? "0",
    precio_adulto: evento?.precio_adulto?.toString() ?? "0",
    descuento: evento?.descuento?.toString() ?? "0",
    estado: evento?.estado ?? ("pendiente" as EventoEstado),
    notas: evento?.notas ?? "",
  });

  // Preview calculated price
  const selectedPaquete = paquetes.find((p) => p.id === form.paquete_id);
  const precioBase = selectedPaquete?.precio ?? 0;
  const ninosExtra = Math.max(0, Number(form.cantidad_ninos_totales) - (selectedPaquete?.cantidad_ninos_incluidos ?? 0));
  const adultosExtra = Math.max(0, Number(form.cantidad_adultos_totales) - (selectedPaquete?.cantidad_adultos_incluidos ?? 0));
  const precioPreview =
    precioBase +
    ninosExtra * Number(form.precio_nino_extra) +
    adultosExtra * Number(form.precio_adulto) -
    Number(form.descuento);

  useEffect(() => {
    Promise.all([
      fetch("/api/clientes").then((r) => r.json()),
      fetch("/api/paquetes").then((r) => r.json()),
    ]).then(([c, p]) => {
      setClientes(c ?? []);
      setPaquetes(p ?? []);
    });
  }, []);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const availableEstados = isAdmin
    ? EVENTO_ESTADOS
    : EDITABLE_ESTADOS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      cliente_id: form.cliente_id,
      paquete_id: form.paquete_id,
      fecha_evento: new Date(form.fecha_evento).toISOString(),
      nombre_festejado: form.nombre_festejado,
      edad_festejado: form.edad_festejado ? Number(form.edad_festejado) : null,
      num_invitados: Number(form.num_invitados),
      cantidad_ninos_totales: Number(form.cantidad_ninos_totales),
      cantidad_adultos_totales: Number(form.cantidad_adultos_totales),
      precio_nino_extra: Number(form.precio_nino_extra),
      precio_adulto: Number(form.precio_adulto),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Cliente */}
        <div>
          <label className="label">Cliente *</label>
          <select
            className="input"
            value={form.cliente_id}
            onChange={(e) => set("cliente_id", e.target.value)}
            required
          >
            <option value="">Selecciona un cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

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
                {p.nombre} — ${p.precio.toLocaleString()} ({p.duracion_horas}h)
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
            {/* Admin-only options appended for admins */}
            {!isAdmin &&
              ADMIN_ESTADOS.map((s) => (
                <option key={s} value={s} disabled>
                  {s.charAt(0).toUpperCase() + s.slice(1)} (solo admin)
                </option>
              ))}
          </select>
        </div>

        {/* Festejado */}
        <div>
          <label className="label">Nombre del festejado *</label>
          <input
            type="text"
            className="input"
            placeholder="Nombre del festejado"
            value={form.nombre_festejado}
            onChange={(e) => set("nombre_festejado", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Edad del festejado</label>
          <input
            type="number"
            className="input"
            min={1}
            max={99}
            placeholder="Edad"
            value={form.edad_festejado}
            onChange={(e) => set("edad_festejado", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Invitados totales</label>
          <input
            type="number"
            className="input"
            min={0}
            value={form.num_invitados}
            onChange={(e) => set("num_invitados", e.target.value)}
          />
        </div>
      </div>

      {/* Pricing section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Precios adicionales</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="label">
              Niños totales
              {selectedPaquete && (
                <span className="ml-1 text-gray-500 font-normal">
                  ({selectedPaquete.cantidad_ninos_incluidos} incl.)
                </span>
              )}
            </label>
            <input
              type="number"
              className="input"
              min={0}
              value={form.cantidad_ninos_totales}
              onChange={(e) => set("cantidad_ninos_totales", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Precio / niño extra</label>
            <input
              type="number"
              className="input"
              min={0}
              step="0.01"
              value={form.precio_nino_extra}
              onChange={(e) => set("precio_nino_extra", e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              Adultos totales
              {selectedPaquete && (
                <span className="ml-1 text-gray-500 font-normal">
                  ({selectedPaquete.cantidad_adultos_incluidos} incl.)
                </span>
              )}
            </label>
            <input
              type="number"
              className="input"
              min={0}
              value={form.cantidad_adultos_totales}
              onChange={(e) => set("cantidad_adultos_totales", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Precio / adulto</label>
            <input
              type="number"
              className="input"
              min={0}
              step="0.01"
              value={form.precio_adulto}
              onChange={(e) => set("precio_adulto", e.target.value)}
            />
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
