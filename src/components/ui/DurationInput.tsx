"use client";

interface DurationInputProps {
  horas: number;
  minutos: number;
  onChange: (horas: number, minutos: number) => void;
  /** Minimum hours allowed (default 1) */
  minHoras?: number;
  required?: boolean;
}

/**
 * Compact inline duration picker rendered as:
 *   [ HH ] h  [ MM ] min
 */
export default function DurationInput({
  horas,
  minutos,
  onChange,
  minHoras = 1,
  required = false,
}: DurationInputProps) {
  function handleHoras(raw: string) {
    const val = Math.max(minHoras, parseInt(raw, 10) || 0);
    onChange(val, minutos);
  }

  function handleMinutos(raw: string) {
    const val = Math.min(59, Math.max(0, parseInt(raw, 10) || 0));
    onChange(horas, val);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={minHoras}
        required={required}
        className="input w-20 text-center"
        value={horas}
        onChange={(e) => handleHoras(e.target.value)}
        aria-label="Horas"
      />
      <span className="text-sm text-gray-400 select-none">h</span>
      <input
        type="number"
        min={0}
        max={59}
        required={required}
        className="input w-20 text-center"
        value={minutos}
        onChange={(e) => handleMinutos(e.target.value)}
        aria-label="Minutos"
      />
      <span className="text-sm text-gray-400 select-none">min</span>
    </div>
  );
}
