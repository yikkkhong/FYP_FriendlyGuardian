import re
from rapidfuzz import fuzz

# common scam patterns
SCAM_PATTERNS = {
    "OTP / Credential Theft": ["otp", "tac", "verification code", "pin number", "password", "bank account"],
    "High-Return Investment Bait": ["invest now", "profit", "guaranteed return", "earn", "daily return"],
    "Urgency / Threat Tactic": ["urgent", "immediately", "suspended", "blocked", "action required", "24 hours"],
    "Prize / Lottery Lure": ["congrats", "won", "prize", "claim", "reward", "lucky draw"],
    "Money Transfer Request": ["transfer money", "send money", "pay now", "bank in", "processing fee"],
}

# standard recommendation
RECOMMENDATIONS_MAP = {
    "HIGH": [
        "Do not click any links, transfer money, or share OTP/personal details.",
        "Block the sender immediately and report to your bank or authorities."
    ],
    "MEDIUM": [
        "Verify the sender independently through official websites or phone numbers.",
        "Avoid sharing sensitive information or documents until verified."
    ],
    "LOW": [
        "Stay cautious and double-check details if anything feels unusual.",
        "Keep records of the message for your reference."
    ]
}


def extract_scam_clues(text: str) -> dict:
    """
    Non-generative AI auxiliary layer: Uses RapidFuzz for fuzzy matching and regular expressions to extract high-risk features.
    Capable of identifying matches even in the presence of typos or OCR noise (e.g., "Contat," "Clicl," "priize").
    """
    text_lower = text.lower()
    detected_categories = []
    matched_keywords = []
    score = 0

    # analyse
    # 1. link, email
    if re.search(r"https?://\S+|www\.\S+", text_lower):
        detected_categories.append("Contains URL/Link")
        score += 25
    if re.search(r"\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b", text_lower):
        detected_categories.append("Contains Email Address")
        score += 15

    # 2. number like money (RM), percentage (10%)
    if re.search(r"\b(rm\s?\d+|\d+(\.\d+)?\s?%)", text_lower):
        detected_categories.append("Financial/Percentage Figure")
        score += 20

    # 3. RapidFuzz Fuzzy Keyword Detection (Tolerant of Spelling Errors)
    for category, keywords in SCAM_PATTERNS.items():
        for kw in keywords:
            # partial_ratio for typo（like scam -> skam, click -> clicl）, very sensitive
            similarity = fuzz.partial_ratio(kw, text_lower)
            if similarity >= 85:
                if category not in detected_categories:
                    detected_categories.append(category)
                    score += 30
                matched_keywords.append(kw)
                break

    if score >= 50:
        suggested_risk = "HIGH"
    elif score >= 25:
        suggested_risk = "MEDIUM"
    else:
        suggested_risk = "LOW"

    return {
        "categories": detected_categories,
        "keywords": matched_keywords,
        "suggested_risk": suggested_risk,
    }


SYSTEM_PROMPT = (
    "You are an offline anti-scam classifier.\n"
    "Based on the user text and system clues, output ONLY 2 lines:\n"
    "RISK: [HIGH or MEDIUM or LOW]\n"
    "REASON: [One short sentence under 12 words explaining why]\n"
    "Do not output anything else."
)


def analyze_scam_offline(raw_text: str, matched_phone: dict, generate_fn) -> str:
    """Offline Fallback Analysis Combining System Clues and Lightweight Models"""
    # if phone number found from scam database, directly return this
    if matched_phone:
        phone = matched_phone.get("phone", "Unknown")
        scam_type = matched_phone.get("scam_type", "Scam")
        count = matched_phone.get("report_count", 0)
        return (
            "MESSAGE_TYPE: analysis\n"
            "RISK LEVEL: HIGH\n\n"
            "WHY:\n"
            f"- Phone {phone} is in the verified blacklist ({count} reports for {scam_type}).\n"
            "- High risk of financial fraud detected by offline guard.\n\n"
            "RECOMMENDATION:\n"
            "- Block the number immediately and do not transfer any money.\n"
            "- Report this incident to your bank or local authorities."
        )

    # Extract "cheat sheets" using non-generative fuzzy matching
    clues = extract_scam_clues(raw_text)
    clues_str = ", ".join(clues["categories"]) if clues["categories"] else "No obvious scam keywords"

    # give cheat sheet to the lightweight model, fewer than 25 tokens
    user_Input = (
        f"System Clues: {clues_str} (Initial Risk: {clues['suggested_risk']})\n"
        f"Text: {raw_text[:250]}\n"
    )
    ai_raw = generate_fn(SYSTEM_PROMPT, user_Input, max_new_tokens=25)

    # Minimalist output from the parsing model (if the model fails to follow the format, the system’s `suggested_risk` is used as a fallback)
    risk_match = re.search(r"RISK:\s*(HIGH|MEDIUM|LOW)", ai_raw, re.IGNORECASE)
    final_risk = risk_match.group(1).upper() if risk_match else clues["suggested_risk"]

    # If the system’s fuzzy matching indicates a high level of certainty that a threat is high-risk, ensure that a smaller model does not misclassify it as "LOW."
    if clues["suggested_risk"] == "HIGH" and final_risk == "LOW":
        final_risk = "HIGH"

    reason_match = re.search(r"REASON:\s*(.+)", ai_raw, re.IGNORECASE)
    ai_reason = reason_match.group(1).strip() if reason_match else "Suspicious patterns detected in message."

    # assembles the data into the specific format required by the ThreatReportCard frontend
    why_bullets = []
    if clues["categories"]:
        why_bullets.append(f"- Detected risk signals: {', '.join(clues['categories'][:2])}.")
    why_bullets.append(f"- {ai_reason}")

    recs = RECOMMENDATIONS_MAP.get(final_risk, RECOMMENDATIONS_MAP["MEDIUM"])
    rec_bullets = [f"- {r}" for r in recs]

    return (
        "MESSAGE_TYPE: analysis\n"
        f"RISK LEVEL: {final_risk}\n\n"
        "WHY:\n"
        + "\n".join(why_bullets)
        + "\n\nRECOMMENDATION:\n"
        + "\n".join(rec_bullets)
    )