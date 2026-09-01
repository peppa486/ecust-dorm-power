# 华理宿舍电量查询

面向华东理工大学学生的 Android 宿舍电量查询工具，提供奉贤、徐汇校区的楼栋和寝室电量查询。项目为非官方工具，与华东理工大学无隶属或授权关系。

查询网页：<https://power.ecust.cc>

## 当前功能

- Android App：查询、保存上次选择，并可设置“我的寝室”。
- 只有“我的寝室”显示趋势和低电量监控；普通查询不保存历史。
- 缩略图显示最近约 48 个采样点；详情图显示较长期历史，最多保留 14 天并可横向拖动。
- 横轴按真实采样时间，纵轴为剩余电量（度）；充值导致的明显上升用橙色标识。
- 用户可设置 5–40 度的低电量阈值，并开启 Android 本地通知。
- 服务端使用 HTTPS、限流、请求超时、数据校验和安全响应头；服务端保留已登记关注寝室的定时采样与微信旧链路。

## 目录

```text
mobile/       Android App（Android Studio 打开此目录下的 android/）
server/       Node.js API、定时采样和微信旧链路
miniprogram/  原微信小程序代码（保留作历史兼容）
deploy/       反向代理和部署示例
```

## Android App

在 Android Studio 中打开：`mobile/android/`。

```bash
cd mobile
npm ci
cd android
./gradlew assembleRelease
```

Windows 使用 `gradlew.bat assembleRelease`。已构建的安装包位于 [`mobile/releases/ecust-dorm-power-1.0.0-release.apk`](mobile/releases/ecust-dorm-power-1.0.0-release.apk)。App 内置 `https://power.ecust.cc`，release 包不依赖 Metro。

### 后台限制

Android 后台任务由系统和手机厂商调度，不能承诺精确每小时执行。应用被系统回收时通常可以恢复，但用户主动强行停止应用，或 Vivo 的自启动、后台活动和电池优化限制未放开时，系统可能暂停本地任务。需要在强行停止后仍稳定记录并远程通知时，还需配置 Android 推送服务（FCM/Expo Push）及服务端推送凭据；仅靠 App 本地通知无法绕过系统的强行停止策略。

## 服务端运行

需要 Node.js 20.17+（生产 Docker 使用 Node.js 22）：

```bash
cd server
cp .env.example .env
npm ci
npm test
npm start
```

API 默认监听 `8787`。生产部署：

```bash
cd server
docker compose up -d --build
```

容器端口仅绑定宿主机 `127.0.0.1:8787`，由 Nginx/Caddy 提供 HTTPS。`deploy/Caddyfile.example` 可直接作为反代模板。

服务端密钥只放在 `server/.env`，不要提交到 Git。普通查询不落历史；服务端只为已登记关注寝室采样，历史默认保留 14 天。

## 开发检查

```bash
cd mobile
npm run typecheck
npm audit --omit=dev

cd ../server
npm test
npm run check
npm audit --omit=dev
```

当前移动端和服务端依赖审计均为 0 vulnerabilities。移动端使用 npm override 固定已修复的 `uuid` 版本；不要使用会降级 Expo 的 `npm audit fix --force`。

楼栋 ID 与查询方式参考 `ECUSTCIC-CodeHub/ECUST-Electricity-Docker`。学校页面调整后，需同步更新 `server/src/buildings.js` 或 `server/src/power-parser.js`。
