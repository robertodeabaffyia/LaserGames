const formatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoneda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "$0";
  return formatter.format(valor);
}
