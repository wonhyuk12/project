function shade(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(Math.min(255, v), 0);
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0x00ff) + amount);
  const b = clamp((num & 0x0000ff) + amount);
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function PhotoPlaceholder({ tone = '#C9D6E6', height = '200px', label, borderRadius = '4px' }) {
  return (
    <div
      className="tw-card"
      style={{
        height,
        borderRadius,
        background: `linear-gradient(150deg, ${shade(tone, 18)}, ${shade(tone, -18)})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        color: 'rgba(12,35,64,0.5)',
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.4" />
        <path d="M21 16l-5.2-5.2-4 4-2.8-2.8L3 17.6" />
      </svg>
      {label && <span style={{ fontSize: '12px' }}>{label}</span>}
    </div>
  );
}

export default PhotoPlaceholder;
