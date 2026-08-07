import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

// notification message data structure
interface ScamAlertData {
  text: string;
  sender: string;
  detected_account: string;
  reason: string;
  timestamp: string;
}

const App: React.FC = () => {
  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [alertData, setAlertData] = useState<ScamAlertData | null>(null);
  const [blockedCount, setBlockedCount] = useState<number>(12);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    // Connect to Node.js backend Socket.IO service
    const socket = io("http://localhost:5000");

    socket.on("connect", () => {
      console.log("✅ Connected to WebSocket Server");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from WebSocket Server");
      setIsConnected(false);
    });

    // real-time scam alerts - incoming SMS
    socket.on("scam_alert", (data: ScamAlertData) => {
      console.log("🚨 REAL-TIME SCAM ALERT RECEIVED:", data);
      setAlertData(data);
      setShowAlert(true);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleBlock = () => {
    setShowAlert(false);
    setBlockedCount((prev) => prev + 1); // Increment blocked count
  };

  return (
    <div style={styles.container}>
      {/* header */}
      <header style={styles.header}>
        <h1 style={styles.greeting}>Hello, User</h1>
        <div style={styles.statusBadge}>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor: isConnected ? "#22C55E" : "#EF4444",
            }}
          />
          <span style={styles.statusBadgeText}>
            {isConnected ? "Server Connected" : "Server Offline"}
          </span>
        </div>
      </header>

      <main style={styles.statusContainer}>
        <div style={styles.shieldOuter}>
          <div style={styles.shieldInner}>
            <span style={styles.shieldIcon}>🛡️</span>
          </div>
        </div>
        <h2 style={styles.statusTitle}>System Active</h2>
        <p style={styles.statusSubtitle}>
          Monitoring incoming SMS notifications safely
        </p>
      </main>

      <section style={styles.statsContainer}>
        <div style={styles.card}>
          <span style={styles.cardNumberRed}>{blockedCount}</span>
          <span style={styles.cardLabel}>THREATS BLOCKED</span>
        </div>

        <div style={styles.card}>
          <span style={styles.cardNumberBlue}>0</span>
          <span style={styles.cardLabel}>ALERTS TODAY</span>
        </div>
      </section>

      {/* Scam Warning Overlay */}
      {showAlert && alertData && (
        <div style={styles.modalOverlay}>
          <div style={styles.alertCard}>
            <div style={styles.warningIconBg}>
              <span style={styles.warningIcon}>⚠️</span>
            </div>

            <h2 style={styles.alertTitle}>SCAM WARNING!</h2>
            <p style={styles.alertDescription}>
              Do not transfer money. This message contains suspicious scam
              intents or mule account patterns.
            </p>

            <div style={styles.messagePreviewBox}>
              <span style={styles.previewLabel}>Raw Message Context:</span>
              <p style={styles.previewText}>"{alertData.text}"</p>
            </div>

            <div style={styles.detectedAccountBox}>
              <span style={styles.detectedAccountLabel}>
                Detected Mule Account / Target:
              </span>
              <span style={styles.detectedAccountNumber}>
                {alertData.detected_account}
              </span>
            </div>

            <button style={styles.blockButton} onClick={handleBlock}>
              BLOCK SENDER
            </button>

            <button
              style={styles.detailsButton}
              onClick={() => setShowAlert(false)}
            >
              Dismiss / View Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline CSS styles
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0B132B",
    color: "#FFFFFF",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "24px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  header: {
    width: "100%",
    maxWidth: "480px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  greeting: {
    fontSize: "22px",
    fontWeight: "bold",
    margin: 0,
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#1C2541",
    padding: "6px 12px",
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  statusBadgeText: {
    fontSize: "12px",
    color: "#9CA3AF",
  },
  statusContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: "40px",
    marginBottom: "40px",
  },
  shieldOuter: {
    width: "140px",
    height: "140px",
    borderRadius: "70px",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "20px",
  },
  shieldInner: {
    width: "100px",
    height: "100px",
    borderRadius: "50px",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    border: "2px solid #22C55E",
  },
  shieldIcon: {
    fontSize: "40px",
  },
  statusTitle: {
    color: "#22C55E",
    fontSize: "24px",
    fontWeight: "bold",
    margin: "0 0 8px 0",
  },
  statusSubtitle: {
    color: "#9CA3AF",
    fontSize: "14px",
    margin: 0,
  },
  statsContainer: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: "480px",
    gap: "16px",
  },
  card: {
    flex: 1,
    backgroundColor: "#1C2541",
    borderRadius: "16px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  cardNumberRed: {
    color: "#EF4444",
    fontSize: "32px",
    fontWeight: "bold",
    marginBottom: "4px",
  },
  cardNumberBlue: {
    color: "#3B82F6",
    fontSize: "32px",
    fontWeight: "bold",
    marginBottom: "4px",
  },
  cardLabel: {
    color: "#9CA3AF",
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.5px",
  },

  /* Overlay Modal */
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    zIndex: 1000,
  },
  alertCard: {
    width: "100%",
    maxWidth: "400px",
    backgroundColor: "#161B22",
    borderRadius: "24px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    border: "1.5px solid rgba(239, 68, 68, 0.5)",
    boxShadow: "0 20px 25px -5px rgba(239, 68, 68, 0.2)",
  },
  warningIconBg: {
    width: "60px",
    height: "60px",
    borderRadius: "30px",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "16px",
  },
  warningIcon: {
    fontSize: "28px",
  },
  alertTitle: {
    color: "#FFFFFF",
    fontSize: "22px",
    fontWeight: "900",
    letterSpacing: "1px",
    margin: "0 0 10px 0",
  },
  alertDescription: {
    color: "#D1D5DB",
    textAlign: "center",
    fontSize: "14px",
    lineHeight: "1.4",
    margin: "0 0 16px 0",
  },
  messagePreviewBox: {
    backgroundColor: "#0D1117",
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "12px",
    boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  previewLabel: {
    color: "#6B7280",
    fontSize: "11px",
    display: "block",
    marginBottom: "4px",
  },
  previewText: {
    color: "#F3F4F6",
    fontSize: "13px",
    margin: 0,
    fontStyle: "italic",
  },
  detectedAccountBox: {
    backgroundColor: "#0D1117",
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    textAlign: "center",
    marginBottom: "20px",
    boxSizing: "border-box",
    border: "1px solid rgba(239, 68, 68, 0.3)",
  },
  detectedAccountLabel: {
    color: "#9CA3AF",
    fontSize: "11px",
    display: "block",
    marginBottom: "4px",
  },
  detectedAccountNumber: {
    color: "#EF4444",
    fontSize: "18px",
    fontWeight: "bold",
    letterSpacing: "1px",
  },
  blockButton: {
    backgroundColor: "#EF4444",
    color: "#FFFFFF",
    border: "none",
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    fontWeight: "900",
    fontSize: "15px",
    cursor: "pointer",
    marginBottom: "10px",
  },
  detailsButton: {
    backgroundColor: "transparent",
    color: "#9CA3AF",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
  },
};

export default App;
