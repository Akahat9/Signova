import React, { useEffect } from 'react';

/**
 * WhatsApp-Style Minimal In-App Notification Toast
 * Crisp 180ms ease-out, zero bouncy distraction, auto-dismiss in 4s.
 */
export default function InAppNotificationToast({ notification, onClose, onClick }) {
  useEffect(() => {
    if (!notification) return undefined;
    const timer = setTimeout(() => {
      onClose?.();
    }, 4000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  return (
    <aside
      className="snvInAppNotificationToast"
      role="alert"
      aria-live="polite"
      onClick={() => {
        onClick?.(notification);
        onClose?.();
      }}
    >
      <div className="snvToastAvatar" aria-hidden="true">
        {notification.avatar || '💬'}
      </div>
      <div className="snvToastContent">
        <strong>{notification.title || 'New Notification'}</strong>
        <p>{notification.message || notification.detail || ''}</p>
      </div>
      <button
        type="button"
        className="snvToastClose"
        aria-label="Close notification"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
      >
        ×
      </button>
    </aside>
  );
}

