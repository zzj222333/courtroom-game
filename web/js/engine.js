// ==================== 图片引擎 ====================
// 负责：加载、缓存、scaled 缩放、淡入淡出绘制

/** @type {Map<string, HTMLImageElement>} */
const imageCache = new Map();

/** 预加载图片列表（主要图片优先） */
function preloadImages(urls) {
  let loaded = 0, total = urls.length;
  return Promise.all(urls.map(url => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imageCache.set(url, img);
        loaded++;
        updateDebug(`加载图片: ${loaded}/${total}`);
        resolve();
      };
      img.onerror = () => {
        console.warn(`[Engine] 图片加载失败: ${url}`);
        resolve(); // 不阻塞流程
      };
      img.src = `${BASE_PATH}/${url}`;
    });
  }));
}

/** 获取已缓存的图片 */
function getImage(filename) {
  return imageCache.get(filename) || null;
}

/** 在 Canvas 上绘制缩放后的图片（等价于 pygame smoothscale + blit） */
function drawImageScaled(filename, x, y, w, h, alpha = 1) {
  const img = getImage(filename);
  if (!img) return;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x, y, w, h);
  ctx.globalAlpha = prevAlpha;
}

/** 按高度缩放绘制（等价于 pygame load_img） */
function drawImageByHeight(filename, x, y, targetH, alpha = 1) {
  const img = getImage(filename);
  if (!img) return;
  const scale = targetH / img.naturalHeight;
  const targetW = img.naturalWidth * scale;
  drawImageScaled(filename, x, y, targetW, targetH, alpha);
}

/** 淡入过渡参数 */
let fadeAlpha = 0;
let fadePhase = null; // 'in' | 'out' | null
let fadeTimer = 0;
let fadeCallback = null;

function startFadeTransition(callback) {
  fadePhase = 'out';
  fadeTimer = 0.5; // 黑屏时长
  fadeCallback = callback;
}

function updateFade(dt) {
  if (!fadePhase) return;
  if (fadePhase === 'in') {
    fadeAlpha = Math.max(0, fadeAlpha - dt / 0.4); // 淡入 0.4s
    if (fadeAlpha <= 0) { fadePhase = null; fadeAlpha = 0; }
  } else if (fadePhase === 'out') {
    fadeAlpha = Math.min(1, fadeAlpha + dt / 0.4); // 淡出 0.4s
    if (fadeAlpha >= 1) {
      fadeTimer -= dt;
      if (fadeTimer <= 0 && fadeCallback) {
        fadeCallback();
        fadeCallback = null;
        fadePhase = 'in';
        fadeTimer = 0;
      }
    }
  }
}

function drawFadeOverlay() {
  if (!gameState) return;
  const fa = gameState.fadeAlpha;
  if (fa <= 0) return;

  // 黑幕
  ctx.fillStyle = `rgba(0,0,0,${fa / 255})`;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // 转场文字（hold_black 阶段显示）
  if (gameState.sceneLabelText && gameState.fadePhase === 'hold_black') {
    const t = gameState.fadeTimer;
    const textFade = 0.45;  // SCENE_LABEL_FADE_TIME
    const holdDur = gameState._FADE_HOLD_TIME;
    let labelAlpha;
    if (holdDur > textFade * 2) {
      if (t < textFade) {
        labelAlpha = 255 * (t / textFade);
      } else if (t > holdDur - textFade) {
        labelAlpha = 255 * (1 - (t - (holdDur - textFade)) / textFade);
      } else {
        labelAlpha = 255;
      }
    } else {
      labelAlpha = 255;
    }
    labelAlpha = Math.max(0, Math.min(255, labelAlpha));
    if (labelAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = labelAlpha / 255;
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${40 * UI_SCALE}px "Source Han Sans SC", "Microsoft YaHei", "SimHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gameState.sceneLabelText, DESIGN_W / 2, DESIGN_H / 2);
      ctx.restore();
    }
  }
}
