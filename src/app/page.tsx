"use client";

import { TextInput } from "@/components/TextInput";

export default function ReflectiveMirror() {
  const handleTextChange = (text: string) => {
    // This will be used for Milestone 2 - AI prods integration
    console.log("Text updated:", text);
  };

  return (
    <TextInput
      onTextChange={handleTextChange}
      placeholder="What's on your mind?"
    />
  );
}
