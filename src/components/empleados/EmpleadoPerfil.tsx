"use client";

import { useState } from "react";
import type { Empleado, RegistroHoras } from "@/types/empleados";
import { formatearHoras } from "@/lib/registros-horas";
import RegistroHorasForm from "./RegistroHorasForm";

interface EmpleadoPerfilProps {
  empleado: Empleado & { registros_horas: RegistroHoras[] };
  onRefresh: () => void;
}

export default function EmpleadoPerfil({ empleado, onRefresh }: EmpleadoPerfilProps) {
  const [showForm, setShowForm] = useState(false);

  const totalHoras = empleado.registros_horas.reduce(
    (s, r) => s + Number(r.horas_trabajadas),
    0
  );
  const costTotal =
    empleado.tarifa_horaria != null ? totalHoras * empleado.tarifa_horaria : null;

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    await fetch(`/api/registros-horas/${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function handleExportXlsx() {
    const res = await fetch(`/api/empleados/${empleado.id}/reporte?formato=xlsx`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${empleado.nombre.replace(/\s+/g, "_")}_historial.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportPdf() {
    // Use jsPDF client-side to generate a print-ready PDF
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Perfil: ${empleado.nombre}`, 14, 20);

    doc.setFontSize(10);
    doc.text(`DNI: ${empleado.dni ?? "—"}`, 14, 30);
    doc.text(`Rol: ${empleado.rol}`, 14, 36);
    doc.text(`Tarifa/h: ${empleado.tarifa_horaria != null ? `$${empleado.tarifa_horaria}` : "—"}`, 14, 42);
    doc.text(`Total horas: ${formatearHoras(totalHoras)}`, 14, 48);
    if (costTotal != null) {
      doc.text(`Costo total: $${costTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, 14, 54);
    }

    // Table header
    let y = 65;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Fecha", 14, y);
    doc.text("Entrada", 50, y);
    doc.text("Salida", 75, y);
    doc.text("Horas", 100, y);
    doc.text("Notas", 120, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    for (const r of empleado.registros_horas) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(r.fecha, 14, y);
      doc.text(r.hora_entrada.slice(0, 5), 50, y);
      doc.text(r.hora_salida.slice(0, 5), 75, y);
      doc.text(String(r.horas_trabajadas), 100, y);
      doc.text((r.notas ?? "").slice(0, 30), 120, y);
      y += 6;
    }

    doc.save(`${empleado.nombre.replace(/\s+/g, "_")}_historial.pdf`);
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400 mb-1">Total horas</p>
          <p className="text-lg font-bold text-white">{formatearHoras(totalHoras)}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400 mb-1">Registros</p>
          <p className="text-lg font-bold text-white">{empleado.registros_horas.length}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-xs text-gray-400 mb-1">Costo total</p>
          <p className="text-lg font-bold text-green-400">
            {costTotal != null
              ? `$${costTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
              : "—"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Historial de horas</h3>
        <div className="flex gap-2">
          <button
            onClick={handleExportPdf}
            className="rounded-lg border border-gray-700 hover:border-gray-500 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white transition-colors"
          >
            ↓ PDF
          </button>
          <button
            onClick={handleExportXlsx}
            className="rounded-lg border border-gray-700 hover:border-gray-500 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white transition-colors"
          >
            ↓ Excel
          </button>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              + Registrar horas
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <RegistroHorasForm
            empleadoId={empleado.id}
            onSuccess={() => { setShowForm(false); onRefresh(); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* History table */}
      {empleado.registros_horas.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-10 text-center text-sm text-gray-500">
          Sin registros de horas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Salida</th>
                <th className="px-4 py-3 text-right">Horas</th>
                {empleado.tarifa_horaria != null && (
                  <th className="px-4 py-3 text-right">Costo</th>
                )}
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {empleado.registros_horas.map((r) => (
                <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-200">{r.fecha}</td>
                  <td className="px-4 py-3 text-gray-300">{r.hora_entrada.slice(0, 5)}</td>
                  <td className="px-4 py-3 text-gray-300">{r.hora_salida.slice(0, 5)}</td>
                  <td className="px-4 py-3 text-right font-medium text-white">
                    {formatearHoras(Number(r.horas_trabajadas))}
                  </td>
                  {empleado.tarifa_horaria != null && (
                    <td className="px-4 py-3 text-right text-green-400">
                      $
                      {(empleado.tarifa_horaria * Number(r.horas_trabajadas)).toLocaleString(
                        "es-MX",
                        { minimumFractionDigits: 2 }
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-400 text-xs">{r.notas ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-red-400 hover:text-red-300 text-xs transition-colors"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
