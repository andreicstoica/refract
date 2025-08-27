import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useHeroKeyboard } from "@/hooks/useHeroKeyboard";
import { CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/helpers";
import { Spotlight } from "@/components/ui/Spotlight";
import { SpotlightOut } from "@/components/ui/SpotlightOut";

export function Hero() {
  const { isEnterPressed } = useHeroKeyboard({
    onEnterPressed: () => {}, // We'll handle the navigation in the button click
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center relative overflow-hidden">
      <Spotlight className="absolute inset-0 text-foreground" />
      <SpotlightOut className="absolute inset-0 text-foreground" />
      <h1 className="text-6xl font-bold mb-8 relative z-10">Refract</h1>
      <Link href="/write">
        <Button
          size="lg"
          className={cn(
            "text-lg px-8 py-3 group transition-all duration-150 relative z-10",
            isEnterPressed && "scale-95 shadow-inner"
          )}
          data-hero-button
        >
          Get Started
          <CornerDownLeft
            className={cn(
              "w-4 h-4 ml-2 transition-transform group-hover:translate-y-0.5",
              isEnterPressed && "translate-y-0.5"
            )}
          />
        </Button>
      </Link>
    </div>
  );
}
