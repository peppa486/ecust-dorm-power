import { authRequest } from '../../utils/api'
import { formatShortTime } from '../../utils/format'

function display(value, suffix = '') {
  return value === null || value === undefined ? '—' : `${value}${suffix}`
}

Page({
  data: {
    loading: true,
    roomName: '',
    stats: null,
    currentNumber: '—',
    hasCurrent: false,
    statCards: [],
    items: [],
    recent: [],
    chartReady: false
  },

  onShow() {
    this.loadHistory()
  },

  async loadHistory() {
    this.setData({ loading: true })
    try {
      const data = await authRequest('/api/history')
      const watch = data.watch
      const items = data.items || []
      const stats = data.stats || {}
      const hasChartPoints = items.some(item => Number.isFinite(Number(item.kwh)))
      this.setData({
        roomName: data.displayName || watch.displayName || `${watch.campus} · ${watch.building} · ${watch.room}`,
        stats,
        currentNumber: stats.current === null || stats.current === undefined ? '—' : String(stats.current),
        hasCurrent: stats.current !== null && stats.current !== undefined,
        statCards: [
          { label: '24h 用量', value: display(stats.consumed24h, ' 度') },
          { label: '日均', value: display(stats.dailyAverage, ' 度') },
          { label: '预计可用', value: display(stats.estimatedDays, ' 天') }
        ],
        items,
        recent: items.slice(-8).reverse().map(item => ({ ...item, time: formatShortTime(item.createdAt) })),
        chartReady: hasChartPoints
      })
      if (hasChartPoints) wx.nextTick(() => this.drawChart())
    } catch (error) {
      wx.showModal({ title: '暂无历史', content: error.message || '还没有可展示的数据', showCancel: false })
    } finally {
      this.setData({ loading: false })
    }
  },

  drawChart() {
    const points = this.data.items.slice(-168).filter(item => Number.isFinite(Number(item.kwh)))
    if (!points.length) return
    const query = wx.createSelectorQuery().in(this)
    query.select('#trendCanvas').fields({ node: true, size: true }).exec(result => {
      const entry = result?.[0]
      if (!entry?.node || !entry.width || !entry.height) return

      const canvas = entry.node
      const ctx = canvas.getContext('2d')
      const dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio) || 1
      const width = entry.width
      const height = entry.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)

      const padX = 6
      const padY = 12
      const values = points.map(item => Number(item.kwh)).filter(Number.isFinite)
      const min = Math.min(...values)
      const max = Math.max(...values)
      const span = Math.max(max - min, 1)
      const step = points.length === 1 ? 0 : (width - padX * 2) / (points.length - 1)
      const xy = points.map((point, index) => ({
        x: points.length === 1 ? width / 2 : padX + index * step,
        y: padY + ((max - Number(point.kwh)) / span) * (height - padY * 2)
      }))

      ctx.clearRect(0, 0, width, height)
      if (xy.length > 1) {
        ctx.beginPath()
        ctx.moveTo(xy[0].x, xy[0].y)
        for (const point of xy.slice(1)) ctx.lineTo(point.x, point.y)
        ctx.strokeStyle = '#1c1f24'
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(xy[0].x, xy[0].y, 4, 0, Math.PI * 2)
        ctx.fillStyle = '#1c1f24'
        ctx.fill()
      }
    })
  }
})
