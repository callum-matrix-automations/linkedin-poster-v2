"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasCompletedOnboarding } from "@/lib/storage";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    hasCompletedOnboarding().then((done) => {
      router.replace(done ? "/find" : "/onboarding");
    });
  }, [router]);

  return <div className="min-h-dvh bg-chrome" />;
}
