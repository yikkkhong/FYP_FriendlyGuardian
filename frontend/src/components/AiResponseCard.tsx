import React from "react";

interface AiResponseCardProps {
  content: string;
}

export const AiResponseCard: React.FC<AiResponseCardProps> = ({ content }) => {
  // Split paragraphs by double line breaks
  const rawParagraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (rawParagraphs.length === 0) return null;

  // 1. Extract the main heading and introduction: Use the first sentence of the first paragraph as the card's main headline.
  const firstPara = rawParagraphs[0];
  let headline = "";
  let intro = "";

  const sentenceSplit = firstPara.match(/^(.*?[.?!。？！])\s*([\s\S]*)$/);
  if (sentenceSplit) {
    headline = sentenceSplit[1].replace(/[*#_`]/g, "").trim();
    intro = sentenceSplit[2].replace(/[*#_`]/g, "").trim();
  } else {
    headline = firstPara.replace(/[*#_`]/g, "").trim();
  }

  // 2. Extract the remaining paragraphs as body content, and identify if the last paragraph is a takeaway (summary/advice) based on its format.
  const remaining = rawParagraphs.slice(1);
  let takeaway = "";
  let bodyParagraphs = remaining;

  // If the last paragraph is a summary or advice (starting with Always, Remember, Suggestions, etc., or not having a numbered list format), extract it as the bottom takeaway
  if (remaining.length > 0) {
    const last = remaining[remaining.length - 1];
    if (!/^\d+\.\s|^\s*[-*]\s/.test(last)) {
      takeaway = last.replace(/[*#_`]/g, "").trim();
      bodyParagraphs = remaining.slice(0, remaining.length - 1);
    }
  }

  // Parse list items inside the paragraphs
  const parsePoint = (line: string) => {
    const clean = line.replace(/^\d+\.\s*|^[-*]\s*/, "");
    const match = clean.match(/^\*\*(.*?)\*\*[:：]?\s*([\s\S]*)$/);
    if (match) {
      return { title: match[1], desc: match[2] };
    }
    return { title: "", desc: clean };
  };

  return (
    <article className="ai-insight-card">
      {/* card header: icon + title */}
      <div className="insight-card-header">
        <div className="insight-badge">
          <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
            <path
              fill="currentColor"
              d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
            />
          </svg>
          <span>ADVISORY & EXPLANATION</span>
        </div>
        <h3 className="insight-headline">{headline}</h3>
        {intro && <p className="insight-intro">{intro}</p>}
      </div>

      {/* card content: block layout */}
      {bodyParagraphs.length > 0 && (
        <div className="insight-content-section">
          <span className="insight-section-title">KEY FACTORS / DETAILS</span>
          <div className="insight-point-grid">
            {bodyParagraphs.map((para, pIdx) => {
              const lines = para.split("\n").filter(Boolean);
              return lines.map((line, lIdx) => {
                const { title, desc } = parsePoint(line);
                return (
                  <div key={`${pIdx}-${lIdx}`} className="insight-point-item">
                    <div className="point-indicator" />
                    <div className="point-body">
                      {title && <h4 className="point-title">{title}</h4>}
                      <p className="point-desc">{desc}</p>
                    </div>
                  </div>
                );
              });
            })}
          </div>
        </div>
      )}

      {/* card bottom: key takeaway and action items */}
      {takeaway && (
        <div className="insight-takeaway-box">
          <span className="takeaway-label">SAFETY TAKEAWAY</span>
          <p className="takeaway-text">{takeaway}</p>
        </div>
      )}
    </article>
  );
};

export default AiResponseCard;
