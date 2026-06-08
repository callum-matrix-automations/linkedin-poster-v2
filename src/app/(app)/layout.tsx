"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasCompletedOnboarding } from "@/lib/storage";
import { Sidebar } from "@/components/sidebar";
import { FeedbackBanner } from "@/components/feedback-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hasCompletedOnboarding().then((done) => {
      if (!done) {
        router.replace("/onboarding");
      } else {
        setReady(true);
      }
    });
  }, [router]);

  if (!ready) return <div className="min-h-dvh bg-chrome" />;

  return (
    <div className="flex h-dvh flex-col">
      <FeedbackBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
