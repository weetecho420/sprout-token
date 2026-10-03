// Small inline icons (stroke style, inherit text color).
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function Leaf({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...S} stroke="#C6F26B">
      <path d="M12 21v-9" />
      <path d="M12 12c0-4 3-7 8-7 0 5-3 8-8 7z" />
      <path d="M12 14c0-3-2.5-6-7-6 0 4 2.5 6.5 7 6z" />
    </svg>
  );
}
export const IconSale = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...S}>
    <rect x="3" y="4" width="18" height="7" rx="2" />
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01" />
  </svg>
);
export const IconBuy = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...S}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);
export const IconNodes = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...S}>
    <path d="M12 21v-9" />
    <path d="M12 12c0-4 3-7 8-7 0 5-3 8-8 7z" />
  </svg>
);
export const IconExternal = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...S}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const IconRun = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...S}>
    <path d="M12 3v8" />
    <path d="M6.3 7.3a8 8 0 1 0 11.4 0" />
  </svg>
);
