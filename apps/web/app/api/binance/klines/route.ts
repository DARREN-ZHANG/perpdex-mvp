import { NextResponse } from 'next/server'
import {
  BINANCE_KLINE_LIMIT,
  normalizeBinanceKline,
  type BinanceKlineResponse,
} from '@/lib/binance-market'

const BINANCE_KLINE_ENDPOINTS = [
  'https://api.binance.com/api/v3/klines',
  'https://api.binance.us/api/v3/klines',
]
const UPSTREAM_TIMEOUT_MS = 5000
const RESPONSE_CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=120'

function isValidSymbol(symbol: string): boolean {
  return /^[A-Z0-9]{5,20}$/.test(symbol)
}

function isValidInterval(interval: string): boolean {
  return /^(1m|5m|15m|1h|4h|1d)$/.test(interval)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.trim().toUpperCase() ?? 'BTCUSDT'
  const interval = searchParams.get('interval')?.trim() ?? '1h'
  const limit = Math.min(
    Number.parseInt(searchParams.get('limit') ?? `${BINANCE_KLINE_LIMIT}`, 10) || BINANCE_KLINE_LIMIT,
    500
  )

  if (!isValidSymbol(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  if (!isValidInterval(interval)) {
    return NextResponse.json({ error: 'Invalid interval' }, { status: 400 })
  }

  let lastError: Error | null = null

  for (const endpoint of BINANCE_KLINE_ENDPOINTS) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    try {
      const response = await fetch(
        `${endpoint}?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        }
      )

      if (!response.ok) {
        lastError = new Error(`Kline upstream returned ${response.status}`)
        continue
      }

      const payload = await response.json() as BinanceKlineResponse[]
      return NextResponse.json(
        {
          data: payload.map(normalizeBinanceKline),
        },
        {
          headers: {
            'Cache-Control': RESPONSE_CACHE_CONTROL,
          },
        }
      )
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Failed to load Binance klines')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return NextResponse.json(
    {
      error: lastError?.message || 'Failed to load Binance klines',
    },
    {
      status: 502,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
