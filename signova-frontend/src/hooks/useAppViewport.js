import { useEffect } from 'react';

export default function useAppViewport() {
  useEffect(() => {
    let frame = 0;

    const sync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const height = window.visualViewport?.height || window.innerHeight;
        document.documentElement.style.setProperty('--snv-vh', `${height * 0.01}px`);
        document.documentElement.style.setProperty('--snv-app-height', `${height}px`);
      });
    };

    sync();
    window.addEventListener('resize', sync, { passive: true });
    window.visualViewport?.addEventListener('resize', sync, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, []);
}
