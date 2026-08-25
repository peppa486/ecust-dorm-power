import { authRequest, request } from '../../utils/api'
import { sameRoom } from '../../utils/format'

Page({
  data: {
    campuses: ['奉贤', '徐汇'],
    campusIndex: 0,
    buildings: [],
    buildingIndex: 0,
    room: '',
    threshold: 15,
    templateId: '',
    result: null,
    watch: null,
    isMine: false,
    loading: false,
    saving: false,
    subscribing: false
  },

  async onLoad() {
    this.ready = false
    const last = wx.getStorageSync('lastRoom') || null
    const lastCampusIndex = last?.campus ? this.data.campuses.indexOf(last.campus) : -1
    const campusIndex = lastCampusIndex >= 0 ? lastCampusIndex : this.data.campusIndex
    if (lastCampusIndex >= 0) await this.setDataAsync({ campusIndex, room: last.room || '' })
    const restored = await this.loadBuildings(lastCampusIndex >= 0 ? last.building : '', campusIndex)
    await Promise.all([
      this.loadClientConfig(),
      wx.getStorageSync('token') ? this.loadWatch() : Promise.resolve()
    ])
    if (restored && last?.room) await this.runQuery(true)
    this.ready = true
  },

  setDataAsync(data) {
    return new Promise(resolve => this.setData(data, resolve))
  },

  onShow() {
    if (this.ready && wx.getStorageSync('token')) this.loadWatch()
  },

  async loadClientConfig() {
    try {
      const data = await request('/api/client-config')
      this.setData({ templateId: data.lowPowerTemplateId || '' })
    } catch (_) {}
  },

  async loadBuildings(preferred, campusIndex = this.data.campusIndex) {
    const campus = this.data.campuses[campusIndex]
    try {
      const data = await request(`/api/buildings?campus=${encodeURIComponent(campus)}`)
      const preferredIndex = preferred ? data.buildings.findIndex(item => item.value === preferred) : 0
      await this.setDataAsync({
        buildings: data.buildings,
        buildingIndex: preferredIndex >= 0 ? preferredIndex : 0
      })
      return !preferred || preferredIndex >= 0
    } catch (_) {
      wx.showToast({ title: '楼栋加载失败', icon: 'none' })
      return false
    }
  },

  async loadWatch() {
    try {
      const data = await authRequest('/api/watch')
      const watch = data.watch || null
      this.setData({ watch, threshold: watch?.threshold || this.data.threshold })
      this.syncMine()
    } catch (_) {}
  },

  syncMine() {
    this.setData({ isMine: sameRoom(this.data.result, this.data.watch) })
  },

  onCampusTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (index === this.data.campusIndex) return
    this.setData({ campusIndex: index, buildingIndex: 0, result: null, isMine: false })
    this.loadBuildings('', index)
  },

  onBuildingChange(e) {
    this.setData({ buildingIndex: Number(e.detail.value), result: null, isMine: false })
  },

  onRoomInput(e) {
    this.setData({ room: e.detail.value.trim().toUpperCase(), result: null, isMine: false })
  },

  onThresholdChange(e) {
    this.setData({ threshold: Number(e.detail.value) })
  },

  currentRoom() {
    const option = this.data.buildings[this.data.buildingIndex]
    return {
      campus: this.data.campuses[this.data.campusIndex],
      building: option?.value || '',
      room: this.data.room.trim().toUpperCase()
    }
  },

  queryPower() {
    return this.runQuery(false)
  },

  async runQuery(silent = false) {
    const room = this.currentRoom()
    if (!room.building || !room.room) {
      if (!silent) wx.showToast({ title: '填写寝室号', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      const data = await request('/api/query', { method: 'POST', data: room })
      const level = data.kwh <= 5
        ? { tone: 'danger', text: '紧张' }
        : data.kwh <= 15
          ? { tone: 'warning', text: '偏低' }
          : { tone: 'good', text: '充足' }
      const result = { ...data, tone: level.tone, statusText: level.text }
      this.setData({ result })
      wx.setStorageSync('lastRoom', room)
      this.syncMine()
    } catch (error) {
      if (!silent) wx.showModal({ title: '查询失败', content: error.message || '暂时不可用', showCancel: false })
    } finally {
      this.setData({ loading: false })
    }
  },

  async setMine() {
    if (!this.data.result) return
    this.setData({ saving: true })
    try {
      const room = this.currentRoom()
      const data = await authRequest('/api/watch', {
        method: 'POST',
        data: { ...room, threshold: this.data.threshold }
      })
      this.setData({ watch: data.watch, threshold: data.watch.threshold })
      this.syncMine()
      wx.showToast({ title: '已设为我的寝室', icon: 'success' })
    } catch (error) {
      wx.showModal({ title: '设置失败', content: error.message || '请稍后再试', showCancel: false })
    } finally {
      this.setData({ saving: false })
    }
  },

  async saveThreshold() {
    if (!this.data.isMine) return
    this.setData({ saving: true })
    try {
      const room = this.currentRoom()
      const data = await authRequest('/api/watch', {
        method: 'POST',
        data: { ...room, threshold: this.data.threshold }
      })
      this.setData({ watch: data.watch })
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  async subscribeLowPower() {
    if (!this.data.templateId) {
      return wx.showModal({ title: '提醒暂未开放', content: '管理员尚未配置订阅消息模板。', showCancel: false })
    }
    this.setData({ subscribing: true })
    try {
      const result = await new Promise((resolve, reject) => {
        wx.requestSubscribeMessage({ tmplIds: [this.data.templateId], success: resolve, fail: reject })
      })
      if (!['accept', 'acceptWithAudio'].includes(result[this.data.templateId])) {
        return wx.showToast({ title: '未订阅', icon: 'none' })
      }
      const data = await authRequest('/api/watch/subscription', {
        method: 'POST',
        data: { templateId: this.data.templateId, threshold: this.data.threshold }
      })
      this.setData({ watch: data.watch })
      wx.showToast({ title: '已订阅一次', icon: 'success' })
    } catch (error) {
      wx.showModal({ title: '订阅失败', content: error.message || '请稍后再试', showCancel: false })
    } finally {
      this.setData({ subscribing: false })
    }
  },

  async removeMine() {
    const modal = await new Promise(resolve => {
      wx.showModal({ title: '取消我的寝室？', content: '历史采集和低电量提醒会停止。', success: resolve })
    })
    if (!modal.confirm) return
    try {
      await authRequest('/api/watch', { method: 'DELETE' })
      this.setData({ watch: null, isMine: false })
      wx.showToast({ title: '已取消', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    }
  },

  goHistory() {
    if (!this.data.isMine) return
    wx.navigateTo({ url: '/pages/history/history' })
  },

  goAbout() {
    wx.navigateTo({ url: '/pages/about/about' })
  },

  onShareAppMessage() {
    return { title: '宿电｜华理寝室电量', path: '/pages/index/index' }
  },

  onShareTimeline() {
    return { title: '宿电｜华理寝室电量' }
  }
})
