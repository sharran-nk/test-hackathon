import React from 'react';

// Inline SVG icons drawn in the Lucide style (24-unit grid, 2px round strokes). They are inline
// so the page loads nothing from outside and adds no dependency. Every icon sits next to a text
// label, so they are hidden from screen readers.
function Svg({ size = 20, children }) {
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

const icon = (paths) => (p) => <Svg {...p}>{paths}</Svg>;

// Product mark: a storefront awning, filled in the brand green.
export function Logo({ size = 28 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M8 14.5h16M9 14.5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M7 14.5 9.5 9h13L25 14.5M13.5 24.5v-5h5v5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export const IconCheckCircle = icon(<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>);
export const IconCheck = icon(<path d="M20 6 9 17l-5-5" />);
export const IconError = icon(<><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>);
export const IconWarning = icon(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4M12 17h.01" /></>);
export const IconInfo = icon(<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>);
export const IconX = icon(<path d="M18 6 6 18M6 6l12 12" />);
export const IconChevron = icon(<path d="m6 9 6 6 6-6" />);
export const IconChevronRight = icon(<path d="m9 18 6-6-6-6" />);
export const IconArrowRight = icon(<path d="M5 12h14M12 5l7 7-7 7" />);
export const IconBack = icon(<path d="m12 19-7-7 7-7M19 12H5" />);
export const IconMenu = icon(<path d="M4 6h16M4 12h16M4 18h16" />);
export const IconSearch = icon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>);
export const IconEye = icon(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
export const IconEyeOff = icon(<><path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3.5 8 10 8a10.6 10.6 0 0 0 5.4-1.4" /><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20" /></>);
export const IconUser = icon(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
export const IconUsers = icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>);
export const IconBriefcase = icon(<><rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>);
export const IconDashboard = icon(<><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>);
export const IconUpload = icon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5M12 3v12" /></>);
export const IconTable = icon(<><path d="M12 3v18M3 9h18M3 15h18" /><rect width="18" height="18" x="3" y="3" rx="2" /></>);
export const IconHistory = icon(<><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5M12 7v5l4 2" /></>);
export const IconLogout = icon(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>);
export const IconTrash = icon(<><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M10 11v6M14 11v6" /></>);
export const IconFile = icon(<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></>);
export const IconFileWarning = icon(<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4M12 11v4M12 18h.01" /></>);
export const IconFileCheck = icon(<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4M9 15l2 2 4-4" /></>);
export const IconStore = icon(<><path d="M2 7v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V7l-2-4H4Z" /><path d="M4 11v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9M9 21v-6h6v6" /></>);
export const IconClock = icon(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>);
export const IconCalendar = icon(<><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>);
export const IconCalendarOff = icon(<><path d="M4.2 4.2A2 2 0 0 0 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.8-1.2M21 15.5V6a2 2 0 0 0-2-2H9.5" /><path d="M16 2v4M3 10h7M21 10h-5.5M2 2l20 20" /></>);
export const IconMoon = icon(<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />);
export const IconOverlap = icon(<><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></>);
export const IconShield = icon(<><path d="M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.6a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z" /><path d="m9 12 2 2 4-4" /></>);
export const IconActivity = icon(<path d="M22 12h-2.5a2 2 0 0 0-1.9 1.4l-2.3 7a.5.5 0 0 1-1 0L9.6 3.6a.5.5 0 0 0-1 0l-2.3 7A2 2 0 0 1 4.5 12H2" />);
export const IconPlay = icon(<path d="m6 3 14 9-14 9V3Z" />);
export const IconRefresh = icon(<><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></>);
export const IconFilter = icon(<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z" />);
export const IconSort = icon(<path d="m3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16" />);
export const IconBell = icon(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>);
export const IconDownload = icon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>);
export const IconSparkle = icon(<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />);
