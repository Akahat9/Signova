import React, { useCallback, useEffect, useRef, useState } from 'react';

const MIN_THUMB_HEIGHT = 34;

export default function ProgressScrollRail({ targetRef }) {
  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const [metrics, setMetrics] = useState({ thumbHeight: 0, thumbTop: 0, visible: false });

  const sync = useCallback(() => {
    const target = targetRef.current;
    const track = trackRef.current;
    if (!target || !track) return;

    const trackHeight = track.clientHeight;
    const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight);
    const thumbHeight = maxScroll
      ? Math.max(MIN_THUMB_HEIGHT, trackHeight * (target.clientHeight / target.scrollHeight))
      : trackHeight;
    const travel = Math.max(0, trackHeight - thumbHeight);
    const thumbTop = maxScroll ? (target.scrollTop / maxScroll) * travel : 0;
    setMetrics({ thumbHeight, thumbTop, visible: maxScroll > 1 });
  }, [targetRef]);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return undefined;

    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(sync) : null;
    target.addEventListener('scroll', sync, { passive: true });
    observer?.observe(target);
    if (target.firstElementChild) observer?.observe(target.firstElementChild);
    sync();

    return () => {
      target.removeEventListener('scroll', sync);
      observer?.disconnect();
    };
  }, [sync, targetRef]);

  function scrollFromPointer(clientY, centered = true) {
    const target = targetRef.current;
    const track = trackRef.current;
    if (!target || !track) return;
    const rect = track.getBoundingClientRect();
    const travel = Math.max(1, rect.height - metrics.thumbHeight);
    const pointerOffset = centered ? metrics.thumbHeight / 2 : dragRef.current?.pointerOffset || 0;
    const thumbTop = Math.max(0, Math.min(travel, clientY - rect.top - pointerOffset));
    const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight);
    target.scrollTop = (thumbTop / travel) * maxScroll;
  }

  function startDrag(event) {
    event.preventDefault();
    const thumbRect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { pointerOffset: event.clientY - thumbRect.top };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event) {
    if (!dragRef.current) return;
    event.preventDefault();
    scrollFromPointer(event.clientY, false);
  }

  function stopDrag(event) {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div
      ref={trackRef}
      className={`progressScrollRail ${metrics.visible ? 'visibleProgressScrollRail' : ''}`}
      aria-hidden={!metrics.visible}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) scrollFromPointer(event.clientY);
      }}
    >
      <span
        className="progressScrollThumb"
        style={{ height: `${metrics.thumbHeight}px`, transform: `translateY(${metrics.thumbTop}px)` }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      />
    </div>
  );
}
