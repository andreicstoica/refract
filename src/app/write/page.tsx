"use client";

import { TextInput } from "@/components/TextInput";

export default function WritePage() {
  const handleTextChange = (text: string) => {
    // This will be used for any future text change handling
    console.log("Text updated:", text);
  };

  return (
    <div className="relative h-dvh">
      <TextInput
        onTextChange={handleTextChange}
        placeholder="What's on your mind?"
      />
    </div>
  );
}
