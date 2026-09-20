const RADII = [20, 40, 60, 80, 100];
const ANGLES = [0, 22.5, 45, 67.5, 90];

function point(radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return [radius * Math.cos(rad), radius * Math.sin(rad)] as const;
}

/** A classic corner spider-web: radial spokes + concentric rings, anchored at (0,0). */
export function SpiderWebCorner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      {ANGLES.map((angle) => {
        const [x, y] = point(100, angle);
        return <line key={angle} x1={0} y1={0} x2={x} y2={y} stroke="currentColor" strokeWidth={0.6} />;
      })}
      {RADII.map((r) => {
        const [x1] = point(r, 0);
        const [, y2] = point(r, 90);
        return (
          <path
            key={r}
            d={`M ${x1} 0 A ${r} ${r} 0 0 1 0 ${y2}`}
            stroke="currentColor"
            strokeWidth={0.6}
          />
        );
      })}
    </svg>
  );
}
