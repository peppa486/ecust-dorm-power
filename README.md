# 华理宿舍电量查询

一个非官方的 Android 工具，用来查询华东理工大学宿舍剩余电量和用电趋势。

## 功能

- 支持奉贤、徐汇两个校区。
- 查询楼栋和寝室的当前剩余电量。
- 记住上次选择的校区、楼栋和寝室。
- 将自己的寝室设为“我的寝室”，查看用电趋势。
- 趋势图支持查看较长时间的历史记录，并标记充值导致的电量上升。
- 自定义低电量阈值，低于阈值时接收提醒。
- 有新版本时接收更新提醒。
- 设置“我的寝室”后，即使 App 不在后台，服务器也会继续定时记录电量。

## 使用

1. 选择校区和楼栋，输入寝室号，点击“查询”。
2. 在查询结果中点击“设为我的寝室”，开启趋势记录。
3. 在低电量提醒中设置阈值并开启通知。

首次开启提醒时，请允许 App 发送通知。

## 下载

[查看最新版 Release](https://github.com/peppa486/ecust-dorm-power/releases/latest)

当前最新版为 [v1.2.1](https://github.com/peppa486/ecust-dorm-power/releases/tag/v1.2.1)：

- [arm64-v8a（推荐，适合大多数新手机）](https://github.com/peppa486/ecust-dorm-power/releases/download/v1.2.1/ecust-dorm-power-1.2.1-arm64-v8a.apk)
- [armeabi-v7a（适合较老的 32 位手机）](https://github.com/peppa486/ecust-dorm-power/releases/download/v1.2.1/ecust-dorm-power-1.2.1-armeabi-v7a.apk)

两个安装包功能一致，只需选择一个安装。目前仅提供 Android 版本。

## 说明

普通查询不会保存为历史记录；只有设置“我的寝室”后，才会持续记录趋势。项目与华东理工大学没有隶属或授权关系，仅供个人使用。
