# Android 版本更新

App 会在启动和回到前台时检查版本，也会登记通知 Token。服务端保存最新版本信息；发布新 APK 后，已允许通知的设备会收到更新提醒。

## 发布顺序

1. 修改 `mobile/app.json` 中的 `version` 和 `android.versionCode`，重新构建生产 APK。
2. 创建 GitHub Release，并把 APK 上传为 Release 资产。
3. 用 Release 资产的直链发布版本信息并发送通知：

```powershell
$env:MOBILE_UPDATE_API_URL = "https://power.ecust.cc"
$env:MOBILE_UPDATE_ADMIN_TOKEN = "<服务端配置的令牌>"
$env:UPDATE_VERSION = "1.2.0"
$env:UPDATE_VERSION_CODE = "3"
$env:UPDATE_DOWNLOAD_URL = "https://github.com/peppa486/ecust-dorm-power/releases/download/v1.2.0/ecust-dorm-power-1.2.0-release.apk"
$env:UPDATE_RELEASE_NOTES = "加入版本更新提醒。"
$env:UPDATE_SHA256 = "<APK 的 SHA-256>"
npm run notify:update --prefix server
```

服务端只接受 HTTPS 下载地址。管理员令牌只放在服务器环境变量或本机临时环境变量中，不要提交到仓库。

## App 内更新行为

通知点击后会打开 APK 下载地址；启动检查是通知之外的兜底。Android 仍会要求用户确认安装，不能静默替用户安装 APK。原生代码、通知配置或权限变化必须重新构建 APK；只改 JavaScript 页面时才适合使用 EAS Update。
