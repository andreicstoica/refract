"use client";

import { useState } from "react";
import { TextInput } from "@/components/TextInput";
import { useAIProds } from "@/hooks/useAIProds";

export default function ReflectiveMirror() {
  const [currentText, setCurrentText] = useState("");
  const { prods, isLoading, error } = useAIProds(currentText);

  const handleTextChange = (text: string) => {
    setCurrentText(text);
    
    // Console logging for development
    console.log("📝 Text length:", text.length);
    console.log("🤖 AI Status:", { 
      prodsCount: prods.length, 
      isLoading, 
      hasError: !!error 
    });
    
    if (prods.length > 0) {
      console.log("💫 Current prods:", prods.map(p => `"${p.text}"`));
    }
    
    if (error) {
      console.error("🚨 AI Error:", error);
    }
  };

  return (
    <TextInput
      onTextChange={handleTextChange}
      placeholder="What's on your mind?"
    />
  );
}
