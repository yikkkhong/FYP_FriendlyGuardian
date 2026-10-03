import React from "react";

interface HeaderProps {
  isConnected: boolean; // only to know socket is connected or no
}

export const Header: React.FC<HeaderProps> = ({ isConnected }) => {
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
      </div>
    </header>
  );
};

export default Header;
