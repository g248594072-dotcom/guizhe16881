# 小手机 UI（Vite + React）

独立构建的手机桌面界面，由 **`src/小手机壳`** 脚本以 iframe 加载；勿与酒馆模板根目录的 `pnpm build` 混为同一产物。

## 本地开发

```bash
cd src/手机
npm install
npm run dev
```

浏览器访问开发服务器地址；单独打开时无壳层，仅用于调试 UI。

## 生产构建与部署

**与仓库根目录统一：**

- 先在 `src/手机` 安装依赖一次（`npm install`）。
- 在**仓库根目录**执行 **`pnpm build`** 会依次：**webpack**（更新 `dist/规则` 等）→ **`build:phone`**（构建并同步 **`dist/手机`**）。  
  若只想打 webpack、不构建手机，用：**`pnpm run build:webpack`**。  
  若只构建手机：**`pnpm build:phone`**。

**调试（F5）时：** `.vscode` 里「开始任务」会并行启动 **`pnpm watch`**（webpack）与 **`pnpm run watch:phone`**（`vite build --watch`，产物在 **`src/手机/dist`**）。  
若 `phone_ui_url` 指向 **`dist/手机`**，保存后需再执行一次 **`pnpm build:phone`** 同步，或开发时把静态服务根目录指到 **`src/手机/dist`**。

**仅构建在子目录：**

```bash
cd src/手机
pnpm install
pnpm run build
```

产物在 **`src/手机/dist/`**。

默认 `base` 为 `./`，便于静态托管子路径。将 **`dist/手机`**（或 `src/手机/dist`）整目录部署到 HTTPS，在酒馆 **`src/小手机壳`** 脚本变量 **`phone_ui_url`** 中填写 **`index.html`** 的完整地址。

## 与壳脚本通信

见 `src/tavernPhoneBridge.ts`：可向父页面发送 `tavern-phone:request-close` 以关闭整个小手机浮层（壳脚本处理）。
