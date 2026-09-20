interface DialProps {
  value: number;
  maxScale: number;
  unit: string;
  label: string;
  color: string;
  size?: number;
}

/** A large radial readout. The ring fill is a rough visual scale (log-ish against maxScale), not a percentage — it never claims precision it doesn't have. */
export function Dial({
  value,
  maxScale,
  unit,
  label,
  color,
  size = 260,
}: DialProps) {
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(
    0,
    Math.min(1, Math.log10(value + 1) / Math.log10(maxScale + 1)),
  );
  const offset = circumference * (1 - fraction);

  return (
    <div className="dial" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="dial-ring"
        />
      </svg>
      <div className="dial-content">
        <span className="dial-value">
          {value.toFixed(value >= 100 ? 0 : 1)}
        </span>
        <span className="dial-unit">{unit}</span>
        <span className="dial-label">{label}</span>
      </div>
    </div>
  );
}
