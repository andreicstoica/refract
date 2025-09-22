import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/helpers";
import { Spotlight } from "@/components/ui/Spotlight";
import { SpotlightOut } from "@/components/ui/SpotlightOut";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedText } from "@/components/ui/AnimatedText";
import { Pin } from "lucide-react";

const mockChips = [
  "What if you explored this feeling deeper?",
  "Reminds me of your earlier thoughts",
  "Have you considered the opposite?",
  "Have you tried being more specific?",
  "What's the emotion behind this?",
  "How do you feel this in your body?",
  "Try expanding on this metaphor",
  "What would your future self think about this?",
  "How can you plan this better?",
  "What specific steps can you take?",
];

export function Hero() {
  const [currentChipIndex, setCurrentChipIndex] = useState(0);
  const [showChip, setShowChip] = useState(false); // Start hidden
  const [shouldFade, setShouldFade] = useState(false);
  const [chipPosition, setChipPosition] = useState({ top: 25, left: 20 });

  // Generate random positions within bounds
  const generateRandomPosition = (isTop: boolean) => {
    if (isTop) {
      return {
        top: Math.random() * 20 + 15, // 15-35% from top
        left: Math.random() * 60 + 20, // 20-80% from left
      };
    } else {
      return {
        top: Math.random() * 20 + 65, // 65-85% from top
        left: Math.random() * 60 + 20, // 20-80% from left
      };
    }
  };

  useEffect(() => {
    // Initial delay of 4 seconds before first chip
    const initialTimer = setTimeout(() => {
      setChipPosition(generateRandomPosition(Math.random() > 0.5));
      setShowChip(true);
    }, 4000);

    // Set up recurring cycle after initial delay
    const cycleTimer = setTimeout(() => {
      const interval = setInterval(() => {
        // Start fade after 8 seconds
        setShouldFade(true);

        // After 4 seconds of fading, show next chip
        setTimeout(() => {
          setShouldFade(false);
          setCurrentChipIndex((prev) => (prev + 1) % mockChips.length);
          const newIsTop = Math.random() > 0.5;
          setChipPosition(generateRandomPosition(newIsTop));
        }, 4000);
      }, 12000); // 8s visible + 4s fade = 12s cycle

      return () => clearInterval(interval);
    }, 4000 + 8000); // Initial delay + first chip visible time

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(cycleTimer);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center relative overflow-hidden">
      <Spotlight className="absolute inset-0 text-foreground" />
      <SpotlightOut className="absolute inset-0 text-foreground" />

      {/* Single mock chip */}
      <AnimatePresence mode="wait">
        {showChip && (
          <motion.div
            key={`chip-${currentChipIndex}`}
            initial={{ opacity: 1, scale: 1, y: 0 }}
            animate={{
              opacity: shouldFade ? 0 : 1,
              scale: 1,
              y: 0,
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              duration: shouldFade ? 4 : 0, // 4 second fade like real chips
              ease: "easeOut",
            }}
            className={cn(
              "absolute z-20 text-sm font-medium text-blue-600 dark:text-blue-400",
              "leading-tight group inline-flex items-center",
              "whitespace-nowrap overflow-hidden text-ellipsis",
              "pointer-events-none max-w-[280px]"
            )}
            style={{
              top: `${chipPosition.top}%`,
              left: `${chipPosition.left}%`,
            }}
          >
            <AnimatedText
              text={mockChips[currentChipIndex]}
              duration={1500}
              delay={0}
            />
            <Pin
              size={14}
              className={cn(
                "ml-0.5 rotate-[12deg]",
                "transition-all duration-200 ease-out",
                "opacity-0"
              )}
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <h1 className="text-6xl font-bold mb-8 relative z-10">Refract</h1>
      <h2 className="text-lg text-muted-foreground max-w-md mb-8 relative z-10">
        The journal that nudges you deeper
      </h2>
      <Link href="/write">
        <Button
          className="group w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium transition-all duration-150 relative z-10"
          data-hero-button
        >
          Try Writing
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </Link>
    </div>
  );
}
