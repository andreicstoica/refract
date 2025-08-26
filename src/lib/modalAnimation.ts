import { gsap } from "gsap";

export interface ModalAnimationConfig {
    contentRef: React.RefObject<HTMLDivElement | null>;
    modalRef: React.RefObject<HTMLDivElement | null>;
    stagingRef: React.RefObject<HTMLDivElement | null>;
    onPageChange: () => void;
    onAnimationComplete: () => void;
}

export function animateModalTransition(config: ModalAnimationConfig) {
    const { contentRef, modalRef, stagingRef, onPageChange, onAnimationComplete } = config;

    if (!contentRef.current || !modalRef.current || !stagingRef.current) return;

    // Get current modal height and target height using precise bounding boxes
    // to avoid integer rounding differences that can cause 1px flicker.
    const currentHeightRaw = modalRef.current.getBoundingClientRect().height;
    const targetHeightRaw = stagingRef.current.getBoundingClientRect().height;
    // Snap to device pixels to avoid fractional rounding flicker
    const currentHeight = Math.round(currentHeightRaw);
    const targetHeight = Math.round(targetHeightRaw);
    const modalStyles = getComputedStyle(modalRef.current);
    const padTop = parseFloat(modalStyles.paddingTop || "0");
    const padBottom = parseFloat(modalStyles.paddingBottom || "0");
    const innerTargetHeight = Math.max(0, targetHeight - padTop - padBottom);

    // Set modal to fixed current height for smooth animation
    gsap.set(modalRef.current, { height: currentHeight });

    // Create timeline
    const tl = gsap.timeline();

    // Fade out current content to the left with stagger
    tl.to(contentRef.current.children, {
        opacity: 0,
        x: -25,
        duration: 0.4,
        ease: "power2.inOut",
        stagger: 0.08,
    })
        // Animate modal height to exact target height
        .to(
            modalRef.current,
            {
                height: targetHeight,
                duration: 0.4,
                ease: "power2.out",
            },
            ">-0.1"
        )
        // Update page state
        .call(() => {
            onPageChange();
        })
        // After React commits the new DOM, animate new content in from the right
        .call(
            () => {
                // Ensure we wait for the DOM update to commit before selecting children.
                requestAnimationFrame(() => {
                    if (!contentRef.current) return;
                    const children = contentRef.current.children;
                    // Ensure initial state is correct even if classes/styles didn't apply yet
                    gsap.set(children, { opacity: 0, x: 25 });
                    gsap.to(children, {
                        opacity: 1,
                        x: 0,
                        duration: 0.5,
                        ease: "power2.out",
                        stagger: 0.1,
                        onComplete: () => {
                            // Lock inner content height briefly to absorb any
                            // internal control animations without affecting modal height.
                            if (contentRef.current) {
                                gsap.set(contentRef.current, { minHeight: innerTargetHeight });
                            }
                            // Decide whether it's safe to clear height to auto without a jump.
                            // Measure natural height within the same frame to avoid paint.
                            requestAnimationFrame(() => {
                                const modalEl = modalRef.current;
                                if (!modalEl) return onAnimationComplete();
                                const prev = modalEl.style.height;
                                // Temporarily set to auto to measure natural height, then revert immediately
                                gsap.set(modalEl, { height: "auto" });
                                const natural = Math.round(modalEl.getBoundingClientRect().height);
                                gsap.set(modalEl, { height: prev });
                                const diff = Math.abs(natural - targetHeight);
                                if (diff <= 0.5) {
                                    // Safe to clear next frame with no visible shift
                                    requestAnimationFrame(() => {
                                        gsap.set(modalEl, { height: "auto" });
                                    });
                                } else {
                                    // Keep fixed height to avoid visible bottom shift; we'll clear later.
                                    gsap.delayedCall(0.6, () => {
                                        // Re-check and clear if stable
                                        const stable = Math.round(modalEl.getBoundingClientRect().height);
                                        if (Math.abs(stable - targetHeight) <= 0.5) {
                                            gsap.set(modalEl, { height: "auto" });
                                        }
                                    });
                                }
                                // Clear min-height shortly after to restore natural flow
                                gsap.delayedCall(0.25, () => {
                                    if (contentRef.current) {
                                        gsap.set(contentRef.current, { clearProps: "minHeight" });
                                    }
                                    onAnimationComplete();
                                });
                            });
                        },
                    });
                });
            },
            [],
            ">+0.15"
        );

    return tl || null;
}
