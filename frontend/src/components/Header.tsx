import React, { useState, useEffect } from "react";
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
  const [textSize, setTextSize] = useState<"normal" | "large">(() => {
    return (localStorage.getItem("text-size") as "normal" | "large") || "normal";
  });

  useEffect(() => {
    localStorage.setItem("text-size", textSize);
    document.documentElement.setAttribute("data-text-size", textSize);
  }, [textSize]);

  const toggleTextSize = () => {
    setTextSize((prev) => (prev === "normal" ? "large" : "normal"));
  };

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
        <div className="header-actions">
          <button
            type="button"
            className="text-size-toggle"
            onClick={toggleTextSize}
            aria-label={textSize === "normal" ? "Increase text size" : "Decrease text size"}
            title={textSize === "normal" ? "Larger text" : "Normal text"}
          >
            {textSize === "normal" ? "A+" : "A-"}
          </button>
          <Notification
            notifications={notifications}
            onMarkAsRead={onMarkAsRead}
            onClearAll={onClearAll}
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
