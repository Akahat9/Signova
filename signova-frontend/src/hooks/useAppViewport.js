import { useEffect } from 'react';

export default function useAppViewport() {
  useEffect(() => {
    let frame = 0;
    let refreshFrame = 0;
    let refreshSamples = [];
    let previousFrameAt = 0;
    let scrollIdleTimer = 0;

    const sync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const height = viewport?.height || window.innerHeight;
        const width = viewport?.width || window.innerWidth;
        const root = document.documentElement;
        root.style.setProperty('--snv-vh', `${height * 0.01}px`);
        root.style.setProperty('--snv-app-height', `${height}px`);
        root.style.setProperty('--snv-app-width', `${width}px`);
        root.style.setProperty('--snv-viewport-offset-top', `${viewport?.offsetTop || 0}px`);
        root.dataset.snvKeyboardOpen = String(height < window.innerHeight * 0.78);
      });
    };

    sync();

    const detectRefreshRate = (now) => {
      if (previousFrameAt) {
        const delta = now - previousFrameAt;
        if (delta > 3 && delta < 40) refreshSamples.push(delta);
      }
      previousFrameAt = now;
      if (refreshSamples.length < 100) {
        refreshFrame = window.requestAnimationFrame(detectRefreshRate);
        return;
      }
      const ordered = [...refreshSamples].sort((a, b) => a - b);
      const median = ordered[Math.floor(ordered.length / 2)] || 16.67;
      const measured = Math.round(1000 / median);
      const standardRates = [60, 75, 90, 120, 144, 165];
      const displayRate = standardRates.reduce((best, rate) => (
        Math.abs(rate - measured) < Math.abs(best - measured) ? rate : best
      ), 60);
      const cores = Number(navigator.hardwareConcurrency || 4);
      const memory = Number(navigator.deviceMemory || 4);
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const deviceCap = reducedMotion || cores <= 4 || memory <= 4 ? 60 : cores <= 6 || memory <= 6 ? 90 : 144;
      const adaptiveRate = Math.min(displayRate, deviceCap);
      const root = document.documentElement;
      root.style.setProperty('--snv-refresh-rate', String(adaptiveRate));
      root.style.setProperty('--snv-frame-ms', `${(1000 / adaptiveRate).toFixed(2)}ms`);
      root.style.setProperty('--snv-motion-scale', String(Math.max(0.58, 60 / adaptiveRate)));
      root.dataset.snvRefresh = String(adaptiveRate);
      document.body.classList.toggle('signovaHighRefresh', adaptiveRate >= 120);
      document.body.classList.toggle('signovaLowPower', adaptiveRate <= 60 && displayRate > 60);
      refreshSamples = [];
    };
    refreshFrame = window.requestAnimationFrame(detectRefreshRate);

    const markScrolling = () => {
      document.body.classList.add('signovaIsScrolling');
      window.clearTimeout(scrollIdleTimer);
      scrollIdleTimer = window.setTimeout(() => {
        document.body.classList.remove('signovaIsScrolling');
      }, 110);
    };

    window.addEventListener('resize', sync, { passive: true });
    window.visualViewport?.addEventListener('resize', sync, { passive: true });
    window.visualViewport?.addEventListener('scroll', sync, { passive: true });
    document.addEventListener('scroll', markScrolling, { passive: true, capture: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(refreshFrame);
      window.clearTimeout(scrollIdleTimer);
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('scroll', sync);
      document.removeEventListener('scroll', markScrolling, { capture: true });
      delete document.documentElement.dataset.snvKeyboardOpen;
      document.body.classList.remove('signovaHighRefresh', 'signovaLowPower', 'signovaIsScrolling');
    };
  }, []);
}
