export interface EditorMetrics {
	hasContent: boolean;
	lineCount: number;
	shouldUseFullHeight: boolean;
}

export function calculateEditorMetrics(text: string): EditorMetrics {
	const normalized = text ?? "";
	const hasContent = normalized.trim().length > 0;
	const lineCount = normalized.split("\n").length;
	const shouldUseFullHeight = hasContent && (normalized.length > 400 || lineCount > 10);

	return {
		hasContent,
		lineCount,
		shouldUseFullHeight
	};
}
