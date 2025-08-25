import { useEffect, useState, useRef } from "react";

interface ViewportKeyboardState {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
  visualViewportHeight: number;
  windowHeight: number;
}

/**
 * Hook for detecting iOS keyboard overlap using Visual Viewport API
 * 
 * Sets CSS variable `--kb-safe` on document root for keyboard-safe spacing.
 * This helps ensure the caret stays visible above the virtual keyboard.
 * 
 * @returns Object with keyboard state and measurements
 */
export function useViewportKeyboard() {
  const [state, setState] = useState<ViewportKeyboardState>({
    keyboardHeight: 0,
    isKeyboardVisible: false,
    visualViewportHeight: 0,
    windowHeight: 0,
  });

  const rafRef = useRef<number | null>(null);
  const prevStateRef = useRef<ViewportKeyboardState>(state);

  useEffect(() => {
    // Check if Visual Viewport API is supported (iOS Safari 13+)
    if (typeof window === "undefined" || !window.visualViewport) {
      if (process.env.NODE_ENV !== "production") {
        console.log("📱 Visual Viewport API not supported, using fallback");
      }
      return;
    }

    const visualViewport = window.visualViewport;
    
    const updateKeyboardState = () => {
      // Cancel any pending RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        const windowHeight = window.innerHeight;
        const visualViewportHeight = visualViewport.height;
        const keyboardHeight = Math.max(0, windowHeight - visualViewportHeight);
        const isKeyboardVisible = keyboardHeight > 0;

        const newState = {
          keyboardHeight,
          isKeyboardVisible,
          visualViewportHeight,
          windowHeight,
        };

        // Only update state if values have changed significantly (avoid jitter)
        const prevState = prevStateRef.current;
        const heightDiff = Math.abs(newState.keyboardHeight - prevState.keyboardHeight);
        const hasSignificantChange = 
          heightDiff > 10 || // At least 10px difference
          newState.isKeyboardVisible !== prevState.isKeyboardVisible;

        if (hasSignificantChange) {
          setState(newState);
          prevStateRef.current = newState;
          
          // Set CSS variable for keyboard-safe spacing
          const kbSafeValue = isKeyboardVisible ? `${keyboardHeight}px` : '0px';
          document.documentElement.style.setProperty('--kb-safe', kbSafeValue);
          
          if (process.env.NODE_ENV !== "production") {
            console.log('📱 Keyboard state updated:', {
              keyboardHeight,
              isKeyboardVisible,
              visualViewportHeight,
              windowHeight,
              kbSafeValue,
            });
          }
        }
      });
    };

    // Set initial state
    updateKeyboardState();

    // Listen to viewport changes
    visualViewport.addEventListener('resize', updateKeyboardState);
    visualViewport.addEventListener('scroll', updateKeyboardState);

    return () => {
      visualViewport.removeEventListener('resize', updateKeyboardState);
      visualViewport.removeEventListener('scroll', updateKeyboardState);
      
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      
      // Clean up CSS variable
      document.documentElement.style.removeProperty('--kb-safe');
    };
  }, []);

  return state;
}

/**
 * Lightweight version that only sets the CSS variable without exposing state
 * Use this if you only need the CSS variable and don't need to react to state changes
 */
export function useViewportKeyboardCSSVar() {
  useEffect(() => {
    // Check if Visual Viewport API is supported
    if (typeof window === "undefined" || !window.visualViewport) {
      // Fallback: use safe-area-inset-bottom for older iOS
      document.documentElement.style.setProperty(
        '--kb-safe', 
        'env(safe-area-inset-bottom, 0px)'
      );
      return;
    }

    const visualViewport = window.visualViewport;
    let rafId: number | null = null;
    
    const updateCSSVar = () => {
      if (rafId) cancelAnimationFrame(rafId);
      
      rafId = requestAnimationFrame(() => {
        const windowHeight = window.innerHeight;
        const visualViewportHeight = visualViewport.height;
        const keyboardHeight = Math.max(0, windowHeight - visualViewportHeight);
        const kbSafeValue = keyboardHeight > 0 ? `${keyboardHeight}px` : '0px';
        
        document.documentElement.style.setProperty('--kb-safe', kbSafeValue);
      });
    };

    updateCSSVar();
    visualViewport.addEventListener('resize', updateCSSVar);
    visualViewport.addEventListener('scroll', updateCSSVar);

    return () => {
      visualViewport.removeEventListener('resize', updateCSSVar);
      visualViewport.removeEventListener('scroll', updateCSSVar);
      if (rafId) cancelAnimationFrame(rafId);
      document.documentElement.style.removeProperty('--kb-safe');
    };
  }, []);
}