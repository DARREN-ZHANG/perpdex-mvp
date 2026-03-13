import { NextResponse } from 'next/server'
import {
  normalizeBinanceTicker,
  type BinancePriceData,
  type BinanceTicker24hResponse,
} from '@/lib/binance-market'

const BINANCE_TICKER_ENDPOINTS = [
  {
    source: 'binance' as const,
    url: 'https://api.binance.com/api/v3/ticker/24hr',
  },
  {
    source: 'binance-us' as const,
    url: 'https://api.binance.us/api/v3/ticker/24hr',
  },
]
const UPSTREAM_TIMEOUT_MS = 5000

function isValidSymbol(symbol: string): boolean {
  return /^[A-Z0-9]{5,20}$/.test(symbol)
}

async function fetchTickerSnapshot(symbol: string): Promise<BinancePriceData> {
  let lastError: Error | null = null

  for (const endpoint of BINANCE_TICKER_ENDPOINTS) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    try {
      const response = await fetch(`${endpoint.url}?symbol=${symbol}`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        lastError = new Error(`${endpoint.source} returned ${response.status}`)
        continue
      }

      const payload = await response.json() as BinanceTicker24hResponse
      return normalizeBinanceTicker(payload, endpoint.source)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown upstream error')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw lastError ?? new Error('No Binance market data endpoint is available')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requestedSymbol = searchParams.get('symbol')?.trim().toUpperCase() ?? 'BTCUSDT'

  if (!isValidSymbol(requestedSymbol)) {
    return NextResponse.json(
      {
        error: 'Invalid symbol',
      },
      { status: 400 }
    )
  }

  try {
    const data = await fetchTickerSnapshot(requestedSymbol)
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Binance market data'

    return NextResponse.json(
      {
        error: message,
      },
      { status: 502 }
    )
  }
}
