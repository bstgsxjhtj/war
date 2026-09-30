import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', '..', '..', 'src');

function scanJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...scanJsFiles(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

function offendersIn(layerDir, re) {
  return scanJsFiles(layerDir)
    .filter((f) => re.test(readFileSync(f, 'utf8')))
    .map((f) => f.replace(SRC + sep, '').replace(/\\/g, '/'));
}

const APP_IMPORT_RE = /(?:from|import)\s+['"][^'"]*\/app\/[^'"]*['"]/;

describe('KeyBindings 分层架构约束（P1-2：下沉 core/input）', () => {
  it('源文件位于 core/input/KeyBindings.js', () => {
    expect(existsSync(join(SRC, 'core', 'input', 'KeyBindings.js'))).toBe(true);
  });

  it('旧路径 app/KeyBindings.js 已移除（避免双份漂移）', () => {
    expect(existsSync(join(SRC, 'app', 'KeyBindings.js'))).toBe(false);
  });

  it('gameplay 层不反向依赖 app/', () => {
    expect(offendersIn(join(SRC, 'gameplay'), APP_IMPORT_RE)).toEqual([]);
  });

  it('ui 层不反向依赖 app/', () => {
    expect(offendersIn(join(SRC, 'ui'), APP_IMPORT_RE)).toEqual([]);
  });
});

// 成员访问（UIStack.push 等）；先剔除 import 语句，避免模块路径 'UIStack.js' 被误判为使用
const UI_STACK_USE_RE = /UIStack\s*\./;
const UI_STACK_IMPORT_RE = /import\s*\{[^}]*\bUIStack\b[^}]*\}\s*from\s*['"][^'"]*UIStack\.js['"]/;
const stripImports = (src) => src.replace(/import\b[^;]*;/g, '');

describe('UIStack 显式导入约束（防止面板 show/hide 抛 ReferenceError）', () => {
  it('凡引用 UIStack 的文件都必须导入它', () => {
    const offenders = scanJsFiles(SRC)
      .filter((f) => !f.endsWith(join('ui', 'UIStack.js')))
      .filter((f) => {
        const src = readFileSync(f, 'utf8');
        return UI_STACK_USE_RE.test(stripImports(src)) && !UI_STACK_IMPORT_RE.test(src);
      })
      .map((f) => f.replace(SRC + sep, '').replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });
});
