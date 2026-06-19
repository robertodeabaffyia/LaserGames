"use client";

import type { PaqueteWithItems } from "@/types/paquetes";
import { formatDuration } from "@/lib/duration";
import { formatMoneda } from "@/lib/moneda";

interface PackageCardProps {
  paquete: PaqueteWithItems;
  onEdit: (paquete: PaqueteWithItems) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
}

function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="4" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}

export default function PackageCard({
  paquete,
  onEdit,
  onDelete,
  dragHandleProps,
  isDragging,
}: PackageCardProps) {
  return (
    <div
      className={`bg-gray-800 rounded-xl p-5 border flex flex-col gap-3 transition-shadow ${
        isDragging
          ? "border-indigo-500 shadow-lg shadow-indigo-900/40 opacity-50"
          : "border-gray-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {dragHandleProps && (
            <button
              type="button"
              {...dragHandleProps}
              className="mt-1 shrink-0 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing focus:outline-none"
              aria-label="Arrastrar para reordenar"
            >
              <GripIcon />
            </button>
          )}
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-lg leading-tight">{paquete.nombre}</h3>
            {paquete.descripcion && (
              <p className="text-gray-400 text-sm mt-0.5 line-clamp-2">{paquete.descripcion}</p>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
            paquete.es_activo
              ? "bg-green-500/20 text-green-400"
              : "bg-gray-600/50 text-gray-400"
          }`}
        >
          {paquete.es_activo ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-400">
        <span className="text-indigo-400 font-bold text-base">
          {formatMoneda(paquete.precio)}
        </span>
        <span>{formatDuration(paquete.duracion_horas, paquete.duracion_minutos)}</span>
      </div>

      <p className="text-sm text-gray-400">
        {paquete.cantidad_ninos_incluidos} niños, {paquete.cantidad_adultos_incluidos} adultos incluidos
      </p>

      {paquete.paquete_items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {paquete.paquete_items.map((pi) => (
            <li
              key={pi.id}
              className="text-xs bg-gray-700 text-gray-300 rounded-md px-2 py-0.5"
            >
              {pi.item.nombre}
              {pi.cantidad > 1 && (
                <span className="text-gray-500 ml-1">×{pi.cantidad}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onEdit(paquete)}
          className="flex-1 text-sm rounded-lg border border-gray-600 text-gray-300 hover:border-indigo-500 hover:text-indigo-400 py-1.5 transition-colors"
        >
          Editar
        </button>
        <button
          onClick={() => onDelete(paquete.id)}
          className="flex-1 text-sm rounded-lg border border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-400 py-1.5 transition-colors"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
