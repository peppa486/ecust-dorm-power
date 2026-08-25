# 验收记录

## 已验证

- 37 个 Node 单元测试通过
- `node scripts/check-miniprogram.mjs` 通过，完成小程序 JS、JSON、WXML 与发布配置静态检查
- 服务端与小程序 JavaScript 语法检查通过
- Windows 与 CI 都可执行 `npm run check`
- `npm run smoke` 启动服务并通过 `/health`
- JSON 配置解析通过
- WXML 结构检查通过
- Docker Compose / GitHub Actions YAML 解析通过
- SQLite upsert、提醒状态、会话过期与历史清理 SQL smoke test 通过
- 奉贤 5 号楼映射为 `areaid=2, buildid=27`
- 徐汇南区 4A 映射为 `areaid=3, buildid=68`
- 电量解析覆盖真实负数、带“剩余电量”标签、无单位值、错误页面、多个数字干扰
- 充值跳变不会计入耗电，异常高耗电率不会进入统计
- 查询缓存有容量上限，同寝室并发查询合并为一次学校请求
- 学校请求有全局并发上限
- 同寝室多人关注合并采样
- 最后一个关注者取消后清理该寝室历史
- Session 30 天过期并定时清理
- 历史数据默认 14 天清理
- 微信 access_token 缓存、并发刷新和失效重试
- `43101` 清空不可用订阅次数，`47003` 保留次数并记录配置错误
- 定时采样防重入，订阅模板字段必须由环境变量提供
- 生产错误响应不返回内部 stack，学校超时、网络和不可识别页面有明确分类
- `npm audit --omit=dev --audit-level=high` 无漏洞

## 外部依赖

- 学校查询地址与楼栋映射已和公开的 ECUST 电量监控项目核对
- 实际请求奉贤 5 号楼 202 室得到 `剩余电量 -18.8度`
- 实际请求徐汇南区 4A/101 得到学校异常页，未误报电量
- 真机登录、模板字段和消息送达需使用实际 AppID、AppSecret、模板 ID 验收
- 已在当前环境完成依赖安装、测试、语法检查和服务启动 smoke；Docker Compose YAML 已静态解析，但本机 Docker daemon 未运行，镜像构建需在目标服务器或可用 Docker 环境执行
