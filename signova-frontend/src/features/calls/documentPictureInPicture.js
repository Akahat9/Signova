/**
 * Signova Document Picture-in-Picture Manager
 * Allows video/voice calls to float as a native OS-level window outside the browser,
 * enabling full multitasking (Google Meet style) while preserving all controls:
 * - Live camera & remote video
 * - Mic mute / unmute
 * - Camera toggle & flip
 * - Synapse live sign translation & captions
 * - Dynamic window resize scaling for camera frames & controls
 * - Settings launcher & end call
 * - Synchronized theme (Light glassmorphism or Cosmic dark mode)
 */

export function isDocumentPiPSupported() {
  return typeof window !== 'undefined'
    && Boolean(window.documentPictureInPicture && typeof window.documentPictureInPicture.requestWindow === 'function');
}

export function copyStylesToTargetDocument(targetDoc, isDarkMode = false) {
  if (!targetDoc) return;

  // Copy all existing stylesheets and style tags
  try {
    const sheets = Array.from(document.styleSheets || []);
    sheets.forEach((sheet) => {
      try {
        if (sheet.cssRules) {
          const style = targetDoc.createElement('style');
          Array.from(sheet.cssRules).forEach((rule) => {
            style.appendChild(targetDoc.createTextNode(rule.cssText));
          });
          targetDoc.head.appendChild(style);
        } else if (sheet.href) {
          const link = targetDoc.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          targetDoc.head.appendChild(link);
        }
      } catch {
        // Cross-origin stylesheet security fallback
        if (sheet.href) {
          const link = targetDoc.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          targetDoc.head.appendChild(link);
        }
      }
    });
  } catch {
    // Stylesheet enumeration fallback
  }

  // Inject fully responsive PiP standalone styling (Adaptive Theme: Light vs Dark)
  const pipStyles = targetDoc.createElement('style');
  pipStyles.textContent = `
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      overflow: hidden !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif !important;
      user-select: none !important;
    }

    * {
      box-sizing: border-box !important;
    }

    /* Full-viewport flex container that resizes seamlessly */
    .signovaPipCallContainer {
      width: 100vw !important;
      height: 100vh !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      padding: 8px !important;
    }

    .signovaPipCallContainer .unifiedMinimizedCallBody {
      width: 100% !important;
      height: 100% !important;
      flex: 1 1 0 !important;
      min-height: 0 !important;
      min-width: 0 !important;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 52px !important;
      gap: 8px !important;
      padding: 0 !important;
      position: relative !important;
      overflow: hidden !important;
    }

    /* Both participant camera frames scale dynamically with window resize */
    .signovaPipCallContainer .unifiedMinimizedParticipants {
      width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      min-width: 0 !important;
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
      position: relative !important;
      overflow: hidden !important;
    }

    .signovaPipCallContainer .unifiedMinimizedParticipant {
      width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      min-width: 0 !important;
      display: block !important;
      position: relative !important;
      overflow: hidden !important;
      border-radius: 14px !important;
      padding: 0 !important;
      cursor: pointer !important;
      border: 1px solid rgba(100, 180, 218, 0.65) !important;
    }

    .signovaPipCallContainer .unifiedMinimizedParticipant video {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      display: block !important;
    }

    .signovaPipCallContainer .unifiedMinimizedHandTrackerOverlay {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      pointer-events: none !important;
      z-index: 4 !important;
      object-fit: cover !important;
    }

    /* Subtitle Translation overlay positioned above bottom of video */
    .signovaPipCallContainer .unifiedMinimizedTranslation {
      position: absolute !important;
      z-index: 6 !important;
      left: 12px !important;
      right: 68px !important;
      bottom: 10px !important;
      min-width: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 2px !important;
      border-radius: 14px !important;
      padding: 7px 14px !important;
      text-align: center !important;
      backdrop-filter: blur(20px) saturate(160%) !important;
      pointer-events: none !important;
      transition: all 180ms ease !important;
    }

    .signovaPipCallContainer .unifiedMinimizedTranslation span {
      font-size: 8px !important;
      font-weight: 800 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
    }

    .signovaPipCallContainer .unifiedMinimizedTranslation strong {
      font-size: clamp(13px, 2.8vw, 19px) !important;
      font-weight: 800 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      max-width: 100% !important;
    }

    .signovaPipCallContainer .unifiedMinimizedTranslation small {
      font-size: 7px !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      opacity: 0.8 !important;
    }

    /* Vertically centered right-side controls column */
    .signovaPipCallContainer .unifiedMinimizedCallControls {
      height: 100% !important;
      width: 52px !important;
      min-width: 52px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      align-items: center !important;
      gap: 7px !important;
      padding: 0 !important;
    }

    .signovaPipCallContainer .unifiedMinimizedCallControls button {
      width: 44px !important;
      height: 44px !important;
      min-width: 44px !important;
      min-height: 44px !important;
      border-radius: 12px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
      cursor: pointer !important;
      font-size: 16px !important;
      transition: transform 150ms ease, background 150ms ease, box-shadow 150ms ease !important;
    }

    .signovaPipCallContainer .unifiedMinimizedCallControls button:hover {
      transform: translateY(-1px) scale(1.05) !important;
    }

    /* ========================================================
       DARK THEME STYLES (Enabled when premiumDarkMode is active)
       ======================================================== */
    body.premiumDarkMode,
    html.premiumDarkMode body,
    .signovaPipCallContainer.premiumDarkMode {
      background: #081724 !important;
      color: #e3f2fd !important;
    }

    .signovaPipCallContainer.premiumDarkMode {
      background: linear-gradient(180deg, #0a1e2e 0%, #06131d 100%) !important;
    }

    .signovaPipCallContainer.premiumDarkMode .unifiedMinimizedParticipant {
      background: #0a2433 !important;
      border-color: rgba(92, 202, 226, 0.35) !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
    }

    .signovaPipCallContainer.premiumDarkMode .unifiedMinimizedTranslation {
      background: rgba(10, 30, 46, 0.85) !important;
      border: 1px solid rgba(56, 189, 248, 0.35) !important;
      color: #ffffff !important;
      box-shadow: 0 10px 28px rgba(0, 10, 20, 0.4) !important;
    }

    .signovaPipCallContainer.premiumDarkMode .unifiedMinimizedTranslation span {
      color: #38bdf8 !important;
    }

    .signovaPipCallContainer.premiumDarkMode .unifiedMinimizedTranslation strong {
      color: #ffffff !important;
    }

    .signovaPipCallContainer.premiumDarkMode .unifiedMinimizedTranslation small {
      color: #94a3b8 !important;
    }

    .signovaPipCallContainer.premiumDarkMode .mini3dCallControl {
      background: rgba(255, 255, 255, 0.1) !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      color: #e0f2fe !important;
    }

    .signovaPipCallContainer.premiumDarkMode .mini3dCallControl:hover {
      background: rgba(56, 189, 248, 0.25) !important;
      border-color: rgba(56, 189, 248, 0.5) !important;
    }

    .signovaPipCallContainer.premiumDarkMode .mini3dCallControl.activeMiniCallControl {
      background: #0284c7 !important;
      border-color: #0284c7 !important;
      color: #ffffff !important;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4) !important;
    }

    .signovaPipCallContainer.premiumDarkMode .unifiedMiniEndCall {
      background: #ef4444 !important;
      border-color: #dc2626 !important;
      color: #ffffff !important;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4) !important;
    }

    /* ========================================================
       LIGHT THEME STYLES (Matches Signova Light Theme Glassmorphism)
       ======================================================== */
    body.callLightTheme,
    html:not(.premiumDarkMode) body,
    .signovaPipCallContainer.callLightTheme {
      background: #f0f7fb !important;
      color: #10213b !important;
    }

    .signovaPipCallContainer.callLightTheme {
      background: linear-gradient(180deg, #f7fbfe 0%, #e9f4fa 100%) !important;
    }

    .signovaPipCallContainer.callLightTheme .unifiedMinimizedParticipant {
      background: #dbeff8 !important;
      border: 1px solid rgba(100, 180, 218, 0.65) !important;
      box-shadow: 0 4px 14px rgba(35, 80, 115, 0.08) !important;
    }

    .signovaPipCallContainer.callLightTheme .unifiedMinimizedTranslation {
      background: rgba(255, 255, 255, 0.92) !important;
      border: 1px solid rgba(140, 205, 235, 0.6) !important;
      box-shadow: 0 8px 24px rgba(35, 85, 120, 0.14) !important;
    }

    .signovaPipCallContainer.callLightTheme .unifiedMinimizedTranslation span {
      color: #0284c7 !important;
    }

    .signovaPipCallContainer.callLightTheme .unifiedMinimizedTranslation strong {
      color: #0d2238 !important;
      text-shadow: none !important;
    }

    .signovaPipCallContainer.callLightTheme .unifiedMinimizedTranslation small {
      color: #557088 !important;
    }

    .signovaPipCallContainer.callLightTheme .mini3dCallControl {
      background: rgba(255, 255, 255, 0.9) !important;
      border: 1px solid rgba(120, 195, 225, 0.5) !important;
      color: #1a3652 !important;
      box-shadow: 0 2px 8px rgba(30, 75, 110, 0.1) !important;
    }

    .signovaPipCallContainer.callLightTheme .mini3dCallControl:hover {
      background: rgba(240, 250, 255, 0.98) !important;
      border-color: rgba(2, 132, 199, 0.5) !important;
    }

    .signovaPipCallContainer.callLightTheme .mini3dCallControl.activeMiniCallControl {
      background: #0284c7 !important;
      border-color: #0284c7 !important;
      color: #ffffff !important;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35) !important;
    }

    .signovaPipCallContainer.callLightTheme .unifiedMiniEndCall {
      background: #ef4444 !important;
      border-color: #dc2626 !important;
      color: #ffffff !important;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35) !important;
    }
  `;
  targetDoc.head.appendChild(pipStyles);
  const themeClass = isDarkMode ? 'premiumDarkMode signovaPremiumDarkPage' : 'callLightTheme';
  if (targetDoc.documentElement) {
    targetDoc.documentElement.className = themeClass;
  }
  targetDoc.body.className = `${document.body.className || ''} signovaPipDocumentActive ${themeClass}`.trim();
  targetDoc.title = 'Signova Live Call · Multitasking';
}

export async function requestDocumentPiP({
  width = 520,
  height = 310,
  isDarkMode = false,
  onClose = null,
} = {}) {
  if (!isDocumentPiPSupported()) {
    throw new Error('Document Picture-in-Picture is not supported in this browser.');
  }

  // Close existing PiP window if already open
  if (window.documentPictureInPicture.window) {
    try {
      window.documentPictureInPicture.window.close();
    } catch {
      // Ignore cleanup error
    }
  }

  const pipWindow = await window.documentPictureInPicture.requestWindow({
    width,
    height,
  });

  copyStylesToTargetDocument(pipWindow.document, isDarkMode);

  if (typeof onClose === 'function') {
    pipWindow.addEventListener('pagehide', onClose, { once: true });
  }

  return pipWindow;
}

export function closeActiveDocumentPiP() {
  if (isDocumentPiPSupported() && window.documentPictureInPicture.window) {
    try {
      window.documentPictureInPicture.window.close();
    } catch {
      // Ignore error during window close
    }
  }
}
