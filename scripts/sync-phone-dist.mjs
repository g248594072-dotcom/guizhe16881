/**
 * 将 src/手机 (Vite) 构建产物复制到 dist/手机，便于与 webpack 产物一起部署或填写 phone_ui_url。
 */
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src', '手机', 'dist');
const dest = path.join(root, 'dist', '手机');
const indexHtml = path.join(src, 'index.html');

if (!fs.existsSync(indexHtml)) {
  console.error('[sync-phone-dist] 未找到 src/手机/dist/index.html，请先执行: pnpm build:phone:vite');
  process.exit(1);
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}
fs.mkdirSync(path.dirname(dest), { recursive: true });

if (os.platform() === 'win32') {
  execSync(`xcopy /E /I /Y "${src}" "${dest}\\"`, { stdio: 'inherit', shell: true });
} else {
  fs.mkdirSync(dest, { recursive: true });
  execSync(`cp -R "${src}/." "${dest}/"`, { stdio: 'inherit' });
}

console.info('[sync-phone-dist] 已输出: dist/手机/index.html');
