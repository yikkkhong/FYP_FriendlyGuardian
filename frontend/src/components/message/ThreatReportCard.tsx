import React, { useState, useEffect, useMemo, useRef } from "react";
import type { AttachmentPreview, WebSource } from "../chat/ChatMessageItem";
import useTextToSpeech, { ReportSpeechRate } from "../../hooks/useTextToSpeech";

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

const MEDIA_AUTH_COPY: Partial<typeof RISK_COPY> = {
  HIGH: {
    ...RISK_COPY.HIGH,
    headline: "Possible AI-generated or edited file.",
    guidance: "Treat this document with caution and verify its source.",
  },
  SAFE: {
    ...RISK_COPY.SAFE,
    headline: "No obvious AI generation signals found.",
    guidance: "The file appears clean, though standard verification is still advised.",
  },
};

export function parseReport(rawText: string) {
  const riskMatch = rawText.match(/RISK LEVEL:\s*([A-Z]+)/i);
  if (!riskMatch) return null;

  const risk = riskMatch[1].toUpperCase() as RiskKey;
  const whyMatch = rawText.match(/WHY:\s*([\s\S]*?)(?=RECOMMENDATION:|$)/i);
  // Older saved replies can restart a report after the first action list.
  const recMatch = rawText.match(
    /RECOMMENDATION:([\s\S]*?)(?=\r?\n[ \t*•#>\-]*(?:WHY|RISK LEVEL|RECOMMENDATION|MESSAGE_TYPE)[ \t]*:|$)/i,
  );

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
  sources?: WebSource[];
  forensicImageUrl?: string;
  onPreviewAttachment: (preview: AttachmentPreview, trigger: HTMLButtonElement) => void;
  speechOwner: object;
  report: {
    risk: RiskKey;
    why: string[];
    recommendations: string[];
  };
  isNew?: boolean;
}

export const ThreatReportCard: React.FC<ThreatReportCardProps> = ({
  report,
  speechOwner,
  sources,
  forensicImageUrl,
  onPreviewAttachment,
  isNew = false,
}) => {
  const isMediaAuthCheck = report.why.some(w => /AI (?:image )?generation/i.test(w));
  const riskMeta = (isMediaAuthCheck ? MEDIA_AUTH_COPY[report.risk] : undefined)
    ?? RISK_COPY[report.risk];
  // The same control owns manual playback and this message's automatic guidance.
  const { speak, stop, enabled, speechOwner: activeOwner } = useTextToSpeech();
  const rate = React.useContext(ReportSpeechRate);
  const isSpeaking = activeOwner === speechOwner;
  const hasStreamedRef = useRef(!isNew);

  const segments = useMemo(() => {
    const list: { key: string; text: string }[] = [];
    if (riskMeta) {
      list.push({ key: "headline", text: riskMeta.headline });
      list.push({ key: "guidance", text: riskMeta.guidance });
    }
    report.why.forEach((point, i) => {
      list.push({ key: `why-${i}`, text: point });
    });
    report.recommendations.forEach((point, i) => {
      list.push({ key: `rec-${i}`, text: point });
    });
    return list;
  }, [riskMeta, report]);

  const totalLength = useMemo(() => {
    return segments.reduce((sum, seg) => sum + seg.text.length, 0);
  }, [segments]);

  const [streamedLength, setStreamedLength] = useState(() =>
    isNew ? 0 : totalLength,
  );

  useEffect(() => {
    if (!isNew || hasStreamedRef.current) {
      setStreamedLength(totalLength);
      return;
    }

    let current = 0;
    // Rapid streaming: completes in ~35 ticks (approx 700ms)
    const stepSize = Math.max(3, Math.ceil(totalLength / 35));
    const interval = setInterval(() => {
      current += stepSize;
      if (current >= totalLength) {
        current = totalLength;
        clearInterval(interval);
        hasStreamedRef.current = true;
      }
      setStreamedLength(current);
    }, 20);

    return () => clearInterval(interval);
  }, [isNew, totalLength]);

  if (!riskMeta) {
    return null;
  }

  const getSegment = (key: string) => {
    if (!isNew || hasStreamedRef.current || streamedLength >= totalLength) {
      const seg = segments.find((s) => s.key === key);
      return { text: seg?.text || "", isTyping: false, isVisible: true };
    }

    let accumulated = 0;
    for (const seg of segments) {
      const segStart = accumulated;
      const segEnd = accumulated + seg.text.length;
      accumulated = segEnd;

      if (seg.key === key) {
        if (streamedLength <= segStart) {
          return { text: "", isTyping: false, isVisible: false };
        }
        if (streamedLength >= segEnd) {
          return { text: seg.text, isTyping: false, isVisible: true };
        }
        const visibleChars = streamedLength - segStart;
        return {
          text: seg.text.slice(0, visibleChars),
          isTyping: true,
          isVisible: true,
        };
      }
    }
    return { text: "", isTyping: false, isVisible: false };
  };

  const headlineData = getSegment("headline");
  const guidanceData = getSegment("guidance");

  const hasStartedWhy = report.why.some(
    (_, i) => getSegment(`why-${i}`).isVisible,
  );
  const hasStartedRecs = report.recommendations.some(
    (_, i) => getSegment(`rec-${i}`).isVisible,
  );

  return (
    <article
      className={`threat-report-card risk-${report.risk.toLowerCase()}${isNew ? " is-streaming-card" : ""}`}
      aria-label={`Risk result: ${riskMeta.label}`}
    >
      <div className="report-verdict">
        <button className="manual-icon-btn report-speech-button" type="button"
          aria-label={isSpeaking ? "Stop reading report" : "Read report aloud"}
          title={isSpeaking ? "Stop reading report" : "Read report aloud"}
          disabled={!enabled || typeof window === "undefined" || !window.speechSynthesis}
          onClick={() => {
            if (isSpeaking) return stop();
            const narration = [riskMeta.headline, "Why.", ...report.why,
              "What to do next.", ...report.recommendations].join("\n");
            speak(narration, /[\u4e00-\u9fff]/.test(narration) ? "zh-CN" : "en-US", rate, speechOwner);
          }}>
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
            {isSpeaking ? <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" /> :
              <path d="M3 9h4l5-4v14l-5-4H3z M16 8a6 6 0 0 1 0 8 M19 5a10 10 0 0 1 0 14"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          </svg>
        </button>
        <div className={`risk-level-badge ${report.risk.toLowerCase()}`}>
          <RiskIcon risk={report.risk} />
          <span>{riskMeta.label}</span>
        </div>
        <div className="report-verdict-copy">
          <h3>
            {headlineData.text}
            {headlineData.isTyping && (
              <span className="streaming-cursor" aria-hidden="true">
                ▍
              </span>
            )}
          </h3>
          {(guidanceData.text || guidanceData.isTyping) && (
            <p>
              {guidanceData.text}
              {guidanceData.isTyping && (
                <span className="streaming-cursor" aria-hidden="true">
                  ▍
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {report.why.length > 0 && hasStartedWhy && (
        <div className="report-section">
          <span className="section-label">Why</span>
          <ul className="report-list alert-list">
            {report.why.map((point, i) => {
              const seg = getSegment(`why-${i}`);
              if (!seg.isVisible) return null;
              return (
                <li key={i}>
                  {seg.text}
                  {seg.isTyping && (
                    <span className="streaming-cursor" aria-hidden="true">
                      ▍
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {report.recommendations.length > 0 && hasStartedRecs && (
        <div className="report-section report-section-action">
          <span className="section-label">What to do next</span>
          <ul className="report-list action-list">
            {report.recommendations.map((point, i) => {
              const seg = getSegment(`rec-${i}`);
              if (!seg.isVisible) return null;
              return (
                <li key={i}>
                  {seg.text}
                  {seg.isTyping && (
                    <span className="streaming-cursor" aria-hidden="true">
                      ▍
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {(Boolean(sources?.length) || forensicImageUrl) && (
        <div className="report-evidence">
          {sources && sources.length > 0 && (
            <button type="button" onClick={e => onPreviewAttachment({ name: "Web sources", sources }, e.currentTarget)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" />
              </svg>
              <span>Web Sources</span>
            </button>
          )}
          {forensicImageUrl && (
            <button type="button" onClick={e => onPreviewAttachment({
              name: "Pixel noise map", src: forensicImageUrl, heatmap: true, isPdf: false,
            }, e.currentTarget)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 8V3h5m8 0h5v5m0 8v5h-5m-8 0H3v-5M8 10h8m-8 4h8m-6-6v8m4-8v8" />
              </svg>
              <span>Pixel Noise Map</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default ThreatReportCard;
