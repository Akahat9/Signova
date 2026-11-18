import React from 'react';

export function SettingsCategoryIcon({ id, className = '' }) {
  const iconProps = {
    width: '18',
    height: '18',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2.1',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': 'true',
  };

  switch (id) {
    case 'general':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'account':
      return (
        <svg {...iconProps}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'security':
      return (
        <svg {...iconProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'notifications':
      return (
        <svg {...iconProps}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'display':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" fillOpacity="0.28" />
        </svg>
      );
    case 'translation':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case 'accessibility':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="4" r="2" />
          <path d="m5 9 14-2" />
          <path d="M12 7v10" />
          <path d="m8 21 4-4 4 4" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...iconProps}>
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...iconProps}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'calls':
      return (
        <svg {...iconProps}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case 'ai':
      return (
        <svg {...iconProps}>
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
          <path d="M5 3v4M3 5h4M19 17v4M17 19h4" />
        </svg>
      );
    case 'practice':
      return (
        <svg {...iconProps}>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
    case 'communitySettings':
      return (
        <svg {...iconProps}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'librarySettings':
      return (
        <svg {...iconProps}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'device':
      return (
        <svg {...iconProps}>
          <line x1="22" y1="12" x2="2" y2="12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          <line x1="6" y1="16" x2="6.01" y2="16" />
          <line x1="10" y1="16" x2="10.01" y2="16" />
        </svg>
      );
    case 'backup':
      return (
        <svg {...iconProps}>
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      );
    case 'support':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'about':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
    case 'developer':
      return (
        <svg {...iconProps}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}

export function SettingsNavItem({ section, active, onSelect, className = '' }) {
  return (
    <button
      type="button"
      className={`${className} settingsNavItem ${active ? 'activeSettingsNavItem' : ''}`.trim()}
      onClick={() => onSelect(section.id)}
      aria-current={active ? 'page' : undefined}
    >
      <span className={`settingsIcon settingsIcon-${section.id}`} aria-hidden="true">
        <SettingsCategoryIcon id={section.id} />
      </span>
      <span className="settingsNavLabelBlock">
        <strong>{section.title}</strong>
        <small>{section.detail}</small>
      </span>
      <em className="settingsNavChevron" aria-hidden="true">›</em>
    </button>
  );
}

export function SettingsPageTitle({ title = 'Settings', detail = '', children }) {
  return (
    <header className="settingsPageTitle">
      <div className="settingsPageTitleLeft">
        <h1>{title}</h1>
        {detail ? <p>{detail}</p> : null}
      </div>
      {children ? <div className="settingsPageActions">{children}</div> : null}
    </header>
  );
}

const CONTEXT_CONTENT = {
  security: {
    id: 'security',
    title: 'Privacy & Security Guard',
    detail: 'Signova keeps account credentials and workspace sessions protected by Firebase Auth & WebRTC E2EE primitives.',
    sections: [
      ['Account Protection', 'Firebase Authentication & Token Guard', 'Active'],
      ['Sign Transport', 'Encrypted WebRTC Peer Protocol', 'Active'],
      ['Session State', 'Protected local browser workspace', 'Verified'],
      ['DPDP Consent', 'Digital Personal Data compliance', 'Configurable'],
      ['2FA Hardware Key', 'Authenticator app integration', 'Coming Soon'],
    ],
    action: 'Review Security Controls',
  },
  privacy: {
    id: 'security',
    title: 'Privacy Overview',
    detail: 'Control presence visibility, history retention, camera processing, and public profile data.',
    sections: [
      ['Camera Feed', 'Processed live in browser memory', 'On-device'],
      ['Chat Storage', 'Local IndexedDB with cloud sync', 'Configurable'],
      ['Read Receipts', 'Delivered & read state in chats', 'Verified'],
      ['Online Status', 'Live availability visibility', 'Customizable'],
    ],
    action: 'Manage Privacy',
  },
  device: {
    id: 'device',
    title: 'Storage & Memory Guard',
    detail: 'Keep model cache, offline dictionary, and media data optimized for fast recognition.',
    sections: [
      ['Local Storage', 'IndexedDB + Cache Storage', 'Optimized'],
      ['ISL Dictionary', 'Preloaded offline gesture bank', 'Ready'],
      ['Workspace Sync', 'Encrypted cloud preferences', 'Active'],
      ['Data Saver', 'Reduces bandwidth on cellular', 'Available'],
    ],
    action: 'Clean Storage',
  },
  display: {
    id: 'display',
    title: 'Appearance Preview',
    detail: 'Modern fluid surfaces with dark-first styling, glassmorphism, and responsive scales.',
    sections: [
      ['Active Theme', 'Dark / Light / System auto-detect', 'Preview'],
      ['Contrast Level', 'WCAG AA accessible contrast', 'Verified'],
      ['Typography', 'Crisp Inter system sans font scale', 'Optimized'],
      ['Visual Cues', 'Color-coded recognition feedback', 'Active'],
    ],
    action: 'Change Theme',
  },
  camera: {
    id: 'camera',
    title: 'Media Stream Health',
    detail: 'Camera resolution, framerate, and microphone suppression directly tune translation latency.',
    sections: [
      ['Video Sensor', 'High definition real-time capture', 'Ready'],
      ['Microphone', 'Hardware audio input with filtering', 'Ready'],
      ['Noise Cancellation', 'Neural background suppression', 'Enabled'],
      ['Resolution', 'Adaptive WebRTC stream bitrate', 'Dynamic'],
    ],
    action: 'Test Devices',
  },
  calls: {
    id: 'calls',
    title: 'Call Readiness',
    detail: 'Peer-to-peer WebRTC video with real-time ISL/ASL overlay translation.',
    sections: [
      ['WebRTC Signaling', 'Real-time WebSocket & Firebase relay', 'Connected'],
      ['Sign Overlay', 'Synchronous caption pipeline', 'Active'],
      ['Call Encryption', 'DTLS-SRTP end-to-end transport', 'Secure'],
      ['Network RTT', 'Low latency bidirectional streaming', 'Healthy'],
    ],
    action: 'Call Preferences',
  },
  ai: {
    id: 'ai',
    title: 'ISL Neural Engine',
    detail: 'Signova proprietary MediaPipe + Bi-directional Transformer model for real-time sign recognition.',
    sections: [
      ['Core Engine', 'Continuous Sentence-Level ISL v2', 'Active'],
      ['Frame Rate', '30 FPS smooth temporal tracking', 'Optimized'],
      ['Confidence Threshold', 'Heuristic filter for high precision', '55% - 95%'],
      ['Device Mode', 'Client-side WASM + Backend inference', 'Hybrid'],
    ],
    action: 'Calibrate Model',
  },
  translation: {
    id: 'translation',
    title: 'Sign Dialect & Output',
    detail: 'Instant bidirectional conversion between Sign Language and spoken or written languages.',
    sections: [
      ['Sign System', 'Indian Sign Language (ISL primary)', 'Configured'],
      ['Grammar Engine', 'Sentence semantic translation', 'Active'],
      ['Voice Synthesizer', 'Web Speech API auto-utterance', 'Ready'],
      ['Caption Display', 'Live floating transcription card', 'Supported'],
    ],
    action: 'Language Options',
  },
  account: {
    id: 'account',
    title: 'User Profile & Plan',
    detail: 'Manage identity, Signova subscription tier, and connected assistive devices.',
    sections: [
      ['Profile Identity', 'Unique Signova handle and verified email', 'Active'],
      ['Subscription', 'Signova Pro / Free Learning Access', 'Enrolled'],
      ['Sync Status', 'Multi-device cloud workspace sync', 'Enabled'],
      ['Assistance Level', 'Tailored for deaf & hard-of-hearing', 'Personalized'],
    ],
    action: 'Edit Profile',
  },
  general: {
    id: 'general',
    title: 'System Preferences',
    detail: 'Manage basic interface defaults, responsive layout, motion, and daily usage comfort.',
    sections: [
      ['Visual Interface', 'Glassmorphism with calm contrast', 'Active'],
      ['Performance Profile', 'Hardware accelerated animations', 'Smooth'],
      ['Haptic / Audio', 'Discreet confirmation alerts', 'Configurable'],
      ['Accessibility Cues', 'Live recognition indicator rings', 'Active'],
    ],
    action: 'General Settings',
  },
  support: {
    id: 'support',
    title: 'Support & Assistance',
    detail: 'Diagnostic tools, account recovery, documentation, and contact channels.',
    sections: [
      ['App Version', 'Signova Suite v2.4.0', 'Up to date'],
      ['Diagnostic Dump', 'Export anonymous session telemetry', 'Available'],
      ['Knowledge Base', 'Sign language dictionary & tutorials', 'Online'],
      ['Developer Contact', 'Direct engineer assistance', 'Active'],
    ],
    action: 'Get Assistance',
  },
  about: {
    id: 'about',
    title: 'Signova Technology',
    detail: 'Pioneering accessible neural communication for the deaf and hard-of-hearing community.',
    sections: [
      ['Organization', 'Synaptiq Pvt Ltd', 'Registered'],
      ['Lead Architect', 'Akshat Sharma', 'Verified'],
      ['API Gateway', 'Port 5000 REST/Socket gateway', 'Operational'],
      ['AI Microservice', 'Port 8000 Python Inference Core', 'Operational'],
    ],
    action: 'View System Health',
  },
};

function resolveContext(activeSection) {
  return CONTEXT_CONTENT[activeSection] || CONTEXT_CONTENT.general;
}

export function SettingsContextCard({ encryptionAvailable = false, activeSection = 'general' }) {
  const content = resolveContext(activeSection);
  return (
    <aside className="settingsContextCard" aria-label="Privacy and security status">
      <div className="settingsContextVisual" aria-hidden="true">
        <span className={`settingsContextIcon settingsIcon-${content.id}`}>
          <SettingsCategoryIcon id={content.id} />
        </span>
      </div>
      <strong className="settingsContextTitle">{content.title}</strong>
      <p className="settingsContextDetail">{content.detail}</p>
      <ul className="settingsContextList">
        {content.sections.map(([title, detail, status]) => (
          <li key={title} className="settingsContextItem">
            <span
              className={`settingsStatusIndicator ${
                status === 'Unavailable' || status === 'Pending infra' || status === 'Pending'
                  ? 'statusWarning'
                  : status === 'Active' || status === 'Ready' || status === 'Verified' || status === 'Connected' || status === 'Operational'
                  ? 'statusSuccess'
                  : 'statusInfo'
              }`}
            />
            <div className="settingsContextItemBody">
              <strong>{title}</strong>
              <small>{title === 'E2EE Encryption' ? (encryptionAvailable ? 'Available' : detail) : detail}</small>
            </div>
            <em className="settingsContextBadge">
              {title === 'E2EE Encryption' && encryptionAvailable ? 'Available' : status}
            </em>
          </li>
        ))}
      </ul>
      <button type="button" className="settingsContextAction">
        <span>{content.action}</span>
        <span aria-hidden="true">›</span>
      </button>
    </aside>
  );
}
