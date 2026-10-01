// 截图模式 / 屏幕快照系统：独立于 gameplay 与渲染器实现，仅通过 DOM 操作完成 WebGL Canvas 的 PNG 下载。
// 默认 F12 触发；capture() 调用 canvas.toDataURL 生成图片，构造临时 <a download> 触发浏览器下载，
// 文件名格式 screenshot_YYYYMMDD_HHmmss.png；捕获成功后回调 onCapture?.(filename) 并经可选 bus 发出 'aux.screenshot' 事件。
// WebGL 上下文若未开启 preserveDrawingBuffer 可能得到空白帧，此处通过与同尺寸空白画布基线比较检测并打印警告，不阻断下载。
// 不依赖任何外部模块（无 import），纯 DOM 实现；bus 通过 setBus(bus) 可选注入，canvas 通过 setCanvas 更新。

const FLASH_MS = 200;
const SCREENSHOT_EVENT = 'aux.screenshot';

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function buildTimestamp(d) {
  return ''
    + d.getFullYear()
    + pad2(d.getMonth() + 1)
    + pad2(d.getDate())
    + '_'
    + pad2(d.getHours())
    + pad2(d.getMinutes())
    + pad2(d.getSeconds());
}

// 以同尺寸空白画布的 toDataURL 作为"空白帧"基线：若捕获结果与之完全一致，
// 说明 WebGL 绘制缓冲未被保留（preserveDrawingBuffer:false 且非渲染后立即调用）。
function blankDataURL(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c.toDataURL('image/png');
}

export class ScreenshotMode {
  constructor(opts = {}) {
    this.toggleKey = opts.toggleKey ?? 'F12';
    this._canvas = opts.canvas ?? null;
    this._bus = null;
    this.onCapture = null;

    this._boundKey = (e) => this._onKey(e);
    document.addEventListener('keydown', this._boundKey);
  }

  _onKey(e) {
    // 同时兼容 e.key（如 'F12'）与 e.code（如 'KeyG'），便于按键配置
    if (e.key === this.toggleKey || e.code === this.toggleKey) {
      e.preventDefault();
      this.capture();
    }
  }

  setBus(bus) {
    this._bus = bus || null;
  }

  setCanvas(canvas) {
    this._canvas = canvas || null;
  }

  capture() {
    if (!this._canvas) {
      console.warn('[ScreenshotMode] 无可用 canvas，跳过截图');
      return null;
    }
    const canvas = this._canvas;
    const width = canvas.width;
    const height = canvas.height;

    let dataURL;
    try {
      dataURL = canvas.toDataURL('image/png');
    } catch (err) {
      console.warn('[ScreenshotMode] toDataURL 调用失败：', err);
      return null;
    }

    if (!dataURL || dataURL === 'data:,') {
      console.warn('[ScreenshotMode] toDataURL 返回空数据，可能是 WebGL 绘制缓冲已被清除');
      return null;
    }

    if (width && height) {
      try {
        const base = blankDataURL(width, height);
        if (base === dataURL) {
          console.warn('[ScreenshotMode] 检测到空白图像：WebGL 上下文可能未设置 preserveDrawingBuffer:true，建议在 render 之后立即截图');
        }
      } catch (_) {
        // 基线比较失败时不影响下载流程
      }
    }

    const filename = 'screenshot_' + buildTimestamp(new Date()) + '.png';

    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    if (link.parentNode) link.parentNode.removeChild(link);

    this._flash();

    if (typeof this.onCapture === 'function') {
      try {
        this.onCapture(filename);
      } catch (_) {
        // 回调异常不影响主流程
      }
    }
    if (this._bus && typeof this._bus.emit === 'function') {
      try {
        this._bus.emit(SCREENSHOT_EVENT, { filename });
      } catch (_) {
        // bus 异常不影响主流程
      }
    }

    return filename;
  }

  _flash() {
    const flash = document.createElement('div');
    Object.assign(flash.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      background: '#ffffff',
      opacity: '0.8',
      zIndex: '9999',
      pointerEvents: 'none',
      transition: 'opacity ' + FLASH_MS + 'ms ease-out'
    });
    document.body.appendChild(flash);

    // 下一帧淡出，模拟相机快门；若无 rAF（如老环境）退化为 setTimeout
    const raf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 16);
    raf(() => { flash.style.opacity = '0'; });

    setTimeout(() => {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
    }, FLASH_MS + 60);
  }

  destroy() {
    document.removeEventListener('keydown', this._boundKey);
    this._canvas = null;
    this._bus = null;
    this.onCapture = null;
  }
}
