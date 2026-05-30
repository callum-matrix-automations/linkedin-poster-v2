"use client";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function OnboardingInput({
  value,
  onChange,
  placeholder,
  multiline = false,
  onKeyDown,
}: TextInputProps) {
  const shared =
    "w-full rounded-lg border border-chrome-border bg-chrome-light px-4 py-3.5 text-base text-chrome-text-strong outline-none transition-colors placeholder:text-chrome-text focus:border-accent";

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={4}
        className={`${shared} resize-none`}
        style={{
          transitionDuration: "var(--duration-fast)",
        }}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={shared}
      style={{
        transitionDuration: "var(--duration-fast)",
      }}
    />
  );
}

interface ChipSelectProps {
  options: string[];
  selected: string;
  onChange: (value: string) => void;
}

export function ChipSelect({ options, selected, onChange }: ChipSelectProps) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-all"
            style={{
              transitionDuration: "var(--duration-fast)",
              transitionTimingFunction: "var(--ease-out-expo)",
              borderColor: isSelected
                ? "var(--accent)"
                : "var(--chrome-border)",
              backgroundColor: isSelected
                ? "oklch(80% 0.13 86 / 0.12)"
                : "transparent",
              color: isSelected
                ? "var(--accent)"
                : "var(--chrome-text)",
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
