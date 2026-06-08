"use client";

import Image from "next/image";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-chrome px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 h-12 w-12 overflow-hidden rounded-xl">
            <Image
              src="/brand/logo-icon.png"
              alt="Elevateo"
              width={48}
              height={48}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-chrome-text-strong">
            {title}
          </h1>
          <p className="mt-1 text-sm text-chrome-text">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-chrome-border bg-chrome-light p-6">
          {children}
        </div>

        <p className="mt-5 text-center text-sm text-chrome-text">{footer}</p>
      </div>
    </div>
  );
}

export function AuthInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium text-chrome-text-strong">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-chrome-border bg-chrome px-4 py-2.5 text-sm text-chrome-text-strong outline-none transition-colors placeholder:text-chrome-text focus:border-accent"
        style={{ transitionDuration: "var(--duration-fast)" }}
      />
    </label>
  );
}
