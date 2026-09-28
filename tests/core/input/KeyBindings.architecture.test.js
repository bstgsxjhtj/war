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
