"use client";

import { useEffect, useState, useRef } from 'react';
import { Bell, CheckCheck, AlertTriangle, Briefcase, Calendar, CheckSquare, Flame, Info, ExternalLink } from 'lucide-react';
import { api, type NotificationItem } from '../lib/api';

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    const load = () => {
      api<{ items: NotificationItem[]; unreadCount: number }>('/api/notifications')
        .then((data) => {
          if (!active) return;
          setNotifications(data.items);
          setUnreadCount(data.unreadCount);
        })
        .catch(() => {});
    };

    load();
    const interval = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const markAsRead = async (id: string) => {
    try {
      await api(`/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await api('/api/notifications/read-all', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'ALERT':
        return <AlertTriangle size={16} color="var(--accent-danger)" />;
      case 'BURNOUT':
        return <Flame size={16} color="var(--accent-danger)" />;
      case 'LEAD':
        return <Briefcase size={16} color="var(--accent-primary)" />;
      case 'LEAVE':
        return <Calendar size={16} color="var(--accent-warning)" />;
      case 'TASK':
        return <CheckSquare size={16} color="var(--accent-secondary)" />;
      default:
        return <Info size={16} color="var(--accent-primary)" />;
    }
  };

  const formatNotificationDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="View notifications"
        title="Notifications"
        className="icon-button"
        style={{
          position: 'relative',
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-glass)',
          color: unreadCount > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'var(--transition-fast)',
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: '999px',
              background: 'var(--accent-danger)',
              color: 'white',
              fontSize: '0.68rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 5px rgba(239, 68, 68, 0.4)',
              border: '2px solid var(--bg-secondary)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 'min(380px, calc(100vw - 2rem))',
            maxHeight: '480px',
            overflowY: 'auto',
            zIndex: 100,
            padding: '1rem',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--border-radius-lg)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
              paddingBottom: '0.6rem',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Notifications</span>
              {unreadCount > 0 && (
                <span className="badge badge-danger" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => !item.read && markAsRead(item.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--border-radius-md)',
                  background: item.read ? 'transparent' : 'rgba(79, 70, 229, 0.05)',
                  border: '1px solid',
                  borderColor: item.read ? 'var(--border-color)' : 'rgba(79, 70, 229, 0.2)',
                  cursor: item.read ? 'default' : 'pointer',
                  transition: 'var(--transition-fast)',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    padding: '6px',
                    borderRadius: '8px',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-color)',
                    marginTop: '2px',
                    flexShrink: 0,
                  }}
                >
                  {getIcon(item.type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontWeight: item.read ? 600 : 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: '6px' }}>
                      {formatNotificationDate(item.createdAt)}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.35, margin: 0 }}>
                    {item.message}
                  </p>
                  {item.link && (
                    <a
                      href={item.link}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.75rem',
                        color: 'var(--accent-primary)',
                        marginTop: '4px',
                        fontWeight: 600,
                      }}
                    >
                      View details <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No notifications right now.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
