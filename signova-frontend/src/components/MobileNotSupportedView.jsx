import React, { useState } from 'react';

export default function MobileNotSupportedView({ onProceedAnyway }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="signovaMobileBlockOverlay" role="dialog" aria-modal="true" aria-label="Mobile device notice">
      <div className="signovaMobileBlockCard">
        {/* Signova Brand Header */}
        <div className="signovaMobileBlockBrand">
          <img src="/app-logo.png" alt="Signova Logo" className="signovaMobileLogo" />
          <div className="signovaMobileBrandText">
            <span className="signovaBrandName">Signova</span>
            <span className="signovaBrandTagline">Every Gesture, A Voice.</span>
          </div>
        </div>

        {/* 3D Visual Device Illustration */}
        <div className="signovaMobileVisual">
          <div className="signovaDeviceBadge desktopDevice">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="signovaDeviceCheck" aria-label="Supported">✓</span>
          </div>

          <div className="signovaDeviceConnector">
            <span className="connectorDot" />
            <span className="connectorLine" />
            <span className="connectorDot" />
          </div>

          <div className="signovaDeviceBadge mobileDevice">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2.5" ry="2.5" />
              <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" />
            </svg>
            <span className="signovaDeviceCross" aria-label="Not supported directly in mobile web">×</span>
          </div>
        </div>

        {/* Headline & Description */}
        <h1 className="signovaMobileTitle">Signova Web is built for Computers</h1>
        <p className="signovaMobileSubtitle">
          To use real-time sign language AI translation, 3D tracking, and interactive video workspaces, please open Signova on your <strong>PC, Mac, or Laptop</strong>.
        </p>

        {/* Action Buttons: Native App & Copy Link */}
        <div className="signovaMobileActions">
          <button
            type="button"
            className="signovaCopyLinkBtn"
            onClick={handleCopyLink}
          >
            {copied ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Link Copied! Open on PC</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy Link to Open on Desktop</span>
              </>
            )}
          </button>
        </div>

        {/* Mobile App Coming Soon Badge (Flutter) */}
        <div className="signovaMobileAppPill">
          <span className="flutterBadge">Flutter Native</span>
          <p>
            Native Android & iOS apps with offline AI recognition and zero-latency video calls are currently in private beta.
          </p>
        </div>

        {/* Optional fallback override */}
        {onProceedAnyway && (
          <button
            type="button"
            className="signovaBypassLink"
            onClick={onProceedAnyway}
          >
            Continue to web version anyway →
          </button>
        )}
      </div>
    </div>
  );
}

