"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { FeedbackBanner } from "@/components/feedback-banner";
import { AppDataProvider, useProfile } from "@/components/app-data-provider";
import { NavGuardProvider } from "@/components/nav-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <NavGuardProvider>
        <div className="flex h-dvh flex-col">
          <FeedbackBanner />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="min-h-0 flex-1 overflow-y-auto">
              <OnboardingGate>{children}</OnboardingGate>
            </main>
          </div>
        </div>
      </NavGuardProvider>
    </AppDataProvider>
  );
}

/**
 * Reads the onboarding flag from the cached profile (no extra DB round-trip).
 * Redirects to /onboarding if incomplete. While the profile is still loading
 * for the very first time, the page's own skeleton handles the visual — we
 * render children straight through so the chrome never blanks on navigation.
 */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile } = useProfile();

  useEffect(() => {
    if (profile && !profile.completedOnboarding) {
      router.replace("/onboarding");
    }
  }, [profile, router]);

  return <>{children}</>;
}
