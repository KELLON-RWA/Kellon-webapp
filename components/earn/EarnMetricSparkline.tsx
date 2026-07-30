"use client";

import { useId, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 72;
const CHART_PADDING = 4;

type SparklineTone = "primary" | "positive" | "info";

interface EarnMetricSparklineProps {
  points: EarnMetricPoint[];
  label: string;
  tone: SparklineTone;
  formatValue: (value: number) => string;
  className?: string;
}

export interface EarnMetricPoint {
  label: string;
  value: number;
}

const toneStyles: Record<SparklineTone, string> = {
  primary: "text-primary-50 dark:text-primary-80",
  positive: "text-emerald-600 dark:text-emerald-300",
  info: "text-sky-600 dark:text-sky-300",
};

function getChartPoints(points: EarnMetricPoint[]) {
  const fallbackPoint = {
    label: "Current",
    value: points[0]?.value || 0,
  };
  const normalizedPoints =
    points.length > 1 ? points : [points[0] || fallbackPoint, fallbackPoint];
  const values = normalizedPoints.map(({ value }) => value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum;

  return normalizedPoints.map((point, index) => ({
    ...point,
    x: (index / (normalizedPoints.length - 1)) * CHART_WIDTH,
    y:
      range === 0
        ? CHART_HEIGHT / 2
        : CHART_HEIGHT -
          CHART_PADDING -
          ((point.value - minimum) / range) *
            (CHART_HEIGHT - CHART_PADDING * 2),
  }));
}

function getSmoothPath(points: ReturnType<typeof getChartPoints>) {
  const [firstPoint, ...remainingPoints] = points;
  let path = `M ${firstPoint.x} ${firstPoint.y}`;
  let previousPoint = firstPoint;

  remainingPoints.forEach((point) => {
    const midpoint = (previousPoint.x + point.x) / 2;
    path += ` C ${midpoint} ${previousPoint.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
    previousPoint = point;
  });

  return path;
}

export default function EarnMetricSparkline({
  points,
  label,
  tone,
  formatValue,
  className,
}: EarnMetricSparklineProps) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const gradientId = `earn-sparkline-${useId().replaceAll(":", "")}`;
  const chartPoints = getChartPoints(points);
  const linePath = getSmoothPath(chartPoints);
  const areaPath = `${linePath} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;
  const activePoint =
    activePointIndex === null ? null : chartPoints[activePointIndex];
  const activePointOffset = activePoint
    ? (activePoint.x / CHART_WIDTH) * 100
    : 0;

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerOffset = Math.min(
      Math.max(event.clientX - bounds.left, 0),
      bounds.width,
    );
    const pointIndex = Math.round(
      (pointerOffset / bounds.width) * (chartPoints.length - 1),
    );
    setActivePointIndex(pointIndex);
  };

  return (
    <div
      className={cn(
        "relative h-16 w-full touch-pan-y",
        toneStyles[tone],
        className,
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setActivePointIndex(null)}
    >
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="transition-[d] duration-500"
        />
      </svg>

      {activePoint ? (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-current/20"
            style={{ left: `${activePointOffset}%` }}
          />
          <div
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-current shadow-sm dark:border-secondary-50"
            style={{
              left: `${activePointOffset}%`,
              top: `${(activePoint.y / CHART_HEIGHT) * 100}%`,
            }}
          />
          <div
            className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-md border border-white/70 bg-white/90 px-2 py-1 text-[10px] font-semibold text-cryptoNight shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/90 dark:text-white"
            style={{
              left: `${activePointOffset}%`,
              transform:
                activePointOffset < 15
                  ? "translateX(0)"
                  : activePointOffset > 85
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            {formatValue(activePoint.value)}
            <span className="ml-1.5 font-medium text-gray-30 dark:text-gray-40">
              {activePoint.label}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
