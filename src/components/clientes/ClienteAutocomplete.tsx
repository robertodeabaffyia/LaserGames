"use client";

import { useEffect, useRef, useState } from "react";
import type { Cliente } from "@/types/clientes";
import ClienteForm from "./ClienteForm";

export interface HijoResumen {
  id: string;
  nombre: string;
  fecha_nacimiento: string;
}

export interface ClienteResumen {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  hijos: HijoResumen[];
}

interface ClienteAutocompleteProps {
  value: ClienteResumen | null;
  onChange: (cliente: ClienteResumen | null) => void;
  required?: boolean;
}

const MAX_RESULTS = 8;
const DEBOUNCE_MS = 280;

export default function ClienteAutocomplete({
  value,
  onChange,
  required,
}: ClienteAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClienteResumen[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInitialName, setCreateInitialName] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function search(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/clientes?q=${encodeURIComponent(q)}&limit=${MAX_RESULTS}`
        );
        if (res.ok) {
          const data: ClienteResumen[] = await res.json();
          setResults(data);
          setOpen(true);
          setActiveIndex(-1);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    search(q);
  }

  function handleSelect(cliente: ClienteResumen) {
    onChange(cliente);
    setQuery("");
    setOpen(false);
    setResults([]);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setResults([]);
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    const total = results.length + 1; // +1 for "crear" option
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      } else if (activeIndex === results.length) {
        openCreateModal();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function openCreateModal() {
    setCreateInitialName(query);
    setShowCreateModal(true);
    setOpen(false);
  }

  function handleCreateClose(saved: boolean, newCliente?: Cliente) {
    setShowCreateModal(false);
    if (saved && newCliente) {
      // Wrap into ClienteResumen (new client has no hijos yet)
      const resumen: ClienteResumen = {
        id: newCliente.id,
        nombre: newCliente.nombre,
        telefono: newCliente.telefono,
        email: newCliente.email,
        hijos: [],
      };
      onChange(resumen);
      setQuery("");
      setResults([]);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (value) {
    // Selected state: show chip
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-white truncate">{value.nombre}</span>
          {(value.telefono || value.email) && (
            <span className="ml-2 text-xs text-gray-500">
              {value.telefono ?? value.email}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
          title="Cambiar cliente"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="input pr-8"
          placeholder="Buscar por nombre, teléfono o email…"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query && results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          required={required && !value}
          autoComplete="off"
        />

        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
            ⌛
          </span>
        )}

        {open && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 shadow-xl overflow-hidden"
          >
            {results.length === 0 && !loading ? (
              <div className="px-4 py-3 text-sm text-gray-500">Sin resultados</div>
            ) : (
              <ul role="listbox">
                {results.map((c, i) => (
                  <li key={c.id} role="option" aria-selected={activeIndex === i}>
                    <button
                      type="button"
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        activeIndex === i
                          ? "bg-indigo-600 text-white"
                          : "text-gray-200 hover:bg-gray-700"
                      }`}
                      onClick={() => handleSelect(c)}
                      onMouseEnter={() => setActiveIndex(i)}
                    >
                      <span className="font-medium">{c.nombre}</span>
                      {(c.telefono || c.email) && (
                        <span className={`ml-2 text-xs ${activeIndex === i ? "text-indigo-200" : "text-gray-500"}`}>
                          {c.telefono ?? c.email}
                        </span>
                      )}
                      {c.hijos.length > 0 && (
                        <span className={`ml-2 text-xs ${activeIndex === i ? "text-indigo-200" : "text-gray-600"}`}>
                          · {c.hijos.length} hijo{c.hijos.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Create option */}
            <div className="border-t border-gray-700">
              <button
                type="button"
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  activeIndex === results.length
                    ? "bg-indigo-600 text-white"
                    : "text-indigo-400 hover:bg-gray-700"
                }`}
                onClick={openCreateModal}
                onMouseEnter={() => setActiveIndex(results.length)}
              >
                + Crear cliente
                {query && <span className="ml-1 font-medium">"{query}"</span>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick-create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md">
            <ClienteForm
              cliente={
                createInitialName
                  ? ({ nombre: createInitialName } as Cliente)
                  : null
              }
              onClose={handleCreateClose}
            />
          </div>
        </div>
      )}
    </>
  );
}
