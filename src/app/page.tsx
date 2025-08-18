"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the writing page
    router.replace("/write");
  }, [router]);

  return (
    <div className="h-dvh bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">
        Redirecting to writing...
      </div>
    </div>
  );
}
