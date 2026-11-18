import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { RailIcon } from './SignovaIcons';
import { contactInitial } from '../features/contacts/contactModel';

export function ContactAvatar({ contact, className = 'avatar', presenceTone = '' }) {
  const initial = contactInitial(contact);
  const avatarChoice = contact?.avatarChoice || 'signova';
  const presenceIndicator = presenceTone ? <i className={`avatarPresenceIndicator ${presenceTone}`} aria-hidden="true" /> : null;
  if (contact?.profileImage) {
    return (
      <span className={`${className} contactAvatar uploadedContactAvatar`}>
        <img src={contact.profileImage} alt="" />
        {presenceIndicator}
      </span>
    );
  }

  if (avatarChoice === 'initial') {
    return <span className={`${className} contactAvatar initialContactAvatar`}>{initial}{presenceIndicator}</span>;
  }

  return (
    <span className={`${className} contactAvatar signovaContactAvatar`}>
      <img src="/app-logo.png" alt="" />
      <em>{initial}</em>
      {presenceIndicator}
    </span>
  );
}

export function CommunityActionIcon({ type, active = false }) {
  const uniqueId = useId().replace(/:/g, '');
  const gradientId = `community-${type}-${active ? 'active' : 'idle'}-${uniqueId}`;
  return (
    <svg className={`socialActionSvg socialActionSvg-${type}`} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="5" y1="4" x2="27" y2="28">
          <stop stopColor={active ? '#06b6d4' : '#ffffff'} />
          <stop offset="1" stopColor={active ? '#2563eb' : '#dbeafe'} />
        </linearGradient>
      </defs>
      {type === 'like' && <>
        <path d="M11.5 27H7.8a2.3 2.3 0 0 1-2.3-2.3v-9.1a2.3 2.3 0 0 1 2.3-2.3h3.7Z" fill={`url(#${gradientId})`} />
        <path d="M11.5 14.5 16 7.2c.8-1.3 1.1-2.7.8-4.2 3.1.2 4.8 2.8 4.1 5.8l-.9 4h5.8a3 3 0 0 1 2.9 3.7l-1.8 7.4a4 4 0 0 1-3.9 3.1H11.5Z" fill={`url(#${gradientId})`} stroke="#1676e8" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M8.5 17v6.2" stroke="#1676e8" strokeWidth="1.7" strokeLinecap="round" />
      </>}
      {type === 'comment' && <>
        <path d="M5 6.5h22v16H14l-6.7 4.4 1.8-4.4H5Z" fill={`url(#${gradientId})`} stroke="#1676e8" strokeWidth="1.7" strokeLinejoin="round" />
        <circle cx="11" cy="14.5" r="1.4" fill="#1676e8" /><circle cx="16" cy="14.5" r="1.4" fill="#1676e8" /><circle cx="21" cy="14.5" r="1.4" fill="#1676e8" />
      </>}
      {type === 'share' && <>
        <path d="M6 25c2.4-8.3 8-12.1 16.1-11.7V7l6 7.2-6 7v-5.8C14.7 15.1 10.1 18.3 6 25Z" fill={`url(#${gradientId})`} stroke="#1676e8" strokeWidth="1.7" strokeLinejoin="round" />
      </>}
    </svg>
  );
}

export function ContactMetaLine({ contact, activityStatus = '', activityItems = [], fallback = 'Private contact' }) {
  const items = [
    contact?.showUsername !== false ? contact?.username : null,
    contact?.showNumber ? contact?.number : null,
  ].filter(Boolean);
  const liveItems = activityItems.length ? activityItems : (activityStatus ? [activityStatus] : []);

  if (!items.length && !liveItems.length) return <small className="contactMetaLine">{fallback}</small>;

  return (
    <small className="contactMetaLine">
      {items.map((item, index) => (
        <Fragment key={`${item}-${index}`}>
          {index > 0 ? <i aria-hidden="true">·</i> : null}
          <b>{item}</b>
        </Fragment>
      ))}
      {liveItems.length ? (
        <>
          {items.length ? <i aria-hidden="true">·</i> : null}
          <span className="headerActivityTicker" aria-label={liveItems[0]}>
            {liveItems.slice(0, 3).map((item, index) => <em key={`${item}-${index}`}>{item}</em>)}
          </span>
        </>
      ) : null}
    </small>
  );
}

export function VoiceSignChatIcon() {
  return (
    <svg className="minimalHeaderSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.75a3 3 0 0 0-3 3v4.5a3 3 0 0 0 6 0v-4.5a3 3 0 0 0-3-3Z" />
      <path d="M6.5 10.5a5.5 5.5 0 0 0 11 0" />
      <path d="M12 16v3.25" />
      <path d="M15.75 14.5h2.4a2.1 2.1 0 0 1 0 4.2h-.65l-1.75 1.3v-1.3a2.1 2.1 0 0 1 0-4.2Z" />
    </svg>
  );
}

export function VideoSignChatIcon() {
  return (
    <svg className="minimalHeaderSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.75" y="6.5" width="11.5" height="8.8" rx="2.2" />
      <path d="M15.25 9.2 20.25 7v7.8l-5-2.2" />
      <path d="M9 18.7v-4.1" />
      <path d="M12 18.35v-4.8" />
      <path d="M6.75 18.4c1.55 1.5 5.6 1.75 7.9-.2" />
    </svg>
  );
}

export function HeaderSearchIcon() {
  return (
    <svg className="minimalHeaderSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="10.8" cy="10.8" r="5.9" />
      <path d="M15.2 15.2 20 20" />
    </svg>
  );
}

export function HeaderMoreIcon() {
  return (
    <svg className="minimalHeaderSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="6.8" r="1.25" />
      <circle cx="12" cy="12" r="1.25" />
      <circle cx="12" cy="17.2" r="1.25" />
    </svg>
  );
}

export function getCallHistoryPresentation(type = '') {
  const normalizedType = String(type).toLowerCase();
  if (normalizedType === 'video-sign-chat' || normalizedType === 'video-sign' || normalizedType === 'video') {
    return { label: 'Video Sign Chat', tone: 'video', translation: 'Sign translation used' };
  }
  if (normalizedType === 'voice-sign-chat' || normalizedType === 'voice-sign' || normalizedType === 'voice') {
    return { label: 'Voice Sign Chat', tone: 'voice', translation: 'Voice translation used' };
  }
  if (['meeting', 'videomeeting', 'voicemeeting', 'webrtc'].includes(normalizedType)) {
    return { label: 'Video Sign Chat', tone: 'video', translation: 'Sign translation used' };
  }
  return { label: 'Normal Call', tone: 'normal', translation: 'No translation' };
}


export function SignovaOpeningAnimation({ activePanel = 'community', className = '' }) {
  return (
    <div className={`fullSignovaIntro activeFullSignovaIntro ${className}`} aria-hidden="true">
      <span className="tributeGlow" />
      <span className="tributeIcon tributeIconHome"><RailIcon type="home" /></span>
      <span className="tributeIcon tributeIconChat"><RailIcon type="voiceHistory" /></span>
      <span className="tributeIcon tributeIconLibrary"><RailIcon type="library" /></span>
      <span className="tributeIcon tributeIconLearn"><RailIcon type="learn" /></span>
      <span className="tributeIcon tributeIconCommunity"><RailIcon type={activePanel === 'communityGroups' ? 'communityGroups' : 'communityFeed'} /></span>
      <span className="tributeIcon tributeIconSettings"><RailIcon type="settings" /></span>
      <span className="tributeLogoReveal">
        <span className="openingLogoCore"><img src="/app-logo.png" alt="" /></span>
        <span className="openingBrandCopy">
          <strong>Signova</strong>
          <small>Every Gesture, Give a Voice</small>
        </span>
      </span>
    </div>
  );
}

export function AppStartupSkeleton() {
  return (
    <div className="appStartupSkeleton" role="status" aria-live="polite" aria-label="Loading your Signova workspace">
      <aside>
        <span className="startupLogoSkeleton" />
        {[0, 1, 2, 3, 4].map((item) => <i key={item} />)}
      </aside>
      <main>
        <header><span /><i /><i /></header>
        <section className="startupSkeletonWorkspace">
          <div className="startupSkeletonList">
            <b />
            {[0, 1, 2, 3].map((item) => <span key={item}><i /><em /></span>)}
          </div>
          <div className="startupSkeletonContent">
            <b />
            <span />
            <span />
            <span />
            <footer><i /><em /></footer>
          </div>
        </section>
      </main>
      <p>Preparing your workspace…</p>
    </div>
  );
}

export function DelayedStartupSkeleton({ delay = 400 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;
  return <AppStartupSkeleton />;
}

export function CommunityFeedVideo({ src, label, poster = '' }) {
  const feedVideoRef = useRef(null);

  useEffect(() => {
    const video = feedVideoRef.current;
    if (!video || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.2) {
        video.pause();
      }
    }, {
      root: document.querySelector('.communityPostStream'),
      rootMargin: '120px 0px',
      threshold: [0, 0.2],
    });

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  function handlePlay() {
    document.querySelectorAll('.performanceCommunityVideo').forEach((video) => {
      if (video !== feedVideoRef.current) video.pause();
    });
  }

  return (
    <video
      ref={feedVideoRef}
      className="performanceCommunityVideo"
      src={src}
      poster={poster || undefined}
      controls
      muted
      playsInline
      preload="metadata"
      controlsList="nodownload"
      aria-label={label}
      onPlay={handlePlay}
    />
  );
}
