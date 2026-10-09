/** The "Unite as One" ring from the deck cover: 1 + 8 + 16 white dots on a red disc. */
export default function BrandMark({ size = 64, ring = "#E00800", dot = "#fff" }: { size?: number; ring?: string; dot?: string }) {
  const circles: { cx: number; cy: number; r: number }[] = [{ cx: 0, cy: 0, r: 10.4 }];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    circles.push({ cx: Math.cos(a) * 22.3, cy: Math.sin(a) * 22.3, r: 6 });
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    circles.push({ cx: Math.cos(a) * 37.4, cy: Math.sin(a) * 37.4, r: 3.45 });
  }
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true">
      <circle r="48" style={{ fill: ring }} />
      {circles.map((c, i) => (
        <circle key={i} cx={c.cx.toFixed(2)} cy={c.cy.toFixed(2)} r={c.r} style={{ fill: dot }} />
      ))}
    </svg>
  );
}
