# Rule Workshop API (Cloudflare Worker)

后端 API：Discord OAuth、内容 CRUD、审核、搜索；KV 存储元数据与索引。

## 前置条件

- [Cloudflare](https://dash.cloudflare.com) 账号、`wrangler` CLI 已登录
- [Discord Application](https://discord.com/developers/applications)：`OAuth2` → Redirects **必须**与 Worker 代码一致，例如本仓库当前 Worker：

  `https://raspy-fire-7d20.g248594072.workers.dev/api/auth/callback`

  （不能使用 `/callback`，必须是 **`/api/auth/callback`**。）

## 本地配置

1. 在 `wrangler.toml` 将 `[[kv_namespaces]].id` 换成你在 Cloudflare 里 KV 命名空间 **guizhe** 的 **Namespace ID**（UUID）。获取方式：

   - Dashboard → **Workers KV** → 点命名空间 **guizhe** → 复制 ID；或  
   - 本机已 `wrangler login` 后执行：`npx wrangler kv namespace list`

2. 在 `wrangler.toml` 的 `[vars]` 中填写：

   - `DISCORD_CLIENT_ID` — Discord Application → OAuth2 → Client ID  
   - `DISCORD_GUILD_ID` — 要求用户加入的服务器 ID（留空则跳过成员校验，`inGuild` 恒为 true）  
   - `ADMIN_DISCORD_IDS` — 管理员 Discord 用户 ID，逗号分隔  

3. 机密（勿提交到 Git）：

   ```bash
   npx wrangler secret put DISCORD_CLIENT_SECRET
   npx wrangler secret put JWT_SECRET
   ```

   `JWT_SECRET` 建议 32+ 字符随机串。

## 脚本命令

```bash
npm install
npm run typecheck
npm run dev      # wrangler dev
npm run deploy   # wrangler deploy
```

## HTTP 接口摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/auth/discord?redirect=<key>` | 跳转 Discord 登录 |
| GET | `/api/auth/callback` | OAuth 回调（Discord 配置） |
| GET | `/api/auth/poll?key=<key>` | 轮询登录结果 `{ token, user }` |
| GET | `/api/content/list?type=&page=&sort=&status=` | 列表 |
| GET | `/api/content/get/:type/:id` | 详情（非 approved 需作者或管理员） |
| GET | `/api/content/search?q=&type=` | 搜索 |
| POST | `/api/content/create` | 创建（需 Bearer；需加入 Guild） |
| PUT | `/api/content/update/:id` | 更新 |
| DELETE | `/api/content/delete/:id` | 删除 |
| POST | `/api/content/download/:id` | 下载计数 +1 |
| GET | `/api/stats` | 各类型已通过数量 |
| GET | `/api/user/me` | 当前 JWT 用户信息 |
| GET | `/api/admin/pending` | 待审核（管理员） |
| POST | `/api/admin/review/:id` | body: `{ "action": "approve" \| "reject" }` |
| GET | `/api/admin/list-all` | 分页筛选全部内容 |
| GET/PUT/DELETE | `/api/admin/detail|edit|delete/:type/:id` | 管理详情/编辑/删除 |
| POST | `/api/admin/ban/:userId` / `unban/:userId` | 封禁 / 解封 |

`Authorization: Bearer <jwt>` 用于需登录接口。

## 内容类型 `type`

`world-rule` | `regional-rule` | `personal-rule` | `region` | `building` | `character` | `sticker`

与前端 MVU / 工坊脚本约定一致即可。
