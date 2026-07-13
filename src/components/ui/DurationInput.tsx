"use client";

import { useState } from "react";
import { parseHoras, parseMinutos, trimLeadingZeros, MAX_HORAS, MAX_MINUTOS } from "@/lib/duration";

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
 *
 * Validation rules:
 * - Both fields accept at most 2 digits (maxLength behaviour enforced in JS
 *   because maxLength has no effect on type="number").
 * - horas: 1–24; minutos: 0–59.
 * - Values outside range are auto-corrected on blur.
 * - Leading zeros are trimmed on blur ("030" → "30").
 * - An inline error is shown while the field holds a value that cannot be
 *   parsed as a valid integer.
 */
export default function DurationInput({
  horas,
  minutos,
  onChange,
  minHoras = 1,
  required = false,
}: DurationInputProps) {
  // Raw string state lets the user type freely; we validate on change and blur.
  const [rawH, setRawH] = useState(String(horas));
  const [rawM, setRawM] = useState(String(minutos));
  const [errorH, setErrorH] = useState<string | null>(null);
  const [errorM, setErrorM] = useState<string | null>(null);

  // Keep raw values in sync when the parent resets the controlled prop, using
  // the React-recommended "adjust state during render" pattern (tracking the
  // previous prop) instead of an effect — avoids an extra render and the
  // set-state-in-effect lint rule.
  const [prevHoras, setPrevHoras] = useState(horas);
  if (horas !== prevHoras) {
    setPrevHoras(horas);
    setRawH(String(horas));
  }
  const [prevMinutos, setPrevMinutos] = useState(minutos);
  if (minutos !== prevMinutos) {
    setPrevMinutos(minutos);
    setRawM(String(minutos));
  }

  // ── Horas ────────────────────────────────────────────────────────────────
  function handleHorasChange(raw: string) {
    // Enforce maxLength=2 (type="number" ignores the maxLength attribute).
    const sliced = raw.slice(0, 2);
    setRawH(sliced);

    const parsed = parseHoras(sliced, minHoras);
    if (parsed === null) {
      setErrorH("Valor inválido");
      return;
    }
    setErrorH(null);
    onChange(parsed, minutos);
  }

  function handleHorasBlur() {
    const parsed = parseHoras(rawH, minHoras);
    if (parsed === null) {
      // Auto-correct to minimum on blur.
      setRawH(String(minHoras));
      setErrorH(null);
      onChange(minHoras, minutos);
    } else {
      setRawH(trimLeadingZeros(String(parsed)));
      setErrorH(null);
      onChange(parsed, minutos);
    }
  }

  // ── Minutos ───────────────────────────────────────────────────────────────
  function handleMinutosChange(raw: string) {
    const sliced = raw.slice(0, 2);
    setRawM(sliced);

    const parsed = parseMinutos(sliced);
    if (parsed === null) {
      setErrorM("Valor inválido");
      return;
    }
    // Auto-correct > 59 immediately (requirement 3).
    setErrorM(null);
    onChange(horas, parsed); // parseMinutos already clamps to MAX_MINUTOS
  }

  function handleMinutosBlur() {
    const parsed = parseMinutos(rawM);
    if (parsed === null) {
      setRawM("0");
      setErrorM(null);
      onChange(horas, 0);
    } else {
      setRawM(trimLeadingZeros(String(parsed)));
      setErrorM(null);
      onChange(horas, parsed);
    }
  }

  const hasError = errorH !== null || errorM !== null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={minHoras}
          max={MAX_HORAS}
          maxLength={2}
          required={required}
          className={`input w-20 text-center ${errorH ? "border-red-500 focus:ring-red-500" : ""}`}
          value={rawH}
          onChange={(e) => handleHorasChange(e.target.value)}
          onBlur={handleHorasBlur}
          aria-label="Horas"
          aria-invalid={errorH !== null}
        />
        <span className="text-sm text-gray-400 select-none">h</span>
        <input
          type="number"
          min={0}
          max={MAX_MINUTOS}
          maxLength={2}
          required={required}
          className={`input w-20 text-center ${errorM ? "border-red-500 focus:ring-red-500" : ""}`}
          value={rawM}
          onChange={(e) => handleMinutosChange(e.target.value)}
          onBlur={handleMinutosBlur}
          aria-label="Minutos"
          aria-invalid={errorM !== null}
        />
        <span className="text-sm text-gray-400 select-none">min</span>
      </div>

      {hasError && (
        <p className="mt-1 text-xs text-red-400" role="alert">
          {errorH ?? errorM}
        </p>
      )}
    </div>
  );
}
