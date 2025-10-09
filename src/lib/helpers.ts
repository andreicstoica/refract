import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}


// Mobile detection utility
export function isMobileViewport(containerWidth: number, breakpoint: number = 480): boolean {
	return containerWidth < breakpoint;
}

// Measure actual text width for accurate chip sizing
export function measureTextWidth(text: string, fontStyle: string = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"): number {
	// Create a temporary canvas to measure text width
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) return text.length * 8; // Fallback to character-based estimation

	context.font = fontStyle;
	return context.measureText(text).width;
}

