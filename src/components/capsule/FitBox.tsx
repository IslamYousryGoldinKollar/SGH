"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Renders children at the biggest font size (px, between `max` and `min`) that still fits the box,
 * so any length of text lands on one projected screen without scrolling.
 */
export default function FitBox({
  max,
  min = 18,
  children,
  className,
  style,
  watch,
}: {
  max: number;
  min?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Changes whenever the content changes, so the fit is recomputed. */
  watch: unknown;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(max);

  const fit = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    let s = max;
    box.style.fontSize = `${s}px`;
    while (box.scrollHeight > box.clientHeight + 1 && s > min) {
      s -= 1;
      box.style.fontSize = `${s}px`;
    }
    setSize(s);
  }, [max, min]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(fit, [fit, watch]);
  useEffect(() => {
    // Re-measure once web fonts have settled.
    void document.fonts?.ready.then(fit);
  }, [fit, watch]);

  return (
    <div ref={boxRef} className={className} style={{ ...style, overflow: "hidden", fontSize: size }}>
      {children}
    </div>
  );
}
