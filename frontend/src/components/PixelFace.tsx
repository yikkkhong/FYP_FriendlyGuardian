import React, { useState, useEffect } from "react";

export type EmotionState = "NEUTRAL" | "HAPPY" | "ALERT" | "THINKING";

interface PixelFaceProps {
  emotion: EmotionState;
  isSpeaking?: boolean;
}

const COLOR_THEMES: Record<
  EmotionState,
  { active: string; glow: string; bg: string }
> = {
  NEUTRAL: {
    active: "#60A5FA",
    glow: "rgba(96, 165, 250, 0.45)",
    bg: "#091326",
  },
  HAPPY: { active: "#4ADE80", glow: "rgba(74, 222, 128, 0.55)", bg: "#042211" },
  ALERT: { active: "#F87171", glow: "rgba(248, 113, 113, 0.7)", bg: "#380707" },
  THINKING: {
    active: "#FBBF24",
    glow: "rgba(251, 191, 36, 0.55)",
    bg: "#1E1738",
  },
};

export const PixelFace: React.FC<PixelFaceProps> = ({
  emotion,
  isSpeaking = false,
}) => {
  const [tick, setTick] = useState<number>(0);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);

  // refreshes one frame every 140ms
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => (prev + 1) % 60);
    }, 140);
    return () => clearInterval(timer);
  }, []);

  // blink naturally every 3.5–5 seconds (alert and thinking no blink)
  useEffect(() => {
    if (emotion === "ALERT" || emotion === "THINKING") return;

    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 160);
    }, 3800);

    return () => clearInterval(blinkInterval);
  }, [emotion]);

  // 16x16 matrix frames
  const generateFrame = (): number[][] => {
    const grid: number[][] = Array(16)
      .fill(0)
      .map(() => Array(16).fill(0));

    // Eye generation logic
    if (isBlinking) {
      // if blinking, horizontal lines show as closed eyes
      [3, 4, 5].forEach((c) => {
        grid[4][c] = 1;
      });
      [10, 11, 12].forEach((c) => {
        grid[4][c] = 1;
      });
    } else if (emotion === "HAPPY") {
      // happpy ^ ^
      grid[2][3] = 1;
      grid[2][4] = 1;
      grid[2][11] = 1;
      grid[2][12] = 1;
      grid[3][2] = 1;
      grid[3][5] = 1;
      grid[3][10] = 1;
      grid[3][13] = 1;
      grid[4][2] = 1;
      grid[4][5] = 1;
      grid[4][10] = 1;
      grid[4][13] = 1;
    } else if (emotion === "ALERT") {
      const shift = tick % 2;
      for (let r = 2; r <= 5; r++) {
        for (let c = 2; c <= 5; c++) grid[r][c] = 1;
        for (let c = 10; c <= 13; c++) grid[r][c] = 1;
      }
      grid[3 + shift][3] = 0;
      grid[3 + shift][4] = 0;
      grid[3 + shift][11] = 0;
      grid[3 + shift][12] = 0;
    } else if (emotion === "THINKING") {
      const scanCol = tick % 4;
      grid[3][3 + (scanCol > 2 ? 1 : 0)] = 1;
      grid[3][4 + (scanCol > 2 ? 1 : 0)] = 1;
      grid[3][11 + (scanCol > 2 ? 1 : 0)] = 1;
      grid[3][12 + (scanCol > 2 ? 1 : 0)] = 1;
    } else {
      // neutral
      for (let r = 2; r <= 4; r++) {
        for (let c = 3; c <= 5; c++) grid[r][c] = 1;
        for (let c = 10; c <= 12; c++) grid[r][c] = 1;
      }
    }

    // mouth generation logic
    if (isSpeaking) {
      // speaking, 4-frame loop
      const speakFrame = tick % 4;

      if (speakFrame === 0) {
        // small open mouth
        for (let c = 5; c <= 10; c++) grid[10][c] = 1;
        for (let c = 6; c <= 9; c++) grid[11][c] = 1;
      } else if (speakFrame === 1) {
        // wide open mouth
        grid[9][4] = 1;
        grid[9][11] = 1;
        for (let c = 5; c <= 10; c++) {
          grid[8][c] = 1;
          grid[12][c] = 1;
        }
        grid[10][3] = 1;
        grid[10][12] = 1;
      } else if (speakFrame === 2) {
        // zig-zag mouth
        grid[10][3] = 1;
        grid[9][5] = 1;
        grid[11][7] = 1;
        grid[9][9] = 1;
        grid[10][11] = 1;
        grid[10][12] = 1;
        grid[10][4] = 1;
        grid[9][6] = 1;
        grid[11][8] = 1;
        grid[9][10] = 1;
      } else {
        for (let c = 4; c <= 11; c++) grid[10][c] = 1;
      }
    } else {
      // emotion-based mouth
      if (emotion === "HAPPY") {
        grid[9][2] = 1;
        grid[9][13] = 1;
        grid[10][3] = 1;
        grid[10][12] = 1;
        grid[11][4] = 1;
        grid[11][11] = 1;
        for (let c = 5; c <= 10; c++) grid[12][c] = 1;
      } else if (emotion === "ALERT") {
        for (let c = 4; c <= 11; c++) {
          grid[c % 2 === 0 ? 11 : 12][c] = 1;
        }
      } else if (emotion === "THINKING") {
        const wavePos = tick % 8;
        for (let c = 4; c <= 11; c++) {
          grid[c === 4 + wavePos ? 9 : 11][c] = 1;
        }
      } else {
        // neutral
        for (let c = 4; c <= 11; c++) grid[11][c] = 1;
      }
    }

    return grid;
  };

  const matrix = generateFrame();
  const theme = COLOR_THEMES[emotion] || COLOR_THEMES.NEUTRAL;

  return (
    <div
      style={{
        width: "320px",
        height: "320px",
        backgroundColor: theme.bg,
        borderRadius: "36px",
        padding: "24px",
        display: "grid",
        gridTemplateColumns: "repeat(16, 1fr)",
        gridTemplateRows: "repeat(16, 1fr)",
        gap: "4px",
        boxShadow: `0 0 50px ${theme.glow}`,
        border: `3px solid ${theme.active}`,
        transition:
          "border-color 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease",
        boxSizing: "border-box",
      }}
    >
      {matrix.flatMap((row, rowIndex) =>
        row.map((pixel, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            style={{
              backgroundColor: pixel === 1 ? theme.active : "transparent",
              borderRadius: "2px",
              boxShadow: pixel === 1 ? `0 0 8px ${theme.active}` : "none",
              transition: "background-color 0.08s ease",
            }}
          />
        )),
      )}
    </div>
  );
};
