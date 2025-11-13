import { useEffect, useRef } from "react";

interface UseModalKeyboardProps {
    isOpen: boolean;
    currentPage: number;
    selectedMinutes: number;
    inputBuffer: string;
    onNext: () => void;
    onPrevious: () => void;
    onStart: (minutes: number) => void;
    onMinutesChange: (minutes: number) => void;
    onInputBufferChange: (buffer: string) => void;
    onEnterPressed: (pressed: boolean) => void;
}

export function useModalKeyboard({
    isOpen,
    currentPage,
    selectedMinutes,
    inputBuffer,
    onNext,
    onPrevious,
    onStart,
    onMinutesChange,
    onInputBufferChange,
    onEnterPressed,
}: UseModalKeyboardProps) {
    const bufferResetRef = useRef<number | null>(null);
    const minutesRef = useRef(selectedMinutes);

    useEffect(() => {
        minutesRef.current = selectedMinutes;
    }, [selectedMinutes]);

    useEffect(() => {
        if (!isOpen) return;

        const resetBufferSoon = () => {
            if (bufferResetRef.current) {
                window.clearTimeout(bufferResetRef.current);
            }
            bufferResetRef.current = window.setTimeout(() => {
                onInputBufferChange("");
                bufferResetRef.current = null;
            }, 1000);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            const { key } = event;

            // Page navigation
            if (key === "ArrowRight" && currentPage < 1) {
                event.preventDefault();
                event.stopPropagation();
                onNext();
                return;
            }
            if (key === "ArrowLeft" && currentPage > 0) {
                event.preventDefault();
                event.stopPropagation();
                onPrevious();
                return;
            }

            // Only handle timer controls on page 1 (timer setup)
            if (currentPage === 1) {
                // Arrow handling for timer
                if (key === "ArrowUp") {
                    event.preventDefault();
                    event.stopPropagation();
                    onMinutesChange(selectedMinutes + 1);
                    return;
                }
                if (key === "ArrowDown") {
                    event.preventDefault();
                    event.stopPropagation();
                    onMinutesChange(Math.max(1, selectedMinutes - 1));
                    return;
                }

                // Enter starts writing
                if (key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    onEnterPressed(true);
                    setTimeout(() => {
                        onStart(minutesRef.current);
                        onEnterPressed(false);
                    }, 200);
                    return;
                }
            } else if (currentPage === 0) {
                // Enter goes to next page on intro
                if (key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    onEnterPressed(true);
                    setTimeout(() => {
                        onNext();
                        onEnterPressed(false);
                    }, 200);
                    return;
                }
            }

            // Numeric entry to set minutes (supports multi-digit) - only on timer page
            if (currentPage === 1 && /^[0-9]$/.test(key)) {
                event.preventDefault();
                event.stopPropagation();
                const next = (inputBuffer + key).replace(/^0+(\d)/, "$1");
                const parsed = parseInt(next, 10);
                onMinutesChange(Number.isNaN(parsed) ? 1 : Math.max(1, parsed));
                onInputBufferChange(next);
                resetBufferSoon();
                return;
            }

            // Allow correcting numeric input with Backspace - only on timer page
            if (currentPage === 1 && key === "Backspace") {
                if (inputBuffer.length > 0) {
                    event.preventDefault();
                    event.stopPropagation();
                    const next = inputBuffer.slice(0, -1);
                    const parsed = parseInt(next || "0", 10);
                    onMinutesChange(Math.max(1, parsed || 1));
                    onInputBufferChange(next);
                    resetBufferSoon();
                }
                return;
            }
        };

        // Use capture to intercept before underlying textarea
        document.addEventListener("keydown", onKeyDown, { capture: true });
        return () => {
            document.removeEventListener("keydown", onKeyDown, true);
            if (bufferResetRef.current) {
                window.clearTimeout(bufferResetRef.current);
                bufferResetRef.current = null;
            }
        };
    }, [isOpen, inputBuffer, currentPage, selectedMinutes, onNext, onPrevious, onStart, onMinutesChange, onInputBufferChange, onEnterPressed]);
}
