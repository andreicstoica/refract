import { useEffect, useState } from "react";

interface UseHeroKeyboardProps {
    onEnterPressed: (pressed: boolean) => void;
}

export function useHeroKeyboard({ onEnterPressed }: UseHeroKeyboardProps) {
    const [isEnterPressed, setIsEnterPressed] = useState(false);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            // Enter key to trigger the button
            if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                setIsEnterPressed(true);
                onEnterPressed(true);

                // Simulate button click after a short delay
                setTimeout(() => {
                    const button = document.querySelector('[data-hero-button]') as HTMLButtonElement;
                    if (button) {
                        button.click();
                    }
                    setIsEnterPressed(false);
                    onEnterPressed(false);
                }, 200);
            }
        };

        // Use capture to intercept before other handlers
        document.addEventListener("keydown", onKeyDown, { capture: true });

        return () => {
            document.removeEventListener("keydown", onKeyDown, true);
        };
    }, [onEnterPressed]);

    return { isEnterPressed };
}
