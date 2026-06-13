"use client";

import { useState } from "react";

interface PasswordInputProps {
  id: string;
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Password input with a show/hide toggle. Works uncontrolled (server-action
 * forms, via `name`) or controlled (via `value`/`onChange`).
 */
export default function PasswordInput({
  id,
  name,
  autoComplete,
  placeholder = "••••••••",
  required,
  value,
  onChange,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 pr-11 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
      >
        {visible ? "🙈" : "👁️"}
      </button>
    </div>
  );
}
