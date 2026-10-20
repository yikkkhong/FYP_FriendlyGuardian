import React, { useState, useEffect } from "react";
import { Notification, Notification as NotificationType } from "./Notification";

import "../../styles/header.css";
import "../../styles/chat/chat-message.css";

interface HeaderProps {
  isConnected: boolean; // only to know socket is connected or no
  notifications?: NotificationType[];
  onMarkAsRead?: (id: string) => void;
  onClearAll?: () => void;
  onNewConversation?: () => void;
  isLoading?: boolean;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
    </svg>
  );
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  notifications = [],
  onMarkAsRead,
  onClearAll,
  onNewConversation,
  isLoading = false,
}) => {
  const [textSize, setTextSize] = useState<"normal" | "large">(() => {
    return (
      (localStorage.getItem("text-size") as "normal" | "large") || "normal"
    );
  });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    localStorage.setItem("text-size", textSize);
    document.documentElement.setAttribute("data-text-size", textSize);
  }, [textSize]);

  // Add is-scrolled class when page has been scrolled
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 4 || document.documentElement.scrollTop > 4);
    };
    // Also watch the manual-stream-viewport scroll
    const viewport = document.querySelector(".manual-stream-viewport");
    const handleViewportScroll = () => {
      if (viewport) {
        setScrolled((viewport as HTMLElement).scrollTop > 4);
      }
    };
    window.addEventListener("scroll", handleScroll);
    viewport?.addEventListener("scroll", handleViewportScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      viewport?.removeEventListener("scroll", handleViewportScroll);
    };
  }, []);

  const toggleTextSize = () => {
    setTextSize((prev) => (prev === "normal" ? "large" : "normal"));
  };

  return (
    <header className={`control-bar-wrapper${scrolled ? " is-scrolled" : ""}`}>
      <div className="control-bar">
        {/* Inner centred container — matches the 1000px content column */}
        <div className="control-bar-inner">
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
            {/* "New check" pill button — replaces the old floating + button */}
            {onNewConversation && (
              <button
                type="button"
                className="header-new-check-btn"
                onClick={onNewConversation}
                disabled={isLoading}
                aria-label="Start a new check"
                id="header-new-check"
              >
                <PlusIcon />
                <span className="btn-label">New check</span>
              </button>
            )}

            <button
              type="button"
              className="text-size-toggle"
              onClick={toggleTextSize}
              aria-label={
                textSize === "normal"
                  ? "Increase text size"
                  : "Decrease text size"
              }
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
      </div>
    </header>
  );
};

export default Header;
