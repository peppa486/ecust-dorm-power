# 宿电

华东理工大学宿舍剩余电量微信小程序。

## 功能

- 奉贤、徐汇宿舍电量查询
- 设为“我的寝室”
- 每小时历史采样
- 24h 用量、日均用量、预计可用天数
- 低电量一次性订阅提醒
- 同寝室多人关注合并采样
- 10 分钟查询缓存

## 目录

```text
miniprogram/   微信小程序
server/        Node.js API
server/test/   单元测试
```

## 本地运行

Node.js 20.17+（生产 Docker 使用 Node.js 22）。

```bash
cd server
cp .env.example .env
npm install
npm test
npm run dev
```

API 默认监听 `8787`。

```bash
curl -X POST http://127.0.0.1:8787/api/query \
  -H 'Content-Type: application/json' \
  -d '{"campus":"奉贤","building":"5","room":"202"}'
```

微信开发者工具导入仓库根目录。`miniprogram/utils/config.js` 中的 `API_ENV` 用于切换环境：本地联调保留 `development`，发布前改为 `production`，并将 `API_BASES.production` 改成自己的 HTTPS API 域名。`project.config.json` 中的 `appid` 是占位值，发布前替换为小程序 AppID；AppSecret 只放在服务端 `.env`，不要提交到 Git。

## 微信配置

`server/.env`：

```env
WECHAT_APPID=
WECHAT_SECRET=
WECHAT_LOW_POWER_TEMPLATE_ID=
WECHAT_FIELD_ROOM=thing1
WECHAT_FIELD_POWER=number2
WECHAT_FIELD_POWER_TYPE=number
WECHAT_FIELD_TIP=thing3
```

订阅模板字段名和电量字段类型以微信公众平台实际模板为准。`WECHAT_FIELD_ROOM` 可选；两字段模板可以留空，服务端会把寝室位置和用户设置的动态阈值合并到提示字段。推荐把“当前电量”配置为 `number` 类型。

正式发布时把 `miniprogram/utils/config.js` 的 `API_ENV` 改为 `production`，在微信公众平台添加 HTTPS request 合法域名，并将开发者工具的 `urlCheck` 改为 `true`。

## 部署

```bash
cd server
cp .env.example .env
docker compose up -d --build
```

容器端口仅绑定宿主机 `127.0.0.1:8787`，由 Nginx/Caddy 提供 HTTPS。`deploy/Caddyfile.example` 可直接作为反代模板。

## 数据

普通查询不落历史。只有“我的寝室”会采样；最后一个关注者取消后，该寝室历史删除。历史默认最多保留 14 天。

## 数据源

楼栋 ID 与查询方式参考 `ECUSTCIC-CodeHub/ECUST-Electricity-Docker`。学校页面调整后，需同步更新 `server/src/buildings.js` 或 `server/src/power-parser.js`。

本项目为非官方工具，与华东理工大学无隶属或授权关系。
