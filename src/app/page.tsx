"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasCompletedOnboarding } from "@/lib/storage";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (hasCompletedOnboarding()) {
      router.replace("/find");
    } else {
      router.replace("/onboarding");
    }
  }, [router]);

  return <div className="min-h-dvh bg-chrome" />;
}
