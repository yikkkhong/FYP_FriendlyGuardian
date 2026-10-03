import React from "react";

export type RiskKey = "HIGH" | "MEDIUM" | "LOW" | "SAFE";

const RISK_COPY: Record<
  RiskKey,
  { label: string; headline: string; guidance: string }
> = {
  HIGH: {
    label: "Dangerous",
    headline: "This looks like a scam — do not proceed.",
    guidance: "Stop and protect your accounts before doing anything else.",
  },
  MEDIUM: {
    label: "Suspicious",
    headline: "This needs extra caution.",
    guidance: "Verify through an official channel before you reply or pay.",
  },
  LOW: {
    label: "Low risk",
    headline: "Likely low risk, but stay careful.",
    guidance: "Double-check details if anything still feels off.",
  },
  SAFE: {
    label: "Looks safe",
    headline: "No strong scam signals found.",
    guidance: "You can proceed, but keep normal security habits.",
  },
};

export function parseReport(rawText: string) {
  const riskMatch = rawText.match(/RISK LEVEL:\s*([A-Z]+)/i);
  if (!riskMatch) return null;

  const risk = riskMatch[1].toUpperCase() as RiskKey;
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
}

function RiskIcon({ risk }: { risk: RiskKey }) {
  if (risk === "HIGH") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="manual-risk-icon">
        <path
          fill="currentColor"
          d="M12 2L1 21h22L12 2zm0 4.5L19.5 19h-15L12 6.5zM11 10v5h2v-5h-2zm0 6v2h2v-2h-2z"
        />
      </svg>
    );
  }
  if (risk === "MEDIUM") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="manual-risk-icon">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="manual-risk-icon">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.4l-3.7-3.7 1.4-1.4 2.3 2.3 5-5 1.4 1.4-6.4 6.4z"
      />
    </svg>
  );
}

interface ThreatReportCardProps {
  report: {
    risk: RiskKey;
    why: string[];
    recommendations: string[];
  };
}

export const ThreatReportCard: React.FC<ThreatReportCardProps> = ({
  report,
}) => {
  const riskMeta = RISK_COPY[report.risk];
  if (!riskMeta) {
    return null;
  }

  return (
    <article
      className={`threat-report-card risk-${report!.risk.toLowerCase()}`}
      aria-label={`Risk result: ${riskMeta.label}`}
    >
      <div className="report-verdict">
        <div className={`risk-level-badge ${report!.risk.toLowerCase()}`}>
          <RiskIcon risk={report!.risk} />
          <span>{riskMeta.label}</span>
        </div>
        <div className="report-verdict-copy">
          <h3>{riskMeta.headline}</h3>
          <p>{riskMeta.guidance}</p>
        </div>
      </div>

      {report!.why.length > 0 && (
        <div className="report-section">
          <span className="section-label">Why</span>
          <ul className="report-list alert-list">
            {report!.why.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {report!.recommendations.length > 0 && (
        <div className="report-section report-section-action">
          <span className="section-label">What to do next</span>
          <ul className="report-list action-list">
            {report!.recommendations.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
};

export default ThreatReportCard;
