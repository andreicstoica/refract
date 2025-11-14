import { useState, useRef, useEffect, useCallback } from "react";
import type React from "react";
import { calculateEditorMetrics } from "@/lib/editorMetrics";

interface UseEditorTextOptions {
	onTextChange?: (text: string) => void;
}

export function useEditorText({ onTextChange }: UseEditorTextOptions = {}) {
	const [text, setTextState] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const setText = useCallback<React.Dispatch<React.SetStateAction<string>>>(
		(update) => {
			setTextState((prev) => {
				const next = typeof update === "function" ? (update as (value: string) => string)(prev) : update;
				if (next !== prev) {
					onTextChange?.(next);
				}
				return next;
			});
		},
		[onTextChange]
	);

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			setText(event.target.value);
		},
		[setText]
	);

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.focus();
		}
	}, []);

	useEffect(() => {
		if (textareaRef.current) {
			const textarea = textareaRef.current;
			textarea.scrollTop = textarea.scrollHeight;
		}
	}, [text]);

	const metrics = calculateEditorMetrics(text);

	return {
		text,
		setText,
		textareaRef,
		handleChange,
		metrics
	};
}
