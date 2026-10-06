import React from "react";
import { Notification, Notification as NotificationType } from "./Notification";

interface HeaderProps {
  isConnected: boolean; // only to know socket is connected or no
  notifications?: NotificationType[];
  onMarkAsRead?: (id: string) => void;
  onClearAll?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  notifications = [],
  onMarkAsRead,
  onClearAll,
}) => {
  return (
    <header className="control-bar-wrapper">
      <div className="control-bar">
        <div className="brand-group">
          <span className="brand-pill">Friendly Guardian</span>
          <div className="connection-indicator">
            <span
              className={`pulse-dot ${isConnected ? "online" : "offline"}`}
            />
            <span className="status-label">
              {isConnected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>
        <Notification
          notifications={notifications}
          onMarkAsRead={onMarkAsRead}
          onClearAll={onClearAll}
        />
      </div>
    </header>
  );
};

export default Header;
