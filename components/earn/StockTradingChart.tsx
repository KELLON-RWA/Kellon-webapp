"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import type { Candle } from "@/services/api/stock-research";

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
  volMa5?: number;
  volMa10?: number;
};

interface StockTradingChartProps {
  candles: Candle[];
  chartType: ChartType;
  indicators: Set<IndicatorType>;
  avgBuyPrice?: number;
  avgSellPrice?: number;
  onHoverDataChange?: (data: HoveredData | null) => void;
  className?: string;
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

  if (candles.length < period) return { upper, middle, lower };

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    const sma = sum / period;
    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      varianceSum += Math.pow(candles[i - j].close - sma, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    const t = candles[i].time;
    upper.push({ time: t, value: Number((sma + multiplier * stdDev).toFixed(2)) });
    middle.push({ time: t, value: Number(sma.toFixed(2)) });
    lower.push({ time: t, value: Number((sma - multiplier * stdDev).toFixed(2)) });
  }

  return { upper, middle, lower };
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
}: StockTradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);

  // Maintain refs to avoid stale closures in listeners
  const onHoverDataChangeRef = useRef(onHoverDataChange);
  onHoverDataChangeRef.current = onHoverDataChange;

  const isHoveringRef = useRef(false);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  // Pre-calculate technical indicator series data
  const ma5Data = useMemo(() => calculateSMA(candles, 5), [candles]);
  const ma10Data = useMemo(() => calculateSMA(candles, 10), [candles]);
  const ma20Data = useMemo(() => calculateSMA(candles, 20), [candles]);

  const ema5Data = useMemo(() => calculateEMA(candles, 5), [candles]);
  const ema10Data = useMemo(() => calculateEMA(candles, 10), [candles]);
  const ema20Data = useMemo(() => calculateEMA(candles, 20), [candles]);

  const bollData = useMemo(() => calculateBollingerBands(candles, 20, 2), [candles]);

  const volMa5Data = useMemo(() => calculateVolumeSMA(candles, 5), [candles]);
  const volMa10Data = useMemo(() => calculateVolumeSMA(candles, 10), [candles]);

  const ma5DataRef = useRef(ma5Data);
  ma5DataRef.current = ma5Data;
  const ma10DataRef = useRef(ma10Data);
  ma10DataRef.current = ma10Data;
  const ma20DataRef = useRef(ma20Data);
  ma20DataRef.current = ma20Data;
  const volMa5DataRef = useRef(volMa5Data);
  volMa5DataRef.current = volMa5Data;
  const volMa10DataRef = useRef(volMa10Data);
  volMa10DataRef.current = volMa10Data;

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
      volMa5: volMa5Data[volMa5Data.length - 1]?.value,
      volMa10: volMa10Data[volMa10Data.length - 1]?.value,
    };
  }, [candles, ma5Data, ma10Data, ma20Data, volMa5Data, volMa10Data]);

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

      const lc = await import("lightweight-charts");
      if (isCancelled || !chartContainerRef.current) return;

      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }

      const container = chartContainerRef.current;
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 400;

      const chart = lc.createChart(container, {
        width,
        height,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: "#94a3b8",
          fontSize: 11,
          fontFamily: "inherit",
        },
        grid: {
          vertLines: { color: "rgba(255, 255, 255, 0.04)" },
          horzLines: { color: "rgba(255, 255, 255, 0.04)" },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: {
            color: "rgba(255, 255, 255, 0.2)",
            width: 1,
            style: lc.LineStyle.Dashed,
            labelBackgroundColor: "#1e293b",
          },
          horzLine: {
            color: "rgba(255, 255, 255, 0.2)",
            width: 1,
            style: lc.LineStyle.Dashed,
            labelBackgroundColor: "#1e293b",
          },
        },
        rightPriceScale: {
          borderColor: "rgba(255, 255, 255, 0.08)",
          scaleMargins: {
            top: 0.08,
            bottom: indicators.has("VOL") ? 0.28 : 0.08,
          },
          textColor: "#64748b",
        },
        timeScale: {
          borderColor: "rgba(255, 255, 255, 0.08)",
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

      // 2. Overlaid Indicators (MA / EMA / BOLL)
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
          color: "#06b6d4",
          lineWidth: 1,
          lineStyle: lc.LineStyle.Dashed,
          priceLineVisible: false,
        });
        bollUpper.setData(bollData.upper.map((d) => ({ time: d.time as any, value: d.value })));

        const bollMid = chart.addSeries(lc.LineSeries, {
          color: "#a855f7",
          lineWidth: 2,
          priceLineVisible: false,
        });
        bollMid.setData(bollData.middle.map((d) => ({ time: d.time as any, value: d.value })));

        const bollLower = chart.addSeries(lc.LineSeries, {
          color: "#06b6d4",
          lineWidth: 1,
          lineStyle: lc.LineStyle.Dashed,
          priceLineVisible: false,
        });
        bollLower.setData(bollData.lower.map((d) => ({ time: d.time as any, value: d.value })));
      }

      // 3. Volume Sub-Pane (VOL)
      if (indicators.has("VOL")) {
        const volumeSeries = chart.addSeries(lc.HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "volume-scale",
        });

        chart.priceScale("volume-scale").applyOptions({
          scaleMargins: {
            top: 0.78,
            bottom: 0,
          },
          borderColor: "transparent",
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

        const volMa5Series = chart.addSeries(lc.LineSeries, {
          priceScaleId: "volume-scale",
          color: "#f59e0b",
          lineWidth: 1,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        volMa5Series.setData(volMa5Data.map((d) => ({ time: d.time as any, value: d.value })));

        const volMa10Series = chart.addSeries(lc.LineSeries, {
          priceScaleId: "volume-scale",
          color: "#a855f7",
          lineWidth: 1,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        volMa10Series.setData(volMa10Data.map((d) => ({ time: d.time as any, value: d.value })));
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

      // 5. Crosshair Move Subscription
      chart.subscribeCrosshairMove((param: any) => {
        if (!param || !param.time || !param.point || !param.seriesData) {
          resetToLatest();
          return;
        }

        const candle = candlesRef.current.find((c) => c.time === param.time);
        if (candle) {
          isHoveringRef.current = true;
          const ma5 = ma5DataRef.current.find((d) => d.time === param.time)?.value;
          const ma10 = ma10DataRef.current.find((d) => d.time === param.time)?.value;
          const ma20 = ma20DataRef.current.find((d) => d.time === param.time)?.value;
          const volMa5 = volMa5DataRef.current.find((d) => d.time === param.time)?.value;
          const volMa10 = volMa10DataRef.current.find((d) => d.time === param.time)?.value;

          onHoverDataChangeRef.current?.({
            timeStr: formatCandleDateTime(candle.time),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            ma5,
            ma10,
            ma20,
            volMa5,
            volMa10,
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
            const t = visibleCandle.time;
            const ma5 = ma5DataRef.current.find((d) => d.time === t)?.value;
            const ma10 = ma10DataRef.current.find((d) => d.time === t)?.value;
            const ma20 = ma20DataRef.current.find((d) => d.time === t)?.value;
            const volMa5 = volMa5DataRef.current.find((d) => d.time === t)?.value;
            const volMa10 = volMa10DataRef.current.find((d) => d.time === t)?.value;

            onHoverDataChangeRef.current?.({
              timeStr: formatCandleDateTime(visibleCandle.time),
              open: visibleCandle.open,
              high: visibleCandle.high,
              low: visibleCandle.low,
              close: visibleCandle.close,
              volume: visibleCandle.volume,
              ma5,
              ma10,
              ma20,
              volMa5,
              volMa10,
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
    };
  }, [
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
    resetToLatest,
  ]);

  return (
    <div
      className={`relative w-full ${className}`}
      onMouseLeave={resetToLatest}
      onPointerLeave={resetToLatest}
      onTouchCancel={resetToLatest}
      onTouchEnd={resetToLatest}
    >
      <div ref={chartContainerRef} className="h-full w-full" />
    </div>
  );
}
