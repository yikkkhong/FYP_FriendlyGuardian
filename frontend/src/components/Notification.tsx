import React, { useState, useRef, useEffect } from "react";

export interface Notification {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
  type?: "info" | "warning" | "success" | "danger";
}

interface NotificationProps {
  notifications: Notification[];
  onMarkAsRead?: (id: string) => void;
  onClearAll?: () => void;
}

export const Notification: React.FC<NotificationProps> = ({
  notifications,
  onMarkAsRead,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = (id: string) => {
    if (onMarkAsRead) {
      onMarkAsRead(id);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case "warning":
        return "#b45309";
      case "success":
        return "#047857";
      case "danger":
        return "#b91c1c";
      default:
        return "#0f766e";
    }
  };

  return (
    <div className="notification-wrapper" ref={dropdownRef}>
      <button
        className="notification-bell-btn"
        onClick={handleToggle}
        aria-label="Notifications"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="notification-bell-icon"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3 className="notification-title">Notifications</h3>
            {notifications.length > 0 && onClearAll && (
              <button
                className="notification-clear-btn"
                onClick={() => {
                  onClearAll();
                  setIsOpen(false);
                }}
              >
                Clear all
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? "unread" : ""}`}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  <div
                    className="notification-dot"
                    style={{ backgroundColor: getTypeColor(notification.type) }}
                  />
                  <div className="notification-content">
                    <p className="notification-message">
                      {notification.message}
                    </p>
                    <span className="notification-time">
                      {formatTime(notification.timestamp)}
                    </span>
                  </div>
                  {!notification.read && (
                    <div className="notification-indicator" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notification;
