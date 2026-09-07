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
  onUploadImage: (file: File) => void;
}

export const ManualView: React.FC<ManualViewProps> = ({
  blockedCount,
  messages,
  isLoading,
  onSendMessage,
  onUploadImage,
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

  // new image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLoading) return;

    onUploadImage(file);

    // reset input，next time can choose same file
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // old image upload
  // const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file || isLoading) return;

  //   const formData = new FormData();
  //   formData.append("image", file);

  //   // 1. let user know image uploaded
  //   onSendMessage(`[Uploaded Image: ${file.name}] Analyzing OCR...`);

  //   try {
  //     // 2. request backend endpoint
  //     const res = await fetch("http://localhost:5000/api/manual-scan-image", {
  //       method: "POST",
  //       body: formData,
  //     });
  //     const data = await res.json();

  //     // 3. display raw text via ocr
  //     if (data.analysis) {
  //       // trigger interface receives the AI response
  //       window.dispatchEvent(
  //         new CustomEvent("manual_image_analyzed", { detail: data }),
  //       );
  //     }
  //   } catch (err) {
  //     console.error("Image upload failed:", err);
  //   } finally {
  //     // Reset the input, so can select same image again
  //     if (fileInputRef.current) fileInputRef.current.value = "";
  //   }
  // };

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
        {/* input image */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="image/*"
          onChange={handleImageUpload}
        />
        <button
          type="button"
          className="query-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Upload suspicious screenshot"
        >
          📷
        </button>

        {/* input text */}
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
