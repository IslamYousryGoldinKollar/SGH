
"use client"

import { cn } from '@/lib/utils';
import React, { useEffect, useRef, useState } from 'react';

export default function RippleEffect({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  // We use a key to force re-mounting of the SVG, which restarts the animation
  const [key, setKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setKey(prevKey => prevKey + 1);
    }, 3000); // Restart animation every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn("w-full h-full grid place-items-center", className)}>
      <div className="w-[min(180vw,1120px)] aspect-[1.6]">
        <svg
          key={key}
          ref={svgRef}
          viewBox="-400 -260 800 520"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Isometric ripple ring animation"
        >
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2" result="g1" />
              <feMerge>
                <feMergeNode in="g1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="roughWobble" x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
              <feTurbulence id="twLow" type="fractalNoise" baseFrequency="0.018 0.055" numOctaves="2" seed="11" stitchTiles="stitch" result="low" />
              <animate xlinkHref="#twLow" attributeName="seed" from="11" to="2011" dur="3s" fill="freeze" />
              <animate xlinkHref="#twLow" attributeName="baseFrequency" values="0.018 0.055;0.022 0.060;0.017 0.050;0.020 0.058" dur="3s" fill="freeze" />

              <feTurbulence id="twHi" type="turbulence" baseFrequency="0.8" numOctaves="1" seed="23" stitchTiles="stitch" result="hi" />
              <animate xlinkHref="#twHi" attributeName="seed" from="23" to="2023" dur="3s" fill="freeze" />

              <feDisplacementMap in="SourceGraphic" in2="low" scale="9" xChannelSelector="R" yChannelSelector="G" result="d1" />
              <feDisplacementMap in="d1" in2="hi" scale="1.8" xChannelSelector="R" yChannelSelector="B" />
            </filter>

            <linearGradient id="whiteEdge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.95" />
              <stop offset="100%" stopColor="white" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          <g id="iso" transform="skewX(-22) skewY(8)">
            <g id="ripple" filter="url(#roughWobble)" opacity="1">
              <path
                id="ring"
                d="M -220,0 C -220,-68 220,-68 220,0 C 220,68 -220,68 -220,0 Z"
                fill="none"
                stroke="url(#whiteEdge)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="9 7 4 12 6 5"
                strokeDashoffset="0"
                filter="url(#glow)"
              >
                <animate attributeName="stroke-dashoffset" values="0;6;12;18;24" dur="3s" fill="freeze" />
                <animate attributeName="stroke-width" values="3.5;3;2.2;1.6;1" dur="3s" fill="freeze" />
              </path>
            </g>

            <animateTransform
              xlinkHref="#ripple"
              attributeName="transform"
              type="scale"
              from="0.6"
              to="1.5"
              dur="3s"
              fill="freeze"
            />
            <animateTransform
              xlinkHref="#ripple"
              attributeName="transform"
              type="translate"
              additive="sum"
              from="0 0"
              to="10 -6"
              dur="3s"
              fill="freeze"
            />
            <animate
              xlinkHref="#ripple"
              attributeName="opacity"
              from="1"
              to="0"
              dur="3s"
              fill="freeze"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
