const { EMA, RSI, ATR } = require('technicalindicators');

export interface CandleRow {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ts: string;
}

export const normalizeCandles = (rawCandles: any[]): CandleRow[] => {
    return [...rawCandles].reverse().map((c) => ({
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume) || 0,
        ts: String(c.ts),
    }));
};

export const calculateEmaCrossover = (
    closes: number[],
    fast = 9,
    slow = 21,
) => {
    const emaFast = EMA.calculate({ period: fast, values: closes });
    const emaSlow = EMA.calculate({ period: slow, values: closes });
    const lastFast = emaFast[emaFast.length - 1];
    const prevFast = emaFast[emaFast.length - 2];
    const lastSlow = emaSlow[emaSlow.length - 1];
    const prevSlow = emaSlow[emaSlow.length - 2];

    return {
        lastFast,
        prevFast,
        lastSlow,
        prevSlow,
        bullishCross: lastFast > lastSlow && prevFast <= prevSlow,
        bearishCross: lastFast < lastSlow && prevFast >= prevSlow,
    };
};

export const aggregateTo5m = (candles: CandleRow[]): CandleRow[] => {
    const result: CandleRow[] = [];
    for (let i = 0; i + 4 < candles.length; i += 5) {
        const chunk = candles.slice(i, i + 5);
        result.push({
            open: chunk[0].open,
            high: Math.max(...chunk.map((c) => c.high)),
            low: Math.min(...chunk.map((c) => c.low)),
            close: chunk[chunk.length - 1].close,
            volume: chunk.reduce((s, c) => s + c.volume, 0),
            ts: chunk[chunk.length - 1].ts,
        });
    }
    return result;
};

export const calculateLatestRSI = (
    closes: number[],
    period = 14,
): number | null => {
    if (closes.length <= period) return null;
    const values = RSI.calculate({ period, values: closes });
    return values[values.length - 1] ?? null;
};

export const calculateLatestATR = (
    candles: CandleRow[],
    period = 14,
): number | null => {
    if (candles.length <= period) return null;
    const atrValues = ATR.calculate({
        period,
        high: candles.map((c) => c.high),
        low: candles.map((c) => c.low),
        close: candles.map((c) => c.close),
    });
    return atrValues[atrValues.length - 1] ?? null;
};
