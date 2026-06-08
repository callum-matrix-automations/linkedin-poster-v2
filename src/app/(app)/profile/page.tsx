"use client";

import { useEffect, useState } from "react";
import { getProfile, saveProfile } from "@/lib/storage";
import { OnboardingInput, ChipSelect } from "@/components/onboarding-input";
import { EMPTY_PROFILE } from "@/lib/types";
import type { UserProfile } from "@/lib/types";

const TONE_OPTIONS = [
  "Direct and authoritative",
  "Conversational and warm",
  "Thought-provoking",
  "Data-driven and analytical",
  "Storytelling",
  "Witty and sharp",
];

const FIELDS: {
  key: keyof UserProfile;
  label: string;
  hint: string;
  placeholder: string;
  multiline?: boolean;
}[] = [
  {
    key: "name",
    label: "Name",
    hint: "How your posts are signed.",
    placeholder: "Your name",
  },
  {
    key: "title",
    label: "Job title",
    hint: "Your role.",
    placeholder: "e.g. Head of Sales, CEO, Account Executive",
  },
  {
    key: "industry",
    label: "Industry",
    hint: "Shapes the language of your posts.",
    placeholder: "e.g. SaaS, Financial Services, Recruitment",
  },
  {
    key: "targetAudience",
    label: "Target audience",
    hint: "Who you want reading your posts.",
    placeholder: "e.g. CTOs at mid-market companies",
  },
  {
    key: "uniqueBackground",
    label: "Unique background",
    hint: "The surprising parts of your path.",
    placeholder: "What's unusual about your career or background?",
    multiline: true,
  },
  {
    key: "contrarian",
    label: "Contrarian view",
    hint: "What you believe that most in your field don't.",
    placeholder: "e.g. 'Cold calling isn't dead. Most people just do it badly.'",
    multiline: true,
  },
  {
    key: "personalStory",
    label: "Personal story",
    hint: "A moment that changed how you work.",
    placeholder: "A specific turning point, lesson, or mistake...",
    multiline: true,
  },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      setMounted(true);
    });
  }, []);

  function update(key: keyof UserProfile, value: string) {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await saveProfile(profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return <div className="min-h-dvh bg-chrome" />;

  return (
    <div className="min-h-dvh bg-chrome px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-chrome-text-strong">
            Your profile
          </h1>
          <p className="text-sm text-chrome-text">
            This shapes how your posts sound. Update it any time.
          </p>
        </header>

        <div className="flex flex-col gap-7">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className="mb-1.5 block text-sm font-medium text-chrome-text-strong">
                {field.label}
              </label>
              <p className="mb-2.5 text-xs text-chrome-text">{field.hint}</p>
              <OnboardingInput
                value={(profile[field.key] as string) || ""}
                onChange={(v) => update(field.key, v)}
                placeholder={field.placeholder}
                multiline={field.multiline}
              />
            </div>
          ))}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-chrome-text-strong">
              Tone
            </label>
            <p className="mb-2.5 text-xs text-chrome-text">
              How you want to come across.
            </p>
            <ChipSelect
              options={TONE_OPTIONS}
              selected={profile.tone}
              onChange={(v) => update("tone", v)}
            />
          </div>
        </div>

        <div className="mt-10 flex items-center gap-3 border-t border-chrome-border pt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:opacity-40"
            style={{
              transitionDuration: "var(--duration-fast)",
              transitionTimingFunction: "var(--ease-out-expo)",
            }}
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
          </button>
          {saved && (
            <span className="text-sm text-accent">Profile updated.</span>
          )}
        </div>
      </div>
    </div>
  );
}
