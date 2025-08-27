import React from "react";
import { cn } from "@/lib/helpers";

type SpotlightOutProps = {
  className?: string;
  fill?: string;
};

export const SpotlightOut = ({ className, fill }: SpotlightOutProps) => {
  return (
    <svg
      className={cn(
        "animate-spotlight-out-mobile md:animate-spotlight-out pointer-events-none absolute z-[1] h-[100vh] w-[100vw] opacity-0",
        "inset-0",
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 3787 2842"
      fill="none"
    >
      <defs>
        <linearGradient id="rgbGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="35%" stopColor="#00ff00" stopOpacity="0.7" />
          <stop offset="20%" stopColor="#ff0000" stopOpacity="1" />
          <stop offset="90%" stopColor="#0000ff" stopOpacity="0.6" />
        </linearGradient>
        <filter
          id="filter"
          x="0.860352"
          y="0.838989"
          width="3785.16"
          height="2840.26"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          ></feBlend>
          <feGaussianBlur
            stdDeviation="151"
            result="effect1_foregroundBlur_1065_8"
          ></feGaussianBlur>
        </filter>
      </defs>
      <g filter="url(#filter)">
        <ellipse
          cx="1924.71"
          cy="273.501"
          rx="1924.71"
          ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
          fill="url(#rgbGradient)"
          fillOpacity="0.7"
        ></ellipse>
      </g>
    </svg>
  );
};
