# 华理宿舍电量查询 Android App

这是一个面向 Android 的 Expo React Native + TypeScript 应用，视觉沿用现有微信小程序的浅灰背景、白色圆角卡片、分段校区切换和电量状态色。

当前技术基线为 Expo SDK 57、React Native 0.86、React 19.2 和 TypeScript 6。

## 当前实现

- 奉贤 / 徐汇校区切换。
- 通过 `GET https://power.ecust.cc/api/buildings?campus=...` 加载楼栋。
- 输入寝室号后，通过 `POST https://power.ecust.cc/api/query` 查询电量。
- 使用 AsyncStorage 保存最近校区，以及奉贤、徐汇各自的楼栋和寝室选择；启动时恢复最近校区和对应选择，切换校区不会覆盖另一校区的选择。
- “我的寝室”仅对当前安装实例保存，只有它会显示趋势和监控卡片。
- 低电量阈值可由用户在 5–40 度之间设置；允许通知后，应用会通过 Android 本地通知提醒。
- 应用在后台由 Android 系统调度每小时监控任务，并将最近 14 天采样保存在本机；充值跳变以橙色点和线段标识。
- 点击趋势预览可打开详情图；详情图横向可拖动，横轴是采样时间，纵轴是剩余电量（度）。
- 覆盖启动恢复、楼栋加载、查询中的加载态、网络/服务端错误、空楼栋、空结果和电量结果卡片。

## 后台能力边界

Android 后台任务由系统和厂商电量策略调度，`minimumInterval` 不是精确闹钟。应用被系统回收时通常仍可恢复任务，但用户主动“强行停止”应用，或 Vivo 的自启动/后台活动/电池优化限制未放开时，系统可能暂停任务。真正要求在强行停止后仍稳定采样和远程推送，需要服务端移动设备身份、推送令牌登记以及 FCM/Expo Push 服务端凭据；当前服务器的定时轮询和微信订阅发送链路不等同于 Android App 的远程推送。

## 目录

```text
App.tsx
src/
  api/          HTTP 请求与响应校验
  components/   查询卡片、楼栋选择器、状态卡片、结果卡片
  screens/      查询页面状态编排
  storage/      AsyncStorage 偏好读写
  types/        API 与领域类型
  utils/        寝室号、电量状态和时间格式化
```

## 脚本

```bash
npm run start
npm run prebuild:android
npm run android
npm run typecheck
```

依赖已经安装。`npm run prebuild:android` 会生成可由 Android Studio 打开的 `android/` 原生工程；连接 Android 模拟器或真机后可运行 `npm run android`。

## 已完成验证

- `npx expo install --check`：依赖版本与 Expo SDK 57 对齐。
- `npm run typecheck`：通过。
- Android 生产 bundle：通过。
- 生产 API 健康检查和奉贤楼栋接口：通过。

`npm audit --omit=dev` 当前为 0 vulnerabilities。Expo 构建链使用 npm override 固定 `uuid@11.1.1`，没有执行会破坏 Expo 版本的 `npm audit fix --force`。
