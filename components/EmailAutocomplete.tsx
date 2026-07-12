"use client";

import { useMemo, useRef, useState } from "react";

type Option = { name: string; email: string };

export function EmailAutocomplete({
  options,
  fieldName = "email",
  placeholder,
}: {
  options: Option[];
  fieldName?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter((o) => o.name.toLowerCase().includes(q) || o.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, options]);

  function select(o: Option) {
    setQuery(o.email);
    setOpen(false);
  }

  return (
    <div className="relative flex-1">
      <input
        className="input"
        name={fieldName}
        type="text"
        autoComplete="off"
        placeholder={placeholder ?? "Search by name or email…"}
        value={query}
        required
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay closing so a click on a suggestion registers first.
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && matches[highlight]) {
            e.preventDefault();
            select(matches[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.map((o, i) => (
            <li key={o.email}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === highlight ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
                onMouseDown={(e) => {
                  // onMouseDown fires before the input's onBlur, so the click registers.
                  e.preventDefault();
                  if (blurTimeout.current) clearTimeout(blurTimeout.current);
                  select(o);
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span className="font-medium">{o.name}</span>{" "}
                <span className="text-slate-500">({o.email})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
