# Tavern Workshop Server

创意工坊后端服务器，为酒馆助手提供云端内容分享功能。

## 功能

- Discord OAuth 登录
- 内容上传（规则、角色、场景、开局场景、完整预设）
- 内容审核（管理员）
- 内容浏览和下载
- PostgreSQL 数据持久化

## 部署到 Render（推荐）

### 1. 创建 Discord 应用

1. 访问 https://discord.com/developers/applications
2. 点击 "New Application"，填写名称
3. 进入 OAuth2 -> General
4. 添加 Redirect URI: `https://你的域名/callback`
5. 记下 Client ID 和 Client Secret

### 2. 部署步骤

```bash
# 1. 创建 GitHub 仓库并推送代码
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/tavern-workshop.git
git push -u origin main

# 2. 在 Render 上创建服务
# - 登录 https://render.com
# - New -> Web Service -> 连接 GitHub 仓库
# - Render 会自动读取 render.yaml 配置

# 3. 创建 PostgreSQL 数据库
# - 在 Render Dashboard 点击 New -> PostgreSQL
# - 选择 Free Plan
# - 数据库会自动连接到 Web Service

# 4. 设置环境变量
# 在 Render Dashboard -> 你的 Web Service -> Environment
# 添加以下变量：
# - DISCORD_CLIENT_ID: 你的 Discord 应用 Client ID
# - DISCORD_CLIENT_SECRET: 你的 Discord 应用 Client Secret
# - ADMIN_DISCORD_ID: 你的 Discord 用户 ID（作为管理员）
```

### 3. 获取 Discord 用户 ID

1. 在 Discord 中开启开发者模式：
   - 设置 -> 高级 -> 开发者模式（开启）
2. 右键点击自己的用户名 -> 复制用户 ID

### 4. 更新前端配置

在 `src/规则/utils/workshopApi.ts` 中更新 API 地址：

```typescript
const API_BASE_URL = 'https://你的-render-域名.onrender.com';
```

## API 文档

### 认证

- `GET /auth/discord` - 跳转到 Discord 登录
- `GET /callback` - Discord 回调（自动处理）
- `POST /auth/exchange` - 换取用户信息

### 内容管理

- `GET /api/items?type={type}&status=approved` - 获取已审核内容
- `POST /api/upload` - 上传内容（需登录）
- `POST /api/download/:id` - 下载内容

### 管理员

- `GET /api/pending` - 获取待审核列表（需管理员权限）
- `POST /api/review` - 审核内容（需管理员权限）
- `GET /api/my-uploads` - 获取我的上传列表

## 数据模型

### WorkshopItem

```typescript
{
  id: string;           // 唯一ID: {author_id}_{timestamp}
  type: string;         // rule | character | scene | openingScene | preset
  content: object;      // 内容数据
  author_id: string;    // Discord 用户ID
  author_name: string;  // Discord 用户名
  author_avatar: string; // Discord 头像hash
  status: string;       // pending | approved | rejected
  reject_reason: string; // 拒绝原因（可选）
  created_at: number;   // 创建时间戳
  downloads: number;    // 下载次数
}
```

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 设置环境变量
cp .env.example .env
# 编辑 .env 填入你的 Discord 应用信息

# 3. 启动开发服务器
npm run dev
```

## 免费额度

Render 免费版：
- Web Service: 512MB RAM，永不休眠
- PostgreSQL: 1GB 存储
- 足够支持几十人同时使用
