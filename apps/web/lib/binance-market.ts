export const DEFAULT_BINANCE_SYMBOL = 'BTCUSDT'
export const DEFAULT_TRADINGVIEW_SYMBOL = 'BINANCE:BTCUSDT'
export const DEFAULT_QUOTE_ASSET = 'USDT'
export const BINANCE_KLINE_LIMIT = 200

export const BINANCE_INTERVAL_MAP = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
} as const

export interface BinanceTicker24hResponse {
  symbol: string
  priceChange: string
  priceChangePercent: string
  lastPrice: string
  highPrice: string
  lowPrice: string
  volume: string
  closeTime: number
}

export interface BinancePriceData {
  symbol: string
  price: number
  change24h: number
  changePercent24h: number
  high24h: number
  low24h: number
  volume24h: number
  updatedAt: number
  source: 'binance' | 'binance-us'
}

export type BinanceInterval = typeof BINANCE_INTERVAL_MAP[keyof typeof BINANCE_INTERVAL_MAP]
export type BinanceKlineResponse = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
]

export function toBinanceSymbol(baseSymbol: string, quoteAsset: string = DEFAULT_QUOTE_ASSET): string {
  const normalizedBase = baseSymbol.trim().toUpperCase()
  const normalizedQuote = quoteAsset.trim().toUpperCase()

  if (normalizedBase.endsWith(normalizedQuote)) {
    return normalizedBase
  }

  return `${normalizedBase}${normalizedQuote}`
}

export function toTradingViewSymbol(symbol: string): string {
  return `BINANCE:${symbol.toUpperCase()}`
}

export function normalizeBinanceTicker(
  ticker: BinanceTicker24hResponse,
  source: BinancePriceData['source']
): BinancePriceData {
  return {
    symbol: ticker.symbol,
    price: Number.parseFloat(ticker.lastPrice),
    change24h: Number.parseFloat(ticker.priceChange),
    changePercent24h: Number.parseFloat(ticker.priceChangePercent),
    high24h: Number.parseFloat(ticker.highPrice),
    low24h: Number.parseFloat(ticker.lowPrice),
    volume24h: Number.parseFloat(ticker.volume),
    updatedAt: ticker.closeTime || Date.now(),
    source,
  }
}

export function toBinanceInterval(timeframe: keyof typeof BINANCE_INTERVAL_MAP): BinanceInterval {
  return BINANCE_INTERVAL_MAP[timeframe]
}

export function normalizeBinanceKline(kline: BinanceKlineResponse) {
  return {
    time: Math.floor(kline[0] / 1000),
    open: Number.parseFloat(kline[1]),
    high: Number.parseFloat(kline[2]),
    low: Number.parseFloat(kline[3]),
    close: Number.parseFloat(kline[4]),
    volume: Number.parseFloat(kline[5]),
  }
}
