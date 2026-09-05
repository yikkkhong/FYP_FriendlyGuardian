import React from "react";

interface ManualViewProps {
  blockedCount: number;
}

export const ManualView: React.FC<ManualViewProps> = ({ blockedCount }) => {
  return (
    /* SME mode (Manual mode) */
    <div className="sme-tactile-dashboard">
      <div className="sme-lead-card">
        <div className="card-kicker">SEC-OPS // MONITORING</div>
        <h2>Enterprise Transaction & Mule Anomaly Grid</h2>
        <p>Continuous heuristic analysis of inbound telemetric SMS data.</p>
      </div>

      <div className="metric-tiles-row">
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
      </div>

      {/*Input field for manual mode*/}
      <form
        onSubmit={(e) => e.preventDefault()}
        className="bottom-query-capsule"
      >
        <input
          type="text"
          placeholder="Enter manual query or upload image..."
          className="query-input"
        />
        <button type="button" className="query-submit-action">
          Send
        </button>
      </form>
    </div>
  );
};

export default ManualView;
