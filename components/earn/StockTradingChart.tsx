"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { Candle } from "@/services/api/stock-research";

let lcPromise: Promise<typeof import("lightweight-charts")> | null = null;
function getLightweightCharts() {
  if (!lcPromise) {
    lcPromise = import("lightweight-charts");
  }
  return lcPromise;
}

if (typeof window !== "undefined") {
  getLightweightCharts();
}

export type ChartType = "candlestick" | "line";
export type IndicatorType = "MA" | "EMA" | "BOLL" | "SAR" | "VOL" | "MACD" | "RSI" | "KDJ";

export type HoveredData = {
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ema5?: number;
  ema10?: number;
  ema20?: number;
  bollUpper?: number;
  bollMid?: number;
  bollLower?: number;
  sar?: number;
  volMa5?: number;
  volMa10?: number;
  macd?: { macd: number; signal: number; hist: number };
  rsi?: number;
  kdj?: { k: number; d: number; j: number };
};

export type LiveTick = {
  price: number;
  volume?: number;
  timestamp?: number;
};

interface StockTradingChartProps {
  candles: Candle[];
  chartType: ChartType;
  indicators: Set<IndicatorType>;
  avgBuyPrice?: number;
  avgSellPrice?: number;
  onHoverDataChange?: (data: HoveredData | null) => void;
  className?: string;
  liveTick?: LiveTick | null;
}

function calculateSMA(candles: Candle[], period: number) {
  const result: Array<{ time: number; value: number }> = [];
  if (candles.length < period) return result;

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    result.push({
      time: candles[i].time,
      value: Number((sum / period).toFixed(2)),
    });
  }
  return result;
}

function calculateEMA(candles: Candle[], period: number) {
  const result: Array<{ time: number; value: number }> = [];
  if (candles.length < period) return result;

  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let prevEma = sum / period;
  result.push({ time: candles[period - 1].time, value: Number(prevEma.toFixed(2)) });

  for (let i = period; i < candles.length; i++) {
    const current = candles[i].close;
    const ema = current * k + prevEma * (1 - k);
    result.push({ time: candles[i].time, value: Number(ema.toFixed(2)) });
    prevEma = ema;
  }
  return result;
}

function calculateVolumeSMA(candles: Candle[], period: number) {
  const result: Array<{ time: number; value: number }> = [];
  if (candles.length < period) return result;

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].volume;
    }
    result.push({
      time: candles[i].time,
      value: Math.round(sum / period),
    });
  }
  return result;
}

function calculateBollingerBands(candles: Candle[], period = 20, multiplier = 2) {
  const upper: Array<{ time: number; value: number }> = [];
  const middle: Array<{ time: number; value: number }> = [];
  const lower: Array<{ time: number; value: number }> = [];

  if (candles.length < 2) return { upper, middle, lower };

  for (let i = 0; i < candles.length; i++) {
    const windowSize = Math.min(i + 1, period);
    if (windowSize < 2) continue;

    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += candles[i - j].close;
    }
    const sma = sum / windowSize;

    let varianceSum = 0;
    for (let j = 0; j < windowSize; j++) {
      varianceSum += Math.pow(candles[i - j].close - sma, 2);
    }
    const stdDev = Math.sqrt(varianceSum / windowSize);

    const t = candles[i].time;
    upper.push({ time: t, value: Number((sma + multiplier * stdDev).toFixed(2)) });
    middle.push({ time: t, value: Number(sma.toFixed(2)) });
    lower.push({ time: t, value: Number((sma - multiplier * stdDev).toFixed(2)) });
  }

  return { upper, middle, lower };
}

function calculateSAR(candles: Candle[], step = 0.02, max = 0.2) {
  const result: Array<{ time: number; value: number; isUp: boolean }> = [];
  if (candles.length < 2) return result;

  let isUpTrend = candles[1].close >= candles[0].close;
  let af = step;
  let ep = isUpTrend ? candles[0].high : candles[0].low;
  let sar = isUpTrend ? candles[0].low : candles[0].high;

  for (let i = 1; i < candles.length; i++) {
    const prevCandle = candles[i - 1];
    const currCandle = candles[i];

    if (isUpTrend) {
      sar = sar + af * (ep - sar);
      if (prevCandle && i >= 2) {
        sar = Math.min(sar, candles[i - 1].low, candles[i - 2].low);
      } else if (prevCandle) {
        sar = Math.min(sar, prevCandle.low);
      }

      if (currCandle.low < sar) {
        isUpTrend = false;
        sar = ep;
        ep = currCandle.low;
        af = step;
      } else {
        if (currCandle.high > ep) {
          ep = currCandle.high;
          af = Math.min(af + step, max);
        }
      }
    } else {
      sar = sar + af * (ep - sar);
      if (prevCandle && i >= 2) {
        sar = Math.max(sar, candles[i - 1].high, candles[i - 2].high);
      } else if (prevCandle) {
        sar = Math.max(sar, prevCandle.high);
      }

      if (currCandle.high > sar) {
        isUpTrend = true;
        sar = ep;
        ep = currCandle.high;
        af = step;
      } else {
        if (currCandle.low < ep) {
          ep = currCandle.low;
          af = Math.min(af + step, max);
        }
      }
    }

    result.push({
      time: currCandle.time,
      value: Number(sar.toFixed(2)),
      isUp: isUpTrend,
    });
  }

  return result;
}

function calculateMACD(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
) {
  const result: Array<{
    time: number;
    macd: number;
    signal: number;
    hist: number;
  }> = [];

  if (candles.length < slow) return result;

  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);
  const kSignal = 2 / (signalPeriod + 1);

  let emaFast = candles[0].close;
  let emaSlow = candles[0].close;

  const macdValues: Array<{ time: number; macd: number }> = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i].close;
    if (i === 0) {
      emaFast = c;
      emaSlow = c;
    } else {
      emaFast = c * kFast + emaFast * (1 - kFast);
      emaSlow = c * kSlow + emaSlow * (1 - kSlow);
    }

    if (i >= slow - 1) {
      macdValues.push({
        time: candles[i].time,
        macd: emaFast - emaSlow,
      });
    }
  }

  if (macdValues.length < signalPeriod) return result;

  let emaSignal = macdValues[0].macd;
  for (let i = 0; i < macdValues.length; i++) {
    const macd = macdValues[i].macd;
    if (i === 0) {
      emaSignal = macd;
    } else {
      emaSignal = macd * kSignal + emaSignal * (1 - kSignal);
    }

    if (i >= signalPeriod - 1) {
      const hist = (macd - emaSignal) * 2;
      result.push({
        time: macdValues[i].time,
        macd: Number(macd.toFixed(3)),
        signal: Number(emaSignal.toFixed(3)),
        hist: Number(hist.toFixed(3)),
      });
    }
  }

  return result;
}

function calculateRSI(candles: Candle[], period = 14) {
  const result: Array<{ time: number; value: number }> = [];
  if (candles.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  result.push({
    time: candles[period].time,
    value: Number(rsi.toFixed(2)),
  });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const currentRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const currentRsi = 100 - 100 / (1 + currentRs);

    result.push({
      time: candles[i].time,
      value: Number(currentRsi.toFixed(2)),
    });
  }

  return result;
}

function calculateKDJ(candles: Candle[], n = 9, m1 = 3, m2 = 3) {
  const result: Array<{
    time: number;
    k: number;
    d: number;
    j: number;
  }> = [];

  if (candles.length < n) return result;

  let prevK = 50;
  let prevD = 50;

  for (let i = n - 1; i < candles.length; i++) {
    let lowN = Infinity;
    let highN = -Infinity;

    for (let j = 0; j < n; j++) {
      const c = candles[i - j];
      if (c.low < lowN) lowN = c.low;
      if (c.high > highN) highN = c.high;
    }

    const currentClose = candles[i].close;
    const rsv =
      highN === lowN ? 50 : ((currentClose - lowN) / (highN - lowN)) * 100;

    const k = (1 / m1) * rsv + ((m1 - 1) / m1) * prevK;
    const d = (1 / m2) * k + ((m2 - 1) / m2) * prevD;
    const j = 3 * k - 2 * d;

    prevK = k;
    prevD = d;

    result.push({
      time: candles[i].time,
      k: Number(k.toFixed(2)),
      d: Number(d.toFixed(2)),
      j: Number(j.toFixed(2)),
    });
  }

  return result;
}

function formatCandleDateTime(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function StockTradingChart({
  candles,
  chartType,
  indicators,
  avgBuyPrice,
  avgSellPrice,
  onHoverDataChange,
  className = "",
  liveTick = null,
}: StockTradingChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const priceSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const localCandlesRef = useRef<Candle[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);

  // Maintain refs to avoid stale closures in listeners
  const onHoverDataChangeRef = useRef(onHoverDataChange);
  onHoverDataChangeRef.current = onHoverDataChange;

  const isHoveringRef = useRef(false);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  // Sync incoming candles prop into localCandlesRef
  useEffect(() => {
    localCandlesRef.current = candles.map((c) => ({ ...c }));
  }, [candles]);

  // Pre-calculate technical indicator series data
  const ma5Data = useMemo(() => calculateSMA(candles, 5), [candles]);
  const ma10Data = useMemo(() => calculateSMA(candles, 10), [candles]);
  const ma20Data = useMemo(() => calculateSMA(candles, 20), [candles]);

  const ema5Data = useMemo(() => calculateEMA(candles, 5), [candles]);
  const ema10Data = useMemo(() => calculateEMA(candles, 10), [candles]);
  const ema20Data = useMemo(() => calculateEMA(candles, 20), [candles]);

  const bollData = useMemo(() => calculateBollingerBands(candles, 20, 2), [candles]);
  const sarData = useMemo(() => calculateSAR(candles), [candles]);

  const volMa5Data = useMemo(() => calculateVolumeSMA(candles, 5), [candles]);
  const volMa10Data = useMemo(() => calculateVolumeSMA(candles, 10), [candles]);

  const macdData = useMemo(() => calculateMACD(candles), [candles]);
  const rsiData = useMemo(() => calculateRSI(candles), [candles]);
  const kdjData = useMemo(() => calculateKDJ(candles), [candles]);

  const ma5DataRef = useRef(ma5Data);
  ma5DataRef.current = ma5Data;
  const ma10DataRef = useRef(ma10Data);
  ma10DataRef.current = ma10Data;
  const ma20DataRef = useRef(ma20Data);
  ma20DataRef.current = ma20Data;

  const ema5DataRef = useRef(ema5Data);
  ema5DataRef.current = ema5Data;
  const ema10DataRef = useRef(ema10Data);
  ema10DataRef.current = ema10Data;
  const ema20DataRef = useRef(ema20Data);
  ema20DataRef.current = ema20Data;

  const bollDataRef = useRef(bollData);
  bollDataRef.current = bollData;
  const sarDataRef = useRef(sarData);
  sarDataRef.current = sarData;

  const volMa5DataRef = useRef(volMa5Data);
  volMa5DataRef.current = volMa5Data;
  const volMa10DataRef = useRef(volMa10Data);
  volMa10DataRef.current = volMa10Data;

  const macdDataRef = useRef(macdData);
  macdDataRef.current = macdData;
  const rsiDataRef = useRef(rsiData);
  rsiDataRef.current = rsiData;
  const kdjDataRef = useRef(kdjData);
  kdjDataRef.current = kdjData;

  // Latest candle data for default readout
  const latestData = useMemo<HoveredData | null>(() => {
    if (candles.length === 0) return null;
    const last = candles[candles.length - 1];
    return {
      timeStr: formatCandleDateTime(last.time),
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      volume: last.volume,
      ma5: ma5Data[ma5Data.length - 1]?.value,
      ma10: ma10Data[ma10Data.length - 1]?.value,
      ma20: ma20Data[ma20Data.length - 1]?.value,
      ema5: ema5Data[ema5Data.length - 1]?.value,
      ema10: ema10Data[ema10Data.length - 1]?.value,
      ema20: ema20Data[ema20Data.length - 1]?.value,
      bollUpper: bollData.upper[bollData.upper.length - 1]?.value,
      bollMid: bollData.middle[bollData.middle.length - 1]?.value,
      bollLower: bollData.lower[bollData.lower.length - 1]?.value,
      sar: sarData[sarData.length - 1]?.value,
      volMa5: volMa5Data[volMa5Data.length - 1]?.value,
      volMa10: volMa10Data[volMa10Data.length - 1]?.value,
      macd: macdData[macdData.length - 1],
      rsi: rsiData[rsiData.length - 1]?.value,
      kdj: kdjData[kdjData.length - 1],
    };
  }, [
    candles,
    ma5Data,
    ma10Data,
    ma20Data,
    ema5Data,
    ema10Data,
    ema20Data,
    bollData,
    sarData,
    volMa5Data,
    volMa10Data,
    macdData,
    rsiData,
    kdjData,
  ]);

  const latestDataRef = useRef(latestData);
  latestDataRef.current = latestData;

  // Stable reset callback
  const resetToLatest = useCallback(() => {
    isHoveringRef.current = false;
    if (latestDataRef.current && onHoverDataChangeRef.current) {
      onHoverDataChangeRef.current(latestDataRef.current);
    }
  }, []);

  // Update default readout on latest data change if not actively hovering
  useEffect(() => {
    if (!isHoveringRef.current && latestDataRef.current && onHoverDataChangeRef.current) {
      onHoverDataChangeRef.current(latestDataRef.current);
    }
  }, [latestData]);

  // Window scroll listener: when page scrolls (cursor leaves chart area), reset hover readout
  useEffect(() => {
    const handleScroll = () => {
      if (isHoveringRef.current) {
        resetToLatest();
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [resetToLatest]);

  useEffect(() => {
    let isCancelled = false;

    async function initChart() {
      if (!chartContainerRef.current) return;

      const lc = await getLightweightCharts();
      if (isCancelled || !chartContainerRef.current) return;

      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }

      const container = chartContainerRef.current;
      const width =
        container.clientWidth ||
        (typeof window !== "undefined"
          ? Math.min(window.innerWidth - 32, 600)
          : 320);
      const height = container.clientHeight || 340;

      const hasSubPane =
        indicators.has("VOL") ||
        indicators.has("MACD") ||
        indicators.has("RSI") ||
        indicators.has("KDJ");

      const chart = lc.createChart(container, {
        width,
        height,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: isDark ? "#94a3b8" : "#475569",
          fontSize: 11,
          fontFamily: "inherit",
        },
        grid: {
          vertLines: { color: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.06)" },
          horzLines: { color: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.06)" },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: {
            color: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.25)",
            width: 1,
            style: lc.LineStyle.Dashed,
            labelBackgroundColor: isDark ? "#1e293b" : "#cbd5e1",
          },
          horzLine: {
            color: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.25)",
            width: 1,
            style: lc.LineStyle.Dashed,
            labelBackgroundColor: isDark ? "#1e293b" : "#cbd5e1",
          },
        },
        rightPriceScale: {
          borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
          scaleMargins: {
            top: 0.08,
            bottom: hasSubPane ? 0.28 : 0.08,
          },
          textColor: isDark ? "#94a3b8" : "#64748b",
        },
        timeScale: {
          borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 6,
          barSpacing: 8,
          minBarSpacing: 2,
          fixLeftEdge: false,
          fixRightEdge: false,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
      });

      chartInstanceRef.current = chart;

      // 1. Main Price Series (Candlestick or Area Line)
      let priceSeries: any;

      if (chartType === "candlestick") {
        priceSeries = chart.addSeries(lc.CandlestickSeries, {
          upColor: "#10b981",
          downColor: "#ef4444",
          borderVisible: false,
          wickUpColor: "#10b981",
          wickDownColor: "#ef4444",
        });

        const formattedCandles = candles.map((c) => ({
          time: c.time as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        priceSeries.setData(formattedCandles);
      } else {
        priceSeries = chart.addSeries(lc.AreaSeries, {
          lineColor: "#10b981",
          topColor: "rgba(16, 185, 129, 0.35)",
          bottomColor: "rgba(16, 185, 129, 0.01)",
          lineWidth: 2,
          priceLineVisible: false,
        });

        const lineData = candles.map((c) => ({
          time: c.time as any,
          value: c.close,
        }));
        priceSeries.setData(lineData);
      }
      priceSeriesRef.current = priceSeries;

      // 2. Overlaid Indicators (MA / EMA / BOLL / SAR)
      if (indicators.has("MA")) {
        const ma5Series = chart.addSeries(lc.LineSeries, {
          color: "#f59e0b",
          lineWidth: 2,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        ma5Series.setData(ma5Data.map((d) => ({ time: d.time as any, value: d.value })));

        const ma10Series = chart.addSeries(lc.LineSeries, {
          color: "#a855f7",
          lineWidth: 2,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        ma10Series.setData(ma10Data.map((d) => ({ time: d.time as any, value: d.value })));

        const ma20Series = chart.addSeries(lc.LineSeries, {
          color: "#06b6d4",
          lineWidth: 2,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        ma20Series.setData(ma20Data.map((d) => ({ time: d.time as any, value: d.value })));
      } else if (indicators.has("EMA")) {
        const ema5Series = chart.addSeries(lc.LineSeries, {
          color: "#f59e0b",
          lineWidth: 2,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        ema5Series.setData(ema5Data.map((d) => ({ time: d.time as any, value: d.value })));

        const ema10Series = chart.addSeries(lc.LineSeries, {
          color: "#a855f7",
          lineWidth: 2,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        ema10Series.setData(ema10Data.map((d) => ({ time: d.time as any, value: d.value })));

        const ema20Series = chart.addSeries(lc.LineSeries, {
          color: "#06b6d4",
          lineWidth: 2,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        ema20Series.setData(ema20Data.map((d) => ({ time: d.time as any, value: d.value })));
      } else if (indicators.has("BOLL")) {
        const bollUpper = chart.addSeries(lc.LineSeries, {
          color: "#f59e0b",
          lineWidth: 1,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
        });
        bollUpper.setData(bollData.upper.map((d) => ({ time: d.time as any, value: d.value })));

        const bollMid = chart.addSeries(lc.LineSeries, {
          color: "#a855f7",
          lineWidth: 1,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
        });
        bollMid.setData(bollData.middle.map((d) => ({ time: d.time as any, value: d.value })));

        const bollLower = chart.addSeries(lc.LineSeries, {
          color: "#06b6d4",
          lineWidth: 1,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
        });
        bollLower.setData(bollData.lower.map((d) => ({ time: d.time as any, value: d.value })));
      } else if (indicators.has("SAR")) {
        const sarSeries = chart.addSeries(lc.LineSeries, {
          color: "#eab308",
          lineWidth: 2,
          lineStyle: lc.LineStyle.Dotted,
          priceLineVisible: false,
          crosshairMarkerVisible: true,
          lastValueVisible: false,
        });
        sarSeries.setData(sarData.map((d) => ({ time: d.time as any, value: d.value })));
      }

      // 3. Sub-Pane Indicator (VOL / MACD / RSI / KDJ)
      if (hasSubPane) {
        if (indicators.has("VOL")) {
          const volumeSeries = chart.addSeries(lc.HistogramSeries, {
            priceFormat: { type: "volume" },
            priceScaleId: "subpane-scale",
          });

          const volumeData = candles.map((c) => {
            const isUp = c.close >= c.open;
            return {
              time: c.time as any,
              value: c.volume,
              color: isUp ? "rgba(16, 185, 129, 0.65)" : "rgba(239, 68, 68, 0.65)",
            };
          });
          volumeSeries.setData(volumeData);
          volumeSeriesRef.current = volumeSeries;

          const volMa5Series = chart.addSeries(lc.LineSeries, {
            priceScaleId: "subpane-scale",
            color: "#f59e0b",
            lineWidth: 1,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          volMa5Series.setData(volMa5Data.map((d) => ({ time: d.time as any, value: d.value })));

          const volMa10Series = chart.addSeries(lc.LineSeries, {
            priceScaleId: "subpane-scale",
            color: "#a855f7",
            lineWidth: 1,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          volMa10Series.setData(volMa10Data.map((d) => ({ time: d.time as any, value: d.value })));
        } else if (indicators.has("MACD")) {
          const macdHistSeries = chart.addSeries(lc.HistogramSeries, {
            priceScaleId: "subpane-scale",
          });
          macdHistSeries.setData(
            macdData.map((d) => ({
              time: d.time as any,
              value: d.hist,
              color: d.hist >= 0 ? "rgba(16, 185, 129, 0.75)" : "rgba(239, 68, 68, 0.75)",
            })),
          );

          const macdLineSeries = chart.addSeries(lc.LineSeries, {
            priceScaleId: "subpane-scale",
            color: "#f59e0b",
            lineWidth: 1,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          macdLineSeries.setData(macdData.map((d) => ({ time: d.time as any, value: d.macd })));

          const signalLineSeries = chart.addSeries(lc.LineSeries, {
            priceScaleId: "subpane-scale",
            color: "#a855f7",
            lineWidth: 1,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          signalLineSeries.setData(macdData.map((d) => ({ time: d.time as any, value: d.signal })));
        } else if (indicators.has("RSI")) {
          const rsiSeries = chart.addSeries(lc.LineSeries, {
            priceScaleId: "subpane-scale",
            color: "#a855f7",
            lineWidth: 2,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          rsiSeries.setData(rsiData.map((d) => ({ time: d.time as any, value: d.value })));

          rsiSeries.createPriceLine({
            price: 70,
            color: "rgba(239, 68, 68, 0.5)",
            lineStyle: lc.LineStyle.Dashed,
            lineWidth: 1,
            axisLabelVisible: true,
            title: "70",
          });
          rsiSeries.createPriceLine({
            price: 30,
            color: "rgba(16, 185, 129, 0.5)",
            lineStyle: lc.LineStyle.Dashed,
            lineWidth: 1,
            axisLabelVisible: true,
            title: "30",
          });
        } else if (indicators.has("KDJ")) {
          const kSeries = chart.addSeries(lc.LineSeries, {
            priceScaleId: "subpane-scale",
            color: "#f59e0b",
            lineWidth: 1,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          kSeries.setData(kdjData.map((d) => ({ time: d.time as any, value: d.k })));

          const dSeries = chart.addSeries(lc.LineSeries, {
            priceScaleId: "subpane-scale",
            color: "#06b6d4",
            lineWidth: 1,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          dSeries.setData(kdjData.map((d) => ({ time: d.time as any, value: d.d })));

          const jSeries = chart.addSeries(lc.LineSeries, {
            priceScaleId: "subpane-scale",
            color: "#a855f7",
            lineWidth: 1,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          jSeries.setData(kdjData.map((d) => ({ time: d.time as any, value: d.j })));

          kSeries.createPriceLine({
            price: 80,
            color: "rgba(239, 68, 68, 0.4)",
            lineStyle: lc.LineStyle.Dashed,
            lineWidth: 1,
            axisLabelVisible: true,
            title: "80",
          });
          kSeries.createPriceLine({
            price: 20,
            color: "rgba(16, 185, 129, 0.4)",
            lineStyle: lc.LineStyle.Dashed,
            lineWidth: 1,
            axisLabelVisible: true,
            title: "20",
          });
        }

        try {
          chart.priceScale("subpane-scale").applyOptions({
            scaleMargins: {
              top: 0.78,
              bottom: 0,
            },
            borderColor: "transparent",
          });
        } catch (e) {
          console.warn("Could not configure subpane scale:", e);
        }
      }

      // 4. Position Lines (Avg Buy & Avg Sell)
      if (avgBuyPrice && avgBuyPrice > 0 && priceSeries) {
        priceSeries.createPriceLine({
          price: avgBuyPrice,
          color: "#3b82f6",
          lineWidth: 2,
          lineStyle: lc.LineStyle.Dashed,
          axisLabelVisible: true,
          title: `Avg Buy $${avgBuyPrice.toFixed(2)}`,
        });

        if (typeof lc.createSeriesMarkers === "function" && candles.length > 0) {
          const midIndex = Math.floor(candles.length * 0.45);
          try {
            lc.createSeriesMarkers(priceSeries, [
              {
                time: candles[midIndex].time as any,
                position: "aboveBar",
                color: "#10b981",
                shape: "circle",
                text: "B",
                size: 1,
              },
            ]);
          } catch {
            // ignore
          }
        }
      }

      if (avgSellPrice && avgSellPrice > 0 && priceSeries) {
        priceSeries.createPriceLine({
          price: avgSellPrice,
          color: "#f59e0b",
          lineWidth: 2,
          lineStyle: lc.LineStyle.Dashed,
          axisLabelVisible: true,
          title: `Avg Sell $${avgSellPrice.toFixed(2)}`,
        });

        if (typeof lc.createSeriesMarkers === "function" && candles.length > 0) {
          const midIndex = Math.floor(candles.length * 0.55);
          try {
            lc.createSeriesMarkers(priceSeries, [
              {
                time: candles[midIndex].time as any,
                position: "belowBar",
                color: "#ef4444",
                shape: "circle",
                text: "S",
                size: 1,
              },
            ]);
          } catch {
            // ignore
          }
        }
      }

      const getHoverValues = (t: number) => ({
        ma5: ma5DataRef.current.find((d) => d.time === t)?.value,
        ma10: ma10DataRef.current.find((d) => d.time === t)?.value,
        ma20: ma20DataRef.current.find((d) => d.time === t)?.value,
        ema5: ema5DataRef.current.find((d) => d.time === t)?.value,
        ema10: ema10DataRef.current.find((d) => d.time === t)?.value,
        ema20: ema20DataRef.current.find((d) => d.time === t)?.value,
        bollUpper: bollDataRef.current.upper.find((d) => d.time === t)?.value,
        bollMid: bollDataRef.current.middle.find((d) => d.time === t)?.value,
        bollLower: bollDataRef.current.lower.find((d) => d.time === t)?.value,
        sar: sarDataRef.current.find((d) => d.time === t)?.value,
        volMa5: volMa5DataRef.current.find((d) => d.time === t)?.value,
        volMa10: volMa10DataRef.current.find((d) => d.time === t)?.value,
        macd: macdDataRef.current.find((d) => d.time === t),
        rsi: rsiDataRef.current.find((d) => d.time === t)?.value,
        kdj: kdjDataRef.current.find((d) => d.time === t),
      });

      // 5. Crosshair Move Subscription
      chart.subscribeCrosshairMove((param: any) => {
        if (!param || !param.time || !param.point || !param.seriesData) {
          resetToLatest();
          return;
        }

        const candle = candlesRef.current.find((c) => c.time === param.time);
        if (candle) {
          isHoveringRef.current = true;
          const indValues = getHoverValues(candle.time);

          onHoverDataChangeRef.current?.({
            timeStr: formatCandleDateTime(candle.time),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            ...indValues,
          });
        } else {
          resetToLatest();
        }
      });

      // 6. Horizontal Scroll / Pan Subscription: update readout to latest visible candle if not crosshair-hovering
      chart.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        if (!isHoveringRef.current && range && candlesRef.current.length > 0) {
          const cList = candlesRef.current;
          const toIndex = Math.min(
            cList.length - 1,
            Math.max(0, Math.floor(range.to)),
          );
          const visibleCandle = cList[toIndex] || cList[cList.length - 1];
          if (visibleCandle) {
            const indValues = getHoverValues(visibleCandle.time);

            onHoverDataChangeRef.current?.({
              timeStr: formatCandleDateTime(visibleCandle.time),
              open: visibleCandle.open,
              high: visibleCandle.high,
              low: visibleCandle.low,
              close: visibleCandle.close,
              volume: visibleCandle.volume,
              ...indValues,
            });
          }
        }
      });

      // Set initial visible range to the latest candles so recent action is clear
      // while preserving full scrollback into historical candles
      const totalCandles = candles.length;
      if (totalCandles > 0) {
        const isNarrow = typeof window !== "undefined" && window.innerWidth < 640;
        const visibleBars = Math.min(isNarrow ? 32 : 80, totalCandles);
        chart.timeScale().setVisibleLogicalRange({
          from: totalCandles - visibleBars,
          to: totalCandles + (isNarrow ? 2 : 5),
        });
      }

      // Handle ResizeObserver
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }

      resizeObserverRef.current = new ResizeObserver((entries) => {
        if (!entries || entries.length === 0 || !chartInstanceRef.current) return;
        const entry = entries[0];
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (newWidth > 0 && newHeight > 0) {
          chartInstanceRef.current.resize(newWidth, newHeight);
        }
      });
      resizeObserverRef.current.observe(container);

      // Handle IntersectionObserver (when chart scrolls out of view and back into view)
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect();
      }

      intersectionObserverRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && chartInstanceRef.current && container) {
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (w > 0 && h > 0) {
            chartInstanceRef.current.resize(w, h);
          }
        }
      });
      intersectionObserverRef.current.observe(container);
    }

    initChart();

    return () => {
      isCancelled = true;
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect();
        intersectionObserverRef.current = null;
      }
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
      priceSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [
    isDark,
    candles,
    chartType,
    indicators,
    avgBuyPrice,
    avgSellPrice,
    ma5Data,
    ma10Data,
    ma20Data,
    ema5Data,
    ema10Data,
    ema20Data,
    bollData,
    volMa5Data,
    volMa10Data,
    sarData,
    macdData,
    rsiData,
    kdjData,
    resetToLatest,
  ]);

  // Real-time sub-second candle update (Tick-by-tick bar update without re-rendering chart)
  useEffect(() => {
    if (!liveTick || !priceSeriesRef.current || liveTick.price <= 0) return;
    const cList = localCandlesRef.current;
    if (cList.length === 0) return;

    const last = cList[cList.length - 1];
    const newPrice = Number(liveTick.price.toFixed(2));
    const newVol = Number(liveTick.volume || 0);

    last.close = newPrice;
    if (newPrice > last.high) last.high = newPrice;
    if (newPrice < last.low) last.low = newPrice;
    if (newVol > 0) last.volume += newVol;

    try {
      if (chartType === "candlestick") {
        priceSeriesRef.current.update({
          time: last.time as any,
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
        });
      } else {
        priceSeriesRef.current.update({
          time: last.time as any,
          value: last.close,
        });
      }

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.update({
          time: last.time as any,
          value: last.volume,
          color:
            last.close >= last.open
              ? "rgba(16, 185, 129, 0.65)"
              : "rgba(239, 68, 68, 0.65)",
        });
      }

      // Update hover readout if not currently inspecting a historical bar
      if (!isHoveringRef.current && onHoverDataChangeRef.current) {
        onHoverDataChangeRef.current({
          timeStr: formatCandleDateTime(last.time),
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
          volume: last.volume,
          ma5: ma5DataRef.current[ma5DataRef.current.length - 1]?.value,
          ma10: ma10DataRef.current[ma10DataRef.current.length - 1]?.value,
          ma20: ma20DataRef.current[ma20DataRef.current.length - 1]?.value,
          ema5: ema5DataRef.current[ema5DataRef.current.length - 1]?.value,
          ema10: ema10DataRef.current[ema10DataRef.current.length - 1]?.value,
          ema20: ema20DataRef.current[ema20DataRef.current.length - 1]?.value,
          bollUpper: bollDataRef.current.upper[bollDataRef.current.upper.length - 1]?.value,
          bollMid: bollDataRef.current.middle[bollDataRef.current.middle.length - 1]?.value,
          bollLower: bollDataRef.current.lower[bollDataRef.current.lower.length - 1]?.value,
          sar: sarDataRef.current[sarDataRef.current.length - 1]?.value,
          volMa5: volMa5DataRef.current[volMa5DataRef.current.length - 1]?.value,
          volMa10: volMa10DataRef.current[volMa10DataRef.current.length - 1]?.value,
          macd: macdDataRef.current[macdDataRef.current.length - 1],
          rsi: rsiDataRef.current[rsiDataRef.current.length - 1]?.value,
          kdj: kdjDataRef.current[kdjDataRef.current.length - 1],
        });
      }
    } catch {
      // ignore
    }
  }, [liveTick, chartType]);

  return (
    <div
      className={cn("relative w-full max-w-full overflow-hidden", className)}
      onMouseLeave={resetToLatest}
      onPointerLeave={resetToLatest}
      onTouchCancel={resetToLatest}
      onTouchEnd={resetToLatest}
    >
      <div
        ref={chartContainerRef}
        className="h-full w-full max-w-full overflow-hidden"
      />
    </div>
  );
}
