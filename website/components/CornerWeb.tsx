type CornerWebProps = {
  /** Which corner the web hangs from; geometry is authored for top-left and mirrored/rotated via transform. */
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size?: number;
  spokes?: number;
  rings?: number;
  className?: string;
};

const CORNER_TRANSFORM: Record<CornerWebProps["corner"], string> = {
  "top-left": "",
  "top-right": "scaleX(-1)",
  "bottom-left": "scaleY(-1)",
  "bottom-right": "rotate(180deg)",
};

const CORNER_POSITION: Record<CornerWebProps["corner"], string> = {
  "top-left": "top-0 left-0",
  "top-right": "top-0 right-0",
  "bottom-left": "bottom-0 left-0",
  "bottom-right": "bottom-0 right-0",
};

/**
 * A quarter spider web anchored at a corner — spokes radiating into the box
 * plus a few sagging connecting strands, the way a real cobweb hangs off a
 * ceiling corner. Authored once for top-left; other corners just mirror or
 * rotate it, since the geometry is symmetric.
 */
export function CornerWeb({
  corner,
  size = 260,
  spokes = 7,
  rings = 5,
  className,
}: CornerWebProps) {
  const spokeAngles = Array.from(
    { length: spokes },
    (_, i) => (i * (90 / (spokes - 1)) * Math.PI) / 180,
  );

  const point = (r: number, angle: number): [number, number] => [
    r * Math.cos(angle),
    r * Math.sin(angle),
  ];

  // Real webs sag between spokes rather than forming perfect circles —
  // nudge each ring point outward a touch at the midpoint between spokes.
  const ringPoints = (r: number) =>
    spokeAngles
      .map((a) => point(r, a))
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={`pointer-events-none absolute ${CORNER_POSITION[corner]} ${className ?? ""}`}
      style={{ transform: CORNER_TRANSFORM[corner] }}
    >
      {spokeAngles.map((a, i) => {
        const [x, y] = point(size, a);
        return (
          <line
            key={i}
            x1={0}
            y1={0}
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeWidth={1.25}
          />
        );
      })}
      {Array.from({ length: rings }, (_, i) => {
        const r = size * ((i + 1) / (rings + 0.6));
        return (
          <polyline
            key={i}
            points={ringPoints(r)}
            stroke="currentColor"
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
