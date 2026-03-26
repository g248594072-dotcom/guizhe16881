# 小手机壳（酒馆助手脚本）

在酒馆**主页面**挂载半透明遮罩与内嵌 iframe，加载独立部署的 React 小手机界面（`src/手机` 构建产物），并在 `window.parent` 上暴露 **`TavernPhone`** 供主界面前端或其它脚本调用。

## 构建产物

执行仓库根目录 `pnpm build` 后生成：

- `dist/小手机壳/index.js`

在酒馆助手中将该脚本加入角色卡/全局脚本并启用。

## 手机界面产物位置（仓库内）

在仓库根目录执行 **`pnpm build:phone`** 会：

1. 构建 `src/手机`（Vite）
2. 同步到 **`dist/手机/index.html`**（与 `dist/小手机壳` 等并列，便于一起部署）

本地调试 `phone_ui_url` 时，可用 Live Server 打开 **`dist/手机`** 目录，例如 `http://127.0.0.1:5500/index.html`（端口以实际为准）。

## 脚本变量

在本脚本的变量表中配置（`type: script`，对应当前脚本 ID）：

| 键 | 说明 |
|----|------|
| `phone_ui_url` | **必填**。手机界面 `index.html` 的完整 **HTTPS** URL（例如 GitHub Pages、Cloudflare Pages 部署后的地址）。 |

可选别名：`tavern_phone_ui_url`（与 `phone_ui_url` 二选一即可）。

## 全局 API（挂在酒馆页面）

在任意**子 iframe**（如规则主界面）中：

```ts
window.parent.TavernPhone?.toggle();
window.parent.TavernPhone?.open();
window.parent.TavernPhone?.close();
```

| 成员 | 说明 |
|------|------|
| `version` | 壳脚本版本字符串 |
| `isOpen` | 是否处于打开状态 |
| `open()` / `close()` / `toggle()` | 打开 / 关闭 / 切换 |
| `getIframeWindow()` | 手机内 iframe 的 `contentWindow`（高级用途） |

## 脚本工具栏

启用后会注册脚本按钮 **「小手机」**，用于手动打开/关闭（便于调试）。

## 与 `src/手机` 的协议

内嵌页面通过 `postMessage` 与壳通信，类型常量见 `src/手机/src/tavernPhoneBridge.ts`（如 `tavern-phone:request-close` 关闭浮层）。
