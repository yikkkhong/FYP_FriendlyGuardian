import React, { useState, useRef, useEffect } from "react";

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
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim() || isLoading) return;

    onSendMessage(queryInput);
    setQueryInput("");
  };

  const parseReport = (rawText: string) => {
    const riskMatch = rawText.match(/RISK LEVEL:\s*([A-Z]+)/i);
    if (!riskMatch) return null;

    const risk = riskMatch[1].toUpperCase();
    const whyMatch = rawText.match(/WHY:\s*([\s\S]*?)(?=RECOMMENDATION:|$)/i);
    const recMatch = rawText.match(/RECOMMENDATION:\s*([\s\S]*?)$/i);

    const parseBullets = (str: string | undefined) =>
      str
        ? str
            .split("\n")
            .map((l) => l.replace(/^[-*•]\s*/, "").trim())
            .filter(Boolean)
        : [];

    return {
      risk,
      why: parseBullets(whyMatch?.[1]),
      recommendations: parseBullets(recMatch?.[1]),
    };
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
      <div className="manual-stream-card">
        <div className="manual-stream-viewport">
          {messages.length === 0 && (
            <div className="manual-empty-state">
              <div className="empty-icon-capsule">🛡️</div>
              <p>
                Inspector standing by. Paste a message or bank account below to
                begin.
              </p>
            </div>
          )}

          {messages.map((m, idx) => {
            const isUser = m.sender === "user";
            const report = !isUser ? parseReport(m.text) : null;

            return (
              <div
                key={idx}
                className={`manual-msg-row ${isUser ? "user" : "ai"}`}
              >
                <div className="manual-msg-meta">
                  <span className="meta-label">
                    {isUser ? "OPERATOR QUERY" : "THREAT ANALYSIS"}
                  </span>
                  <span className="meta-time">{m.time}</span>
                </div>

                {isUser ? (
                  <div className="user-query-bubble">{m.text}</div>
                ) : report ? (
                  <div className="threat-report-card">
                    <div className="report-header-row">
                      <span className="report-header-title">
                        SECURITY INTELLIGENCE
                      </span>
                      <span
                        className={`risk-level-badge ${report.risk.toLowerCase()}`}
                      >
                        RISK // {report.risk}
                      </span>
                    </div>

                    {report.why.length > 0 && (
                      <div className="report-section">
                        <span className="section-label">
                          DETECTED ANOMALIES
                        </span>
                        <ul className="report-list alert-list">
                          {report.why.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {report.recommendations.length > 0 && (
                      <div className="report-section">
                        <span className="section-label">
                          RECOMMENDED COUNTERMEASURES
                        </span>
                        <ul className="report-list">
                          {report.recommendations.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="plain-ai-bubble">{m.text}</div>
                )}
              </div>
            );
          })}
          {isLoading && (
            <p style={{ color: "#38bdf8", fontSize: "12px" }}>
              Gemini analyzing...
            </p>
          )}
          <div ref={chatEndRef} />
        </div>
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
