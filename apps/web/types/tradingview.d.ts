declare global {
  interface Window {
    TradingView: {
      widget: new (config: {
        autosize: boolean
        symbol: string
        interval: string
        timezone: string
        theme: string
        style: string
        locale: string
        toolbar_bg: string
        enable_publishing: boolean
        allow_symbol_change: boolean
        container_id: string
        hide_top_toolbar?: boolean
        hide_legend?: boolean
        save_image?: boolean
        backgroundColor?: string
        gridColor?: string
      }) => void
    }
  }
}

export {}
