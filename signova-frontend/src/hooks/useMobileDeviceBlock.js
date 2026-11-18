import { useState, useEffect, useCallback } from 'react';

const BYPASS_KEY = 'signova_mobile_bypass';

export function isMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // 1. Check for manual bypass parameter in URL (e.g., ?bypass_mobile=true or for test suites)
  const params = new URLSearchParams(window.location.search);
  if (params.get('bypass_mobile') === 'true' || params.get('signovaCall')) {
    return false;
  }

  // 2. Automated test / Electron environment checks
  if (
    process.env.NODE_ENV === 'test' ||
    window.__coverage__ ||
    window.signovaDesktop ||
    Boolean(window.navigator.webdriver)
  ) {
    return false;
  }

  // 3. User agent pattern check for real mobile phones/tablets
  const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  const isMobileUA = mobileRegex.test(userAgent);

  // 4. Viewport width check (typically mobile phones are < 768px)
  const isSmallViewport = window.innerWidth < 768;

  // We consider it a mobile block candidate if it has a mobile user agent OR very narrow screen with touch points
  const hasTouch = Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1);

  return (isMobileUA && hasTouch) || (isSmallViewport && hasTouch);
}

export default function useMobileDeviceBlock() {
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    // Check if user already clicked bypass in this session
    const hasBypassed = sessionStorage.getItem(BYPASS_KEY) === 'true';
    if (hasBypassed) {
      setIsBlocked(false);
      return;
    }

    const check = () => {
      const mobile = isMobileDevice();
      setIsBlocked(mobile);
    };

    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const proceedAnyway = useCallback(() => {
    sessionStorage.setItem(BYPASS_KEY, 'true');
    setIsBlocked(false);
  }, []);

  return { isMobileBlocked: isBlocked, proceedAnyway };
}

