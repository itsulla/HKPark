'use client';

import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';

const typeStyles: Record<string, string> = {
  info: 'border-[#08d9d6]/40 bg-[#08d9d6]/10 text-[#08d9d6]',
  success: 'border-green-500/40 bg-green-500/10 text-green-400',
  warning: 'border-[#f0c040]/40 bg-[#f0c040]/10 text-[#f0c040]',
  error: 'border-[#ff2e63]/40 bg-[#ff2e63]/10 text-[#ff2e63]',
};

const typeIcons: Record<string, string> = {
  info: '\u2139\uFE0F',
  success: '\u2705',
  warning: '\u26A0\uFE0F',
  error: '\u274C',
};

export default function NotificationToast() {
  const notifications = useGameStore((s) => s.notifications);

  // Auto-dismiss notifications after 3 seconds
  useEffect(() => {
    if (notifications.length === 0) return;

    const timer = setTimeout(() => {
      const store = useGameStore.getState();
      // Remove the oldest notification
      if (store.notifications.length > 0) {
        useGameStore.setState((state) => ({
          notifications: state.notifications.slice(1),
        }));
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [notifications]);

  // Show only the last 3 notifications
  const visible = notifications.slice(-3);

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-14 right-4 z-notification flex flex-col gap-2 pointer-events-none">
      {visible.map((n) => (
        <div
          key={n.id}
          className={`px-3 py-2 rounded-lg border backdrop-blur-md text-xs font-medium animate-notification-enter ${
            typeStyles[n.type] ?? typeStyles.info
          }`}
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
        >
          <span className="mr-1.5">{typeIcons[n.type] ?? ''}</span>
          {n.message}
        </div>
      ))}
    </div>
  );
}
