/**
 * 与 watch-all.mjs 相同，但 Webpack 仅打包「规则 + 小手机壳」（通过 TAVERN_HELPER_WEBPACK_ENTRIES=rules-shell）。
 * src/手机 仍由 watch:phone（Vite）单独构建。
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const webpackEnv = {
  ...process.env,
  TAVERN_HELPER_WEBPACK_ENTRIES: 'rules-shell',
};

const children = [];

function run(npmScript, env = process.env) {
  const child = spawn('pnpm', ['run', npmScript], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env,
  });
  children.push(child);
  return child;
}

run('watch:webpack', webpackEnv);
run('watch:phone');

function shutdown() {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
}

['SIGINT', 'SIGTERM'].forEach(sig => {
  process.on(sig, () => {
    shutdown();
    process.exit(0);
  });
});
