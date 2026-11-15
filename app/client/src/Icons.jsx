import React from 'react';

// Inline SVG icons. No external files and no xmlns attribute (not needed for inline SVG, and
// the security test forbids URLs in the source). They are decorative: every icon sits next
// to a text label, so they are hidden from screen readers.
function Svg({ size = 24, children }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconCheckCircle = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="m8 12.5 3 3 5-6" /></Svg>
);
export const IconError = (p) => (
  <Svg {...p}>
    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
    <path d="m15 9-6 6" /><path d="m9 9 6 6" />
  </Svg>
);
export const IconWarning = (p) => (
  <Svg {...p}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" /><path d="M12 17h.01" />
  </Svg>
);
export const IconOverlap = (p) => (
  <Svg {...p}><rect x="3" y="4" width="12" height="6" rx="1.5" /><rect x="9" y="14" width="12" height="6" rx="1.5" /></Svg>
);
export const IconMoon = (p) => (
  <Svg {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Svg>
);
export const IconCalendarOff = (p) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h18" />
    <path d="m10 13.5 4 4" /><path d="m14 13.5-4 4" />
  </Svg>
);
export const IconFileWarning = (p) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />
    <path d="M12 12v4" /><path d="M12 19h.01" />
  </Svg>
);
export const IconCheck = (p) => (
  <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
);
export const IconChevron = (p) => (
  <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
);
export const IconUpload = (p) => (
  <Svg {...p}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></Svg>
);
export const IconUser = (p) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>
);
export const IconBriefcase = (p) => (
  <Svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></Svg>
);
export const IconDashboard = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Svg>
);
export const IconTable = (p) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M9 4v16" /></Svg>
);
export const IconHistory = (p) => (
  <Svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /></Svg>
);
export const IconLogout = (p) => (
  <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Svg>
);
export const IconBack = (p) => (
  <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>
);

// Company logo: a green rounded square with a white shopping basket. Pure inline SVG.
export function Logo({ size = 40 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="8" fill="currentColor" />
      <g transform="translate(8 8) scale(1)" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 11-1 9" /><path d="m19 11-4-7" /><path d="M2 11h20" />
        <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" />
        <path d="M4.5 15.5h15" /><path d="m5 11 4-7" /><path d="m9 11 1 9" />
      </g>
    </svg>
  );
}
