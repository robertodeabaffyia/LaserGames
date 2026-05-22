"use client";

interface Props {
  filename: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  label?: string;
}

export default function ExportExcel({ filename, data, label = "Excel" }: Props) {
  async function handleExport() {
    const xlsx = await import("xlsx");
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Reporte");
    xlsx.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <button
      onClick={handleExport}
      className="rounded-lg border border-green-800 hover:border-green-600 px-3 py-1.5 text-xs font-medium text-green-400 hover:text-green-300 transition-colors"
    >
      ↓ {label}
    </button>
  );
}
