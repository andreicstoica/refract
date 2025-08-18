"use client";

import { TextInput } from "@/components/TextInput";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function WritePage() {
  const [hasContent, setHasContent] = useState(false);

  const handleTextChange = (text: string) => {
    setHasContent(text.trim().length > 0);
  };

  return (
    <div className="relative h-dvh">
      {/* Clean navigation - only show when there's content */}
      {hasContent && (
        <div className="absolute top-4 right-4 z-50">
          <Link href="/themes">
            <Button
              variant="outline"
              size="sm"
              className="bg-background/80 backdrop-blur-sm border-blue-200/30 hover:bg-blue-50/50"
            >
              View Themes
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      )}

      <TextInput
        onTextChange={handleTextChange}
        placeholder="What's on your mind?"
        hideThemes={true} // Hide theme bubbles on writing page
      />
    </div>
  );
}
