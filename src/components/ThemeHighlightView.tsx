"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/types/theme";
import type { Sentence } from "@/types/sentence";
import { storage } from "@/services/storage";
import { cn } from "@/utils/utils";
import { Button } from "@/components/ui/button";
import { Highlighter } from "@/components/magicui/highlighter";

type ThemeHighlightViewProps = {
	className?: string;
	themes?: Theme[];
};

type HighlightRange = {
	start: number;
	end: number;
	color: string;
	themeId: string;
};

function renderTextWithHighlights(text: string, ranges: HighlightRange[]) {
	const baseTextStyles = {
		lineHeight: "3.5rem",
		wordBreak: "break-word" as const,
		overflowWrap: "anywhere" as const,
	};

	if (!ranges.length) {
		return (
			<pre 
				className="whitespace-pre-wrap font-plex text-xl text-muted-foreground/60 w-full bg-transparent outline-none border-none resize-none box-border px-4"
				style={baseTextStyles}
			>
				{text}
			</pre>
		);
	}

	// Sort ranges by start position
	const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);
	const fragments: React.ReactNode[] = [];
	let lastEnd = 0;

	for (let i = 0; i < sortedRanges.length; i++) {
		const range = sortedRanges[i];
		
		// Add unhighlighted text before this range
		if (range.start > lastEnd) {
			const plainText = text.slice(lastEnd, range.start);
			if (plainText) {
				fragments.push(
					<span key={`text-${i}`} style={{ display: "inline" }}>
						{plainText}
					</span>
				);
			}
		}

		// Add highlighted text using MagicUI Highlighter
		const highlightedText = text.slice(range.start, range.end);
		if (highlightedText) {
			fragments.push(
				<Highlighter
					key={`highlight-${i}`}
					action="highlight"
					color={`${range.color}66`} // More opacity for visibility
					strokeWidth={0}
					animationDuration={400}
					iterations={1}
					padding={1}
					multiline={true}
				>
					{highlightedText}
				</Highlighter>
			);
		}

		lastEnd = Math.max(lastEnd, range.end);
	}

	// Add remaining unhighlighted text
	if (lastEnd < text.length) {
		const remainingText = text.slice(lastEnd);
		if (remainingText) {
			fragments.push(
				<span key="text-end" style={{ display: "inline" }}>
					{remainingText}
				</span>
			);
		}
	}

	return (
		<pre 
			className="whitespace-pre-wrap font-plex text-xl w-full bg-transparent outline-none border-none resize-none box-border px-4"
			style={baseTextStyles}
		>
			{fragments}
		</pre>
	);
}

export function ThemeHighlightView({ className, themes: propThemes }: ThemeHighlightViewProps) {
	const router = useRouter();
	const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
	const [themes, setThemes] = useState<Theme[] | null>(null);
	const [fullText, setFullText] = useState<string>("");
	const [sentences, setSentences] = useState<Sentence[] | null>(null);

	// Load data from storage on mount
	useEffect(() => {
		const storedThemes = propThemes || storage.getThemes();
		const storedText = storage.getText();
		const storedSentences = storage.getSentences();

		if (!storedText || !storedThemes?.length) {
			// Redirect to write page if no data
			router.push("/write");
			return;
		}

		setThemes(storedThemes);
		setFullText(storedText);
		setSentences(storedSentences);
	}, [propThemes, router]);

	// Generate highlight ranges for selected themes
	const highlightRanges = useMemo(() => {
		if (!themes || selectedThemeIds.length === 0) {
			return [];
		}

		// Build sentence lookup map
		const sentenceMap = new Map<string, Sentence>();
		if (sentences) {
			for (const sentence of sentences) {
				sentenceMap.set(sentence.id, sentence);
			}
		}

		const ranges: HighlightRange[] = [];

		for (const themeId of selectedThemeIds) {
			const theme = themes.find(t => t.id === themeId);
			if (!theme || !theme.chunks) continue;

			const color = theme.color ?? "#93c5fd"; // blue-300 fallback

			for (const chunk of theme.chunks) {
				const sentence = sentenceMap.get(chunk.sentenceId);
				if (sentence) {
					// Use precise sentence mapping when available
					ranges.push({
						start: sentence.startIndex,
						end: sentence.endIndex,
						color,
						themeId: theme.id,
					});
				} else {
					// Fallback: search for chunk text in fullText
					const chunkText = chunk.text.trim();
					const index = fullText.indexOf(chunkText);
					if (index !== -1) {
						ranges.push({
							start: index,
							end: index + chunkText.length,
							color,
							themeId: theme.id,
						});
					}
				}
			}
		}

		return ranges.sort((a, b) => a.start - b.start);
	}, [themes, sentences, selectedThemeIds, fullText]);

	const toggleTheme = (themeId: string) => {
		setSelectedThemeIds(prev => 
			prev.includes(themeId) 
				? prev.filter(id => id !== themeId)
				: [...prev, themeId]
		);
	};

	if (!themes || !fullText) {
		return (
			<div className={cn(
				"flex items-center justify-center h-64 text-muted-foreground",
				className
			)}>
				<div className="text-sm">Loading...</div>
			</div>
		);
	}

	return (
		<div className={cn("relative h-full w-full", className)}>
			{/* Static centered container matching write page */}
			<div className="mx-auto max-w-2xl w-full h-full px-4">
				<div className="h-full overflow-hidden flex flex-col min-h-0">
					{/* Instructions when no theme selected */}
					{selectedThemeIds.length === 0 && (
						<div className="text-sm text-muted-foreground mb-4 text-center pt-8">
							Select a theme to highlight matching sentences
						</div>
					)}

					{/* Theme selection buttons */}
					<div className="shrink-0 pb-4 mb-4 pt-4">
						<div className="flex flex-wrap gap-2">
							{themes.map((theme) => {
								const isSelected = selectedThemeIds.includes(theme.id);
								return (
									<Button
										key={theme.id}
										variant={isSelected ? "default" : "outline"}
										size="sm"
										onClick={() => toggleTheme(theme.id)}
										aria-pressed={isSelected}
										className="flex items-center gap-2 max-w-[200px]"
									>
										<div
											className="w-2 h-2 rounded-full flex-shrink-0"
											style={{
												backgroundColor: theme.color ?? "#93c5fd",
											}}
										/>
										<span className="truncate">{theme.label}</span>
									</Button>
								);
							})}
						</div>
					</div>

					{/* Scrollable text area fills remaining height */}
					<div className="relative flex-1 min-h-0">
						<div className="h-full overflow-y-auto overflow-x-hidden">
							{renderTextWithHighlights(fullText, highlightRanges)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

