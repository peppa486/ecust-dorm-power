# 华理宿舍电量监控 App · Apple HIG 视觉重构与多维可视化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将华理宿舍电量监控 Android App 全面重构为 Apple HIG（iOS「设置 → 电池」与 Apple「健康」风格）的高级感视觉体系，新增 24 小时分时柱状图、14 天每日耗电柱状图、带阈值警戒与耗尽预测的余量曲线、四时段耗电占比环图/分段条、7×24 小时用电密度热力图，并修复后台/离线低电量通知触发状态机、新增常驻通知栏电量卡片与电池优化白名单引导。

**Architecture:** 保持与现有 `https://power.ecust.cc` 服务端接口完全兼容，在移动端新增纯函数多维分析引擎 `mobile/src/utils/analytics.ts`，将服务端下发的 14 天快照序列转化为逐时桶、按日汇总、时段占比、热力矩阵和耗尽预测点；重构通知监控模块 `mobile/src/monitoring/background.ts`，引入独立告警状态锁、常驻通知栏实时卡片与系统电池优化跳转；使用模块化 Apple HIG 卡片组件替换原有单薄界面。

**Tech Stack:** React Native 0.86 / Expo 57 / TypeScript 6.0 / Node.js built-in test runner (`node --test`)

---

### Task 1: Apple HIG 视觉 Token 与偏好存储扩展

**Files:**
- Modify: `mobile/src/theme.ts`
- Modify: `mobile/src/storage/preferences.ts`
- Modify: `mobile/src/utils/power.ts`

- [ ] **Step 1: 更新 `mobile/src/theme.ts` 为 Apple HIG 色彩与排印系统**
  提供 `#F2F2F7` Grouped Background、`#FFFFFF` 纯白卡片、`0.5px` 极细分割线、Apple 原生语义色（`#34C759`、`#007AFF`、`#FF9500`、`#FF3B30`、`#30B0C7`、`#5856D6`）以及等宽数字样式工具。

- [ ] **Step 2: 扩展 `mobile/src/storage/preferences.ts`**
  在 `StoredPreferences` 中新增 `ongoingNotificationEnabled: boolean`（默认 `true`，开启提醒时同步常驻通知栏实时电量卡片），并确保存储向后兼容。

- [ ] **Step 3: 运行 TypeScript 检查验证类型一致性**
  Run: `npm --prefix mobile run typecheck`

---

### Task 2: 多维电量分析引擎（24h分时柱状图、14天日耗、时段占比、7×24热力图、耗尽预测）与单元测试

**Files:**
- Create: `mobile/src/utils/analytics.ts`
- Create: `mobile/scripts/test-analytics.mjs`

- [ ] **Step 1: 编写 `mobile/src/utils/analytics.ts`**
  实现以下核心纯函数：
  - `analyzePowerHistory(points: HistoryPoint[], serverStats?: MobileHistoryStats | null, threshold?: number, nowMs?: number): PowerAnalytics`
  - 按自然整点比例分摊相邻快照耗电量，过滤充电跳变（`\Delta kWh < -2` 记为充电事件），生成过去 14 天任意日期的 24 小时逐时桶（`HourlyDayRecord[]`，含每小时耗电、峰值小时、当日总耗电）。
  - 生成近 14 天每日耗电对比数据（`DailyConsumptionPoint[]`）及日均耗电参考值。
  - 生成四时段耗电占比（`PeriodShare[]`：晚间 `18:00–24:00`、夜间 `00:00–06:00`、午间 `12:00–18:00`、上午 `06:00–12:00`）。
  - 生成最近 7 天 × 24 小时用电密度热力矩阵（`HeatmapRow[]`，含 0–4 五级归一化强度）。
  - 生成余量曲线与未来 48 小时耗尽预测点、预计耗尽时间戳与预计可用天数。

- [ ] **Step 2: 编写并运行测试脚本 `mobile/scripts/test-analytics.mjs`**
  验证跨小时分摊、充电跳变剔除、24h 柱状图汇总、时段占比之和为 100% 以及耗尽预测计算。

---

### Task 3: 修复后台/离线低电量通知状态机与新增常驻通知栏卡片、电池白名单引导

**Files:**
- Modify: `mobile/src/monitoring/background.ts`

- [ ] **Step 1: 实现独立告警状态锁与持久化巡检状态**
  在 `AsyncStorage` 中保存 `ecust-power:monitor-state:v1`（含 `alertedRoomKey`、`alertedThreshold`、`lastCheckedAt`、`lastKwh`）。
  修复先前依赖 `points.at(-2)` 的 Bug：当用户开启监控或后台巡检发现 `data.kwh <= preferences.threshold` 且当前未告警时，立即触发高优通知；当电量充电回升超过 `threshold + 1.5` 时自动重置告警状态。

- [ ] **Step 2: 实现常驻通知栏电量卡片（Ongoing Notification）与测试通知、电池优化设置跳转**
  - 新增 `ongoing-power-status` 通知通道与 `updateOngoingPowerNotification()` / `dismissOngoingPowerNotification()`。
  - 新增 `sendTestNotification()` 供用户一键验证通知权限与横幅展示。
  - 新增 `openBatteryOptimizationSettings()` 调用 Android 系统忽略电池优化设置。

---

### Task 4: 构建 Apple HIG 核心 UI 与可视化组件群

**Files:**
- Create: `mobile/src/components/HeroTelemetryCard.tsx`
- Create: `mobile/src/components/RoomSwitcherModal.tsx`
- Create: `mobile/src/components/EnergyAnalyticsCard.tsx`
- Create: `mobile/src/components/PatternInsightsCard.tsx`
- Modify: `mobile/src/components/MonitorCard.tsx`
- Modify: `mobile/src/screens/PowerQueryScreen.tsx`

- [ ] **Step 1: 创建 `HeroTelemetryCard.tsx` 与 `RoomSwitcherModal.tsx`**
  - `HeroTelemetryCard`：展示 48pt 等宽剩余电量、状态胶囊、带阈值刻度的健康容量条、四宫格核心指标（预计可用天数/耗尽日期、24h 耗电、日均耗电、充电统计）与快捷刷新/设为我的寝室操作。
  - `RoomSwitcherModal`：顶部寝室胶囊触发的 iOS Bottom Sheet，支持切换奉贤/徐汇校区、搜索/选择楼栋、输入寝室号查询及切换绑定寝室。

- [ ] **Step 2: 创建 `EnergyAnalyticsCard.tsx`（含 iOS Segmented Control 与 Scrubbing Callout）**
  - 视图 1：**每小时柱状图（24h Hourly Bar Chart）** —— 24 根圆头柱体 + `00/06/12/18时` 纵向虚线参考轴 + 日期左右切换 + 点击柱体在左上角动态显示该小时度数与时段。
  - 视图 2：**每日柱状图（14d Daily Bar Chart）** —— 近 7/14 天每日耗电柱体 + 日均耗电横虚线 + 点击某天查看详情并支持一键跳转到当日 24 小时分时图。
  - 视图 3：**余量与预测曲线（Balance & Forecast Line Chart）** —— 历史余量曲线 + 低电量阈值警戒红虚线 + 耗尽趋势预测虚线 + 充电跳变琥珀标记 + 全屏横向滑动模式。

- [ ] **Step 3: 创建 `PatternInsightsCard.tsx`（四时段环形/分段占比 + 7×24h 单色深浅热力矩阵）**
  - 使用纯 View 分段比例条 + 极简环形指示器展示「晚间 / 夜间 / 午间 / 上午」耗电占比与度数。
  - 渲染近 7 天 × 24 小时的 Apple Fitness 风格 5 级单色透明度热力矩阵，支持点击任意格子查看该日该小时的具体耗电。

- [ ] **Step 4: 升级 `MonitorCard.tsx` 与重构 `PowerQueryScreen.tsx`**
  - 将 `MonitorCard` 重构为 iOS「设置」分组列表风格，包含低电量提醒开关、阈值步进调节、常驻通知栏实时电量开关、后台电池白名单一键设置、立即发送测试通知按钮与最近巡检状态显示。
  - 在 `PowerQueryScreen.tsx` 中串联服务端 `stats` + `items`、下拉刷新、常驻通知同步与全部新组件。

---

### Task 5: 类型检查、自动化测试与 Android 实机/模拟器构建验证

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 运行全量静态检查与单元测试**
  Run: `npm --prefix mobile run typecheck`
  Run: `npm --prefix server test`
- [ ] **Step 2: 在本地 Android 环境中构建并验证交互**
  通过 Gradle / ADB 安装并启动新版 APK，截屏并验证各图表切换、柱状图点击检视、测试通知与常驻通知栏效果。
