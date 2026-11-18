import { useId } from 'react';

export function Attach3DIcon({ type }) {
  const id = useId().replace(/:/g, '');
  const colors = {
    document: ['#4f46e5', '#38bdf8'],
    home: ['#22d3ee', '#2563eb'],
    learn: ['#8b5cf6', '#38bdf8'],
    practice: ['#14b8a6', '#0f766e'],
    community: ['#fb7185', '#ec4899'],
    settings: ['#93c5fd', '#2563eb'],
    archive: ['#38bdf8', '#1d4ed8'],
    gallery: ['#0ea5e9', '#22d3ee'],
    camera: ['#ec4899', '#f43f5e'],
    audio: ['#fb923c', '#f97316'],
    contact: ['#06b6d4', '#0f766e'],
    poll: ['#fbbf24', '#f59e0b'],
    event: ['#ef4444', '#db2777'],
    sticker: ['#14b8a6', '#10b981'],
    search: ['#60a5fa', '#2563eb'],
    more: ['#93c5fd', '#2563eb'],
    info: ['#38bdf8', '#1d4ed8'],
    select: ['#818cf8', '#4f46e5'],
    mute: ['#fb923c', '#f97316'],
    pin: ['#22d3ee', '#0891b2'],
    heart: ['#fb7185', '#e11d48'],
    lock: ['#64748b', '#334155'],
    share: ['#06b6d4', '#0f766e'],
    link: ['#2dd4bf', '#0f766e'],
    translate: ['#38bdf8', '#4f46e5'],
    report: ['#f59e0b', '#dc2626'],
    block: ['#f87171', '#991b1b'],
    clear: ['#94a3b8', '#475569'],
    trash: ['#f43f5e', '#be123c'],
    copy: ['#38bdf8', '#2563eb'],
    forward: ['#2dd4bf', '#0f766e'],
    retry: ['#60a5fa', '#4f46e5'],
    edit: ['#fbbf24', '#f97316'],
    unsend: ['#fb7185', '#be123c'],
    chat: ['#0284c7', '#0ea5e9'],
  };
  const [start, end] = colors[type] || colors.document;
  const iconPaths = {
    chat: (
      <>
        <path d="M16 26c0-6.6 5.4-12 12-12s12 5.4 12 12c0 2.8-.9 5.3-2.5 7.4L39 39l-6.2-1.7C31.1 38.2 29.6 38.6 28 38.6c-6.6 0-12-5.4-12-12z" />
        <path d="M22 26h.02M28 26h.02M34 26h.02" strokeWidth="4" />
      </>
    ),
    document: <path d="M20 11h13l7 7v25H20zM32 11v9h8M25 28h10M25 34h10" />,
    home: <path d="M14 27 28 15l14 12v15H18V29M24 42V31h8v11" />,
    learn: <path d="M15 18c7-3 13-2 13 3v23c-4-4-8-5-13-3zM28 21c0-5 6-6 13-3v23c-5-2-9-1-13 3zM28 21v23" />,
    practice: <path d="M28 14a14 14 0 1 0 0 28 14 14 0 0 0 0-28zM28 20v8l6 4M18 28h4M34 18l3-3M39 28h4" />,
    community: <path d="M22 17a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM38 20a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM13 43c2-7 6-10 12-10 4 0 7 1.6 9 5M33 42c1.5-4 4-6 8-6 3 0 5.5 1.2 7 4" />,
    settings: <path d="M28 19a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM28 12v5M28 39v5M16 18l4 4M36 36l4 4M12 28h5M39 28h5M16 40l4-4M36 20l4-4" />,
    archive: <path d="M15 18h26l-2 7H17zM18 25h20v17H18zM24 31h8M22 14h14" />,
    gallery: <path d="M14 19h27v20H14zM18 34l6-7 5 5 4-4 6 6M22 24h.1" />,
    camera: <path d="M13 21h8l3-4h9l3 4h7v18H13zM28 26a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />,
    audio: <path d="M28 12a5 5 0 0 0-5 5v11a5 5 0 0 0 10 0V17a5 5 0 0 0-5-5zM17 27c0 7 4.5 12 11 12s11-5 11-12M28 39v6" />,
    contact: <path d="M28 14a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 42c2-7 6.5-10 12-10s10 3 12 10M38 17h7M41.5 13.5v7" />,
    poll: <path d="M16 39h5V27h-5zM26 39h5V18h-5zM36 39h5V23h-5zM14 43h29" />,
    event: <path d="M16 18h26v25H16zM16 25h26M22 13v8M36 13v8M23 31h5M32 31h5M23 37h5" />,
    sticker: <path d="M17 14h24v17L30 42H17zM30 42V31h11M23 24h.1M34 24h.1M23 32c3 3 8 3 11 0" />,
    search: <path d="M25 16a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM33 33l8 8" />,
    more: <path d="M28 18h.1M28 28h.1M28 38h.1" />,
    info: <path d="M28 17h.1M25 25h4v13M23 38h10M28 12a16 16 0 1 0 0 32 16 16 0 0 0 0-32z" />,
    select: <path d="M16 16h24v24H16zM21 28l5 5 10-12" />,
    mute: <path d="M17 31h6l8 7V18l-8 7h-6zM38 24l5 8M43 24l-5 8" />,
    pin: <path d="M22 14h14l-4 10 6 6H18l6-6zM28 30v12" />,
    heart: <path d="M28 42s-13-7.5-13-17a7 7 0 0 1 12-5 7 7 0 0 1 12 5c0 9.5-11 17-11 17z" />,
    lock: <path d="M18 25h20v17H18zM23 25v-6a5 5 0 0 1 10 0v6M28 32v4" />,
    share: <path d="M22 24a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM16 42c1.5-7 5-10 10-10M34 18h9M38.5 13.5v9M33 32l9 9M42 32l-9 9" />,
    link: <path d="M23 21l-3 3a7 7 0 0 0 10 10l3-3M33 25l3-3a7 7 0 0 0-10-10l-3 3M24 32l8-8" />,
    translate: <path d="M15 17h16M23 13v20M17 33c6-3 10-9 12-16M31 39l4-10 4 10M32.5 35h5" />,
    report: <path d="M28 14l15 27H13zM28 23v8M28 36h.1" />,
    block: <path d="M28 13a15 15 0 1 0 0 30 15 15 0 0 0 0-30zM18 38l20-20" />,
    clear: <path d="M17 20h25M22 20l3-5h10l3 5M22 25l2 15h14l2-15M26 30h8" />,
    trash: <path d="M17 20h22M22 20l2-5h10l2 5M21 25l2 17h12l2-17M26 30v7M32 30v7" />,
    copy: <path d="M18 19h18v18H18zM24 13h18v18" />,
    forward: <path d="M17 29h21M31 20l9 9-9 9" />,
    retry: <path d="M39 22a13 13 0 1 0 2 10M39 15v7h-7" />,
    edit: <path d="M18 38l3-9 15-15 6 6-15 15zM32 18l6 6M18 38l9-3" />,
    unsend: <path d="M39 21H21M21 21l8-8M21 21l8 8M18 35h20" />,
  };
  return (
    <span className={`attachIcon3d attachIcon3d-${type}`} aria-hidden="true">
      <svg viewBox="0 0 56 56" focusable="false">
        <defs>
          <linearGradient id={`attach-${id}`} x1="12" y1="8" x2="44" y2="48">
            <stop stopColor={start} />
            <stop offset="1" stopColor={end} />
          </linearGradient>
          <filter id={`attach-shadow-${id}`} x="-30%" y="-20%" width="160%" height="160%">
            <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor={end} floodOpacity="0.26" />
          </filter>
        </defs>
        <rect x="8" y="8" width="40" height="40" rx="13" fill={`url(#attach-${id})`} filter={`url(#attach-shadow-${id})`} />
        <path d="M16 14c7-5 18-5 25 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.38" fill="none" />
        <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {iconPaths[type] || iconPaths.document}
        </g>
      </svg>
    </span>
  );
}

export function RailIcon({ type }) {
  const uniqueId = useId().replace(/:/g, '');
  const iconId = `rail-${type}-${uniqueId}`;
  const icons = {
    home: (
      <>
        <path d="M8 23.5 24 9l16 14.5v16c0 1.3-1 2.3-2.3 2.3h-9.2V30.5h-9v11.3h-9.2C9 41.8 8 40.8 8 39.5v-16Z" fill={`url(#${iconId}-main)`} />
        <path d="M5.8 24.2 24 7.8l18.2 16.4" stroke={`url(#${iconId}-accent)`} strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 22.6c5.4-4.7 12.5-5.2 18.1-1.2" className="iconShine" />
        <rect x="20.2" y="30" width="7.6" height="11.7" rx="2.2" fill="#f8fbff" opacity="0.94" />
      </>
    ),
    practice: (
      <>
        <circle cx="24" cy="24" r="17" fill={`url(#${iconId}-main)`} />
        <circle cx="24" cy="24" r="11" fill="#edf7ff" opacity="0.96" />
        <circle cx="24" cy="24" r="5.4" fill={`url(#${iconId}-accent)`} />
        <path d="M24 4v7M24 37v7M4 24h7M37 24h7" stroke={`url(#${iconId}-accent)`} strokeWidth="4" strokeLinecap="round" />
        <path d="M14 13c4.8-4 12.2-5.2 18.4-1.6" className="iconShine" />
      </>
    ),
    camera: (
      <>
        <rect x="7.5" y="13" width="28" height="23" rx="7" fill={`url(#${iconId}-main)`} />
        <path d="m35 20 7-4v17l-7-4V20Z" fill={`url(#${iconId}-accent)`} />
        <circle cx="21.5" cy="24.5" r="7.2" fill="#eff9ff" opacity="0.96" />
        <circle cx="21.5" cy="24.5" r="3.8" fill={`url(#${iconId}-accent)`} />
        <path d="M12 17c4.5-3 12.4-3.4 18.3-.4" className="iconShine" />
      </>
    ),
    conversations: (
      <>
        <path d="M9 21c0-7.2 6.6-13 14.8-13s14.8 5.8 14.8 13-6.6 13-14.8 13c-1.8 0-3.5-.3-5.1-.8L10 38l2.7-7.2C10.4 28.4 9 24.9 9 21Z" fill={`url(#${iconId}-main)`} />
        <path d="M14 15c4.8-4 13.8-4.6 19.2.2" className="iconShine" />
        <circle cx="18" cy="21" r="2.2" fill="#fff" opacity="0.94" />
        <circle cx="24" cy="21" r="2.2" fill="#fff" opacity="0.94" />
        <circle cx="30" cy="21" r="2.2" fill="#fff" opacity="0.94" />
      </>
    ),
    voiceHistory: (
      <>
        <path d="M8.6 20.2c0-7.1 6.4-12.4 15.1-12.4 8.5 0 15.2 5.3 15.2 12.2 0 6.7-6.5 12.1-14.8 12.1-1.6 0-3.2-.2-4.7-.7l-7.5 4.6 2.1-6.5c-3.3-2.2-5.4-5.5-5.4-9.3Z" fill={`url(#${iconId}-main)`} />
        <path d="M27.6 15.4a4.3 4.3 0 0 0-8.6 0v5.1a4.3 4.3 0 0 0 8.6 0v-5.1Z" fill="#f8fbff" opacity="0.96" />
        <path d="M16.1 19.5c0 4.8 3.2 8.1 7.2 8.1s7.2-3.3 7.2-8.1" className="voiceHistoryMicArc" />
        <path d="M23.3 27.4v4.4" className="voiceHistoryMicArc" />
        <path d="M19.5 31.8h7.6" className="voiceHistoryMicArc" />
        <path d="M35.6 26.3a7.7 7.7 0 1 1-6.4 12" fill="none" stroke={`url(#${iconId}-accent)`} strokeWidth="4" strokeLinecap="round" />
        <path d="M35.5 26.3v6.2h-6.2" fill="none" stroke={`url(#${iconId}-accent)`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <g className="voiceHistoryWaveBars">
          <rect x="14.5" y="18" width="2.5" height="6.5" rx="1.25" fill={`url(#${iconId}-accent)`} />
          <rect x="31.1" y="16.5" width="2.5" height="9.5" rx="1.25" fill={`url(#${iconId}-accent)`} />
          <rect x="35" y="18.4" width="2.4" height="5.7" rx="1.2" fill="#ffffff" opacity="0.9" />
        </g>
        <path d="M14.2 14.2c4.7-3.5 13.2-4.1 19.5.2" className="iconShine" />
      </>
    ),
    translate: (
      <>
        <rect x="8" y="10" width="22" height="20" rx="6" fill={`url(#${iconId}-main)`} />
        <rect x="18" y="18" width="22" height="20" rx="6" fill={`url(#${iconId}-accent)`} opacity="0.92" />
        <path d="M12 15h13" className="iconShine" />
        <path d="M15 23h8M19 16v14M14 30c4.2-2.2 7.2-6.4 8.2-11" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M27 31l3-7 3 7M28.3 28.4h3.4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    learn: (
      <>
        <path d="M8 13c4.8-2.2 10.4-1.8 15 1.4v24c-4.5-3.3-9.8-3.7-15-1.4V13Z" fill={`url(#${iconId}-main)`} />
        <path d="M25 14.4c4.6-3.2 10.2-3.6 15-1.4v24c-5.2-2.3-10.5-1.9-15 1.4v-24Z" fill={`url(#${iconId}-accent)`} />
        <path d="M12 15.5c3.2-.8 6-.3 8.4 1.4M29 16.8c2.6-1.2 5.2-1.5 7.8-.7" className="iconShine" />
        <path d="M14 20h6M14 26h6M30 20h6M30 26h6" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" opacity="0.88" />
      </>
    ),
    library: (
      <>
        <g className="libraryBookStack">
          <rect className="libraryBook3d libraryBookBack" x="9.5" y="13.5" width="8.6" height="25.5" rx="3" fill={`url(#${iconId}-main)`} />
          <rect className="libraryBook3d libraryBookMiddle" x="19.6" y="9.5" width="9.2" height="29.5" rx="3.2" fill={`url(#${iconId}-accent)`} />
          <rect className="libraryBook3d libraryBookFront" x="30.3" y="15" width="8.4" height="24" rx="3" fill={`url(#${iconId}-main)`} />
          <path className="libraryShelfLine" d="M8.6 39.4h31.8" stroke="#0f766e" strokeWidth="4.2" strokeLinecap="round" opacity="0.5" />
          <path d="M12.7 18.2h2.2M22.6 14.4h3.4M33.2 19.4h2.2M12.7 32.7h2.2M22.6 33.8h3.4M33.2 32.7h2.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.86" />
          <path d="M11.8 16.7c1.2-.9 3.1-1 4.5-.2M21.7 12.5c1.5-.9 3.9-1 5.5-.1M32.2 18c1.2-.7 2.8-.8 4-.1" className="iconShine" />
        </g>
      </>
    ),
    progress: (
      <>
        <path d="M10 36h28" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
        <rect x="11" y="25" width="7" height="11" rx="3" fill={`url(#${iconId}-main)`} />
        <rect x="22" y="18" width="7" height="18" rx="3" fill={`url(#${iconId}-main)`} />
        <rect x="33" y="11" width="7" height="25" rx="3" fill={`url(#${iconId}-accent)`} />
        <path d="M10 23l8-7 7 5 12-13" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M34 8h7v7" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 27h4M24 20h4M35 13h3" className="iconShine" />
      </>
    ),
    community: (
      <>
        <circle cx="20" cy="17" r="6" fill={`url(#${iconId}-main)`} />
        <circle cx="32" cy="19" r="5" fill={`url(#${iconId}-accent)`} opacity="0.92" />
        <path d="M10 37c1.2-7.2 5.4-11 10-11s8.8 3.8 10 11H10Z" fill={`url(#${iconId}-main)`} />
        <path d="M26 37c.8-5.8 3.5-9 7-9 3.7 0 6.4 3.2 7 9H26Z" fill={`url(#${iconId}-accent)`} opacity="0.9" />
        <path d="M16 13.5c2.2-1.4 5.2-1.1 7 .6" className="iconShine" />
      </>
    ),
    communityFeed: (
      <>
        <rect x="8" y="9" width="32" height="30" rx="9" fill={`url(#${iconId}-main)`} />
        <rect x="13" y="14" width="22" height="6" rx="3" fill="#fff" opacity="0.88" />
        <rect x="13" y="23" width="16" height="4.8" rx="2.4" fill="#fff" opacity="0.68" />
        <rect x="13" y="31" width="11" height="4.8" rx="2.4" fill="#fff" opacity="0.58" />
        <circle cx="33" cy="32" r="8" fill={`url(#${iconId}-accent)`} />
        <path d="M29.6 32.4 32 34.8l4.6-5.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 13c5.8-3.1 14.8-3.2 21 .8" className="iconShine" />
      </>
    ),
    communityGroups: (
      <>
        <circle cx="18" cy="17" r="6" fill={`url(#${iconId}-main)`} />
        <circle cx="31" cy="17" r="6" fill={`url(#${iconId}-accent)`} opacity="0.94" />
        <circle cx="24.5" cy="28" r="6.4" fill={`url(#${iconId}-main)`} />
        <path d="M8 40c1-6.4 4.5-10.2 9.5-10.2 4.8 0 8.2 3.6 9.1 10.2H8Z" fill={`url(#${iconId}-main)`} opacity="0.92" />
        <path d="M21 40c1-6.7 4.8-10.6 10-10.6S39.8 33.3 41 40H21Z" fill={`url(#${iconId}-accent)`} opacity="0.9" />
        <path d="M15 13.2c2.6-1.6 6.4-1.2 8.8 1" className="iconShine" />
      </>
    ),
    settings: (
      <>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="20.4"
            y="4.6"
            width="7.2"
            height="12.2"
            rx="3.2"
            fill={`url(#${iconId}-main)`}
            transform={`rotate(${angle} 24 24)`}
          />
        ))}
        <circle cx="24" cy="24" r="14.2" fill={`url(#${iconId}-main)`} />
        <circle cx="24" cy="24" r="9.2" fill="#eef6ff" />
        <circle cx="24" cy="24" r="4.8" fill={`url(#${iconId}-accent)`} />
        <path d="M15.8 15.6c4.7-3.6 11.6-3.8 16.4-.1" className="iconShine" />
      </>
    ),
  };

  return (
    <span className={`railIcon3d ${type}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" role="img" focusable="false">
        <defs>
          <linearGradient id={`${iconId}-main`} x1="8" y1="6" x2="39" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor={type === 'progress' ? '#34d399' : type === 'settings' ? '#9aa8bd' : type === 'communityFeed' ? '#60a5fa' : type === 'communityGroups' ? '#a78bfa' : type === 'voiceHistory' ? '#38bdf8' : '#51d7ff'} />
            <stop offset="0.48" stopColor={['conversations', 'community', 'communityFeed', 'communityGroups', 'voiceHistory'].includes(type) ? '#7c5cff' : type === 'settings' ? '#64748b' : '#2f7df6'} />
            <stop offset="1" stopColor={type === 'progress' ? '#059669' : type === 'settings' ? '#475569' : type === 'communityFeed' ? '#1d4ed8' : type === 'communityGroups' ? '#6d28d9' : '#1d4f9a'} />
          </linearGradient>
          <linearGradient id={`${iconId}-accent`} x1="10" y1="8" x2="38" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor={type === 'progress' ? '#6ee7b7' : type === 'communityGroups' ? '#f0abfc' : type === 'voiceHistory' ? '#e0f2fe' : '#eff6ff'} />
            <stop offset="1" stopColor={type === 'progress' ? '#10b981' : type === 'communityGroups' ? '#8b5cf6' : type === 'voiceHistory' ? '#06b6d4' : '#2563eb'} />
          </linearGradient>
          <linearGradient id={`${iconId}-gloss`} x1="12" y1="8" x2="26" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.88" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id={`${iconId}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#1d4f9a" floodOpacity="0.22" />
          </filter>
        </defs>
        <ellipse className="iconGroundShadow" cx="24" cy="42" rx="14" ry="3.4" />
        <g className="iconShape" filter={`url(#${iconId}-shadow)`}>{icons[type] || icons.settings}</g>
        <path className="iconGlassSweep" d="M12 8c8 4 16.5 4 24 0" stroke={`url(#${iconId}-gloss)`} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

