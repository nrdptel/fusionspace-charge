"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** A small segmented toggle, used for mode / deploy / unit switches. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-zinc-300 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={
              "rounded-md font-medium transition " +
              pad +
              " " +
              (active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function display(value: number): string {
  return value === 0 ? "" : String(value);
}

/** Numeric input with a label and a unit suffix. Keeps an internal text buffer so
 *  partial entries like "0." survive a render, and re-syncs when the value changes
 *  externally (a unit switch, or loading state from the URL). */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  step,
  min = 0,
  hint,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  hint?: React.ReactNode;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => display(value));
  const last = useRef(value);
  const unitId = useId();

  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(display(value));
    }
  }, [value]);

  return (
    <label className="block">
      <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <div className="mt-1.5 flex items-center rounded-lg border border-zinc-300 bg-white transition focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={text}
          placeholder={placeholder}
          aria-describedby={unit ? unitId : undefined}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            const n = Number.parseFloat(t);
            const v = Number.isFinite(n) ? n : 0;
            last.current = v;
            onChange(v);
          }}
          className="w-full bg-transparent px-3 py-2 text-sm tabular-nums outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
        />
        {unit && (
          <span
            id={unitId}
            className="shrink-0 px-3 text-xs text-zinc-500 dark:text-zinc-400"
          >
            {unit}
          </span>
        )}
      </div>
      {hint && (
        <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </span>
      )}
    </label>
  );
}
