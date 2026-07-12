"use client";

import { useState } from "react";

export function PasswordField({
  id = "password",
  name = "password",
  label = "Password",
  required = true,
  minLength,
  autoComplete,
}: {
  id?: string;
  name?: string;
  label?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(!show)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer focus:outline-none"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <input
        className="input"
        id={id}
        name={name}
        type={show ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
      />
    </div>
  );
}
