"use client";

import Link from "next/link";
import type { ClienteConHijos } from "@/types/clientes";

interface ClienteCardProps {
  cliente: ClienteConHijos;
  onEdit: (cliente: ClienteConHijos) => void;
  onDelete: (id: string) => void;
  /** Pre-computed by the parent when a birthday-month filter is active. */
  hijosDestacados?: { nombre: string; dia: string }[];
}

export default function ClienteCard({ cliente, onEdit, onDelete, hijosDestacados }: ClienteCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-base truncate">
            {cliente.nombre}
          </h3>
          {cliente.telefono && (
            <p className="text-gray-400 text-xs mt-0.5">{cliente.telefono}</p>
          )}
          {cliente.email && (
            <p className="text-gray-500 text-xs truncate">{cliente.email}</p>
          )}
        </div>
      </div>

      {cliente.hijos.length > 0 && (
        <p className="text-xs text-gray-500">
          👶 {cliente.hijos.length}{" "}
          {cliente.hijos.length === 1 ? "hijo/a" : "hijos/as"}
        </p>
      )}

      {hijosDestacados && hijosDestacados.length > 0 && (
        <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 space-y-0.5">
          <p className="text-xs font-semibold text-indigo-400 mb-1">🎂 Cumpleaños este mes</p>
          {hijosDestacados.map(({ nombre, dia }) => (
            <p key={nombre + dia} className="text-xs text-gray-300">
              {nombre} — {dia}
            </p>
          ))}
        </div>
      )}

      {cliente.notas && (
        <p className="text-xs text-gray-600 line-clamp-2">{cliente.notas}</p>
      )}

      <div className="flex gap-2 pt-1">
        <Link
          href={`/dashboard/clientes/${cliente.id}`}
          className="flex-1 text-center text-sm rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 py-1.5 transition-colors"
        >
          Ver perfil
        </Link>
        <button
          onClick={() => onEdit(cliente)}
          className="flex-1 text-sm rounded-lg border border-gray-600 text-gray-300 hover:border-indigo-500 hover:text-indigo-400 py-1.5 transition-colors"
        >
          Editar
        </button>
        <button
          onClick={() => onDelete(cliente.id)}
          className="text-sm rounded-lg border border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-400 px-3 py-1.5 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
