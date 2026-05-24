"use client";

import { formatFechaHora } from "@/lib/fecha";

interface Props {
  filename: string;
  title: string;
  columns: string[];
  rows: string[][];
  summary?: [string, string][];
  label?: string;
}

export default function ExportPDF({ filename, title, columns, rows, summary, label = "PDF" }: Props) {
  async function handleExport() {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Title
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text(title, 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generado: ${formatFechaHora(new Date())}`, 14, 25);

    // Summary block
    let y = 32;
    if (summary && summary.length > 0) {
      doc.setFontSize(9);
      summary.forEach(([k, v]) => {
        doc.setTextColor(80, 80, 80);
        doc.text(`${k}:`, 14, y);
        doc.setTextColor(40, 40, 40);
        doc.text(v, 60, y);
        y += 5;
      });
      y += 3;
    }

    // Table header
    const colW = Math.floor((270 - 14) / columns.length);
    doc.setFillColor(55, 65, 81);
    doc.rect(14, y, 266, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    columns.forEach((col, i) => {
      doc.text(col, 14 + i * colW + 2, y + 5);
    });
    y += 8;

    // Table rows
    rows.forEach((row, ri) => {
      if (y > 185) {
        doc.addPage();
        y = 14;
      }
      if (ri % 2 === 0) {
        doc.setFillColor(248, 249, 250);
        doc.rect(14, y, 266, 6, "F");
      }
      doc.setTextColor(50, 50, 50);
      row.forEach((cell, i) => {
        const text = String(cell ?? "");
        doc.text(text.length > 30 ? text.slice(0, 27) + "…" : text, 14 + i * colW + 2, y + 4);
      });
      y += 6;
    });

    doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <button
      onClick={handleExport}
      className="rounded-lg border border-red-800 hover:border-red-600 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
    >
      ↓ {label}
    </button>
  );
}
