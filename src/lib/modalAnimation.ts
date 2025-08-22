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

    // Get current modal height and measure target height from staging div
    const currentHeight = modalRef.current.offsetHeight;
    const targetHeight = stagingRef.current.offsetHeight;

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
                            // Clear the fixed height to allow natural sizing
                            if (modalRef.current)
                                gsap.set(modalRef.current, { clearProps: "height" });
                            onAnimationComplete();
                        },
                    });
                });
            },
            [],
            ">+0.15"
        );

    return tl || null;
}
