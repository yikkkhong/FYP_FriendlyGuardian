import React, { useState, useEffect } from "react";

export type EmotionState = "NEUTRAL" | "HAPPY" | "ALERT" | "THINKING";

interface PixelFaceProps {
  emotion: EmotionState;
  isSpeaking?: boolean;
}

const LIGHT_PALETTE: Record<
  EmotionState,
  {
    active: string;
    glow: string;
    recessedDot: string;
    bezelBorder: string;
    chassisTint: string;
  }
> = {
  NEUTRAL: {
    active: "#2563EB",
    glow: "rgba(37, 99, 235, 0.28)",
    recessedDot: "rgba(37, 99, 235, 0.07)",
    bezelBorder: "#DCE3F1",
    chassisTint: "#F4F7FC",
  },
  HAPPY: {
    active: "#059669",
    glow: "rgba(5, 150, 105, 0.26)",
    recessedDot: "rgba(5, 150, 105, 0.08)",
    bezelBorder: "#DCFCE7",
    chassisTint: "#F2FBF6",
  },
  ALERT: {
    active: "#DC2626",
    glow: "rgba(220, 38, 38, 0.32)",
    recessedDot: "rgba(220, 38, 38, 0.08)",
    bezelBorder: "#FEE2E2",
    chassisTint: "#FFF5F5",
  },
  THINKING: {
    active: "#D97706",
    glow: "rgba(217, 119, 6, 0.28)",
    recessedDot: "rgba(217, 119, 6, 0.08)",
    bezelBorder: "#FEF3C7",
    chassisTint: "#FFFDF7",
  },
};

export const PixelFace: React.FC<PixelFaceProps> = ({
  emotion,
  isSpeaking = false,
}) => {
  const [tick, setTick] = useState<number>(0);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => setTick((prev) => (prev + 1) % 60), 130);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (emotion === "ALERT" || emotion === "THINKING") return;
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 170);
    }, 4000);
    return () => clearInterval(blinkInterval);
  }, [emotion]);

  const generateFrame = (): number[][] => {
    const grid: number[][] = Array(16)
      .fill(0)
      .map(() => Array(16).fill(0));

    // eye logic
    if (isBlinking) {
      [3, 4, 5].forEach((c) => (grid[4][c] = 1));
      [10, 11, 12].forEach((c) => (grid[4][c] = 1));
    } else if (emotion === "HAPPY") {
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
      for (let r = 2; r <= 4; r++) {
        for (let c = 3; c <= 5; c++) grid[r][c] = 1;
        for (let c = 10; c <= 12; c++) grid[r][c] = 1;
      }
    }

    // mouth
    if (isSpeaking) {
      const speakFrame = tick % 4;
      if (speakFrame === 0) {
        for (let c = 5; c <= 10; c++) grid[10][c] = 1;
        for (let c = 6; c <= 9; c++) grid[11][c] = 1;
      } else if (speakFrame === 1) {
        grid[9][4] = 1;
        grid[9][11] = 1;
        for (let c = 5; c <= 10; c++) {
          grid[8][c] = 1;
          grid[12][c] = 1;
        }
        grid[10][3] = 1;
        grid[10][12] = 1;
      } else if (speakFrame === 2) {
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
      if (emotion === "HAPPY") {
        grid[9][2] = 1;
        grid[9][13] = 1;
        grid[10][3] = 1;
        grid[10][12] = 1;
        grid[11][4] = 1;
        grid[11][11] = 1;
        for (let c = 5; c <= 10; c++) grid[12][c] = 1;
      } else if (emotion === "ALERT") {
        for (let c = 4; c <= 11; c++) grid[c % 2 === 0 ? 11 : 12][c] = 1;
      } else if (emotion === "THINKING") {
        const wavePos = tick % 8;
        for (let c = 4; c <= 11; c++) {
          grid[c === 4 + wavePos ? 9 : 11][c] = 1;
        }
      } else {
        for (let c = 4; c <= 11; c++) grid[11][c] = 1;
      }
    }

    return grid;
  };

  const matrix = generateFrame();
  const theme = LIGHT_PALETTE[emotion] || LIGHT_PALETTE.NEUTRAL;

  return (
    <div
      className="pixel-chassis"
      style={{
        backgroundColor: theme.chassisTint,
        borderColor: theme.bezelBorder,
        boxShadow: `0 24px 60px -12px rgba(0,0,0,0.06), 0 0 45px ${theme.glow}, inset 0 2px 4px #FFFFFF`,
      }}
    >
      <div className="chassis-hardware-badge">
        <span className="dot-screws"></span>
        <span className="badge-text">GUARDIAN-V2 // EMOTION MATRIX</span>
        <span className="dot-screws"></span>
      </div>

      <div className="matrix-viewport">
        {matrix.flatMap((row, r) =>
          row.map((active, c) => (
            <div
              key={`${r}-${c}`}
              className="pixel-cell"
              style={{
                backgroundColor: active ? theme.active : theme.recessedDot,
                boxShadow: active
                  ? `0 0 10px ${theme.glow}, inset 0 1px 2px rgba(255,255,255,0.4)`
                  : "inset 0 1px 1.5px rgba(0, 0, 0, 0.05)",
                transform: active ? "scale(0.96)" : "scale(0.78)",
              }}
            />
          )),
        )}
      </div>
    </div>
  );
};
