"use client";

import Image from "next/image";

interface OnboardingStepProps {
  step: number;
  totalSteps: number;
  question: string;
  description?: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  canProceed: boolean;
  nextLabel?: string;
}

export function OnboardingStep({
  step,
  totalSteps,
  question,
  description,
  children,
  onNext,
  onBack,
  canProceed,
  nextLabel = "Continue",
}: OnboardingStepProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl">
        <div className="mb-10 flex items-center gap-2.5">
          <div className="h-8 w-8 overflow-hidden rounded-md">
            <Image
              src="/brand/logo-icon.png"
              alt="Elevateo"
              width={32}
              height={32}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <span className="gold-text text-sm font-semibold uppercase tracking-[0.2em]">
            Elevateo
          </span>
        </div>

        <div className="mb-12 flex gap-1.5">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                transitionDuration: "var(--duration-normal)",
                transitionTimingFunction: "var(--ease-out-expo)",
                backgroundColor:
                  i < step
                    ? "var(--accent)"
                    : i === step
                      ? "var(--chrome-text-strong)"
                      : "var(--chrome-border)",
              }}
            />
          ))}
        </div>

        <p className="mb-3 text-sm font-medium tracking-wide text-chrome-text">
          Step {step + 1} of {totalSteps}
        </p>

        <h1 className="mb-3 text-3xl font-semibold leading-tight tracking-tight text-chrome-text-strong">
          {question}
        </h1>

        {description && (
          <p className="mb-10 text-base leading-relaxed text-chrome-text">
            {description}
          </p>
        )}

        <div className="mb-12">{children}</div>

        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg px-5 py-3 text-sm font-medium text-chrome-text transition-colors hover:text-chrome-text-strong"
              style={{
                transitionDuration: "var(--duration-fast)",
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={!canProceed}
            className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30"
            style={{
              transitionDuration: "var(--duration-fast)",
              transitionTimingFunction: "var(--ease-out-expo)",
            }}
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
