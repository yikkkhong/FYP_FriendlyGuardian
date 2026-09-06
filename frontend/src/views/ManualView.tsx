import React, { useState } from "react";

interface ManualMessage {
  sender: "user" | "ai";
  text: string;
  time: string;
}

interface ManualViewProps {
  blockedCount: number;
  messages: ManualMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
}

export const ManualView: React.FC<ManualViewProps> = ({
  blockedCount,
  messages,
  isLoading,
  onSendMessage,
}) => {
  const [queryInput, setQueryInput] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim() || isLoading) return;

    onSendMessage(queryInput);
    setQueryInput("");
  };

  return (
    /* SME mode (Manual mode) */
    <div className="sme-tactile-dashboard">
      <div className="sme-lead-card">
        <div className="card-kicker">SEC-OPS // MONITORING</div>
        <h2>Enterprise Transaction & Mule Anomaly Grid</h2>
        <p>Continuous heuristic analysis of inbound telemetric SMS data.</p>
      </div>

      {/* <div className="metric-tiles-row">
        <div className="metric-tile">
          <span className="tile-sub">TELEMETRY INGESTED</span>
          <span className="tile-num accent-blue">1,248</span>
        </div>
        <div className="metric-tile">
          <span className="tile-sub">THREATS INTERCEPTED</span>
          <span className="tile-num accent-red">{blockedCount}</span>
        </div>
        <div className="metric-tile">
          <span className="tile-sub">MULE ENTITIES FLAGGED</span>
          <span className="tile-num accent-green">8</span>
        </div>
      </div> */}

      {/* Message display area (temporary) */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          margin: "16px 0",
          maxHeight: "380px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "#888", textAlign: "center", margin: "auto" }}>
            Enter a suspicious message or bank detail below to analyze...
          </p>
        )}
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
              background: m.sender === "user" ? "#2563eb" : "#1e293b",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: "8px",
              maxWidth: "80%",
              whiteSpace: "pre-wrap",
            }}
          >
            <div>{m.text}</div>
            <div
              style={{
                fontSize: "10px",
                opacity: 0.6,
                marginTop: "4px",
                textAlign: "right",
              }}
            >
              {m.time}
            </div>
          </div>
        ))}
        {isLoading && (
          <p style={{ color: "#38bdf8", fontSize: "12px" }}>
            Gemini analyzing...
          </p>
        )}
      </div>

      {/*Input field for manual mode*/}
      <form onSubmit={handleSubmit} className="bottom-query-capsule">
        <input
          type="text"
          placeholder="Enter manual query or paste suspicious message..."
          className="query-input"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="query-submit-action"
          disabled={isLoading}
        >
          {isLoading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
};

export default ManualView;
