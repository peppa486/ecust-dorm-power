# 华理宿舍电量监控 App · Apple HIG 视觉重构与多维可视化及后台守护设计规范

## 1. 背景与目标

现有 Android 端（`mobile/`）界面与数据展示过于单薄：
1. **可视化程度低**：虽然服务端（`https://power.ecust.cc/api/mobile/history`）已经按整点采集并保留了 14 天的电量快照（`items`）和统计摘要（`stats`），但客户端仅展示了一张基础折线缩略图，丢弃了服务端返回的统计数据，且缺乏按小时柱状图、按日对比柱状图、时段占比和热力分布等直观分析视图。
2. **UI 视觉缺乏高级感**：首屏被校区、楼栋和寝室输入框占据大量空间，缺乏层次感和精致的数据排印。
3. **后台/离线低电量通知失效**：
   - 客户端 `background.ts` 依赖 `points.at(-2)` 判断是否“首次跌破阈值”。当用户先查询或绑定了一个已处于阈值以下的寝室、随后再开启提醒时，`previous.kwh <= threshold` 恒成立，导致 `crossedThreshold` 永远为 `false`，通知无法触发。
   - 远程推送依赖 Google FCM（国内网络无代理环境下不可达），而本地后台任务仅依赖普通 `WorkManager`，在国产 Android 系统（MIUI/HyperOS、ColorOS、OriginOS 等）划掉后台后极易被省电策略拦截，且缺少常驻通知栏保活、电池优化白名单引导和通知自检测试按钮。

### 核心目标
- **Apple HIG 原生高级感设计语言（去 AI 化）**：采用 iOS「设置 → 电池」与 Apple「健康 (Health)」的设计哲学，使用 `#F2F2F7` 分组画布、纯白卡片、`0.5px` 极细分割线、SF Pro Tabular 等宽数字排印与克制的 Apple 系统语义色，杜绝 Emoji 图标与廉价渐变。
- **全维度用电数据可视化**：在无需修改远端服务器的前提下，基于 14 天快照流在端侧构建：
  1. **核心指标仪表盘（Hero Telemetry Card）**：当前剩余度数、容量健康条、预计可用天数（含预计耗尽日期）、过去 24h 耗电、日均耗电、累计充电次数。
  2. **24 小时分时用电柱状图（Hourly Bar Chart）**：支持按日期左右翻页，展示 00:00–23:00 每小时耗电柱状图、纵向 6 小时虚线网格、峰值高亮及点击柱体 Scrubbing Callout 检视详情。
  3. **近 14 天每日耗电柱状图（Daily Bar Chart）**：按天聚合总耗电量，叠加日均耗电横向参考虚线，点击单日可查看详情或联动到当日分时图。
  4. **余量曲线与耗尽预测图（Balance & Forecast Line Chart）**：展示历史电量曲线、低电量阈值红色警戒虚线、未来耗尽趋势预测虚线及充电跳变点标记，支持点击单点检视与全屏横滑浏览。
  5. **时段占比分段条与环形图（Period Breakdown）**：统计「夜间睡眠 00–06、上午 06–12、午间 12–18、晚间高峰 18–24」四时段的度数与百分比（包含 SVG 环形图与横向比例条）。
  6. **7×24 小时用电密度热力矩阵（Usage Heatmap）**：以 Apple Fitness 单色系 5 级透明度深浅展示最近 7 天 × 24 小时的用电密度分布。
- **可靠后台通知与保活链路**：
  1. 修复低电量触发状态机（独立持久化告警状态锁，开启监控时若已低于阈值立即告警，充电回升后自动解锁）。
  2. 新增「常驻通知栏电量卡片（Ongoing Notification）」功能，在通知栏实时显示当前寝室剩余度数与预计可用天数，大幅提升 Android 进程优先级。
  3. 新增 Android「忽略电池优化 / 后台无限制运行」系统设置一键跳转与权限状态展示，并提供「立即发送测试通知」与「最近巡检时间」诊断项。

---

## 2. 架构与模块划分

### 2.1 文件结构
- `mobile/src/theme.ts`：Apple HIG 色彩系统、圆角、间距、字重与等宽数字样式 Token。
- `mobile/src/utils/analytics.ts`：端侧多维电量分析纯函数引擎（分时插值、按日汇总、四时段占比、7×24 热力矩阵、耗尽预测曲线、核心 KPI 计算）。
- `mobile/src/storage/preferences.ts`：扩展偏好存储，支持 `ongoingNotificationEnabled`（常驻通知栏开关）与 `alertedRoomKey` / `lastCheckedAt`（独立告警状态机与巡检时间戳）。
- `mobile/src/monitoring/background.ts`：重构通知触发逻辑、常驻通知栏实时卡片更新、测试通知发送、Android 电池优化设置跳转与后台巡检同步。
- `mobile/src/components/HeroTelemetryCard.tsx`：顶部实时余量、容量进度条与 4 宫格核心指标卡片。
- `mobile/src/components/RoomSwitcherModal.tsx`：顶部寝室胶囊触发的 iOS 风格底部抽屉（整合校区切换、楼栋选择、寝室号输入、设为/取消我的寝室）。
- `mobile/src/components/EnergyAnalyticsCard.tsx`：带 iOS Segmented Control 与 Scrubbing Callout 的三合一主图表舱（内含 `HourlyBarChart`、`DailyBarChart`、`BalanceForecastChart`）。
- `mobile/src/components/PatternInsightsCard.tsx`：四时段占比（SVG 环图 + 分段比例条）与 7×24 小时单色深浅热力矩阵卡片。
- `mobile/src/components/MonitorCard.tsx`：iOS 设置列表风格的低电量提醒、阈值步进器、常驻通知栏开关、电池优化白名单引导与测试通知面板。
- `mobile/src/screens/PowerQueryScreen.tsx`：主屏幕状态编排与下拉刷新/前景自动同步。

### 2.2 分时与多维聚合算法（`mobile/src/utils/analytics.ts`）
给定按时间升序排列的历史快照点序列 $P = \{p_0, p_1, \dots, p_n\}$：
1. **区间差分与清洗**：
   - 对相邻点 $(p_{i-1}, p_i)$，计算时间跨度 $\Delta t = t_i - t_{i-1}$ 与电量差 $\Delta E = p_{i-1}.\text{kwh} - p_i.\text{kwh}$。
   - 若 $\Delta t \le 0$ 或 $\Delta t > 48\text{h}$ 则跳过。
   - 若 $\Delta E < -2.0\text{ kWh}$，标记 $p_i$ 为充电事件（`recharged = true`），充入电量为 $-\Delta E$，该区间不计入耗电。
   - 若 $\Delta E > 0$ 且单位小时功率 $\Delta E / (\Delta t / 1\text{h}) \le 12\text{ kWh/h}$，则视为有效耗电区间。
2. **按小时桶分摊（Hourly Bucketing）**：
   - 将有效耗电区间 $[t_{i-1}, t_i]$ 与自然整点区间 $[H_k, H_k + 1\text{h}]$ 求交集时长 $\delta_k$，将耗电量按时间占比 $\Delta E \times (\delta_k / \Delta t)$ 累加至对应日期的对应小时桶 `hour[0..23]`。
   - 这样即使服务端采样存在几分钟偏移或偶发漏采，也能平滑还原出准确的每小时用电柱状图。
3. **派生指标**：
   - **每日耗电列表（Daily Totals）**：汇总近 14 天每天 00:00–24:00 的总耗电量、最高耗电小时与采样覆盖率。
   - **四时段耗电占比（Period Breakdown）**：统计近 7 天（或全部有效样本）在「夜间 00–06」「上午 06–12」「午间 12–18」「晚间 18–24」四个时段的累计耗电与占比。
   - **7×24 热力矩阵（Heatmap Matrix）**：输出最近 7 天 × 24 小时的归一化强度等级 `level \in {0, 1, 2, 3, 4}`。
   - **耗尽预测曲线（Forecast Trajectory）**：基于当前余量 $E_{\text{now}}$ 与日均耗电 $R_{\text{daily}}$，生成未来耗尽时间点或未来 72 小时的线性预测轨迹，与低电量阈值线共同绘制在余量曲线图中。

### 2.3 后台通知与保活状态机（`mobile/src/monitoring/background.ts`）
1. **独立告警状态机**：
   - 在 `AsyncStorage` 中维护 `monitorState: { alertedRoomKey: string | null, alertedThreshold: number | null, lastCheckedAt: string | null }`。
   - 每次巡检（或用户在开启提醒/修改阈值时立即执行 `runMonitorNow`）：
     - 若 `data.kwh <= preferences.threshold`：当 `alertedRoomKey !== currentRoomKey` 或 `alertedThreshold !== preferences.threshold` 时，立即发送高优先级低电量通知，并记录 `alertedRoomKey = currentRoomKey, alertedThreshold = preferences.threshold`。
     - 若 `data.kwh > preferences.threshold + 1.5`：清除 `alertedRoomKey`，允许下次跌破时再次提醒。
2. **常驻通知栏电量卡片（Ongoing Notification）**：
   - 建立独立的低打扰通知通道 `ongoing-power-status`（`AndroidImportance.LOW`，无提示音、无震动，`sticky: true`）。
   - 当用户开启「常驻通知栏实时电量」时，每次查询或后台巡检后更新同一 `identifier: 'ecust-ongoing-power'` 的通知内容：`{寝室名} · 剩余 {kwh} 度（预计可用 {days} 天）`。
3. **Android 电池优化白名单与测试通道**：
   - 提供 `openBatteryOptimizationSettings()`：通过 `Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS')` 并在失败时回退至 `Linking.openSettings()`，方便用户在国产 ROM 上一键开启无限制后台。
   - 提供 `sendTestNotification()`：一键触发真实通知弹窗以验证权限与系统通知栏状态。

---

## 3. 验证与测试方案
1. **单元测试与类型检查**：
   - 运行 `mobile` 端 `npm run typecheck` 确保 TypeScript 零错误。
   - 为 `mobile/src/utils/analytics.ts` 编写测试脚本验证分时桶分摊、充电跳变过滤、四时段占比与预测计算准确性。
   - 运行 `server` 端 `npm test` 确保现有后端测试 100% 通过。
2. **本地 Android 环境实机/模拟器构建与交互验证**：
   - 在本地 Android 环境编译并安装应用，验证首屏加载、寝室切换 Sheet、三视图图表切换与柱体点击检视、时段环图与 7×24 热力图渲染、测试通知弹窗及常驻通知栏卡片。
