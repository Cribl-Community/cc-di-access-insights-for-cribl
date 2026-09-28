import './dashboard.css';

interface RingMeterProps {
  /** 0..1 */
  value: number;
  caption: string;
  size?: number;
}

/**
 * A single ratio as a ring meter (dataviz: "a single ratio against a limit →
 * meter"): accent fill on a track that's a lighter step of the same hue.
 */
export function RingMeter({ value, caption, size = 96 }: RingMeterProps) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);
  return (
    <div className="ring-meter" style={{ width: size, height: size }} role="img" aria-label={`${pct}% ${caption}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * clamped} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-center" aria-hidden>
        <span className="ring-value">{pct}%</span>
        <span className="ring-caption">{caption}</span>
      </span>
    </div>
  );
}
