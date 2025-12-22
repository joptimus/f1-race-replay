import React, { useRef, useEffect } from "react";

interface Driver {
  code: string;
  x: number;
  y: number;
  speed: number;
  finished: boolean;
  lapTime: number;
}

interface TrackGeometry {
  centerline_x: number[];
  centerline_y: number[];
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
}

interface QualiGhostRaceProps {
  trackGeometry: TrackGeometry | null;
  drivers: Driver[];
  driverColors: Record<string, number[]>;
  selectedDriver: string | null;
  eliminatedDrivers: string[];
  onDriverClick: (code: string) => void;
}

export const QualiGhostRace: React.FC<QualiGhostRaceProps> = ({
  trackGeometry,
  drivers,
  driverColors,
  selectedDriver,
  eliminatedDrivers,
  onDriverClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !trackGeometry) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;

    const xRange = trackGeometry.x_max - trackGeometry.x_min;
    const yRange = trackGeometry.y_max - trackGeometry.y_min;
    const scale = Math.min(
      (width - padding * 2) / xRange,
      (height - padding * 2) / yRange
    );

    const offsetX = (width - xRange * scale) / 2;
    const offsetY = (height - yRange * scale) / 2;

    const toCanvasX = (x: number) =>
      (x - trackGeometry.x_min) * scale + offsetX;
    const toCanvasY = (y: number) =>
      height - ((y - trackGeometry.y_min) * scale + offsetY);

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < trackGeometry.centerline_x.length; i++) {
      const x = toCanvasX(trackGeometry.centerline_x[i]);
      const y = toCanvasY(trackGeometry.centerline_y[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = "#555";
    ctx.lineWidth = 10;
    ctx.stroke();

    const sortedDrivers = [...drivers].sort((a, b) => {
      if (a.code === selectedDriver) return 1;
      if (b.code === selectedDriver) return -1;
      return 0;
    });

    for (const driver of sortedDrivers) {
      const isSelected = driver.code === selectedDriver;
      const isEliminated = eliminatedDrivers.includes(driver.code);
      const color = driverColors[driver.code] || [128, 128, 128];

      let opacity = 0.4;
      let size = 8;

      if (isSelected) {
        opacity = 1;
        size = 12;
      } else if (isEliminated) {
        opacity = 0.15;
        size = 6;
      }

      const x = toCanvasX(driver.x);
      const y = toCanvasY(driver.y);

      ctx.globalAlpha = opacity;
      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(driver.code, x, y - size - 6);
      }
    }

    ctx.globalAlpha = 1;
  }, [trackGeometry, drivers, driverColors, selectedDriver, eliminatedDrivers]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !trackGeometry) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const padding = 40;
    const xRange = trackGeometry.x_max - trackGeometry.x_min;
    const yRange = trackGeometry.y_max - trackGeometry.y_min;
    const scale = Math.min(
      (rect.width - padding * 2) / xRange,
      (rect.height - padding * 2) / yRange
    );
    const offsetX = (rect.width - xRange * scale) / 2;
    const offsetY = (rect.height - yRange * scale) / 2;

    const toCanvasX = (x: number) =>
      (x - trackGeometry.x_min) * scale + offsetX;
    const toCanvasY = (y: number) =>
      rect.height - ((y - trackGeometry.y_min) * scale + offsetY);

    for (const driver of drivers) {
      const dx = toCanvasX(driver.x) - clickX;
      const dy = toCanvasY(driver.y) - clickY;
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        onDriverClick(driver.code);
        return;
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        width: "100%",
        height: "100%",
        cursor: "pointer",
      }}
    />
  );
};
