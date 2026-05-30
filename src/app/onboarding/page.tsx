"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OnboardingStep } from "@/components/onboarding-step";
import { OnboardingInput, ChipSelect } from "@/components/onboarding-input";
import { getProfile, saveProfile } from "@/lib/storage";
import type { UserProfile } from "@/lib/types";
import { EMPTY_PROFILE } from "@/lib/types";

const TOTAL_STEPS = 6;

const TONE_OPTIONS = [
  "Direct and authoritative",
  "Conversational and warm",
  "Thought-provoking",
  "Data-driven and analytical",
  "Storytelling",
  "Witty and sharp",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setProfile(getProfile());
    setMounted(true);
  }, []);

  const update = useCallback(
    (field: keyof UserProfile, value: string) => {
      setProfile((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const canProceed = (() => {
    switch (step) {
      case 0:
        return profile.name.trim().length > 0 && profile.title.trim().length > 0;
      case 1:
        return profile.industry.trim().length > 0 && profile.targetAudience.trim().length > 0;
      case 2:
        return profile.uniqueBackground.trim().length > 0;
      case 3:
        return profile.contrarian.trim().length > 0;
      case 4:
        return profile.personalStory.trim().length > 0;
      case 5:
        return profile.tone.length > 0;
      default:
        return false;
    }
  })();

  function handleNext() {
    if (!canProceed) return;
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      const completed = { ...profile, completedOnboarding: true };
      saveProfile(completed);
      router.push("/find");
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && canProceed) {
      e.preventDefault();
      handleNext();
    }
  }

  if (!mounted) {
    return <div className="min-h-dvh bg-chrome" />;
  }

  return (
    <div
      className="min-h-dvh bg-chrome"
      style={{
        transition: `opacity var(--duration-normal) var(--ease-out-expo)`,
      }}
    >
      {step === 0 && (
        <OnboardingStep
          step={0}
          totalSteps={TOTAL_STEPS}
          question="Let's start with the basics."
          description="We'll use this to personalize your posts so they sound like you, not a template."
          onNext={handleNext}
          canProceed={canProceed}
        >
          <div className="flex flex-col gap-4">
            <OnboardingInput
              value={profile.name}
              onChange={(v) => update("name", v)}
              placeholder="Your name"
              onKeyDown={handleKeyDown}
            />
            <OnboardingInput
              value={profile.title}
              onChange={(v) => update("title", v)}
              placeholder="Your job title (e.g. Head of Sales, CEO, Account Executive)"
              onKeyDown={handleKeyDown}
            />
          </div>
        </OnboardingStep>
      )}

      {step === 1 && (
        <OnboardingStep
          step={1}
          totalSteps={TOTAL_STEPS}
          question="Who are you talking to?"
          description="Your industry shapes the language. Your audience shapes the angle. Get specific: 'B2B SaaS founders' hits harder than 'business people'."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={canProceed}
        >
          <div className="flex flex-col gap-4">
            <OnboardingInput
              value={profile.industry}
              onChange={(v) => update("industry", v)}
              placeholder="Your industry (e.g. SaaS, Financial Services, Recruitment)"
              onKeyDown={handleKeyDown}
            />
            <OnboardingInput
              value={profile.targetAudience}
              onChange={(v) => update("targetAudience", v)}
              placeholder="Who do you want reading your posts? (e.g. CTOs at mid-market companies)"
              onKeyDown={handleKeyDown}
            />
          </div>
        </OnboardingStep>
      )}

      {step === 2 && (
        <OnboardingStep
          step={2}
          totalSteps={TOTAL_STEPS}
          question="What's unusual about your path?"
          description="The best LinkedIn posts come from unexpected backgrounds. Maybe you were a teacher before tech, ran a restaurant before SaaS, or grew up in a family business. These details make posts memorable."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={canProceed}
        >
          <OnboardingInput
            value={profile.uniqueBackground}
            onChange={(v) => update("uniqueBackground", v)}
            placeholder="What's the most surprising thing about your career path or background?"
            multiline
            onKeyDown={handleKeyDown}
          />
        </OnboardingStep>
      )}

      {step === 3 && (
        <OnboardingStep
          step={3}
          totalSteps={TOTAL_STEPS}
          question="What do you believe that most people in your industry don't?"
          description="Contrarian takes get engagement. Not for the sake of being different, but because real expertise often means seeing things others miss. What's a common practice in your field that you think is wrong?"
          onNext={handleNext}
          onBack={handleBack}
          canProceed={canProceed}
        >
          <OnboardingInput
            value={profile.contrarian}
            onChange={(v) => update("contrarian", v)}
            placeholder="e.g. 'Cold calling isn't dead. Most people just do it badly.'"
            multiline
            onKeyDown={handleKeyDown}
          />
        </OnboardingStep>
      )}

      {step === 4 && (
        <OnboardingStep
          step={4}
          totalSteps={TOTAL_STEPS}
          question="Tell us a story only you can tell."
          description="Think of a moment that changed how you work or think. A deal that fell apart and what it taught you. A mistake that became a breakthrough. A conversation that shifted your perspective. The more specific, the better."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={canProceed}
        >
          <OnboardingInput
            value={profile.personalStory}
            onChange={(v) => update("personalStory", v)}
            placeholder="Share a specific moment, lesson, or turning point from your career..."
            multiline
            onKeyDown={handleKeyDown}
          />
        </OnboardingStep>
      )}

      {step === 5 && (
        <OnboardingStep
          step={5}
          totalSteps={TOTAL_STEPS}
          question="How do you want to come across?"
          description="Pick the voice that feels most like you. We'll use this to shape how your posts read."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={canProceed}
          nextLabel="Finish setup"
        >
          <ChipSelect
            options={TONE_OPTIONS}
            selected={profile.tone}
            onChange={(v) => update("tone", v)}
          />
        </OnboardingStep>
      )}
    </div>
  );
}
