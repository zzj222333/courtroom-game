// ==================== 版本号 ====================
// 格式: v{主版本}.{资源版本} — 主版本任何改动递增，资源版本由用户指示递增
// 例: v146.078 = 代码改动, v146.078.001 = 同时更新了资源图片
const GAME_VERSION = 'v146.221';
const RESOURCE_VERSION = '008'; // 资源版本号，每次资源更新时递增

// ==================== 资源路径配置 ====================
const BASE_PATH = '..';

// 设计分辨率（与 Pygame 版一致）
const DESIGN_W = 1920;
const DESIGN_H = 1080;
const TARGET_ASPECT = 16 / 9;

// ── 事件播放讯息框宽度 ──
// 原值 1125（= DIALOG_WIDTH），移动端拓宽 20% 至 1350
// 调整：改此数值即可全局生效，不影响普通对话对话框
const EVENT_DIALOG_WIDTH = 1350;

// ── 移动端 UI 缩放乘数（PC=1.0 不变，移动端文字/按钮放大） ──
const _IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  || ('ontouchstart' in window && window.innerWidth < 1024);

// ── 移动端可视化调试日志（显示在屏幕上方，当前已禁用） ──
const _dbgLines = [];
function dbgPush(msg) {
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  _dbgLines.push(`${t} ${msg}`);
  if (_dbgLines.length > 12) _dbgLines.shift();
}
/* 启用屏幕debug：取消下面注释即可
function drawDebugOverlay() {
  if (!_dbgLines.length) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(10, 120, 700, _dbgLines.length * 28 + 38);
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < _dbgLines.length; i++) {
    ctx.fillStyle = i === _dbgLines.length - 1 ? '#ff0' : '#0f0';
    ctx.fillText(_dbgLines[i], 16, 126 + i * 28);
  }
  ctx.restore();
}
*/

// ── 移动端全局防连击保护 ──
// 统一覆盖所有交互入口：DOM 按钮(touchstart)、Canvas 按钮(touchend/click)、调查模式
const MOBILE_GUARD_MS = 200;
let _mobileGuardUntil = 0;
function isMobileGuardActive() { return _IS_MOBILE && Date.now() < _mobileGuardUntil; }
function activateMobileGuard(ms) { _mobileGuardUntil = Date.now() + (ms || MOBILE_GUARD_MS); }
const UI_SCALE = _IS_MOBILE ? 1.35 : 1.0;

// ==================== 全局状态引用 ====================
let scenarioData = null;
let charactersData = null;
let gameState = null;

// ==================== DOM 元素 ====================
const loadingScreen = document.getElementById('loading-screen');
const loadingBarFill = document.getElementById('loading-bar-fill');
const loadingPercent = document.getElementById('loading-percent');
const loadingDetail = document.getElementById('loading-detail');
const gameContainer = document.getElementById('game-container');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui-layer');
const debugPanel = document.getElementById('debug-panel');

// ==================== 触摸检测 ====================
let isTouchDevice = false;
window.addEventListener('touchstart', () => { isTouchDevice = true; }, { once: true });

// ==================== Loading 进度 ====================
function setLoadingProgress(percent, detail) {
  loadingBarFill.style.width = percent + '%';
  loadingPercent.textContent = Math.round(percent) + '%';
  if (detail) loadingDetail.textContent = detail;
}

// ==================== 数据加载 ====================

async function loadJSON(filename) {
  // 用 Date.now() 时间戳：每次启动都强制从网络取最新 JSON（用户经常迭代 scenario.json，
  // 避免被 iOS Safari HTTP 缓存或 PC Service Worker 旧条目拦截）。文件不大，可接受。
  const resp = await fetch(`${BASE_PATH}/${filename}?v=${Date.now()}`);
  if (!resp.ok) throw new Error(`${filename}: HTTP ${resp.status}`);
  return resp.json();
}

async function loadData() {
  setLoadingProgress(0, '加载数据文件...');
  const [scenario, characters] = await Promise.all([
    loadJSON('scenario.json'),
    loadJSON('characters.json')
  ]);
  scenarioData = scenario;
  charactersData = characters;
  setLoadingProgress(5, `数据加载完成 (${Object.keys(scenario.nodes).length} 节点)`);
}

// ==================== 图片预加载 ====================

async function loadAllImages() {
  const resp = await fetch('pnglist.json');
  const pngList = await resp.json();
  const total = pngList.length;
  setLoadingProgress(5, `准备加载 ${total} 张图片...`);

  const BATCH = 10;
  let loaded = 0, failed = 0;

  for (let i = 0; i < total; i += BATCH) {
    const batch = pngList.slice(i, i + BATCH);
    await Promise.all(batch.map(name => new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        imageCache.set(name, img);
        loaded++;
        updateLoadingProgress(loaded, failed, total, name);
        resolve();
      };
      img.onerror = () => {
        failed++;
        console.warn(`[Load] 失败: ${name}`);
        loaded++;
        updateLoadingProgress(loaded, failed, total, name);
        resolve();
      };
      img.src = `${BASE_PATH}/${name}?v=${RESOURCE_VERSION}`;
    })));
  }
  setLoadingProgress(100, `图片加载完成 (${total - failed}/${total})`);
}

function updateLoadingProgress(loaded, failed, total, currentName) {
  const percent = 5 + (loaded / total) * 93;
  setLoadingProgress(percent, currentName);
}

// ==================== Canvas 缩放 ====================

function resizeCanvas() {
  // 用 window.innerWidth/Height 代替 container.clientWidth，PWA 中更可靠
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const aspect = cw / ch;
  let renderW, renderH;
  if (aspect > TARGET_ASPECT) {
    renderH = ch;
    renderW = renderH * TARGET_ASPECT;
  } else {
    renderW = cw;
    renderH = renderW / TARGET_ASPECT;
  }
  canvas.width = DESIGN_W;
  canvas.height = DESIGN_H;
  canvas.style.width = renderW + 'px';
  canvas.style.height = renderH + 'px';
  uiLayer.style.width = renderW + 'px';
  uiLayer.style.height = renderH + 'px';

  // 对话框随缩放更新
  rebuildDialogElements();
  if (gameState && (gameState.mode === 'dialogue' || gameState.mode === 'confrontation' || gameState.mode === 'choice_dialogue') && gameState.fullText) {
    const visible = gameState.fullText.substring(0, Math.floor(gameState.typingIndex));
    showDialogBox(gameState.getDisplayName(gameState.displaySpeaker), visible);
  }
  // 菜单模式下强制重绘以更新按钮位置
  if (gameState && gameState.mode === 'menu') {
    _menuNeedsRedraw = true;
  }
}

let _resizeTimer = 0;
function onResize() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    resizeCanvas();
  }, 100);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => {
  // iOS PWA 旋转时 resize 可能不触发，orientationchange 后强制 resize
  setTimeout(resizeCanvas, 50);
  setTimeout(resizeCanvas, 300);
});

// ==================== 血量图标（案情审理阶段） ====================

const BLOOD_ICON_CX = 160;        // 第一个图标中心 X
const BLOOD_ICON_CY = 59;         // 中心 Y
const BLOOD_ICON_WIDTH = 70;      // 每个图标显示宽度
const BLOOD_ICON_GAP = -30;       // 间距（负值=重叠），实际中心距=40px

function drawBloodIcons() {
  if (!gameState) return;
  const gs = gameState;
  const blood = gs.blood || 0;
  if (blood <= 0) return;

  const img = getImage('UI_button_Blood.png');
  if (!img) return;

  // 移动端按 UI_SCALE 放大（与 Python 一致的图标尺寸）
  const iconW = Math.round(BLOOD_ICON_WIDTH * UI_SCALE);
  const aspect = img.naturalHeight / img.naturalWidth;
  const iconH = Math.round(iconW * aspect);
  const cx0 = Math.round(BLOOD_ICON_CX * UI_SCALE);
  const cy = Math.round(BLOOD_ICON_CY * UI_SCALE);
  const gap = Math.round(BLOOD_ICON_GAP * UI_SCALE);

  for (let i = 0; i < blood; i++) {
    const cx = cx0 + i * (iconW + gap);
    const isDeducting = gs.bloodDeductAnimActive && i === blood - 1;

    if (isDeducting) {
      const scale = gs.bloodDeductAnimScale;
      const alpha = gs.bloodDeductAnimAlpha;
      const w = Math.max(1, Math.round(iconW * scale));
      const h = Math.max(1, Math.round(iconH * scale));
      ctx.save();
      ctx.globalAlpha = alpha / 255;
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, cx - iconW / 2, cy - iconH / 2, iconW, iconH);
    }
  }
}

// ==================== 背景绘制 ====================

let currentBg = null;

// 背景全局替换表（与 Python text_adventure.py 的 bg_triggers 对齐）
const BG_TRIGGERS = {
  'scene_prologue_03_wt_confront_done': ['bg_scene00_003.png', 'bg_scene00_003_2.png']
};

function setBackground(filename) {
  if (currentBg === filename) return;
  currentBg = filename;
}

/** 检查 bg_triggers，当指定 flag 为 true 时设置背景覆盖（与 Python set_bg_override 一致） */
function applyBgTriggers(flags) {
  for (const [flagKey, [oldBg, newBg]] of Object.entries(BG_TRIGGERS)) {
    if (flags[flagKey]) {
      // 持久化到 gameState.bgOverrides，确保后续 enterNode 也生效
      if (typeof gameState !== 'undefined') gameState.bgOverrides[oldBg] = newBg;
      // 如果当前背景是 oldBg，立即切换
      if (currentBg === oldBg) {
        console.log(`[BG] bg_trigger: ${oldBg} → ${newBg} (flag: ${flagKey})`);
        setBackground(newBg);
        gameState.currentBgName = newBg;
      }
    }
  }
}

function drawBackground() {
  if (!currentBg) return;
  const img = getImage(currentBg);
  if (!img) return;
  ctx.drawImage(img, 0, 0, DESIGN_W, DESIGN_H);
}

/** 绘制场景名称标签（右上角，与 Python 原型一致：UI_button_15 底图 + 白色文字） */
function drawSceneLabel() {
  if (!gameState || !gameState._uiSceneLabel || gameState.fadePhase) return;
  if (gameState.mode === 'event_trigger') return;

  // 底图：UI_button_15.png，缩放到 384px 宽（移动端乘 UI_SCALE）
  const bgImg = getImage('UI_button_15.png');
  if (!bgImg) return;

  const labelW = 384 * UI_SCALE;
  const scaleFactor = labelW / bgImg.naturalWidth;
  const labelH = Math.round(bgImg.naturalHeight * scaleFactor);

  // 位置：中心 (1725, 30)，移动端向左偏移避免右侧超出画面
  let centerX = 1725;
  if (_IS_MOBILE) {
    const rightEdge = centerX + labelW / 2;
    if (rightEdge > DESIGN_W) centerX -= (rightEdge - DESIGN_W);
  }
  const centerY = _IS_MOBILE ? 50 : 30;
  const x = centerX - labelW / 2;
  const y = centerY - labelH / 2;

  ctx.drawImage(bgImg, x, y, labelW, labelH);

  // 文字：白色，字号 28，居中
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `${28 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gameState._uiSceneLabel, centerX, centerY);
  ctx.restore();
}

// ==================== 设置面板关闭辅助 ====================

/** 关闭设置面板，根据来源回退到标题或选项菜单 */
function _closeSettings() {
  playSound('sfx_ui_cancel');
  if (gameState._settingsFromTitle) {
    gameState._settingsFromTitle = false;
    gameState._subMenu = null;
    gameState.uiMode = 'title';
  } else {
    gameState._subMenu = 'options_menu';
    gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
  }
}

// ==================== 标题画面 ====================
// 与 Python text_adventure.py draw_main_menu() 逐项对齐

const TITLE_BTN_IMAGES = [
  ['bg_menu_button_01.png', 'bg_menu_button_01_high.png'],
  ['bg_menu_button_03.png', 'bg_menu_button_03_high.png'],
  ['bg_menu_button_02.png', 'bg_menu_button_02_high.png'],
  ['bg_menu_button_04.png', 'bg_menu_button_04_high.png']
];
const TITLE_BTN_TEXTS = ['开始游戏', '读取游戏', '设置', '退出游戏'];
const TITLE_BTN_CENTER_X = 613;
const TITLE_BTN_CENTER_Y_START = 583;
const TITLE_BTN_TARGET_H = 523;  // = int(436 * 1.2)，固定目标高度，与 Python 一致
const TITLE_BTN_GAP = 231;

let _titleBgScaled = null;       // 缓存的背景图

function _handleTitleBtnClick(index) {
  const btnText = TITLE_BTN_TEXTS[index];
  try { playSound('sfx_ui_confirm'); } catch (_) {}
  if (btnText === '开始游戏') {
    gameState.startNewGame();
    gameState.uiMode = null;
    console.log('[Title] 开始新游戏');
  } else if (btnText === '读取游戏') {
    // 读取游戏 → 进入读取界面（与 Python 一致：bg_menu_02 背景）
    gameState._saveFromOptions = false;
    gameState.uiMode = 'load';
    gameState.saveIndexFocus = _IS_MOBILE ? -1 : 0;
    console.log('[Title] 读取游戏');
  } else if (btnText === '设置') {
    gameState.mode = 'menu';
    gameState._settingsFromTitle = true;
    gameState._subMenu = 'settings';
    gameState.settingsMenuFocus = _IS_MOBILE ? -1 : 0;
    try { playSound('sfx_ui_confirm'); } catch (_) {}
    console.log('[Title] 设置');
  } else if (btnText === '退出游戏') {
    // 浏览器环境：刷新页面回到标题
    location.reload();
  }
}

function drawTitleScreen() {
  const gs = gameState;
  // 进入标题画面时记录 testMode 状态（每次进入都记录）
  if (gs._lastUiMode !== 'title') {
    dbgPush(`TITLE-ENTER tm=${gs.testMode}`);
    console.log(`[Title] 进入标题画面 testMode=${gs.testMode}`);
  }
  gs._lastUiMode = 'title';

  // ── 背景：bg_menu_01.png，缩放铺满画布 ──
  const bg = getImage('bg_menu_01.png');
  if (bg) {
    if (!_titleBgScaled || _titleBgScaled._src !== bg) {
      const bgScale = Math.max(DESIGN_W / bg.width, DESIGN_H / bg.height);
      _titleBgScaled = { img: bg, sw: Math.round(bg.width * bgScale), sh: Math.round(bg.height * bgScale), _src: bg };
    }
    const sx = (DESIGN_W - _titleBgScaled.sw) / 2;
    const sy = (DESIGN_H - _titleBgScaled.sh) / 2;
    ctx.drawImage(_titleBgScaled.img, sx, sy, _titleBgScaled.sw, _titleBgScaled.sh);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  }

  // ── 按钮：4 个横排，高度固定 523px（436 * 1.2），宽度等比缩放 ──
  gs.titleBtnRects = [];
  const mx = mouse.canvasX || 0;
  const my = mouse.canvasY || 0;
  let hoverIdx = -1;

  const btnInfos = [];
  for (let i = 0; i < 4; i++) {
    const normalImg = getImage(TITLE_BTN_IMAGES[i][0]);
    if (!normalImg) continue;
    // 固定目标高度，等比缩放宽度（与 Python get_main_menu_button 一致）
    const scaledH = TITLE_BTN_TARGET_H;
    const scaledW = Math.round(normalImg.width * (scaledH / normalImg.height));
    const cx = TITLE_BTN_CENTER_X + i * TITLE_BTN_GAP;
    const cy = TITLE_BTN_CENTER_Y_START;
    const rect = { x: cx - scaledW / 2, y: cy - scaledH / 2, w: scaledW, h: scaledH };
    btnInfos.push({ i, rect, normalImg, hoverImg: getImage(TITLE_BTN_IMAGES[i][1]) });
    gs.titleBtnRects.push(rect);
    if (!_IS_MOBILE && mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h) {
      hoverIdx = i;
    }
  }

  if (hoverIdx !== -1 && gamepad.focusByMouse) {
    gs.titleFocus = hoverIdx;
  }

  for (const info of btnInfos) {
    const isHover = (info.i === gs.titleFocus);
    const img = isHover ? (info.hoverImg || info.normalImg) : info.normalImg;
    ctx.drawImage(img, info.rect.x, info.rect.y, info.rect.w, info.rect.h);
  }

  // 手柄模式：焦点按钮下方 A 键图标（与选项菜单一致）
  if (gamepad.usingGamepad) {
    const rect = gs.titleBtnRects[gs.titleFocus];
    if (rect) drawGamepadIconBelow(ctx, 'a', rect, -70);
  }

  // ── 测试模式切换按钮（左上角，避免与右上角刷新按钮重叠） ──
  const TEST_BTN_W = _IS_MOBILE ? 280 : 100;
  const TEST_BTN_H = _IS_MOBILE ? 100 : 36;
  const testBtnX = 20;
  const testBtnY = 20;
  const testHover = !_IS_MOBILE && (mx >= testBtnX && mx <= testBtnX + TEST_BTN_W && my >= testBtnY && my <= testBtnY + TEST_BTN_H);
  gs._testBtnRect = { x: testBtnX, y: testBtnY, w: TEST_BTN_W, h: TEST_BTN_H };

  ctx.save();
  // 移动端用更高不透明度确保可见
  const btnAlpha = _IS_MOBILE ? (gs.testMode ? 0.95 : 0.85) : (gs.testMode ? (testHover ? 0.94 : 0.86) : (testHover ? 0.63 : 0.5));
  ctx.globalAlpha = btnAlpha;
  ctx.fillStyle = gs.testMode ? '#ff5050' : '#787878';
  ctx.beginPath();
  ctx.roundRect(testBtnX, testBtnY, TEST_BTN_W, TEST_BTN_H, 8);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = gs.testMode ? '#cc0000' : '#555';
  ctx.lineWidth = 2;
  ctx.stroke();
  const testFontSize = _IS_MOBILE ? 40 : 22;
  ctx.font = `bold ${testFontSize * UI_SCALE}px Arial, "Microsoft YaHei", "SimHei", sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 文字描边增强可读性
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  const testText = gs.testMode ? '测试: 开' : '测试: 关';
  const testCx = testBtnX + TEST_BTN_W / 2;
  const testCy = testBtnY + TEST_BTN_H / 2;
  ctx.strokeText(testText, testCx, testCy);
  ctx.fillText(testText, testCx, testCy);
  ctx.restore();

  // ── 版本号（右下角，绿色，半透明黑底，文字居中） ──
  const versionText = `${GAME_VERSION}.${RESOURCE_VERSION}`;
  ctx.save();
  ctx.font = `bold ${24 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const vW = ctx.measureText(versionText).width + 16;
  const vH = 32;
  const vCX = DESIGN_W - vW / 2 - 8;
  const vCY = DESIGN_H - vH / 2 - 8;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(vCX - vW / 2, vCY - vH / 2, vW, vH);
  ctx.fillStyle = '#00cc44';
  ctx.fillText(versionText, vCX, vCY);
  ctx.restore();
}

// ==================== 设置面板更新逻辑（标题画面和游戏内共用） ====================

function updateSettingsPanel() {
  if (gameState._subMenu !== 'settings') return;

  // hover 检测（移动端不依赖坐标 hover）
  if (!_IS_MOBILE && gameState._settingsRowRects) {
    const mx = mouse.canvasX, my = mouse.canvasY;
    let hovered = -1;
    for (let i = 0; i < gameState._settingsRowRects.length; i++) {
      const rr = gameState._settingsRowRects[i];
      if (mx >= rr.x && mx <= rr.x + rr.w && my >= rr.y && my <= rr.y + rr.h) {
        hovered = i; break;
      }
    }
    if (hovered < 0 && gameState._settingsBackRect) {
      const r = gameState._settingsBackRect;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) hovered = 3;
    }
    if (hovered >= 0 && gamepad.focusByMouse && gameState.settingsMenuFocus !== hovered) {
      gameState.settingsMenuFocus = hovered;
    }
  }

  // 触摸拖拽启动
  if (!gameState._settingsDragging && mouse._isTouch && (mouse.buttons & 1)) {
    const mx = mouse.canvasX, my = mouse.canvasY;
    const r = (rect) => rect && mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h;
    if (r(gameState._settingsBgmRect)) {
      gameState._settingsDragging = 'bgm';
    } else if (r(gameState._settingsSfxRect)) {
      gameState._settingsDragging = 'sfx';
    }
  }

  // 拖拽实时更新
  if (gameState._settingsDragging) {
    const mx = mouse.canvasX;
    if (gameState._settingsDragging === 'bgm' && gameState._settingsBgmRect) {
      const r = gameState._settingsBgmRect;
      gameState.bgmVolume = Math.max(0, Math.min(1, (mx - r.x) / r.w));
      syncAudioSettings();
      saveSettings();
    } else if (gameState._settingsDragging === 'sfx' && gameState._settingsSfxRect) {
      const r = gameState._settingsSfxRect;
      gameState.sfxVolume = Math.max(0, Math.min(1, (mx - r.x) / r.w));
      saveSettings();
    }
  }
}

// ==================== 保存游戏 UI ====================
// 与 Python draw_save_file_menu 一致：7个 UI_button_14 竖长按钮 + 竖排文字 + 返回按钮

const SAVE_BTN_CENTER_X = 500;   // 第一个按钮 center_x
const SAVE_BTN_CENTER_Y = 580;   // 按钮 center_y
const SAVE_BTN_GAP = 143;        // 按钮间距
const SAVE_BTN_HEIGHT = 493;     // 按钮高度（与 Python SAVE_FILE_BTN_HEIGHT 一致）
const SAVE_BACK_CX = 1533;       // 返回按钮 center_x（UI_Up_01）
const SAVE_BACK_CY = 301;        // 返回按钮 center_y
const SAVE_SUCCESS_TEXT = '已成功保存游戏';
const SAVE_SUCCESS_CX = 1015 - 70;  // 与 Python SAVE_SUCCESS_CENTER_X - 70 一致
const SAVE_SUCCESS_CY = 879;
const SAVE_SUCCESS_DISPLAY_TIME = 1.5;

// 7级时间颜色（与 Python get_relative_time_color_7_levels 一致）
const _SAVE_MAIN_COLORS = [
  [255,0,0],[204,0,0],[153,0,0],[102,0,0],[51,0,0],[25,0,0],[0,0,0]
];
const _SAVE_GLOW_COLORS = [
  [255,198,0],[235,182,0],[210,163,0],null,null,null,null
];

function _getSaveTimeColor(timestamp, allTimestamps) {
  if (!allTimestamps.length) return { text: '#000', glow: null };
  const sorted = [...allTimestamps].sort((a,b) => b - a);
  let rank = sorted.indexOf(timestamp);
  if (rank < 0) rank = allTimestamps.length - 1;
  const total = allTimestamps.length;
  const level = total <= 7 ? rank : Math.floor((rank / (total - 1)) * 6);
  const mc = _SAVE_MAIN_COLORS[level];
  const gc = _SAVE_GLOW_COLORS[level];
  return {
    text: `rgb(${mc[0]},${mc[1]},${mc[2]})`,
    glow: gc ? `rgba(${gc[0]},${gc[1]},${gc[2]},0.4)` : null,
  };
}

// 保存成功提示计时器
let _saveSuccessTimer = 0;

/** 绘制保存/读取游戏界面（全 Canvas，与 Python draw_save_file_menu 一致） */
function drawSaveFileMenu() {
  if (!gameState || (gameState.uiMode !== 'save' && gameState.uiMode !== 'load')) return;

  const isLoad = (gameState.uiMode === 'load');

  // 与 Python 一致：标题画面进入 → 纯背景图（无标题图）；选项菜单进入 → 背景 + 标题图
  if (isLoad) {
    // 读取模式：bg_menu_02 背景
    const bg = getImage('bg_menu_02.png');
    if (bg && bg.complete) {
      const bgScale = Math.max(DESIGN_W / bg.width, DESIGN_H / bg.height);
      const sw = Math.round(bg.width * bgScale);
      const sh = Math.round(bg.height * bgScale);
      ctx.drawImage(bg, (DESIGN_W - sw) / 2, (DESIGN_H - sh) / 2, sw, sh);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
  } else if (gameState._saveFromOptions) {
    // 从选项菜单进入：bg_menu_04 + 标题图 bg_menu_04_02
    const bg = getImage('bg_menu_04.png');
    if (bg && bg.complete) {
      ctx.drawImage(bg, 0, 0, DESIGN_W, DESIGN_H);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
    const title = getImage('bg_menu_04_02.png');
    if (title && title.complete) {
      const titleW = 324;
      const titleH = titleW * (title.naturalHeight / title.naturalWidth);
      const titleX = 978 - titleW / 2;
      const titleY = 192 - titleH / 2;
      ctx.drawImage(title, titleX, titleY, titleW, titleH);
    }
  } else {
    // 从标题画面进入保存：黑色背景
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  }

  const saves = listAllSaves();
  const allTimestamps = saves.filter(s => s.exists).map(s => s.timestamp);

  // 存储按钮 rect 供交互检测
  gameState._saveBtnRects = [];

  // 绘制7个存档按钮（UI_button_14.png 竖长按钮）
  for (let idx = 0; idx < SAVE_COUNT; idx++) {
    const saveInfo = saves[idx];
    const isHover = (gameState.saveIndexFocus === idx);
    const btnFile = isHover ? 'UI_button_14_high.png' : 'UI_button_14.png';
    const btnImg = getImage(btnFile);
    const cx = SAVE_BTN_CENTER_X + idx * SAVE_BTN_GAP;
    const cy = SAVE_BTN_CENTER_Y;

    if (btnImg && btnImg.complete) {
      const btnW = Math.round(SAVE_BTN_HEIGHT * (btnImg.naturalWidth / btnImg.naturalHeight));
      const bx = cx - btnW / 2;
      const by = cy - SAVE_BTN_HEIGHT / 2;
      ctx.drawImage(btnImg, bx, by, btnW, SAVE_BTN_HEIGHT);
      gameState._saveBtnRects.push({ x: bx, y: by, w: btnW, h: SAVE_BTN_HEIGHT, index: idx });

      // 绘制存档内容（竖排文字）
      _drawSaveSlotContent(cx, cy, idx, saveInfo, allTimestamps);
    } else {
      // fallback：纯色矩形
      gameState._saveBtnRects.push({ x: cx - 50, y: cy - SAVE_BTN_HEIGHT/2, w: 100, h: SAVE_BTN_HEIGHT, index: idx });
    }
  }

  // 返回按钮（UI_Up_01，移动端按 UI_SCALE 放大）
  const backHover = gameState._saveBackHover || false;
  const backFile = backHover ? 'UI_Up_01_high.png' : 'UI_Up_01.png';
  const backImg = getImage(backFile);
  if (backImg && backImg.complete) {
    const backW = Math.round(133 * UI_SCALE);
    const backScale = backW / backImg.naturalWidth;
    const backH = backImg.naturalHeight * backScale;
    const bx = SAVE_BACK_CX - backW / 2;
    const by = SAVE_BACK_CY - backH / 2;
    ctx.drawImage(backImg, bx, by, backW, backH);
    gameState._saveBackRect = { x: bx, y: by, w: backW, h: backH };
  }

  // 手柄模式：焦点存档位 A 键图标 / 返回按钮 B 键图标（与 Python draw_save_file_menu 一致）
  if (gamepad.usingGamepad) {
    const focusRect = gameState._saveBtnRects[gameState.saveIndexFocus];
    if (focusRect) drawGamepadIconBelow(ctx, 'a', focusRect, -50);
    if (gameState._saveBackRect) drawGamepadIconBelow(ctx, 'b', gameState._saveBackRect, -55, 40);
  }

  // 保存成功提示（与 Python 一致：黑色文字，淡出效果）
  if (_saveSuccessTimer > 0) {
    const ratio = _saveSuccessTimer / SAVE_SUCCESS_DISPLAY_TIME;
    const alpha = Math.min(1, ratio / 0.3);  // 前70%时间全透明度，后30%淡出
    if (alpha > 0) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${44 * UI_SCALE}px "SourceHanSansSC-Medium", sans-serif`;
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(SAVE_SUCCESS_TEXT, SAVE_SUCCESS_CX, SAVE_SUCCESS_CY);
      ctx.restore();
    }
  }
}

/** 绘制竖排文字（与 Python get_vertical_text 一致：逐字竖排，居中对齐） */
function _getVerticalTextMetrics(text, fontSize) {
  const lines = text.split('');
  const lineHeight = fontSize * 1.1;
  const width = fontSize;
  const height = lines.length * lineHeight;
  return { width, height, lineHeight };
}

function _drawVerticalText(text, cx, cy, fontSize, color) {
  const lines = text.split('');
  fontSize *= UI_SCALE;
  const lineHeight = fontSize * 1.1;
  const totalH = lines.length * lineHeight;
  const startY = cy - totalH / 2 + lineHeight / 2;

  ctx.save();
  ctx.font = `bold ${fontSize}px "SourceHanSansSC-Medium", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, startY + i * lineHeight);
  }
  ctx.restore();
}

/** 绘制水平文字 */
function _drawHorizontalText(text, cx, cy, fontSize, color) {
  ctx.save();
  fontSize *= UI_SCALE;
  ctx.font = `bold ${fontSize}px "SourceHanSansSC-Medium", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

/** 发光文字绘制（与 Python draw_text_with_glow 一致） */
function _drawTextWithGlow(text, cx, cy, fontSize, color, glowColor) {
  ctx.save();
  fontSize *= UI_SCALE;
  ctx.font = `bold ${fontSize}px "SourceHanSansSC-Medium", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 15;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

/** 绘制单个存档槽内容（与 Python draw_save_slot_content 逐项对齐） */
function _drawSaveSlotContent(cx, cy, idx, saveInfo, allTimestamps) {
  const CHINESE_NUMS = ['一','二','三','四','五','六','七'];
  const CHINESE_TO_ARABIC = { '一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7' };

  if (!saveInfo.exists) {
    // 空存档 → 竖排"空存档"（灰色，与 Python 一致）
    _drawVerticalText('空存档', cx, cy, 32 * 1.2, 'rgb(120,120,120)');
    return;
  }

  const timeColor = _getSaveTimeColor(saveInfo.timestamp, allTimestamps);

  // 1. 槽号（阿拉伯数字，竖排，黑色）
  const numStr = CHINESE_TO_ARABIC[CHINESE_NUMS[idx]] || String(idx + 1);
  const numFontSize = 32 * 1.2;
  const numVH = numStr.length * numFontSize * 1.1;

  // 2. 章节名（竖排，黑色）
  let chapVH = 0;
  const chapFontSize = 28 * 1.2;
  const chapName = saveInfo.chapter_display || '';
  if (chapName) {
    chapVH = chapName.length * chapFontSize * 1.1;
  }

  // 3~5. 年/月日/时间（水平渲染，时间颜色）
  const infoFontSize = 22 * 1.2;
  const infoSpacing = _IS_MOBILE ? 30 : 6;
  const year = saveInfo.year || '';
  const date = saveInfo.date || '';
  const realTime = saveInfo.real_time || '';  // 保存时刻的真实时间（HH:MM），与 Python 一致
  const infoItems = [year, date, realTime].filter(s => s);
  const infoTotalH = infoItems.length > 0
    ? infoItems.length * (infoFontSize + infoSpacing) - infoSpacing
    : 0;

  // 垂直排列所有区块（间距随 UI_SCALE 放大，避免移动端文字挤在一起）
  const gap = _IS_MOBILE ? 30 : 10;
  const totalH = numVH + chapVH + infoTotalH + (numVH > 0 && chapVH > 0 ? gap : 0) + (infoTotalH > 0 ? gap : 0);
  let curY = cy - totalH / 2;

  // 槽号（竖排）
  _drawVerticalText(numStr, cx, curY + numVH / 2, numFontSize, '#000');
  curY += numVH;

  // 章节名（竖排）
  if (chapName) {
    curY += gap;
    _drawVerticalText(chapName, cx, curY + chapVH / 2, chapFontSize, '#000');
    curY += chapVH;
  }

  // 年/月日/时间（水平渲染）
  if (infoItems.length > 0) {
    curY += gap;
    for (const item of infoItems) {
      _drawTextWithGlow(item, cx, curY + infoFontSize / 2, infoFontSize, timeColor.text, timeColor.glow);
      curY += infoFontSize + infoSpacing;
    }
  }
}

/** 更新保存界面 hover 状态（鼠标/触摸） */
function updateSaveHover(canvasX, canvasY) {
  if (!gameState || (gameState.uiMode !== 'save' && gameState.uiMode !== 'load')) return;
  if (_IS_MOBILE) return;  // 移动端不依赖坐标 hover

  // 返回按钮 hover
  if (gameState._saveBackRect) {
    const r = gameState._saveBackRect;
    gameState._saveBackHover = (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h);
  }

  // 存档按钮 hover（仅鼠标模式）
  if (gamepad.focusByMouse && gameState._saveBtnRects) {
    for (const r of gameState._saveBtnRects) {
      if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
        gameState.saveIndexFocus = r.index;
        return;
      }
    }
  }
}

/** 处理保存/读取界面的点击事件 */
function handleSaveClick(canvasX, canvasY) {
  if (!gameState || (gameState.uiMode !== 'save' && gameState.uiMode !== 'load')) return false;

  // 返回按钮
  if (gameState._saveBackRect) {
    const r = gameState._saveBackRect;
    if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
      // 从 save_prompt 进入保存界面 → 返回选项菜单（让用户选择关闭或继续）
      if (gameState.mode === 'save_prompt') {
        gameState.uiMode = null;
        gameState._subMenu = 'options_menu';
        gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
        playSound('sfx_ui_cancel');
        return true;
      }
      if (gameState._saveFromOptions) {
        // 从选项菜单进入 → 返回选项菜单
        gameState.uiMode = null;
        gameState._subMenu = 'options_menu';
        gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
      } else {
        // 从标题画面进入 → 返回标题画面
        gameState.uiMode = 'title';
        gameState.titleFocus = _IS_MOBILE ? -1 : 0;
        gameState.mode = 'menu';
      }
      playSound('sfx_ui_cancel');
      return true;
    }
  }

  // 存档按钮
  if (gameState._saveBtnRects) {
    for (const r of gameState._saveBtnRects) {
      if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
        _executeSave(r.index);
        return true;
      }
    }
  }

  return true; // 消费所有点击（防止穿透）
}

/** 执行保存或读取操作 */
function _executeSave(saveIndex) {
  if (!gameState) return;
  if (gameState.uiMode === 'load') {
    // 读取模式 → 淡出后加载存档
    const data = loadGameFromSlot(saveIndex);
    if (data) {
      playSound('sfx_confront_success');
      gameState.fadePhase = 'fade_out';
      gameState.fadeTimer = 0;
      gameState.fadeAlpha = 0;
      gameState.fadeCallback = function() {
        deserializeGameState(data, gameState);
        gameState.uiMode = null;
        gameState._inSceneFade = true;
        // 先还原存档中的背景，enterNode 会覆盖如果目标节点有 background
        currentBg = gameState.currentBgName;
        // 清除运行时状态（与 Python load_from_slot 一致）
        gameState.currentSequenceNode = null;
        gameState.currentSequenceNodeId = null;
        gameState.dialogueQueue = [];
        gameState.dialogueIndex = 0;
        // 调用 enterNode 恢复场景（背景/BGM/对话/菜单等）
        const nodeId = data.node_id || 'scene_prologue_01';
        gameState.enterNode(nodeId);
        // 重置 _justLoaded：enterNode 已完成初始化，后续的 save_prompt 不应被跳过
        gameState._justLoaded = false;
        // 淡入显示
        gameState.fadePhase = 'fade_in';
        gameState.fadeTimer = 0;
        gameState.fadeAlpha = 255;
      };
      console.log(`[Load] 已从槽位 ${saveIndex + 1} 加载`);
    } else {
      console.log(`[Load] 槽位 ${saveIndex + 1} 为空`);
    }
  } else {
    // 保存模式
    const data = serializeGameState(gameState);
    if (saveGameToSlot(saveIndex, data)) {
      playSound('sfx_confront_success');
      _saveSuccessTimer = SAVE_SUCCESS_DISPLAY_TIME;
      console.log(`[Save] 已保存到槽位 ${saveIndex + 1}`);
    }
  }
}

/** 处理保存/读取界面的键盘事件 */
function handleSaveKey(key) {
  if (!gameState || (gameState.uiMode !== 'save' && gameState.uiMode !== 'load')) return false;

  if (key === 'ArrowLeft' || key === 'a') {
    gameState.saveIndexFocus = (gameState.saveIndexFocus - 1 + SAVE_COUNT) % SAVE_COUNT;
    playSound('sfx_ui_cursor_move');
    return true;
  } else if (key === 'ArrowRight' || key === 'd') {
    gameState.saveIndexFocus = (gameState.saveIndexFocus + 1) % SAVE_COUNT;
    playSound('sfx_ui_cursor_move');
    return true;
  } else if (key === 'ArrowUp' || key === 'w') {
    // 上方无元素，保持
    return true;
  } else if (key === 'ArrowDown' || key === 's') {
    // 下方无元素，保持
    return true;
  } else if (key === ' ' || key === 'Enter') {
    _executeSave(gameState.saveIndexFocus);
    return true;
  } else if (key === 'Escape' || key === 'Backspace') {
    // 返回：从 save_prompt 进→继续剧情，从选项菜单进→回选项菜单，从标题进→回标题
    if (gameState.mode === 'save_prompt') {
      gameState.uiMode = null;
      gameState._saveFromOptions = false;
      playSound('sfx_ui_cancel');
      gameState._continueFromSavePrompt();
      return true;
    }
    if (gameState._saveFromOptions) {
      gameState.uiMode = null;
      gameState._subMenu = 'options_menu';
      gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
    } else {
      gameState.uiMode = 'title';
      gameState.titleFocus = _IS_MOBILE ? -1 : 0;
      gameState.mode = 'menu';
    }
    playSound('sfx_ui_cancel');
    return true;
  }

  return false;
}

// ==================== 主循环 ====================

const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS; // ≈33.3ms
let lastFrameTime = 0;

function gameLoop(timestamp) {
  try {
    // 30 FPS 帧率锁定（跳过过快帧，节省移动端电量）
    if (timestamp - lastFrameTime < FRAME_INTERVAL) {
      requestAnimationFrame(gameLoop);
      return;
    }
    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
    lastFrameTime = timestamp;

    // 轮询输入
    pollInput();

    // 手柄光标移动
    updateGamepadMovement(dt);

    // 清空 Canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    // 标题画面优先（与 Python ui_mode == "main_menu" 一致）
    if (gameState && gameState.uiMode === 'title') {
      // 标题BGM（与 Python 一致：云外箫声.mp3 循环播放）
      playBgm('云外箫声.mp3');
      // 标题画面的设置面板也需要更新（hover/drag）
      updateSettingsPanel();
      drawTitleScreen();
      // 标题画面弹出的设置面板需要在标题之上绘制
      if (gameState._subMenu === 'settings') {
        drawSettings();
      }
      // fade-in 覆盖层（game over 回标题时的淡入效果）
      if (gameState.fadePhase) {
        updateSceneFade(dt);
        drawFadeOverlay();
      }
      // drawDebugOverlay();  // 启用屏幕debug时取消注释
      requestAnimationFrame(gameLoop);
      return;
    }

    // 绘制背景
    drawBackground();

    // 场景名称标签（UI_button_15 底图 + 白色文字，右上角）
    drawSceneLabel();

    // 调查对话叠加时：先画调查层（标记/放大镜），再画立绘（立绘在最上面，不覆盖图标）
    if (gameState && gameState._invDialogueActive) {
      try { drawInvestigation(); } catch (e) {}
    }

    // 绘制角色立绘（保护性 try-catch：立绘失败不影响游戏运行）
    try {
      drawCharacterWithFade();
    } catch (e) {
      console.error('[CharRender] 立绘渲染错误:', e.message, e.stack);
    }

    // 卡片叠加层（show_card / show_item，对话中弹出的人物/物品卡片）
    try { drawCardOverlay(); } catch (e) {}

    // 血量图标（案情审理阶段、举证对白或游戏结束时显示，事件播放期间隐藏）
    if (gameState && gameState.mode !== 'event_trigger' && (gameState._inCaseTrial || gameState._inProofInterrupt || gameState._proofInterruptFailPending)) {
      drawBloodIcons();
    }

    // 质问模式 Canvas 叠加层（箭头 + 按钮 + 计数器 + "陈述中"标签）
    try { drawConfrontation(); } catch (e) { console.error('[ConfrontRender] drawConfrontation error:', e.message, e.stack); }

    // 选项对白 Canvas 叠加层（选项按钮 + 滑入动画）
    try { drawChoiceDialogue(); } catch (e) { console.error('[ChoiceDialogue] drawChoiceDialogue error:', e.message, e.stack); }

    // 跳过按钮 RB 手柄图标（对话框模式，Canvas 绘制）
    try { drawSkipGamepadIcon(ctx); } catch (e) { console.error('[SkipGamepad] drawSkipGamepadIcon error:', e.message, e.stack); }

    // 陈述开始动画 Canvas 叠加层
    try { drawIntroAnim(); } catch (e) { console.error('[IntroAnim] drawIntroAnim error:', e.message, e.stack); }

    // 事件渲染（intro_event / trigger_event）
    drawEvent();

    // 谜题渲染（数字密码锁，与 Python draw_puzzle 一致）
    try { drawPuzzle(); } catch (e) { console.error('[PuzzleRender] drawPuzzle error:', e.message, e.stack); }

    // 物品栏 Canvas 渲染（inventory.js）
    if (gameState && gameState._subMenu === 'inventory') {
      try { drawInventoryCanvas(); } catch (e) {
        console.error('[Inventory] 物品栏渲染错误:', e.message);
      }
    }

    // 预览角色立绘（菜单模式下，选项焦点对应的角色半透明显示在右侧）
    try { drawPreviewCharacter(); } catch (e) {
      console.error('[PreviewChar] 预览立绘渲染错误:', e.message);
    }

    // 淡入淡出
    drawFadeOverlay();

    // game over 黑屏文字叠加层（text/fade_out 阶段）— 必须在所有 UI 之上
    if (gameState.gameOverActive && (gameState.gameOverPhase === 'text' || gameState.gameOverPhase === 'fade_out')) {
      const alpha = gameState.gameOverTextAlpha;
      // 全屏纯黑遮挡所有 UI 和事件画面
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      // 居中文字（带淡入淡出）
      if (alpha > 0) {
        const text = '一段波澜壮阔的风云变幻，就此潦草落下帷幕，令人唏嘘不已... ...';
        ctx.save();
        ctx.globalAlpha = alpha / 255;
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${42 * UI_SCALE}px "Source Han Sans SC","Microsoft YaHei","SimHei",sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxWidth = DESIGN_W * 0.75;
        const chars = text.split('');
        let line = '';
        const lines = [];
        for (const ch of chars) {
          const test = line + ch;
          if (ctx.measureText(test).width > maxWidth) { lines.push(line); line = ch; }
          else { line = test; }
        }
        if (line) lines.push(line);
        const lineH = 56 * UI_SCALE;
        const startY = DESIGN_H / 2 - (lines.length - 1) * lineH / 2;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], DESIGN_W / 2, startY + i * lineH);
        }
        ctx.restore();
      }
    }

    // 保存/读取游戏界面（Canvas 全覆盖绘制）
    if (gameState && (gameState.uiMode === 'save' || gameState.uiMode === 'load')) {
      drawSaveFileMenu();
    }

    // 物品获得/失去反馈动画
    drawItemFeedback();

    // 保存提示按钮（Canvas 覆盖层，仅在 save_prompt 模式下绘制）
    drawSavePrompt();

    // 游戏状态更新
    updateGameState(dt);

    // UI 渲染
    renderUI();
  } catch (e) {
    console.error('[GameLoop]', e);
    // 错误显示到调试面板
    if (debugPanel.style.display !== 'none') {
      debugPanel.textContent = 'ERROR: ' + e.message + '\n' + (e.stack || '');
    }
  }

  // drawDebugOverlay();  // 启用屏幕debug时取消注释
  requestAnimationFrame(gameLoop);
}

// ==================== 选项对白绘制 ====================

/** 绘制选项对白按钮（与 Python draw_choice_dialogue 一致，Canvas 叠加层） */
function drawChoiceDialogue() {
  if (!gameState || gameState.mode !== 'choice_dialogue') return;
  if (!gameState.choiceActive2 || !gameState.choiceList || gameState.choiceList.length === 0) return;

  const options = gameState.choiceList;
  const total = options.length;
  const btnW = CONFRONT_BTN_W;   // 720
  const btnH = CONFRONT_BTN_H;   // 72
  const btnGap = 8;
  const totalH = total * btnH + (total - 1) * btnGap;

  // 位置：对话框下方，左对齐对话框左边缘（与 Python 一致：根据角色侧边和宽度计算）
  let baseX = (DESIGN_W - DIALOG_W) / 2;
  if (gameState.displaySpeaker) {
    const side = gameState.displaySide || 'right';
    let charW = 0;
    const charImg = getCharImage(gameState.displaySpeaker, gameState.displayExpression || '01');
    if (charImg && charImg.naturalWidth) {
      charW = Math.round(charImg.naturalWidth * (_CHAR_HEIGHT / charImg.naturalHeight));
    }
    if (side === 'left') {
      baseX = _PLAYER_MARGIN_LEFT + charW + DIALOG_GAP_TO_CHAR;
    } else {
      baseX = DESIGN_W - charW - _NPC_MARGIN_RIGHT - DIALOG_W - DIALOG_GAP_TO_CHAR;
    }
  }
  const baseY = DESIGN_H - DIALOG_H - DIALOG_BOTTOM_MARGIN - totalH - 15;

  const offset = gameState.choiceBtnAnimOffset;
  const curX = baseX + offset;

  // 按钮淡入效果：offset 从 -720 到 0
  const fadeInStart = -CONFRONT_BTN_W;
  const fadeInEnd = 0;
  let btnAlpha = 0;
  if (offset >= fadeInStart) {
    btnAlpha = Math.min(1, (offset - fadeInStart) / (fadeInEnd - fadeInStart));
  }

  ctx.save();
  ctx.globalAlpha = btnAlpha;

  gameState.choiceBtnRects = [];

  for (let i = 0; i < total; i++) {
    const opt = options[i];
    const optText = opt.label || '';
    const x = curX;
    const y = baseY + i * (btnH + btnGap);
    const isFocus = (i === gameState.choiceSelected);

    // 鼠标 hover 检测（与 Python 一致）
    if (gamepad.focusByMouse) {
      const mx = (typeof mouse !== 'undefined') ? mouse.canvasX : -1;
      const my = (typeof mouse !== 'undefined') ? mouse.canvasY : -1;
      if (mx >= x && mx <= x + btnW && my >= y && my <= y + btnH) {
        if (gameState.choiceSelected !== i) {
          gameState.choiceSelected = i;
        }
      }
    }

    // 存储按钮矩形供点击检测
    gameState.choiceBtnRects.push({ x, y, w: btnW, h: btnH });

    // 绘制按钮（复用 _drawConfrontBtn）
    _drawConfrontBtn(x, y, btnW, btnH, optText, isFocus, 'UI_button_06.png');
  }

  // 手柄模式：仅焦点选项右侧绘制 A 键图标（与 Python focus_idx 一致，偏移 -40）
  if (gamepad.usingGamepad && !gamepad.focusByMouse) {
    const fi = gameState.choiceSelected;
    if (fi >= 0 && fi < total) {
      const fx = curX;
      const fy = baseY + fi * (btnH + btnGap);
      drawGamepadIcon(ctx, 'a', { x: fx, y: fy, w: btnW, h: btnH }, 4, -40);
    }
  }

  ctx.restore();
}

// ==================== 游戏状态更新 ====================

function updateGameState(dt) {
  if (!gameState) return;

  // 保存成功提示计时器
  if (_saveSuccessTimer > 0) {
    _saveSuccessTimer -= dt;
  }

  // 扣血动画更新（与 Python blood_deduct_anim 一致）
  gameState.updateBloodDeductAnim(dt);

  // 物品栏滑动动画更新
  if (gameState.invAnimActive) {
    gameState.invAnimProgress += dt / 0.22; // INVENTORY_ANIM_DURATION = 0.22
    if (gameState.invAnimProgress >= 1.0) {
      gameState.invAnimProgress = 1.0;
      gameState.invAnimActive = false;
    }
  }

  // 陈述开始动画更新
  updateIntroAnim(dt);

  // 谜题更新（数字密码锁，与 Python update puzzle_phase 分支一致）
  if (gameState.mode === 'puzzle') {
    try { updatePuzzle(dt); } catch (e) { console.error('[PuzzleUpdate] error:', e.message, e.stack); }
  }

  // 打字机效果（对话模式 + 质问模式 + save_prompt 模式均支持）
  // 转场期间跳过打字进度（否则 fade 隐藏对话框时打字会悄悄完成）
  const typingActive = (gameState.mode === 'dialogue' || gameState.mode === 'confrontation' || gameState.mode === 'save_prompt') && !gameState.typingComplete && gameState.fullText && !gameState.fadePhase;
  if (typingActive) {
    if (Math.floor(gameState.typingIndex) === 0 && gameState.typingIndex < 0.1) {
      // 第一帧打字输出
      console.log(`[TYPING-DEBUG] 第一帧 typing: mode=${gameState.mode} typingIdx=${gameState.typingIndex} complete=${gameState.typingComplete} pageLimit=${(gameState.mode==='dialogue'&&gameState.textPageEnd>0)?gameState.textPageEnd-gameState.textOffset:'N/A'} textPageEnd=${gameState.textPageEnd} textOffset=${gameState.textOffset} speed=${gameState.typingSpeed} dt=${dt} fullTextLen=${gameState.fullText.length}`);
    }
    gameState.typingIndex += gameState.typingSpeed * dt;
    const currentIndex = Math.floor(gameState.typingIndex);
    // 对话模式：打字上限为当前页结束位置；质问模式：无分页，上限为全文
    const pageLimit = ((gameState.mode === 'dialogue' || gameState.mode === 'save_prompt') && gameState.textPageEnd > 0)
      ? gameState.textPageEnd - gameState.textOffset
      : gameState.fullText.length;

    // 打字音效：每 3 个字符播放一次（与 Python 一致）
    if (currentIndex > gameState.lastTypingSoundChar && gameState.currentTypingSound) {
      gameState.lastTypingSoundChar = currentIndex;
      if (currentIndex % 3 === 0) {
        try { playSound(gameState.currentTypingSound); } catch (_) {}
      }
    }

    if (currentIndex >= pageLimit) {
      gameState.typingIndex = pageLimit;
      gameState.typingComplete = true;
      gameState.hintAnimationTime = 0;

      if (gameState.mode === 'confrontation' && gameState._confrontTypingDoneCb) {
        // 质问陈述打字完成：显示按钮，不显示跳动三角
        // 总结界面打字完成时不显示按钮和计数器
        gameState._confrontTypingDoneCb = false;
        if (!gameState.confrontationPendingOutro) {
          gameState.confrontationShowButtons = true;
        }
        // 按钮只在第一次进入质问时滑入，后续陈述直接显示
        if (!gameState._confrontBtnHasAnimated) {
          _confrontBtnOffset = -CONFRONT_BTN_W;
          _confrontBtnAnimActive = true;
          gameState._confrontBtnHasAnimated = true;
        } else {
          _confrontBtnOffset = 0;
          _confrontBtnAnimActive = false;
        }
        showHintArrow(false);
      } else if (gameState.mode === 'save_prompt') {
        // save_prompt 模式：打字完成时不显示跳动三角（按钮接管交互）
        showHintArrow(false);
      } else {
        // 普通对话：显示跳动三角
        showHintArrow(true);
      }
    }

    // 更新对话框文本（每帧刷新，显示当前页内容）
    const visibleText = gameState.fullText.substring(gameState.textOffset, gameState.textOffset + Math.floor(gameState.typingIndex));
    updateDialogText(visibleText);
  }

  // 三角跳动动画：abs(sin(t * 3.0 * pi)) * 12（与 Pygame HINT_BOUNCE_SPEED/HINT_BOUNCE_AMPLITUDE 一致）
  if ((gameState.mode === 'dialogue' || gameState.mode === 'save_prompt') && gameState.typingComplete) {
    gameState.hintAnimationTime += dt;
    updateHintBounce(gameState.hintAnimationTime);
  }

  // ── 保存提示：按钮滑入动画（打字机复用上层 dialogue 系统） ──
  // 转场黑屏时不播放滑入动画，等转场完成后开始
  if (gameState.mode === 'save_prompt' && !gameState.fadePhase) {
    // 按钮滑入动画（与 Python 原型一致：MENU_WIDTH / SAVE_PROMPT_BTN_ANIM_DURATION * dt）
    if (gameState.savePromptBtnAnimActive) {
      gameState.savePromptBtnOffset = Math.min(0, gameState.savePromptBtnOffset + (720 / gameState.SAVE_PROMPT_BTN_ANIM_DURATION) * dt);
      if (gameState.savePromptBtnOffset >= 0) {
        gameState.savePromptBtnOffset = 0;
        gameState.savePromptBtnAnimActive = false;
      }
    }
  }

  // ── 选项对白：按钮滑入动画 + 打字机立即完成（与 Python update choice_dialogue 一致） ──
  if (gameState.mode === 'choice_dialogue') {
    // 按钮滑入动画（与 Python一致：CONFRONT_BTN_W / 0.3 * dt）
    if (gameState.choiceBtnAnimOffset < 0) {
      gameState.choiceBtnAnimOffset = Math.min(0, gameState.choiceBtnAnimOffset + (CONFRONT_BTN_W / 0.3) * dt);
    }
    // 选项对白模式下立即完成打字（与 Python typing_complete = True 一致）
    gameState.typingComplete = true;
    gameState.hintAnimationTime += dt;
  }

  // 物品反馈动画（与 Python item_feedback 两阶段一致）
  if (gameState.itemFeedbackActive) {
    if (gameState.itemFeedbackPhase === 'prompt') {
      gameState.hintAnimationTime += dt;
    } else if (gameState.itemFeedbackPhase === 'fading') {
      gameState.itemFeedbackTimer -= dt;
      if (gameState.itemFeedbackTimer <= 0) {
        gameState.itemFeedbackActive = false;
        gameState.itemFeedbackItem = null;
        gameState.itemFeedbackText = '';
        gameState.itemFeedbackPhase = 'prompt';
        gameState.hintAnimationTime = 0;
        // 恢复场景（与 Python gain_resume_state 一致）
        if (gameState.mode === 'item_feedback' && gameState.gainResumeState) {
          const resume = gameState.gainResumeState;
          gameState.gainResumeState = null;
          gameState.showingItem = null;
          // 牌戏物品奖励动画结束后：清理牌戏状态并返回菜单
          if (resume.cardGameFinish) {
            gameState.cardGameActive = false;
            gameState.cardGameId = null;
            gameState.cardGameConfig = null;
            gameState.cardGameReturnMenu = null;
            gameState.cardGameStage = null;
            const targetMenu = resume.targetMenu;
            if (targetMenu) {
              gameState.enterNode(targetMenu);
            }
            return;
          }
          // desc_update 类型：反馈结束后回物品栏（与 Python 一致）
          if (gameState.itemFeedbackType === 'desc_update') {
            gameState.mode = 'menu';
            gameState.state = 'menu';
            gameState._subMenu = 'inventory';
            if (typeof _invBtnHighlight !== 'undefined') _invBtnHighlight = null;
            gameState.inventoryMode = resume.inventoryMode || 'show';
            gameState.selectedItemIndex = resume.selectedItemIndex || 0;
            gameState.previewSpeaker = null;
            gameState.previewAlpha = 0;
            gameState.previewTargetAlpha = 0;
            _menuNeedsRedraw = true;
          } else if (resume.mode === 'investigation') {
            // 恢复调查模式
            gameState.mode = 'investigation';
            gameState.investigationActive = true;
            gameState._refreshInvestigationPoints();
            if (resume.cursorX !== undefined) {
              gameState.investigationCursorX = resume.cursorX;
              gameState.investigationCursorY = resume.cursorY;
            }
            gameState.displaySpeaker = null;
            gameState.displayExpression = '01';
          } else if (resume.mode === 'dialogue') {
            // 恢复对话模式
            gameState.mode = 'dialogue';
            gameState.dialogueQueue = resume.dialogueQueue;
            gameState.dialogueIndex = resume.dialogueIndex;
            gameState.talkingAboutItem = resume.talkingAboutItem || false;
            gameState.startDialogue();
          } else if (resume.mode === 'inventory') {
            gameState.mode = 'menu';
            gameState.state = 'menu';
            gameState._subMenu = 'inventory';
            if (typeof _invBtnHighlight !== 'undefined') _invBtnHighlight = null;
            gameState.inventoryMode = resume.inventoryMode || 'show';
            gameState.selectedItemIndex = resume.selectedItemIndex || 0;
            _menuNeedsRedraw = true;
          }
        } else if (gameState.mode === 'item_feedback') {
          gameState.mode = 'dialogue';
        }
      }
    }
  }

  // 调查模式：键盘方向键移动光标（持续按住）
  if (gameState.mode === 'investigation' && !gamepad.focusByMouse) {
    const INV_KEY_SPEED = 400;
    let moved = false;
    if (isKeyDown(KEY.UP))    { gameState.investigationCursorY -= INV_KEY_SPEED * dt; moved = true; }
    if (isKeyDown(KEY.DOWN))  { gameState.investigationCursorY += INV_KEY_SPEED * dt; moved = true; }
    if (isKeyDown(KEY.LEFT))  { gameState.investigationCursorX -= INV_KEY_SPEED * dt; moved = true; }
    if (isKeyDown(KEY.RIGHT)) { gameState.investigationCursorX += INV_KEY_SPEED * dt; moved = true; }
    if (moved) {
      gameState.investigationCursorX = Math.max(0, Math.min(DESIGN_W - 1, gameState.investigationCursorX));
      gameState.investigationCursorY = Math.max(0, Math.min(DESIGN_H - 1, gameState.investigationCursorY));
    }
  }

  // 选项菜单（ESC弹出）hover 检测
  if (gameState._subMenu === 'options_menu' && !_IS_MOBILE) {
    updateOptionsMenuHover(mouse.canvasX, mouse.canvasY);
  }

  // 保存/读取游戏界面 hover 检测
  if ((gameState.uiMode === 'save' || gameState.uiMode === 'load') && !_IS_MOBILE) {
    updateSaveHover(mouse.canvasX, mouse.canvasY);
  }

  // 保存提示模式 hover 检测（手柄模式下屏蔽鼠标 hover 抢占焦点）
  if (gameState.mode === 'save_prompt' && !_IS_MOBILE && gamepad.focusByMouse) {
    if (gameState.savePromptBtnSave) {
      const r = gameState.savePromptBtnSave;
      const hoverSave = (mouse.canvasX >= r.x && mouse.canvasX <= r.x + r.w && mouse.canvasY >= r.y && mouse.canvasY <= r.y + r.h);
      if (hoverSave) gameState.savePromptButtonFocus = 0;
    }
    if (gameState.savePromptBtnSkip) {
      const r = gameState.savePromptBtnSkip;
      const hoverSkip = (mouse.canvasX >= r.x && mouse.canvasX <= r.x + r.w && mouse.canvasY >= r.y && mouse.canvasY <= r.y + r.h);
      if (hoverSkip) gameState.savePromptButtonFocus = 1;
    }
  }

  // 设置面板更新（hover/drag）— 与标题画面共用同一函数
  updateSettingsPanel();

  // 场景转场淡入淡出更新
  updateSceneFade(dt);

  // ── game over 黑屏文字阶段更新 ──
  if (gameState.gameOverActive) {
    if (gameState.gameOverPhase === 'text') {
      gameState.gameOverTextTimer = Math.max(0, gameState.gameOverTextTimer - dt);
      // alpha: 0.8s 淡入 → 保持
      const fadein = 0.8;
      if (gameState.gameOverTextTimer > 4.0 - fadein) {
        const elapsed = fadein - (gameState.gameOverTextTimer - (4.0 - fadein));
        gameState.gameOverTextAlpha = Math.round(255 * Math.max(0, Math.min(1, elapsed / fadein)));
      } else {
        gameState.gameOverTextAlpha = 255;
      }
      if (gameState.gameOverTextTimer <= 0) {
        gameState._gameOverAdvance();
      }
    } else if (gameState.gameOverPhase === 'fade_out') {
      gameState.gameOverTextTimer = Math.max(0, gameState.gameOverTextTimer - dt);
      gameState.gameOverTextAlpha = Math.round(255 * gameState.gameOverTextTimer / 1.5);
      if (gameState.gameOverTextTimer <= 0) {
        gameState._gameOverAdvance();
      }
    }
  }

  // 角色立绘淡入淡出计时器
  updateCharTransition(dt);

  // 预览角色立绘 alpha 淡入淡出（与 Pygame PREVIEW_FADE_TIME 一致）
  updatePreviewAlpha(dt);

  // ── 事件更新（intro_event / trigger_event）──
  updateEventState(dt);

  // ── 自动对话延迟触发（独立于 updateSceneFade，因为 fade 完成后不再循环）──
  updateAutoDialogueDelay(dt);
}

// ==================== 场景转场更新 ====================

function updateSceneFade(dt) {
  const gs = gameState;
  if (!gs || !gs.fadePhase) return;

  gs.fadeTimer += dt;
  if (gs.fadePhase === 'fade_out') {
    const progress = gs.fadeTimer / gs._FADE_OUT_TIME;
    if (progress >= 1) {
      gs.fadeAlpha = 255;
      gs.fadePhase = 'hold_black';
      gs.fadeTimer = 0;
      if (gs.fadeCallback) {
        gs.fadeCallback();
        gs.fadeCallback = null;
      }
    } else {
      gs.fadeAlpha = 255 * progress;
    }
  } else if (gs.fadePhase === 'hold_black') {
    gs.fadeAlpha = 255;
    if (gs.fadeTimer >= gs._FADE_HOLD_TIME) {
      gs.fadePhase = 'fade_in';
      gs.fadeTimer = 0;
    }
  } else if (gs.fadePhase === 'fade_in') {
    const progress = gs.fadeTimer / gs._FADE_IN_TIME;
    if (progress >= 1) {
      gs.fadeAlpha = 0;
      gs.fadePhase = null;
      gs.fadeTimer = 0;
      gs._inSceneFade = false;
      gs.sceneLabelText = null;
      dbgPush(`FADE-IN-DONE tm=${gs.testMode} mode=${gs.mode}`);
      // fade-in 完成后恢复对话框（fade 期间 hideDialogBox 每帧隐藏，需重新显示）
      // 重置 typingIndex=0 让用户看到完整的逐字动画，而非已完成的全文
      if ((gs.mode === 'dialogue' || gs.mode === 'confrontation' || gs.mode === 'save_prompt') && gs.fullText) {
        gs.typingIndex = 0;
        gs.typingComplete = false;
        gs.lastTypingSoundChar = -1;
        showDialogBox(gs.getDisplayName(gs.displaySpeaker), '');
      }
      if (gs._pendingAutoTarget) {
        gs._sceneEntryDelay = 1.0;  // SCENE_ENTRY_DELAY（与 Python 一致）
      }
    } else {
      gs.fadeAlpha = 255 - 255 * progress;
    }
  }
}

// ==================== 触发自动对话延迟 ====================

function updateAutoDialogueDelay(dt) {
  if (!gameState || gameState._sceneEntryDelay <= 0) return;
  gameState._sceneEntryDelay -= dt;
  if (gameState._sceneEntryDelay <= 0) {
    const target = gameState._pendingAutoTarget;
    gameState._pendingAutoTarget = null;
    if (target) {
      gameState.enterNode(target);
    }
  }
}

// ==================== 事件系统更新 ====================

function updateEventState(dt) {
  if (!gameState || gameState.mode !== 'event_trigger') return;

  const gs = gameState;

  // 图片切换过渡
  if (gs.eventTransitionPhase === 'img_fade_out') {
    gs.eventTransitionTimer -= dt;
    if (gs.eventTransitionTimer <= 0) {
      gs.eventFrameIndex = gs.eventNextFrameIndex;
      gs.eventTransitionPhase = 'img_fade_in';
      gs.eventTransitionTimer = gs._EVENT_IMG_TRANSITION_DURATION;
      gs.eventTypingIndex = 0;
      gs.eventAutoTimer = 0;
    } else {
      gs.eventImgAlpha = 255 * (gs.eventTransitionTimer / gs._EVENT_IMG_TRANSITION_DURATION);
    }
  } else if (gs.eventTransitionPhase === 'img_fade_in') {
    gs.eventTransitionTimer -= dt;
    if (gs.eventTransitionTimer <= 0) {
      gs.eventImgAlpha = 255;
      gs.eventTransitionPhase = null;
      // 重置计时器使 eventAutoTimer 从 0 开始与语音同步
      gs.eventAutoTimer = 0;
      // 图片切入完成后播放新帧语音
      if (gs.eventAutoAdvance) _playEventVoice(gs);
    } else {
      gs.eventImgAlpha = 255 * (1 - gs.eventTransitionTimer / gs._EVENT_IMG_TRANSITION_DURATION);
    }
  }

  // 阶段处理
  if (gs.eventPhase === 'fade_in') {
    gs.eventFadeTimer -= dt;
    gs.eventAlpha = 255 * (1 - gs.eventFadeTimer / gs._EVENT_FADE_DURATION);
    gs.eventImgAlpha = gs.eventAlpha;
    if (gs.eventFadeTimer <= 0) {
      gs.eventAlpha = 255;
      gs.eventImgAlpha = 255;
      gs.eventTransitionPhase = null;
      gs.eventPhase = 'display';
      // 重置计时器，与语音起点同步
      gs.eventAutoTimer = 0;
      // 进入 display 阶段时播放语音
      if (gs.eventAutoAdvance) _playEventVoice(gs);
    }
  } else if (gs.eventPhase === 'display') {
    gs.eventAutoTimer += dt;
    if (gs.eventFrameIndex >= 0 && gs.eventFrameIndex < gs.eventFrames.length) {
      const currentText = gs.eventFrames[gs.eventFrameIndex].text || '';
      const maxChars = currentText.length;
      if (gs.eventTypingIndex < maxChars) {
        gs.eventTypingIndex = Math.min(gs.eventTypingIndex + gs.typingSpeed * dt, maxChars);
      } else if (gs.eventAutoAdvance) {
        const delay = _getEventFrameDelay(gs);
        if (gs.eventAutoTimer >= delay) {
          gs.eventAutoTimer = 0;
          _autoAdvanceEventFrame();
        }
      }
    }
  } else if (gs.eventPhase === 'fade_out') {
    gs.eventFadeTimer -= dt;
    gs.eventAlpha = 255 * (gs.eventFadeTimer / gs._EVENT_FADE_DURATION);
    if (gs.eventFadeTimer <= 0) {
      gs.eventAlpha = 0;
      // 与 Python 一致：fade_out 结束后检查 success_icon
      if (gs.successIconFlag) {
        gs.successIconFlag = false;
        try { playSound('sfx_puzzle_success'); } catch (_) {}
        // 计算图标位置（与 Python 对齐：事件图片居中，图标居于图片区域中心）
        const imgSize = Math.round(DESIGN_H * 0.25 * gs._EVENT_IMAGE_SCALE);
        const imgX = (DESIGN_W - imgSize) / 2;
        const boxH = gs._EVENT_DIALOG_HEIGHT || 150;
        const boxY = DESIGN_H - boxH - 15;
        const imgTop = boxY - 5 - imgSize;
        // 加载图标图片
        const iconImg = getImage('UI_success_01.png');
        if (iconImg) {
          const iconH = Math.round(imgSize * 0.35);
          const iconW = Math.round(iconImg.naturalWidth * iconH / (iconImg.naturalHeight || 1));
          gs.successIconW = iconW;
          gs.successIconH = iconH;
          gs.successIconCx = imgX + imgSize / 2;
          gs.successIconCy = imgTop + imgSize / 2;
          gs.successIconOffset = -iconW;
          gs.successIconAlpha = 255;
        } else {
          gs.successIconW = 0;
          gs.successIconH = 0;
          gs.successIconCx = imgX + imgSize / 2;
          gs.successIconCy = imgTop + imgSize / 2;
          gs.successIconOffset = 0;
        }
        gs.successIconPhase = 'slide_in';
        gs.successIconTimer = 0.5;
        gs.eventPhase = 'success_icon';
        console.log('[Event] fade_out → success_icon slide_in');
        return;
      }
      gs._resumeFromEvent();
    }
  } else if (gs.eventPhase === 'success_icon') {
    gs.successIconTimer -= dt;
    if (gs.successIconPhase === 'slide_in') {
      if (gs.successIconTimer <= 0) {
        gs.successIconOffset = gs.successIconCx - gs.successIconW / 2;
        gs.successIconAlpha = 255;
        gs.successIconPhase = 'hold';
        gs.successIconTimer = 1.0;
      } else {
        const progress = 1 - gs.successIconTimer / 0.5;
        const targetX = gs.successIconCx - gs.successIconW / 2;
        gs.successIconOffset = targetX - gs.successIconW + progress * gs.successIconW;
        gs.successIconAlpha = Math.round(255 * progress);
      }
    } else if (gs.successIconPhase === 'hold') {
      if (gs.successIconTimer <= 0) {
        gs.successIconPhase = 'slide_out';
        gs.successIconTimer = 0.5;
      }
    } else if (gs.successIconPhase === 'slide_out') {
      if (gs.successIconTimer <= 0) {
        gs.successIconPhase = null;
        gs._resumeFromEvent();
      } else {
        const progress = 1 - gs.successIconTimer / 0.5;
        const targetX = gs.successIconCx - gs.successIconW / 2;
        gs.successIconOffset = targetX + progress * (gs.successIconW * 2);
        gs.successIconAlpha = Math.round(255 * (1 - progress));
      }
    }
  }
}

function _autoAdvanceEventFrame() {
  const gs = gameState;
  if (!gs) return;
  // 重置语音播放标记，使新帧可以触发语音
  gs._eventVoicePlayIndex = -1;
  const curFrame = gs.eventFrames[gs.eventFrameIndex];
  const nextIdx = gs.eventFrameIndex + 1;
  if (nextIdx < gs.eventFrames.length) {
    const nextFrame = gs.eventFrames[nextIdx];
    if (nextFrame.image !== curFrame.image) {
      gs.eventTransitionPhase = 'img_fade_out';
      gs.eventTransitionTimer = gs._EVENT_IMG_TRANSITION_DURATION;
      gs.eventNextFrameIndex = nextIdx;
    } else {
      gs.eventFrameIndex = nextIdx;
      gs.eventTypingIndex = 0;
      gs.eventAutoTimer = 0;
      // 同图帧推进：立即触发新帧语音（语音是背景旁白，覆盖多帧）
      _playEventVoice(gs);
    }
  } else {
    gs.eventPhase = 'fade_out';
    gs.eventFadeTimer = gs._EVENT_FADE_DURATION;
  }
}

/** 播放事件帧语音 */
function _playEventVoice(gs) {
  if (!gs || !gs.eventFrames || gs.eventFrameIndex < 0 || gs.eventFrameIndex >= gs.eventFrames.length) return;
  // 防止同一帧重复触发语音
  if (gs._eventVoicePlayIndex === gs.eventFrameIndex) return;
  const frame = gs.eventFrames[gs.eventFrameIndex];
  gs._eventVoicePlayIndex = gs.eventFrameIndex;
  if (!frame.voice) return;
  const voiceName = frame.voice.replace(/\.wav$/i, '');
  try { playVoice(voiceName); } catch (_) {}

  // ★ Python 原型算法：统计同图连续帧数，语音均分到每帧
  const buf = audioCache.get(`voices/${voiceName}.wav`);
  if (buf) {
    const voiceDuration = buf.duration;
    let frameCount = 1;
    for (let i = gs.eventFrameIndex + 1; i < gs.eventFrames.length; i++) {
      if (gs.eventFrames[i].image === frame.image) {
        frameCount++;
      } else {
        break;
      }
    }
    gs.eventVoiceFrameDelay = voiceDuration / frameCount;
  } else {
    gs.eventVoiceFrameDelay = 1.0;
  }
}

/** 计算事件帧的延迟时间（匹配 Python 原型行为） */
function _getEventFrameDelay(gs) {
  if (!gs || !gs.eventFrames || gs.eventFrameIndex < 0 || gs.eventFrameIndex >= gs.eventFrames.length) return 1.0;
  const frame = gs.eventFrames[gs.eventFrameIndex];

  // 空文字帧：0.3s（与 Python 一致）
  if (!frame.text || !frame.text.trim()) return 0.3;

  // 有语音延迟（由同图帧数均分语音时长得出）：使用它
  if (gs.eventVoiceFrameDelay > 0) return gs.eventVoiceFrameDelay;

  // 无语音：阅读速度估算（10 字/秒 + 0.5s 底数）
  const textLen = frame.text.length;
  const readingTime = textLen / 10 + 0.5;
  return Math.max(0.8, Math.min(readingTime, 3.0));
}

// ==================== 事件渲染 ====================

function drawEvent() {
  if (!gameState || gameState.mode !== 'event_trigger') return;
  const gs = gameState;
  if (gs.eventPhase === 'success_icon') {
    // 绘制事件图片（保持背景）
    if (gs.eventImage) {
      const img = getImage(gs.eventImage);
      if (img) {
        ctx.save();
        ctx.globalAlpha = 1;
        const imgSize = DESIGN_H * 0.25 * gs._EVENT_IMAGE_SCALE;
        const imgGap = gs._EVENT_IMG_GAP;
        const boxY = DESIGN_H - gs._EVENT_DIALOG_HEIGHT - 15;
        const imgBottom = boxY - imgGap;
        const imgTop = imgBottom - imgSize;
        const imgX = (DESIGN_W - imgSize) / 2;
        ctx.drawImage(img, imgX, imgTop, imgSize, imgSize);
        ctx.restore();
      }
    }
    // 绘制胜利图标（带滑入/保持/滑出动画）
    if (gs.successIconW > 0 && gs.successIconH > 0 && gs.successIconAlpha > 0) {
      const iconImg = getImage('UI_success_01.png');
      if (iconImg) {
        ctx.save();
        ctx.globalAlpha = gs.successIconAlpha / 255;
        const drawX = gs.successIconOffset;
        const drawY = gs.successIconCy - gs.successIconH / 2;
        ctx.drawImage(iconImg, drawX, drawY, gs.successIconW, gs.successIconH);
        ctx.restore();
      }
    }
    return;
  }
  if (!gs.eventImage) return;

  // 当前阶段 alpha
  let alpha;
  if (gs.eventPhase === 'fade_in' || gs.eventPhase === 'fade_out') {
    alpha = gs.eventAlpha;
  } else {
    alpha = gs.eventTransitionPhase ? gs.eventImgAlpha : 255;
  }
  if (alpha <= 0) return;

  // 事件对话框尺寸（与 Python 一致）
  const boxW = EVENT_DIALOG_WIDTH;   // 原 1125，拓宽至 1575
  const boxH = gs._EVENT_DIALOG_HEIGHT;   // 150
  const boxX = (DESIGN_W - boxW) / 2;
  const boxY = DESIGN_H - boxH - 15;  // DIALOG_BOTTOM_MARGIN = 15

  // 事件图片（放在对话框上方居中）
  const baseImgSize = DESIGN_H * 0.25;          // 270
  const imgSize = baseImgSize * gs._EVENT_IMAGE_SCALE;  // 270 * 3.3 = 891
  const imgGap = gs._EVENT_IMG_GAP;             // 5
  const imgBottom = boxY - imgGap;
  const imgTop = imgBottom - imgSize;
  const imgX = (DESIGN_W - imgSize) / 2;

  // 当前帧
  if (gs.eventFrameIndex < 0 || gs.eventFrameIndex >= gs.eventFrames.length) return;
  const frame = gs.eventFrames[gs.eventFrameIndex];
  const imgFile = frame.image;

  // 绘制事件图片
  const img = getImage(imgFile);
  if (img) {
    ctx.save();
    ctx.globalAlpha = alpha / 255;
    ctx.drawImage(img, imgX, imgTop, imgSize, imgSize);
    ctx.restore();
  }

  // 绘制事件对话框背景（使用 UI_dialogue_02.png 底图，与 Python 一致）
  ctx.save();
  ctx.globalAlpha = alpha / 255;
  const dlBg = getImage('UI_dialogue_02.png');
  if (dlBg) {
    ctx.drawImage(dlBg, boxX, boxY, boxW, boxH);
  } else {
    // 回退：半透明白底
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    _roundRectPath(ctx, boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    _roundRectPath(ctx, boxX, boxY, boxW, boxH, 8);
    ctx.stroke();
  }
  ctx.restore();

  // 事件文字（逐字跳出，黑色文字，与 Python FONT_SIZE-3=42 一致）
  const currentText = frame.text || '';
  const typingCount = Math.floor(gs.eventTypingIndex);
  const displayText = currentText.substring(0, typingCount);
  if (displayText) {
    ctx.save();
    ctx.globalAlpha = alpha / 255;
    ctx.fillStyle = '#000';
    ctx.font = `${42 * UI_SCALE}px "Microsoft YaHei", "SimHei", "Noto Serif SC", "SimSun", serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // 自动换行（与 Python 样式一致）
    const maxWidth = boxW - 120;
    const lineHeight = 52;
    const paddingTop = 28;
    const paddingLeft = 40;
    const lines = _wrapText(ctx, displayText, maxWidth);
    const maxLines = ((boxH - paddingTop - 20) / lineHeight) | 0;

    let y = boxY + paddingTop;
    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      ctx.fillText(lines[i], boxX + paddingLeft, y);
      y += lineHeight;
    }
    ctx.restore();
  }

  // ── 跳过动画按钮（与 Python 原型一致：对话框右上角上方） ──
  if (gs.eventPhase !== 'success_icon' && gs.eventPhase !== 'fade_out') {
    const skipW = 140 * UI_SCALE;
    const skipH = 48 * UI_SCALE;
    const skipGap = 8;
    const skipX = boxX + boxW - skipW;
    const skipY = boxY - skipH - skipGap;

    // 检测悬浮
    const hover = !_IS_MOBILE && (mouse.canvasX >= skipX && mouse.canvasX <= skipX + skipW &&
                   mouse.canvasY >= skipY && mouse.canvasY <= skipY + skipH);

    ctx.save();
    ctx.globalAlpha = alpha / 255;
    ctx.fillStyle = hover ? 'rgba(170,170,170,0.86)' : 'rgba(200,200,200,0.78)';
    _roundRectPath(ctx, skipX, skipY, skipW, skipH, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.78)';
    ctx.lineWidth = 2;
    _roundRectPath(ctx, skipX, skipY, skipW, skipH, 4);
    ctx.stroke();

    ctx.fillStyle = '#000';
    ctx.font = `bold ${28 * UI_SCALE}px "Microsoft YaHei", "SimHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('跳过动画', skipX + skipW / 2, skipY + skipH / 2);
    ctx.restore();
  }

  // ── 小三角形跳动提示（与 Python 一致：非自动推进 + 打字完成后显示） ──
  if (gs.eventPhase === 'display' && !gs.eventAutoAdvance && !gs.eventTransitionPhase) {
    const curFrame = gs.eventFrames[gs.eventFrameIndex];
    if (curFrame) {
      const text = curFrame.text || '';
      if (Math.floor(gs.eventTypingIndex) >= text.length) {
        const triSize = 33;
        const triOutline = 3;
        const bounceSpeed = 3.0;
        const bounceAmp = 12;
        const t = gs.hintAnimationTime * bounceSpeed;
        const bounceOffset = Math.abs(Math.sin(t * Math.PI)) * bounceAmp;
        const triCenterX = boxX + boxW / 2;
        const baseY = boxY + boxH - 3;
        const topY = baseY - triSize + bounceOffset;
        const bottomY = baseY + bounceOffset;
        ctx.save();
        ctx.globalAlpha = alpha / 255;
        // 黑色描边
        if (triOutline > 0) {
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.moveTo(triCenterX - triSize / 2 - triOutline, topY - triOutline);
          ctx.lineTo(triCenterX + triSize / 2 + triOutline, topY - triOutline);
          ctx.lineTo(triCenterX, bottomY + triOutline);
          ctx.closePath();
          ctx.fill();
        }
        // 绿色三角
        ctx.fillStyle = 'rgb(103,205,35)';
        ctx.beginPath();
        ctx.moveTo(triCenterX - triSize / 2, topY);
        ctx.lineTo(triCenterX + triSize / 2, topY);
        ctx.lineTo(triCenterX, bottomY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

/** 简易文本换行 */
function _wrapText(ctx2, text, maxWidth) {
  const lines = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const test = current + ch;
    if (ctx2.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** 简易圆角矩形路径（只创建路径，不填充/描边；与 ui.js 的 _roundRect 区分避免全局覆盖） */
function _roundRectPath(ctx2, x, y, w, h, r) {
  ctx2.beginPath();
  ctx2.moveTo(x + r, y);
  ctx2.lineTo(x + w - r, y);
  ctx2.arcTo(x + w, y, x + w, y + r, r);
  ctx2.lineTo(x + w, y + h - r);
  ctx2.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx2.lineTo(x + r, y + h);
  ctx2.arcTo(x, y + h, x, y + h - r, r);
  ctx2.lineTo(x, y + r);
  ctx2.arcTo(x, y, x + r, y, r);
  ctx2.closePath();
}

// ==================== UI 渲染 ====================

var _menuNeedsRedraw = false;

function renderUI() {
  if (!gameState) return;

  // 定位刷新按钮（紧贴场景名称标签左侧）
  positionReloadButton();

  // 场景转场黑幕期间隐藏所有DOM UI（按钮不覆盖黑屏，但保留游戏循环中绘制的淡入淡出层）
  if (gameState.fadePhase) {
    hideMenus();
    hideDialogBox();
    // 不 return，让 switch 处理 mode 切换 debug 日志
  }

  // 自动对话等待期间（_sceneEntryDelay > 0）隐藏场景菜单按钮，防止提前显示
  if (gameState._sceneEntryDelay > 0 && gameState.mode === 'menu' && !gameState._subMenu) {
    hideMenus();
  }

  // 每帧追踪模式（仅在变化时打印）
  if (gameState._debugLastMode !== gameState.mode || gameState._debugLastSubMenu !== gameState._subMenu) {
    console.log(`[DEBUG-MODE] mode=${gameState._debugLastMode}→${gameState.mode} subMenu=${gameState._debugLastSubMenu}→${gameState._subMenu}`);
    gameState._debugLastMode = gameState.mode;
    gameState._debugLastSubMenu = gameState._subMenu;
  }

  // 物品栏 — Canvas 绘制（由 inventory.js 的 drawInventoryCanvas 在游戏主循环中渲染）
  if (gameState._subMenu === 'inventory') {
    hideMenus();
    hideDialogBox();
    return;
  }

  // 选项菜单（ESC弹出）—— 无论当前 mode 是什么，优先绘制
  if (gameState._subMenu === 'options_menu') {
    hideMenus();
    hideDialogBox();
    drawOptionsMenu();
    return;
  }

  // 设置面板（从选项菜单进入）
  if (gameState._subMenu === 'settings') {
    hideMenus();
    hideDialogBox();
    drawSettings();             // Canvas 绘制全部内容（底图/标题/高亮/标签/滑块/返回按钮）
    return;
  }

  // 保存/读取游戏界面 — 全 Canvas 绘制（由游戏主循环 drawSaveFileMenu 渲染）
  if (gameState.uiMode === 'save' || gameState.uiMode === 'load') {
    hideMenus();
    hideDialogBox();
    return;
  }

  switch (gameState.mode) {
    case 'confrontation':
      hideMenus();
      // 陈述文本通过 DOM 对话框渲染（_showConfrontStatementDialog 调用 showDialogBox）
      // 对话框由 renderUI 默认流程中的 dialogBoxEl 自动管理
      // 但需要在 confrontation 模式下保持对话框可见并隐藏"略过对话"按钮
      if (dialogBoxEl) dialogBoxEl.style.display = 'block';
      if (skipBtnEl) skipBtnEl.style.display = 'none';
      break;
    case 'event_trigger':
      hideMenus();
      hideDialogBox();
      break;  // 事件完全由 Canvas drawEvent() 绘制，DOM 全隐藏
    case 'puzzle':
      hideMenus();
      hideDialogBox();
      break;  // 谜题完全由 Canvas drawPuzzle() 绘制，DOM 全隐藏
    case 'confrontation_intro_anim':
      hideMenus();
      hideDialogBox();
      break;  // 陈述开始动画：只显示立绘+背景，由 drawIntroAnim() Canvas 绘制
    case 'dialogue':
      hideMenus();
      // 调查触发的对话：调查层已在游戏循环中（立绘之前）绘制，此处不重复
      break;
    case 'save_prompt':
      hideMenus();
      // 对话框通过 showDialogBox() 已在 save_prompt 触发时显示，保持可见
      break;
    case 'choice_dialogue':
      hideMenus();
      // 选项对白：保持对话框可见（显示触发行文本），隐藏略过按钮，选项按钮由 Canvas 绘制
      if (dialogBoxEl) dialogBoxEl.style.display = 'block';
      if (skipBtnEl) skipBtnEl.style.display = 'none';
      break;
    case 'menu':
      // ── 转场中、等待自动对话、game over 中、或标题画面时，不显示场景菜单 ──
      if (gameState.fadePhase || gameState._pendingAutoTarget || gameState.gameOverActive || gameState.uiMode === 'title') {
        hideMenus();
        break;
      }
      const _menuDrawCond = gameState._subMenu === 'leave' ? _menuNeedsRedraw
          : (_menuNeedsRedraw || !menuContainerEl || menuContainerEl.style.display === 'none');
      if (!_menuDrawCond) {
        console.log(`[DEBUG-MENU] renderUI 条件false: _menuNeedsRedraw=${_menuNeedsRedraw} menuContainerEl=${!!menuContainerEl} display=${menuContainerEl?.style.display}`);
      }
      if (_menuDrawCond) {
        drawSceneMenu(gameState.menuOptions, gameState.sceneFocusIndex);
        _menuNeedsRedraw = false;
      }
      break;
    case 'investigation':
      hideMenus();
      if (gameState._invDialogueActive) {
        // 调查触发对话叠加：标记+放大镜+对话框同时可见
        drawInvestigation();
      } else {
        hideDialogBox();
        drawInvestigation();
      }
      // 鼠标移动跟随（鼠标模式，仅非对话时）
      if (!gameState._invDialogueActive && gamepad.focusByMouse && gameState.investigationActive) {
        gameState.investigationCursorX = mouse.canvasX;
        gameState.investigationCursorY = mouse.canvasY;
      }
      break;
    case 'item_feedback':
      // 物品反馈：DOM 全隐藏，Canvas drawItemFeedback() 绘制对话框+物品图片
      hideMenus();
      hideDialogBox();
      break;
    default:
      hideMenus();
      break;
  }

  // 更新 DOM 手柄图标（提示箭头切换等）
  updateGamepadDomIcons();
}

function hideMenus() {
  if (menuContainerEl) menuContainerEl.style.display = 'none';
  if (leaveContainerEl) leaveContainerEl.style.display = 'none';
  if (settingsContainerEl) settingsContainerEl.style.display = 'none';
}

// ==================== 输入处理：对话推进 ====================

/** 推进对话（空格键 / 鼠标点击对话框 / 触摸） */
let _lastAdvanceTime = 0;

function tryAdvanceDialogue() {
  if (!gameState) return;

  // 物品反馈 prompt 阶段：点击进入 fading（与 Python start_item_feedback_fade 一致）
  if (gameState.itemFeedbackActive && gameState.itemFeedbackPhase === 'prompt') {
    gameState.itemFeedbackPhase = 'fading';
    gameState.itemFeedbackTimer = 0.9; // ITEM_FEEDBACK_DURATION
    try { playSound('sfx_ui_confirm'); } catch (_) {}
    return;
  }

  if (gameState.mode !== 'dialogue') return;

  // 防连击：移动端 touchend + 模拟 click 会连续触发，300ms 内忽略重复
  const now = performance.now();
  if (now - _lastAdvanceTime < 300) return;
  _lastAdvanceTime = now;

  // 移动端：推进对话后激活全局保护，防止对话结束切到菜单时手指误触
  if (_IS_MOBILE) activateMobileGuard(300);

  console.log(`[TYPING-DEBUG] tryAdvanceDialogue 调用 advanceDialogue 前: mode=${gameState.mode} typingComplete=${gameState.typingComplete} typingIdx=${gameState.typingIndex}`);
  gameState.advanceDialogue();
  console.log(`[TYPING-DEBUG] tryAdvanceDialogue 返回: mode=${gameState.mode} typingComplete=${gameState.typingComplete} typingIdx=${gameState.typingIndex} fullTextLen=${gameState.fullText ? gameState.fullText.length : 0}`);
}

// 键盘空格 → 推进
window.addEventListener('keydown', e => {
  // 真实键盘按键 → 键盘焦点模式（与 Python KEYDOWN → focus_by_mouse=False 一致）
  // 手柄合成的键盘事件不切换，保持 input.js 中设置的 focusByMouse=false
  if (!gamepad._syntheticKey) {
    gamepad.focusByMouse = false;
  }

  // ── 标题画面键盘处理（与 Python 一致） ──
  if (gameState && gameState.uiMode === 'title') {
    // 标题弹出的设置面板：委托给通用设置面板键盘处理
    if (gameState._subMenu === 'settings') {
      // fall through to settings keyboard handler below
    } else {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        gamepad.focusByMouse = false;
        gameState.titleFocus = (gameState.titleFocus + 3) % 4;
        try { playSound('sfx_ui_cursor_move'); } catch (_) {}
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        gamepad.focusByMouse = false;
        gameState.titleFocus = (gameState.titleFocus + 1) % 4;
        try { playSound('sfx_ui_cursor_move'); } catch (_) {}
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        gamepad.focusByMouse = false;
        _handleTitleBtnClick(gameState.titleFocus);
        return;
      }
      return;
    }
  }

  // ── 保存/读取界面键盘处理（优先于对话/调查等模式） ──
  if (handleSaveKey(e.key)) { e.preventDefault(); return; }

  // 在 setupInputListeners 之外额外处理对话推进/物品反馈（不受 preventDefault 影响）
  if (gameState && (gameState.mode === 'dialogue' || (gameState.itemFeedbackActive && gameState.itemFeedbackPhase === 'prompt'))) {
    if (e.key === ' ' || e.key === 'Enter') {
      tryAdvanceDialogue();
      return;
    }
    // RB／Shift → 略过对话（与 Python K_LSHIFT / RB_BUTTON 一致）
    if (e.key === 'Shift' && gameState.mode === 'dialogue') {
      if (gameState.currentSequenceNodeId &&
          (gameState.playedSequences.has(gameState.currentSequenceNodeId) || gameState.testMode)) {
        gameState.skipDialogue();
      }
      e.preventDefault();
      return;
    }
  }
  // 事件模式：空格/Enter 推进文字或下一帧（与 Python K_SPACE/K_RETURN 一致）
  if (gameState && gameState.mode === 'event_trigger') {
    if ((e.key === ' ' || e.key === 'Enter') && !gameState.eventAutoAdvance) {
      if (gameState.eventPhase === 'display' && !gameState.eventTransitionPhase) {
        const curFrame = gameState.eventFrames[gameState.eventFrameIndex];
        if (curFrame) {
          const text = curFrame.text || '';
          const typingDone = Math.floor(gameState.eventTypingIndex) >= text.length;
          if (!typingDone && text) {
            gameState.eventTypingIndex = text.length;
          } else {
            const nextIdx = gameState.eventFrameIndex + 1;
            if (nextIdx < gameState.eventFrames.length) {
              const nextFrame = gameState.eventFrames[nextIdx];
              if (nextFrame.image !== curFrame.image) {
                gameState.eventTransitionPhase = 'img_fade_out';
                gameState.eventTransitionTimer = gameState._EVENT_IMG_TRANSITION_DURATION;
                gameState.eventNextFrameIndex = nextIdx;
              } else {
                gameState.eventFrameIndex = nextIdx;
                gameState.eventTypingIndex = 0;
                gameState.eventAutoTimer = 0;
              }
            } else {
              gameState.eventPhase = 'fade_out';
              gameState.eventFadeTimer = gameState._EVENT_FADE_DURATION;
            }
          }
        }
      }
      return;
    }
  }

  // ── 保存提示模式键盘处理（与 Python save_prompt 分支一致） ──
  if (gameState && gameState.mode === 'save_prompt') {
    // 任意子菜单打开时，保存提示不处理键盘，由子菜单处理器接管
    if (gameState._subMenu) {
      // 不做处理，走到下面的共同逻辑
    } else {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      gamepad.focusByMouse = false;
      // ↑ = -1（JS 的 % 对负数返回负值，需 +2 校正：0→1, 1→0, -1→1）
      gameState.savePromptButtonFocus = (gameState.savePromptButtonFocus - 1 + 2) % 2;
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      gamepad.focusByMouse = false;
      // ↓ = +1（0→1, 1→0, -1→0）
      gameState.savePromptButtonFocus = (gameState.savePromptButtonFocus + 1) % 2;
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // 无焦点（鼠标未悬停且无手柄）时不响应（与 Python 一致）
      if (gameState.savePromptButtonFocus < 0) return;
      if (gameState.savePromptButtonFocus === 0) {
        // 保存游戏 → 打开选项菜单（与 Python 一致）
        gameState._subMenu = 'options_menu';
        gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
        playSound('sfx_ui_confirm');
      } else if (gameState.savePromptButtonFocus === 1) {
        // 跳过保存 → 直接继续
        playSound('sfx_ui_confirm');
        gameState._continueFromSavePrompt();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      // ESC 等同于跳过保存（与 Python 一致）
      playSound('sfx_ui_cancel');
      gameState._continueFromSavePrompt();
      return;
    }
    return;
    }  // else end
  }  // save_prompt mode keyboard handler

  // ── 选项对白模式键盘处理（与 Python choice_dialogue 分支一致） ──
  if (gameState && gameState.mode === 'choice_dialogue' && gameState.choiceActive2) {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      gamepad.focusByMouse = false;
      const n = gameState.choiceList.length;
      gameState.choiceSelected = (gameState.choiceSelected - 1 + n) % n;
      try { playSound('sfx_ui_cursor_move'); } catch (_) {}
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      gamepad.focusByMouse = false;
      const n = gameState.choiceList.length;
      gameState.choiceSelected = (gameState.choiceSelected + 1) % n;
      try { playSound('sfx_ui_cursor_move'); } catch (_) {}
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      gameState.handleChoiceSelection(gameState.choiceSelected);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      // ESC 不允许（与 Python 一致）
      return;
    }
    return;
  }

  // ── 谜题模式键盘处理（与 Python 数字密码锁分支一致） ──
  if (gameState && gameState.mode === 'puzzle' && gameState.puzzlePhase === 'display') {
    gamepad.focusByMouse = false;
    // 类型 B：选图谜题键盘导航（与 Python 一致：左右选子图，上下选按钮）
    if (gameState.puzzleIsTypeB) {
      if (!gameState.puzzleKeyboardItems || gameState.puzzleKeyboardItems.length === 0) return;
      const items = gameState.puzzleKeyboardItems;
      const total = items.length;
      const curIdx = gameState.puzzleFocusIndex;
      const curItem = (curIdx >= 0 && curIdx < total) ? items[curIdx] : null;

      if (e.key === 'Escape') {
        e.preventDefault();
        puzzleReturn();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        gamepad.focusByMouse = false;
        if (typeof curItem === 'number') {
          // 在子图间左移
          const firstSubIdx = items.findIndex(item => typeof item === 'number');
          if (curIdx > firstSubIdx) {
            gameState.puzzleFocusIndex = curIdx - 1;
          }
        } else {
          // 在按钮上 → 跳到最后一个子图
          const subIndices = items.map((item, i) => ({ item, i })).filter(({ item }) => typeof item === 'number').map(({ i }) => i);
          if (subIndices.length > 0) {
            gameState.puzzleFocusIndex = Math.max(...subIndices);
          }
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        gamepad.focusByMouse = false;
        if (typeof curItem === 'number') {
          // 在子图间右移
          const subIndices = items.map((item, i) => ({ item, i })).filter(({ item }) => typeof item === 'number').map(({ i }) => i);
          const lastSubIdx = subIndices.length > 0 ? Math.max(...subIndices) : -1;
          if (curIdx < lastSubIdx) {
            gameState.puzzleFocusIndex = curIdx + 1;
          } else {
            // 到达最后一个子图 → 跳到第一个按钮
            const btnIndices = items.map((item, i) => ({ item, i })).filter(({ item }) => typeof item !== 'number').map(({ i }) => i);
            if (btnIndices.length > 0) {
              gameState.puzzleFocusIndex = Math.min(...btnIndices);
            }
          }
        }
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        gamepad.focusByMouse = false;
        if (typeof curItem !== 'number') {
          // 在按钮间上移
          const btnIndices = items.map((item, i) => ({ item, i })).filter(({ item }) => typeof item !== 'number').map(({ i }) => i);
          const minBtnIdx = btnIndices.length > 0 ? Math.min(...btnIndices) : -1;
          if (btnIndices.length > 0 && curIdx > minBtnIdx) {
            gameState.puzzleFocusIndex = curIdx - 1;
          }
        }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        gamepad.focusByMouse = false;
        if (typeof curItem !== 'number') {
          // 在按钮间下移
          const btnIndices = items.map((item, i) => ({ item, i })).filter(({ item }) => typeof item !== 'number').map(({ i }) => i);
          const maxBtnIdx = btnIndices.length > 0 ? Math.max(...btnIndices) : -1;
          if (btnIndices.length > 0 && curIdx < maxBtnIdx) {
            gameState.puzzleFocusIndex = curIdx + 1;
          }
        }
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        gamepad.focusByMouse = false;
        if (typeof curItem === 'number') {
          selectPuzzleSub(curItem, true);
        } else if (curItem === 'confirm') {
          puzzleConfirm();
        } else if (curItem === 'prev') {
          puzzlePrevPage();
        } else if (curItem === 'return') {
          puzzleReturn();
        }
        return;
      }
      // LSHIFT → 确定（与 Python RB 一致，始终触发）
      if (e.key === 'Shift') {
        e.preventDefault();
        puzzleConfirm();
        return;
      }
      // LB → 上一幅（始终触发）
      if (e.key === 'F4') {
        e.preventDefault();
        puzzlePrevPage();
        return;
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      puzzleReturn();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      const fi = gameState.puzzleFocusIndex;
      if (fi === 0) gameState.puzzleFocusIndex = 3;
      else if (fi === 1 || fi === 2) gameState.puzzleFocusIndex = fi - 1;
      else gameState.puzzleFocusIndex = 2;
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      const fi = gameState.puzzleFocusIndex;
      if (fi === 0) gameState.puzzleFocusIndex = 1;
      else if (fi === 1) gameState.puzzleFocusIndex = 2;
      else if (fi === 2) gameState.puzzleFocusIndex = 3;
      else gameState.puzzleFocusIndex = 0;
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      const fi = gameState.puzzleFocusIndex;
      if (fi < 3) {
        puzzleChangeDigit(fi, true);
      } else if (fi === 3) {
        gameState.puzzleFocusIndex = 0;
      } else {
        gameState.puzzleFocusIndex = 3;
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      const fi = gameState.puzzleFocusIndex;
      if (fi < 3) {
        puzzleChangeDigit(fi, false);
      } else if (fi === 3) {
        gameState.puzzleFocusIndex = 4;
      } else {
        gameState.puzzleFocusIndex = 0;
      }
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const fi = gameState.puzzleFocusIndex;
      if (fi < 3) {
        puzzleChangeDigit(fi, true);
      } else if (fi === 3) {
        puzzleConfirm();
      } else {
        puzzleReturn();
      }
      return;
    }
    // LSHIFT → 确定（与 Python RB 一致）
    if (e.key === 'Shift') {
      e.preventDefault();
      puzzleConfirm();
      return;
    }
  }
  // 调查模式：方向键移动光标
  if (gameState && gameState.mode === 'investigation') {
    const INV_KEY_SPEED = 400;
    let moved = false;
    if (e.key === 'ArrowUp')    { gameState.investigationCursorY -= INV_KEY_SPEED * 0.016; moved = true; }
    if (e.key === 'ArrowDown')  { gameState.investigationCursorY += INV_KEY_SPEED * 0.016; moved = true; }
    if (e.key === 'ArrowLeft')  { gameState.investigationCursorX -= INV_KEY_SPEED * 0.016; moved = true; }
    if (e.key === 'ArrowRight') { gameState.investigationCursorX += INV_KEY_SPEED * 0.016; moved = true; }
    if (moved) {
      gameState.investigationCursorX = Math.max(0, Math.min(DESIGN_W - 1, gameState.investigationCursorX));
      gameState.investigationCursorY = Math.max(0, Math.min(DESIGN_H - 1, gameState.investigationCursorY));
      gamepad.focusByMouse = false;
      gamepad.usingGamepad = false;
      e.preventDefault();
      return;
    }
    // Enter/Space 触发调查点或退出按钮/推进对话
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // 调查对话叠加中：推进对话
      if (gameState._invDialogueActive) {
        tryAdvanceDialogue();
        return;
      }
      // 检查是否悬停在退出按钮
      if (gameState._exitBtnRect) {
        const r = gameState._exitBtnRect;
        if (gameState.investigationCursorX >= r.x && gameState.investigationCursorX <= r.x + r.w &&
            gameState.investigationCursorY >= r.y && gameState.investigationCursorY <= r.y + r.h) {
          exitInvestigation();
          return;
        }
      }
      // 检查是否悬停在调查点上
      const point = investigationCheck(gameState);
      if (point) {
        investigationTrigger(point);
        return;
      }
      return;
    }
    // 手柄 B 键 / 键盘 Escape / B 键 → 退出调查（与 Python 一致）
    if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      exitInvestigation();
      return;
    }
    return;
  }

  // ── 质问模式 ──
  if (gameState && gameState.mode === 'confrontation') {
    const gs = gameState;

    // 子菜单打开时跳过 confront 专属处理，由下方公共子菜单处理器接管（与 save_prompt 一致）
    if (!gs._subMenu) {
      // 总结界面：← →（或 ↑ ↓）导航，Enter/Space 确认，Escape 退出
      if (gs._summaryOptions) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          gamepad.focusByMouse = false;
          const total = gs._summaryOptions.length;
          const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
          gs._summaryFocus = (gs._summaryFocus + dir + total) % total;
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          gamepad.focusByMouse = false;
          const opt = gs._summaryOptions[gs._summaryFocus];
          if (opt) handleSummarySelect(opt.action);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          handleSummarySelect('end');
          return;
        }
        // 总结界面：忽略其他按键（F1/F3 等不应穿透到质问处理器）
        if (e.key === 'F1' || e.key === 'F2' || e.key === 'F3' || e.key === 'F4' || e.key === 'F6' || e.key === 'Tab' || e.key === 'Shift') {
          e.preventDefault();
        }
        return;
      }

      // 陈述导航：← → 切换（与 Python confrontation_next/prev 一致：最后一句按右触发 outro）
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const total = gs.confrontationStatements.length;
        if (e.key === 'ArrowRight') {
          if (gs.confrontationIndex < total - 1) {
            gs.confrontationIndex++;
            _showConfrontStatementDialog();
          } else {
            _triggerConfrontOutro();
          }
        } else {
          if (gs.confrontationIndex > 0) {
            gs.confrontationIndex--;
            _showConfrontStatementDialog();
          }
        }
        return;
      }

      // 按钮焦点：↑ ↓ 切换（追问/举证）
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        gs.confrontationButtonFocus = (gs.confrontationButtonFocus + 1) % 2;
        return;
      }

      // Enter/Space → 确认按钮操作（与 Python 一致：focus 0=举证, 1=追问）
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (gs.confrontationButtonFocus === 0) {
          executeProof();
        } else {
          executeFollowUp();
        }
        return;
      }

      // F1（手柄 Y 键）→ 举证快捷键（质问模式，与 Enter + focus 0 一致）
      if (e.key === 'F1') {
        e.preventDefault();
        gamepad.focusByMouse = false;
        executeProof();
        return;
      }
      // F3（手柄 X 键）→ 追问快捷键（质问模式，与 Enter + focus 1 一致）
      if (e.key === 'F3') {
        e.preventDefault();
        gamepad.focusByMouse = false;
        executeFollowUp();
        return;
      }

      return;
    }
    // _subMenu 活跃时，不 return，继续走到下方的公共子菜单处理器
  }

  // 菜单导航——包括 options_menu/settings 子面板（mode 为 menu / save_prompt / confrontation 时均生效）
  if (gameState && (gameState.mode === 'menu' || gameState.mode === 'save_prompt' || gameState.mode === 'confrontation')) {
    // Options menu: left/right for 3 buttons
    if (gameState._subMenu === 'options_menu') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const dir = (e.key === 'ArrowRight') ? 1 : -1;
        gameState.optionsMenuFocus = (gameState.optionsMenuFocus + dir + OPTIONS_MENU_BTNS.length) % OPTIONS_MENU_BTNS.length;
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        _execOptionsMenuChoice(gameState.optionsMenuFocus);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        // 防连发：刚打开 options_menu 时忽略立刻到来的第二个 Escape（Xbox Start 键硬件双发）
        if (gameState._subMenu === 'options_menu' && gameState._optionsMenuOpenTime && 
            (performance.now() - gameState._optionsMenuOpenTime) < 200) {
          return;
        }
        gameState._subMenu = null;
        return;
      }
      return;
    }
    // Settings: up/down for 4 items (静音/BGM/SFX/返回)
    if (gameState._subMenu === 'settings') {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const dir = (e.key === 'ArrowDown') ? 1 : -1;
        gameState.settingsMenuFocus = ((gameState.settingsMenuFocus || 0) + dir + 4) % 4;
        gamepad.focusByMouse = false;
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const f = gameState.settingsMenuFocus || 0;
        if (f === 0) {
          gameState.muted = !gameState.muted;
          saveSettings();
        } else {
          const delta = (e.key === 'ArrowRight') ? 0.05 : -0.05;
          if (f === 1) {
            gameState.bgmVolume = Math.max(0, Math.min(1, gameState.bgmVolume + delta));
            saveSettings();
          } else if (f === 2) {
            gameState.sfxVolume = Math.max(0, Math.min(1, gameState.sfxVolume + delta));
            saveSettings();
          }
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const f = gameState.settingsMenuFocus || 0;
        if (f === 0) {
          gameState.muted = !gameState.muted;
          saveSettings();
        } else if (f === 3) { _closeSettings(); }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        _closeSettings();
        return;
      }
      return;
    }
    // Leave menu: 上/下选择目的地或返回按钮
    if (gameState._subMenu === 'leave') {
      const dests = gameState.menuDestinations || [];
      const total = dests.length + 1; // + 返回
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const dir = (e.key === 'ArrowDown') ? 1 : -1;
        gameState.sceneFocusIndex = (gameState.sceneFocusIndex + dir + total) % total;
        gamepad.focusByMouse = false;
        _menuNeedsRedraw = true;
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        gameState.menuConfirm();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        gameState.closeLeaveMenu();
        return;
      }
      return;
    }
    // 物品栏：← → 导航，Enter 展示，Escape 关闭，↑ ↓ 切换物品/人物
    // 手柄 Y（F1）→ 展示/举证/想法，RB（Shift）→ 切换物品/人物
    if (gameState._subMenu === 'inventory') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        gameState.inventoryPrev();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        gameState.inventoryNext();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Shift') {
        e.preventDefault();
        gameState.toggleInventoryMode();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'F1') {
        e.preventDefault();
        // 与 inventory.js 点击逻辑一致：根据 inventoryAction 分发
        if (gameState.inventoryAction === 'show' || gameState.inventoryAction === 'proof') {
          gameState.inventoryShowItem();
        } else {
          gameState.inventoryShowThought();
        }
        return;
      }
      if (e.key === 'Escape' || e.key === 'F2') {
        e.preventDefault();
        // 举证对白模式下不允许 ESC 退出物品栏（与 Python 一致）
        if (gameState._inProofInterrupt) return;
        _hideInventory();
        return;
      }
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      gamepad.focusByMouse = false;
      if (e.key === 'ArrowUp') gameState.menuMoveUp();
      else gameState.menuMoveDown();
      _menuNeedsRedraw = true;
      return;
    }
    // ← → 底部按钮同排切换：物品栏 ↔ 调查（与 Python 一致）
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const optCount = gameState.menuOptions.length;
      const maxFocus = optCount + gameState.bottomButtonCount() - 1;
      if (gameState.sceneFocusIndex >= optCount && gameState.sceneFocusIndex <= maxFocus) {
        e.preventDefault();
        gamepad.focusByMouse = false;
        // 仅在 物品栏(optCount) 和 调查(optCount+1) 之间切换；离开此地不变
        if (gameState.sceneFocusIndex === optCount) {
          gameState.sceneFocusIndex = optCount + 1;
        } else if (gameState.sceneFocusIndex === optCount + 1) {
          gameState.sceneFocusIndex = optCount;
        }
        _menuNeedsRedraw = true;
        return;
      }
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      gamepad.focusByMouse = false;
      gameState.menuConfirm();
      return;
    }
    // 键盘 Escape（手柄 B）→ scene_ 节点打开选项菜单，子菜单返回上级（与 Python 一致）
    // 手柄 Start（F6）→ 仅在 scene_ 节点打开选项菜单
    if (e.key === 'Escape') {
      e.preventDefault();
      gamepad.focusByMouse = false;
      if (gameState.menuNodeId && gameState.menuNodeId.startsWith('scene_')) {
        // 顶层场景菜单 → 打开选项菜单（与 Python scene_ 节点一致）
        playSound('sfx_ui_skip');
        gameState._subMenu = 'options_menu';
        gameState._optionsMenuOpenTime = performance.now();
        gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
        hideMenus();
        hideDialogBox();
      } else {
        // 子菜单 → 返回上一级（与 Python return_to_last_menu 一致）
        gameState.returnToLastMenu();
      }
      return;
    }
    if (e.key === 'F6') {
      e.preventDefault();
      gamepad.focusByMouse = false;
      // Start 键仅在顶层场景菜单打开选项菜单（与 Python 一致）
      if (gameState.menuNodeId && gameState.menuNodeId.startsWith('scene_')) {
        playSound('sfx_ui_skip');
        gameState._subMenu = 'options_menu';
        gameState._optionsMenuOpenTime = performance.now();
        gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
        hideMenus();
        hideDialogBox();
      }
      return;
    }
    // I 键 → 物品栏（仅在场景菜单模式下可用，渐进教学时禁用）
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      gamepad.focusByMouse = false;
      if (gameState.mode === 'menu' && !gameState._subMenu && !gameState._hideInventoryBtn) {
        gameState.showInventoryMenu('thought');
      }
      return;
    }
    // F1（手柄 Y 键）→ 打开离开菜单（scene menu 模式）
    if (e.key === 'F1') {
      e.preventDefault();
      if (gameState.mode === 'menu' && !gameState._subMenu) {
        gameState.openLeaveMenu();
      }
      return;
    }
    // F2（手柄 BACK 键）→ 打开物品栏（scene menu 模式）
    if (e.key === 'F2') {
      e.preventDefault();
      if (gameState.mode === 'menu' && !gameState._subMenu && !gameState._hideInventoryBtn) {
        gameState.showInventoryMenu('thought');
      }
      return;
    }
    // F3（手柄 X 键）→ 进入调查模式（scene menu 模式）
    if (e.key === 'F3') {
      e.preventDefault();
      if (gameState.mode === 'menu' && !gameState._subMenu) {
        gameState.startInvestigation();
      }
      return;
    }
  }

  // ── 存档/读档界面键盘处理 ──
  if (gameState && (gameState.uiMode === 'save' || gameState.uiMode === 'load')) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      gameState.saveIndexFocus = (gameState.saveIndexFocus - 1 + SAVE_COUNT) % SAVE_COUNT;
      playSound('sfx_ui_cursor_move');
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      gameState.saveIndexFocus = (gameState.saveIndexFocus + 1) % SAVE_COUNT;
      playSound('sfx_ui_cursor_move');
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      _executeSave(gameState.saveIndexFocus);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (gameState.uiMode === 'load') {
        // 读档从标题画面进入 → 返回标题
        gameState.uiMode = null;
        playSound('sfx_ui_cancel');
      } else {
        // 存档从选项菜单进入 → 返回选项菜单
        gameState.uiMode = null;
        gameState._subMenu = 'options_menu';
        gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
        playSound('sfx_ui_cancel');
      }
      return;
    }
    return;
  }

  // F6（手柄 START）→ 打开选项菜单（仅在场景菜单模式下有效）
  if (e.key === 'F6') {
    e.preventDefault();
    if (!gameState) return;
    if (gameState.mode === 'menu' && !gameState._subMenu) {
      gameState._subMenu = 'options_menu';
      gameState._optionsMenuOpenTime = performance.now();
      gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
    }
    return;
  }

  // ESC → 选项菜单（仅在场景菜单模式有效）
  if (e.key === 'Escape') {
    e.preventDefault();
    if (!gameState) return;

    // 已在选项菜单的子面板中 → 返回上一级
    if (gameState._subMenu === 'settings') {
      _closeSettings();
      return;
    }
    if (gameState._subMenu === 'options_menu') {
      const inSavePrompt = (gameState.mode === 'save_prompt');
      const inConfrontSummary = gameState._confrontationSummaryExitRequested;
      gameState._subMenu = null;
      gameState._confrontationSummaryExitRequested = false;
      // 在 save_prompt 模式下关闭选项菜单 → 继续剧情（与 Python 一致）
      if (inSavePrompt) {
        playSound('sfx_ui_cancel');
        gameState._continueFromSavePrompt();
      }
      // 审理质问保存后关闭选项菜单 → 回到总结界面（与 Python 一致）
      if (inConfrontSummary) {
        playSound('sfx_ui_cancel');
      }
      return;
    }

    // 仅在场景菜单模式下打开选项菜单
    if (gameState.mode === 'menu') {
      gameState._subMenu = 'options_menu';
      gameState._optionsMenuOpenTime = performance.now();
      gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
    }
    return;
  }
});

// 鼠标按下 → 设置面板滑块开始拖拽
document.addEventListener('mousedown', e => {
  if (!gameState || gameState._subMenu !== 'settings' || e.button !== 0) return;
  const pos = screenToCanvas(e.clientX, e.clientY);
  const r = (rect) => rect && pos.x >= rect.x && pos.x <= rect.x + rect.w && pos.y >= rect.y && pos.y <= rect.y + rect.h;

  if (r(gameState._settingsBgmRect)) {
    const ratio = Math.max(0, Math.min(1, (pos.x - gameState._settingsBgmRect.x) / gameState._settingsBgmRect.w));
    gameState.bgmVolume = ratio;
    gameState._settingsDragging = 'bgm';
    saveSettings();
  } else if (r(gameState._settingsSfxRect)) {
    const ratio = Math.max(0, Math.min(1, (pos.x - gameState._settingsSfxRect.x) / gameState._settingsSfxRect.w));
    gameState.sfxVolume = ratio;
    gameState._settingsDragging = 'sfx';
    saveSettings();
  }
});

// 鼠标松开 → 停止设置面板滑块拖拽
document.addEventListener('mouseup', e => {
  if (gameState) gameState._settingsDragging = null;
});

// 鼠标点击对话框 → 推进 / 调查点击
document.addEventListener('click', e => {
  if (!gameState) return;

  // 移动端：全局防连击保护（与 touchend handler 共用）
  if (isMobileGuardActive()) { dbgPush(`CLICK guard拦截 tm=${gameState.testMode}`); return; }

  const pos = screenToCanvas(e.clientX, e.clientY);
  const targetTag = e.target ? (e.target.tagName || '?') + (e.target.id ? '#' + e.target.id : '') + (e.target.className ? '.' + e.target.className : '') : '?';
  dbgPush(`CLICK ui=${gameState.uiMode} tm=${gameState.testMode} x=${pos.x.toFixed(0)} y=${pos.y.toFixed(0)}`);

  // ── 标题画面点击 ──
  if (gameState.uiMode === 'title') {
    // 标题弹出的设置面板：委托给通用设置面板点击处理
    if (gameState._subMenu === 'settings') {
      // fall through to settings click handler below
    } else {
      // 测试按钮点击（移动端由 touchend 处理，click 仅 PC）
      if (!_IS_MOBILE && gameState._testBtnRect) {
        const r = gameState._testBtnRect;
        if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) {
          gameState.testMode = !gameState.testMode;
          try { playSound('sfx_ui_confirm'); } catch (_) {}
          console.log(`[Title] 测试模式: ${gameState.testMode ? '开' : '关'} (PC click x=${pos.x.toFixed(0)} y=${pos.y.toFixed(0)})`);
          dbgPush(`TM-TOGGLE ${gameState.testMode ? '开' : '关'} PC-click`);
          return;
        }
      }
      for (let i = 0; i < gameState.titleBtnRects.length; i++) {
        const r = gameState.titleBtnRects[i];
        if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) {
          console.log(`[CLICK-TITLE-BTN] index=${i} text=${TITLE_BTN_TEXTS[i]} testMode=${gameState.testMode} _IS_MOBILE=${_IS_MOBILE}`);
          dbgPush(`CLICK-BTN ${TITLE_BTN_TEXTS[i]} tm=${gameState.testMode}`);
          _handleTitleBtnClick(i);
          return;
        }
      }
      return;
    }
  }

  // ── 保存/读取游戏界面点击 ──
  if (gameState.uiMode === 'save' || gameState.uiMode === 'load') {
    handleSaveClick(pos.x, pos.y);
    return;
  }

  // ── 保存提示模式点击（与 Python save_prompt 分支一致） ──
  if (gameState.mode === 'save_prompt') {
    // 任意子菜单打开时，保存提示不处理点击，由子菜单处理器接管
    if (gameState._subMenu) {
      // 不做处理
    } else {
      // 保存游戏按钮
      const saveRect = gameState.savePromptBtnSave;
      if (saveRect && pos.x >= saveRect.x && pos.x <= saveRect.x + saveRect.w && pos.y >= saveRect.y && pos.y <= saveRect.y + saveRect.h) {
        playSound('sfx_ui_confirm');
        // 保存游戏 → 打开选项菜单（与 Python 一致）
        gameState._subMenu = 'options_menu';
        gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
        return;
      }
      // 跳过保存按钮
      const skipRect = gameState.savePromptBtnSkip;
      if (skipRect && pos.x >= skipRect.x && pos.x <= skipRect.x + skipRect.w && pos.y >= skipRect.y && pos.y <= skipRect.y + skipRect.h) {
        playSound('sfx_ui_confirm');
        gameState._continueFromSavePrompt();
        return;
      }
      return;
    }
  }

  // 选项菜单（ESC弹出）优先级最高
  if (gameState._subMenu === 'options_menu') {
    console.log('[DEBUG-CLICK] → handleOptionsMenuClick');
    handleOptionsMenuClick(pos.x, pos.y);
    return;
  }

  // 设置面板（Canvas绘制，通过rect检测点击）
  if (gameState._subMenu === 'settings') {
    console.log('[DEBUG-CLICK] → settings handler');
    const r = (rect) => rect && pos.x >= rect.x && pos.x <= rect.x + rect.w && pos.y >= rect.y && pos.y <= rect.y + rect.h;

    // 返回按钮
    if (r(gameState._settingsBackRect)) {
      _closeSettings();
      return;
    }

    // 静音开关
    if (r(gameState._settingsMuteRect)) {
      gameState.muted = !gameState.muted;
      saveSettings();
      return;
    }

    // 滑块：点击直接跳到该位置（拖拽由 mousedown + game loop 处理）
    if (r(gameState._settingsBgmRect)) {
      const ratio = Math.max(0, Math.min(1, (pos.x - gameState._settingsBgmRect.x) / gameState._settingsBgmRect.w));
      gameState.bgmVolume = ratio;
      saveSettings();
      return;
    }
    if (r(gameState._settingsSfxRect)) {
      const ratio = Math.max(0, Math.min(1, (pos.x - gameState._settingsSfxRect.x) / gameState._settingsSfxRect.w));
      gameState.sfxVolume = ratio;
      saveSettings();
      return;
    }

    // 点击空白区域不关闭（只有返回按钮/ESC才能退出）
    return;
  }

  // ── 物品反馈动画：点击推进（优先于物品栏等其他模式） ──
  if (gameState.itemFeedbackActive && gameState.itemFeedbackPhase === 'prompt') {
    tryAdvanceDialogue();
    return;
  }

  // ── 物品栏（Canvas绘制）：点击处理 ──
  if (gameState._subMenu === 'inventory') {
    if (inventoryCanvasClick(pos.x, pos.y)) return;
    return;
  }

  // ── 质问模式：点击按钮 ──
  if (gameState.mode === 'confrontation') {
    // 总结按钮
    if (gameState._summaryBtnRects) {
      for (const btn of gameState._summaryBtnRects) {
        if (pos.x >= btn.x && pos.x <= btn.x + btn.w && pos.y >= btn.y && pos.y <= btn.y + btn.h) {
          handleSummarySelect(btn.action);
          return;
        }
      }
    }
    // 追问/举证按钮
    if (gameState._confrontationBtnRects) {
      for (const btn of gameState._confrontationBtnRects) {
        if (pos.x >= btn.x && pos.x <= btn.x + btn.w && pos.y >= btn.y && pos.y <= btn.y + btn.h) {
          if (_IS_MOBILE) activateMobileGuard(500);
          if (btn.action === 'follow_up') {
            executeFollowUp();
          } else if (btn.action === 'proof') {
            executeProof();
          }
          return;
        }
      }
    }
    // 左右箭头点击（与 Python 箭头点击检测一致）
    if (gameState._confrontArrowLeft) {
      const a = gameState._confrontArrowLeft;
      if (pos.x >= a.x && pos.x <= a.x + a.w && pos.y >= a.y && pos.y <= a.y + a.h) {
        const total = gameState.confrontationStatements.length;
        gameState.confrontationIndex = Math.max(0, (gameState.confrontationIndex - 1 + total) % total);
        _showConfrontStatementDialog();
        return;
      }
    }
    if (gameState._confrontArrowRight) {
      const a = gameState._confrontArrowRight;
      if (pos.x >= a.x && pos.x <= a.x + a.w && pos.y >= a.y && pos.y <= a.y + a.h) {
        const total = gameState.confrontationStatements.length;
        const idx = gameState.confrontationIndex;
        if (idx < total - 1) {
          // 未到最后一句：翻到下一句
          gameState.confrontationIndex = idx + 1;
          _showConfrontStatementDialog();
        } else {
          // 最后一句：触发 outro（与 Python confrontation_next 一致）
          _triggerConfrontOutro();
        }
        return;
      }
    }
    return;
  }

  // ── 事件模式：点击推进文字/下一帧 + 跳过按钮 ──
  if (gameState.mode === 'event_trigger') {
    if (gameState.eventPhase === 'success_icon' || gameState.eventPhase === 'fade_out') {
      console.log(`[DEBUG-SKIP] 跳过被拦截: phase=${gameState.eventPhase} 不处理点击`);
      return;
    }
    // 先检查跳过按钮
    const boxW = EVENT_DIALOG_WIDTH;
    const boxH = gameState._EVENT_DIALOG_HEIGHT || 150;
    const boxX = (DESIGN_W - boxW) / 2;
    const boxY = DESIGN_H - boxH - 15;
    const skipW = 140 * UI_SCALE;
    const skipH = 48 * UI_SCALE;
    const skipGap = 8;
    const skipX = boxX + boxW - skipW;
    const skipY = boxY - skipH - skipGap;
    console.log(`[DEBUG-SKIP] 点击坐标: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) | 跳过按钮区域: x=[${skipX.toFixed(1)}, ${(skipX+skipW).toFixed(1)}] y=[${skipY.toFixed(1)}, ${(skipY+skipH).toFixed(1)}] | phase=${gameState.eventPhase} | autoAdvance=${gameState.eventAutoAdvance} | frameIndex=${gameState.eventFrameIndex}/${gameState.eventFrames ? gameState.eventFrames.length : '?'} | _IS_MOBILE=${_IS_MOBILE} | UI_SCALE=${UI_SCALE}`);
    if (pos.x >= skipX && pos.x <= skipX + skipW && pos.y >= skipY && pos.y <= skipY + skipH) {
      console.log(`[DEBUG-SKIP] 命中跳过按钮！准备调用 skipEvent()`);
      gameState.skipEvent();
      console.log(`[DEBUG-SKIP] skipEvent 调用完毕, phase=${gameState.eventPhase}`);
      return;
    } else {
      console.log(`[DEBUG-SKIP] 未命中跳过按钮, 继续检查事件推进`);
    }
    // display 阶段：点击推进文字或下一帧（与 Python 一致）
    if (!gameState.eventAutoAdvance && gameState.eventPhase === 'display' && !gameState.eventTransitionPhase) {
      const curFrame = gameState.eventFrames[gameState.eventFrameIndex];
      if (curFrame) {
        const text = curFrame.text || '';
        const typingDone = Math.floor(gameState.eventTypingIndex) >= text.length;
        if (!typingDone && text) {
          // 打字未完成 → 立即显示全文
          gameState.eventTypingIndex = text.length;
        } else {
          // 推进到下一帧
          const nextIdx = gameState.eventFrameIndex + 1;
          if (nextIdx < gameState.eventFrames.length) {
            const nextFrame = gameState.eventFrames[nextIdx];
            if (nextFrame.image !== curFrame.image) {
              gameState.eventTransitionPhase = 'img_fade_out';
              gameState.eventTransitionTimer = gameState._EVENT_IMG_TRANSITION_DURATION;
              gameState.eventNextFrameIndex = nextIdx;
            } else {
              gameState.eventFrameIndex = nextIdx;
              gameState.eventTypingIndex = 0;
              gameState.eventAutoTimer = 0;
            }
          } else {
            // 最后一帧 → 淡出
            gameState.eventPhase = 'fade_out';
            gameState.eventFadeTimer = gameState._EVENT_FADE_DURATION;
          }
        }
      }
      return;
    }
    return;
  }

  // 菜单模式（场景菜单 + 离开菜单）：空白区域点击不响应（按钮由HTML元素独立处理，stopPropagation已保护）
  if (gameState.mode === 'menu') { console.log('[DEBUG-CLICK] → menu mode — skipping'); return; }

  // ── 谜题模式：点击箭头/按钮（与 Python 鼠标点击逻辑一致） ──
  if (gameState.mode === 'puzzle') {
    if (gameState.puzzlePhase !== 'display') return;
    // 触摸来源的点击跳过（touchend handler 单独处理谜题交互，避免重复触发 +2）
    if (mouse._isTouch) {
      gameState._invTouchHandledClick = false;
      return;
    }
    gamepad.focusByMouse = true;
    const mx = pos.x, my = pos.y;

    // 类型 B：选图谜题点击（子图选中/取消）
    if (gameState.puzzleIsTypeB) {
      if (puzzleTypeBClick(mx, my)) return;
      // 子图未命中时继续检测确定/返回按钮（与类型 A 共用 rect）
    }

    // 返回按钮
    if (gameState.puzzleReturnRect) {
      const r = gameState.puzzleReturnRect;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        puzzleReturn();
        return;
      }
    }
    // 确定按钮
    if (gameState.puzzleConfirmRect) {
      const r = gameState.puzzleConfirmRect;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        puzzleConfirm();
        return;
      }
    }
    // 箭头
    for (let i = 0; i < gameState.puzzleArrowRects.length; i++) {
      const r = gameState.puzzleArrowRects[i];
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        const digitIdx = Math.floor(i / 2);
        const isUp = (i % 2 === 0);
        puzzleChangeDigit(digitIdx, isUp);
        return;
      }
    }
    return;
  }

  // 调查模式：点击调查点或退出按钮
  if (gameState.mode === 'investigation') {
    // 触摸来源的点击跳过（touchend handler 单独处理调查交互）
    if (mouse._isTouch) {
      gameState._invTouchHandledClick = false;
      return;
    }

    // 检查退出按钮
    if (gameState._exitBtnRect) {
      const r = gameState._exitBtnRect;
      if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) {
        exitInvestigation();
        return;
      }
    }

    // 检查调查点（用点击位置）
    for (const pt of gameState.investigationPoints) {
      if (Math.abs(pos.x - pt.x) <= INV_CLOSE_RANGE && Math.abs(pos.y - pt.y) <= INV_CLOSE_RANGE) {
        investigationTrigger(pt);
        return;
      }
    }
    return;
  }

  // 选项对白模式：点击按钮选择
  if (gameState.mode === 'choice_dialogue' && gameState.choiceActive2) {
    const mx = pos.x, my = pos.y;
    for (let i = 0; i < gameState.choiceBtnRects.length; i++) {
      const r = gameState.choiceBtnRects[i];
      if (r && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        gameState.handleChoiceSelection(i);
        return;
      }
    }
    return;
  }

  if (gameState.mode !== 'dialogue' && !(gameState.itemFeedbackActive && gameState.itemFeedbackPhase === 'prompt')) return;
  // 任意位置点击均可推进对话/物品反馈（不限于对话框区域）
  tryAdvanceDialogue();
});

// 触摸开始 → 光标跟随手指
document.addEventListener('touchstart', e => {
  if (!gameState) return;
  if (gameState.mode === 'dialogue') return;

  // ── 选项对白移动端触摸高亮 ──
  if (_IS_MOBILE && gameState.mode === 'choice_dialogue' && gameState.choiceActive2) {
    const mx = mouse.canvasX, my = mouse.canvasY;
    for (let i = 0; i < gameState.choiceBtnRects.length; i++) {
      const r = gameState.choiceBtnRects[i];
      if (r && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        gameState.choiceSelected = i;
        break;
      }
    }
  }

  if (gameState.mode === 'investigation' && !gameState._invDialogueActive) {
    // 光标跳到手指位置
    gameState.investigationCursorX = mouse.canvasX;
    gameState.investigationCursorY = mouse.canvasY;
  }

  // ── 设置面板移动端触摸高亮 ──
  if (_IS_MOBILE && gameState._subMenu === 'settings') {
    const mx = mouse.canvasX, my = mouse.canvasY;
    let touched = -1;
    // 检测三行设置项
    if (gameState._settingsRowRects) {
      for (let i = 0; i < gameState._settingsRowRects.length; i++) {
        const rr = gameState._settingsRowRects[i];
        if (mx >= rr.x && mx <= rr.x + rr.w && my >= rr.y && my <= rr.y + rr.h) {
          touched = i; break;
        }
      }
    }
    // 检测返回按钮
    if (touched < 0 && gameState._settingsBackRect) {
      const r = gameState._settingsBackRect;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) touched = 3;
    }
    if (touched >= 0) {
      gameState.settingsMenuFocus = touched;
    }
  }

  // ── 选项菜单移动端触摸高亮 ──
  if (_IS_MOBILE && gameState._subMenu === 'options_menu') {
    const mx = mouse.canvasX, my = mouse.canvasY;
    // 检测三个菜单按钮
    if (gameState._optionsBtnRects) {
      for (const r of gameState._optionsBtnRects) {
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          gameState.optionsMenuFocus = r.index;
          break;
        }
      }
    }
  }

  // ── 存档/读取界面移动端触摸高亮 ──
  if (_IS_MOBILE && (gameState.uiMode === 'save' || gameState.uiMode === 'load')) {
    const mx = mouse.canvasX, my = mouse.canvasY;
    // 检测7个存档槽位
    if (gameState._saveBtnRects) {
      for (const r of gameState._saveBtnRects) {
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          gameState.saveIndexFocus = r.index;
          break;
        }
      }
    }
  }

  // ── 标题画面移动端触摸高亮 ──
  if (_IS_MOBILE && gameState.uiMode === 'title' && !gameState._subMenu) {
    const mx = mouse.canvasX, my = mouse.canvasY;
    // 检测4个主菜单按钮
    if (gameState.titleBtnRects) {
      for (let i = 0; i < gameState.titleBtnRects.length; i++) {
        const r = gameState.titleBtnRects[i];
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          gameState.titleFocus = i;
          break;
        }
      }
    }
  }
});

// 触摸移动 → 光标跟随手指滑动（绝对位置）
document.addEventListener('touchmove', e => {
  if (!gameState || gameState.mode !== 'investigation') return;
  if (gameState._invDialogueActive) return;

  // 光标实时跟随手指，mouse.canvasX/Y 已由 input.js 更新
  gameState.investigationCursorX = mouse.canvasX;
  gameState.investigationCursorY = mouse.canvasY;
});

// 触摸结束 → 手指在调查点附近则触发
document.addEventListener('touchend', e => {
  if (!gameState) return;

  // ── 全局移动端防连击保护（200ms）──
  // 覆盖所有 Canvas 按钮：设置面板、选项菜单、存档/读取、质问按钮、调查退出等
  if (isMobileGuardActive()) return;
  activateMobileGuard();

  console.log(`[DEBUG-TOUCHEND] mode=${gameState.mode} subMenu=${gameState._subMenu}`);

  // ── 标题画面：测试按钮（touchend 处理，click 被 guard 拦截） ──
  if (_IS_MOBILE && gameState.uiMode === 'title' && !gameState._subMenu) {
    const mx = mouse.canvasX, my = mouse.canvasY;
    if (gameState._testBtnRect) {
      const r = gameState._testBtnRect;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        gameState.testMode = !gameState.testMode;
        try { playSound('sfx_ui_confirm'); } catch (_) {}
        dbgPush(`TM-TOGGLE ${gameState.testMode ? '开' : '关'} touchend x=${mx.toFixed(0)} y=${my.toFixed(0)}`);
        console.log(`[TOUCHEND-TEST] 测试模式: ${gameState.testMode ? '开' : '关'} canvasX=${mx.toFixed(0)} canvasY=${my.toFixed(0)} btnRect=[${r.x},${r.y},${r.w},${r.h}]`);
        return;
      }
    }
  }

  // ── 谜题模式：轻触箭头/按钮（与 Python 鼠标点击一致） ──
  if (gameState.mode === 'puzzle') {
    if (gameState.puzzlePhase !== 'display') { gameState._invTouchHandledClick = true; return; }
    gamepad.focusByMouse = true;
    const mx = mouse.canvasX, my = mouse.canvasY;

    // 类型 B：选图谜题触摸（子图选中/取消）
    if (gameState.puzzleIsTypeB) {
      if (puzzleTypeBClick(mx, my)) { gameState._invTouchHandledClick = true; return; }
      // 子图未命中时继续检测确定/返回按钮（与类型 A 共用 rect）
    }

    // 返回按钮
    if (gameState.puzzleReturnRect) {
      const r = gameState.puzzleReturnRect;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        puzzleReturn();
        gameState._invTouchHandledClick = true;
        return;
      }
    }
    // 确定按钮
    if (gameState.puzzleConfirmRect) {
      const r = gameState.puzzleConfirmRect;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        puzzleConfirm();
        gameState._invTouchHandledClick = true;
        return;
      }
    }
    // 箭头
    for (let i = 0; i < gameState.puzzleArrowRects.length; i++) {
      const r = gameState.puzzleArrowRects[i];
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        const digitIdx = Math.floor(i / 2);
        const isUp = (i % 2 === 0);
        puzzleChangeDigit(digitIdx, isUp);
        gameState._invTouchHandledClick = true;
        return;
      }
    }
    gameState._invTouchHandledClick = true;
    return;
  }

  // ── 调查模式 ──
  if (gameState.mode === 'investigation') {
    const mx = mouse.canvasX, my = mouse.canvasY;

    // 调查对话叠加中：轻触推进对话
    if (gameState._invDialogueActive) {
      tryAdvanceDialogue();
      gameState._invTouchHandledClick = true;
      return;
    }

    // 检查退出按钮
    if (gameState._exitBtnRect) {
      const r = gameState._exitBtnRect;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        if (_IS_MOBILE) {
          _investExitHighlight = true;
          setTimeout(() => { _investExitHighlight = false; exitInvestigation(); }, 120);
        } else {
          exitInvestigation();
        }
        gameState._invTouchHandledClick = true;
        return;
      }
    }

    // 手指抬起时，光标在调查点附近 → 直接触发
    for (const pt of gameState.investigationPoints) {
      if (Math.abs(mx - pt.x) <= INV_CLOSE_RANGE && Math.abs(my - pt.y) <= INV_CLOSE_RANGE) {
        investigationTrigger(pt);
        gameState._invTouchHandledClick = true;
        return;
      }
    }

    gameState._invTouchHandledClick = true;
    return;
  }

  // ── 对话模式：点击推进 ──
  if (gameState.mode === 'dialogue') {
    tryAdvanceDialogue();
    gameState._invTouchHandledClick = true;
    return;
  }

  // ── 选项对白模式：轻触按钮选择 ──
  if (gameState.mode === 'choice_dialogue' && gameState.choiceActive2) {
    const mx = mouse.canvasX, my = mouse.canvasY;
    for (let i = 0; i < gameState.choiceBtnRects.length; i++) {
      const r = gameState.choiceBtnRects[i];
      if (r && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        gameState.handleChoiceSelection(i);
        gameState._invTouchHandledClick = true;
        return;
      }
    }
    gameState._invTouchHandledClick = true;
    return;
  }
});

// ==================== 程序入口 ====================

async function init() {
  console.log('[Init] 开始加载...');

  // 加载超时提示（PWA 冷启动时服务器可能不可达）
  const LOAD_TIMEOUT = 15000;
  const timeoutTimer = setTimeout(() => {
    if (loadingScreen.style.display !== 'none') {
      loadingDetail.innerHTML = '加载超时<br><br>请确保连接同一 WiFi<br>然后刷新页面';
      loadingDetail.style.color = '#e55';
      // 在 loading 界面加一个刷新按钮
      if (!document.getElementById('load-reload-btn')) {
        const btn = document.createElement('button');
        btn.id = 'load-reload-btn';
        btn.textContent = '刷新';
        btn.style.cssText = 'margin-top:16px;padding:8px 24px;font-size:16px;cursor:pointer;';
        btn.onclick = () => location.reload(true);
        document.getElementById('loading-box').appendChild(btn);
      }
    }
  }, LOAD_TIMEOUT);

  try {
    // IndexedDB 存档系统初始化（在加载数据之前，确保存档可用）
    await initSaveSystem();
    console.log('[Init] Save system ready');

    await loadData();
    console.log('[Init] JSON OK: nodes=' + Object.keys(scenarioData.nodes).length);

    // 图片、BGM、音效、语音并行加载
    await Promise.all([
      loadAllImages(),
      loadAllBgm(scenarioData),
      loadAllSfx(scenarioData),
      loadAllVoices(scenarioData)
    ]);
    console.log('[Init] Images OK: cache=' + imageCache.size);

    setLoadingProgress(100, '准备就绪');
    await new Promise(r => setTimeout(r, 300));

    clearTimeout(timeoutTimer);

    loadingScreen.style.display = 'none';
    gameContainer.style.display = 'flex';

    // 等待布局稳定后再 resize（PWA 中立即 resize 可能拿到错误尺寸）
    resizeCanvas();
    requestAnimationFrame(() => resizeCanvas());
    setTimeout(() => resizeCanvas(), 300);

    setupInputListeners(canvas);

    // PWA 刷新按钮（桌面端也有用）
    createReloadButton();

    // 创建 GameState 并进入标题画面（与 Python ui_mode="main_menu" 一致）
    gameState = new GameState();
    loadSettings();
    syncAudioSettings();
    console.log('[Init] GameState created, muted=' + gameState.muted + ' bgmVol=' + gameState.bgmVolume + ' sfxVol=' + gameState.sfxVolume);
    // 不自动开始游戏，先显示标题画面
    gameState.uiMode = 'title';
    console.log('[Init] 标题画面就绪');

    // 移动端：加载完成后显示"触摸屏幕开始游戏"覆盖层（iOS AudioContext 解锁）
    if (_IS_MOBILE) {
      const overlay = document.getElementById('tap-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
        const onGesture = () => {
          resumeAudio();
          syncAudioSettings();
          overlay.style.display = 'none';
          overlay.removeEventListener('touchstart', onGesture);
          overlay.removeEventListener('click', onGesture);
        };
        overlay.addEventListener('touchstart', onGesture);
        overlay.addEventListener('click', onGesture);
      }
    }


    lastTime = performance.now();
    requestAnimationFrame(gameLoop);

    // 首次用户交互时恢复 AudioContext（iOS/Chrome 自动暂停策略）
    const resumeOnFirstTouch = () => {
      resumeAudio();
      syncAudioSettings();
      console.log('[Audio] 首次交互: resumeAudio + syncAudioSettings, ctx=' + (audioCtx ? audioCtx.state : 'null'));
      document.removeEventListener('click', resumeOnFirstTouch);
      document.removeEventListener('keydown', resumeOnFirstTouch);
    };
    document.addEventListener('click', resumeOnFirstTouch);
    document.addEventListener('keydown', resumeOnFirstTouch);

    console.log('[Init] 就绪');

  } catch (err) {
    console.error('[Init] 加载失败:', err);
    loadingDetail.textContent = '加载失败: ' + err.message;
    loadingDetail.style.color = '#e55';
  }
}

// ==================== 角色立绘渲染 ====================
// 对应 Python: draw_character_with_fade() / get_char_image() / draw_namebox()
// 注意：独立 character.js 加载失败，内嵌到 main.js。常量冲突的复用已有定义。

var _CHAR_HEIGHT = 780;
var _PLAYER_MARGIN_LEFT = -90;
var _NPC_MARGIN_RIGHT = -90;
var _CHAR_MARGIN_BOTTOM = 15;
var _NAMEBOX_PADDING_X = 22;
var _NAMEBOX_PADDING_Y = 8;
var _NAMEBOX_ALPHA = 0.8;
var _CHAR_FADE_TIME = 0.25;
var _exprImageCache = new Map();

function getCharImage(speakerId, expression) {
  if (!speakerId) return null;
  var info = charactersData ? charactersData[speakerId] : null;
  if (!info) return null;
  expression = expression || '01';
  var prefix = info.prefix;
  if (!prefix) return getImage(info.image) || null;
  var filename = prefix + '_' + expression + '.png';
  if (_exprImageCache.has(filename)) return _exprImageCache.get(filename) || null;
  var img = getImage(filename);
  if (!img) {
    var fallback = getImage(info.image);
    _exprImageCache.set(filename, fallback);
    return fallback || null;
  }
  _exprImageCache.set(filename, img);
  return img;
}

function _getCharRect(img, side) {
  if (!img || !img.naturalWidth) return null;
  var scale = _CHAR_HEIGHT / img.naturalHeight;
  var w = Math.round(img.naturalWidth * scale);
  var h = _CHAR_HEIGHT;
  var y = DESIGN_H - h - _CHAR_MARGIN_BOTTOM;
  var x = side === 'left' ? _PLAYER_MARGIN_LEFT : DESIGN_W - w - _NPC_MARGIN_RIGHT;
  return { x: x, y: y, w: w, h: h };
}

function drawCharacterWithFade() {
  if (!gameState) return;

  // 只在对话模式/质问模式/质问开始动画/物品栏打开/菜单模式/保存提示时 绘制立绘
  if (gameState.mode !== 'dialogue' && gameState.mode !== 'confrontation' && gameState.mode !== 'confrontation_intro_anim' && gameState.mode !== 'menu' && gameState.mode !== 'save_prompt' && gameState.mode !== 'choice_dialogue' && gameState._subMenu !== 'inventory' && gameState.charTransitionTime <= 0 && !gameState.charFadeToNone) return;

  var speakerId = gameState.displaySpeaker;
  var side = gameState.displaySide || 'right';
  var expression = gameState.displayExpression || '01';
  var fgAlpha = gameState.foregroundAlpha;
  var alpha = (fgAlpha != null ? fgAlpha : 255) / 255;
  if (!speakerId && (gameState.charTransitionTime <= 0 || !gameState.prevSpeaker)) return;

  var curImg = null, curRect = null;
  if (speakerId) {
    curImg = getCharImage(speakerId, expression);
    if (curImg) curRect = _getCharRect(curImg, side);
  }
  var shakeX = gameState.charShakeOffsetX || 0;
  var shakeY = gameState.charShakeOffsetY || 0;

  if (gameState.charTransitionTime <= 0) {
    if (curImg && curRect) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(curImg, curRect.x + shakeX, curRect.y + shakeY, curRect.w, curRect.h);
      ctx.globalAlpha = 1;
    }
    return;
  }

  var progress = 1.0 - (gameState.charTransitionTime / _CHAR_FADE_TIME);

  if (gameState.charFadeToNone) {
    var oldImg = getCharImage(gameState.prevSpeaker, gameState.prevExpression || '01');
    if (oldImg) {
      var oldRect = _getCharRect(oldImg, gameState.prevSide || 'right');
      if (oldRect) {
        var oldAlpha = alpha * (1.0 - progress);
        if (oldAlpha > 0) {
          ctx.globalAlpha = oldAlpha;
          ctx.drawImage(oldImg, oldRect.x + shakeX, oldRect.y + shakeY, oldRect.w, oldRect.h);
          ctx.globalAlpha = 1;
        }
      }
    }
    return;
  }

  if (!gameState.prevSpeaker && curImg && curRect) {
    var newAlpha = alpha * progress;
    if (newAlpha > 0) {
      ctx.globalAlpha = newAlpha;
      ctx.drawImage(curImg, curRect.x + shakeX, curRect.y + shakeY, curRect.w, curRect.h);
      ctx.globalAlpha = 1;
    }
    return;
  }

  if (gameState.prevSpeaker) {
    var prevImg = getCharImage(gameState.prevSpeaker, gameState.prevExpression || '01');
    if (prevImg) {
      var prevRect = _getCharRect(prevImg, gameState.prevSide || 'right');
      if (prevRect) {
        var oldFadeAlpha = alpha * (1.0 - progress);
        if (oldFadeAlpha > 0) {
          ctx.globalAlpha = oldFadeAlpha;
          ctx.drawImage(prevImg, prevRect.x + shakeX, prevRect.y + shakeY, prevRect.w, prevRect.h);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  if (curImg && curRect) {
    var newFadeAlpha = alpha * progress;
    if (newFadeAlpha > 0) {
      ctx.globalAlpha = newFadeAlpha;
      ctx.drawImage(curImg, curRect.x + shakeX, curRect.y + shakeY, curRect.w, curRect.h);
      ctx.globalAlpha = 1;
    }
  }
}

function drawNamebox() {
  if (!gameState || !gameState.displaySpeaker) return;
  var speakerId = gameState.displaySpeaker;
  var side = gameState.displaySide || 'right';
  var info = charactersData ? charactersData[speakerId] : null;
  if (!info) return;
  var name = info.name || speakerId;

  ctx.font = `bold ${28 * UI_SCALE}px "Microsoft YaHei", "SimHei", "SourceHanSansSC", sans-serif`;
  var textW = ctx.measureText(name).width;
  var textH = 28 * UI_SCALE;
  var boxW = textW + _NAMEBOX_PADDING_X * 2;
  var boxH = textH + _NAMEBOX_PADDING_Y * 2;
  // 与 Python 一致：名字框底部对齐对话框顶部，X 固定屏幕边缘（不依赖人物立绘位置）
  var dialogBottomY = DESIGN_H - _CHAR_MARGIN_BOTTOM;
  var boxY = dialogBottomY - boxH;
  var boxX;
  if (side === 'left') {
    boxX = _CHAR_MARGIN_BOTTOM;
  } else {
    boxX = DESIGN_W - boxW - _CHAR_MARGIN_BOTTOM;
  }

  var fa = gameState.foregroundAlpha;
  var alphaVal = (fa != null ? fa : 255) / 255;
  ctx.globalAlpha = _NAMEBOX_ALPHA * alphaVal;
  ctx.fillStyle = 'rgb(255, 197, 135)';
  _roundRectPath(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.globalAlpha = alphaVal;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(name, boxX + boxW / 2, boxY + boxH / 2);
  ctx.globalAlpha = 1;
}

function updateCharTransition(dt) {
  if (!gameState || gameState.charTransitionTime <= 0) return;
  gameState.charTransitionTime -= dt;
  if (gameState.charTransitionTime < 0) {
    gameState.charTransitionTime = 0;
    if (gameState.charFadeToNone) {
      gameState.displaySpeaker = null;
      gameState.charFadeToNone = false;
    }
    gameState.prevSpeaker = null;
    gameState.prevSide = null;
    gameState.prevExpression = null;
  }
}

/** 预览角色立绘 alpha 淡入淡出（与 Pygame PREVIEW_FADE_TIME = 0.4 一致） */
function updatePreviewAlpha(dt) {
  if (!gameState) return;
  const fadeTime = gameState._PREVIEW_FADE_TIME || 0.4;
  const step = (255 / fadeTime) * dt;
  if (gameState.previewAlpha < gameState.previewTargetAlpha) {
    gameState.previewAlpha = Math.min(gameState.previewAlpha + step, gameState.previewTargetAlpha);
  } else if (gameState.previewAlpha > gameState.previewTargetAlpha) {
    gameState.previewAlpha = Math.max(gameState.previewAlpha - step, gameState.previewTargetAlpha);
  }
  // alpha 归零时清空 speaker（与 Pygame 一致）
  if (gameState.previewAlpha <= 0 && gameState.previewTargetAlpha <= 0) {
    gameState.previewSpeaker = null;
  }
}

/** 绘制预览角色立绘（菜单模式下，鼠标悬停选项时显示对应角色） */
function drawPreviewCharacter() {
  if (!gameState || gameState.mode !== 'menu') return;
  // 物品栏打开时禁止绘制立绘，防止遮挡物品栏 UI（与 Pygame draw_inventory 一致）
  if (gameState._subMenu === 'inventory') return;
  if (!gameState.previewSpeaker || gameState.previewAlpha <= 0) return;
  const alpha = gameState.previewAlpha / 255;
  const img = getCharImage(gameState.previewSpeaker, '01');
  if (!img) return;
  // 计算立绘位置（与对话模式右侧立绘一致）
  const rect = _getCharRect(img, 'right');
  if (!rect) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = 1;
}

/** 绘制物品获得/失去反馈（与 Python draw_item_feedback_prompt + draw_showing_item 一致） */
function drawItemFeedback() {
  if (!gameState || !gameState.itemFeedbackActive) return;
  const gs = gameState;

  // ── Alpha：prompt 阶段全亮，fading 阶段线性淡出 ──
  let alpha;
  if (gs.itemFeedbackPhase === 'prompt') {
    alpha = 1;
  } else {
    alpha = Math.max(0, gs.itemFeedbackTimer / 0.9);
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  // ── 1. 物品图片（屏幕顶部居中，与 Python draw_showing_item 一致） ──
  const item = gs.inventory.find(i => i.id === gs.itemFeedbackItem);
  if (item && item.image) {
    const img = getImage(item.image);
    if (img) {
      const baseCardSize = Math.min(DESIGN_W * 0.08, DESIGN_H * 0.1);
      const cardW = Math.round(baseCardSize * 1.5);
      const cardH = cardW;
      const cx = (DESIGN_W - cardW) / 2;
      const cy = Math.round(DESIGN_H * 0.09);

      // 物品图片
      const padding = Math.round(cardW * 0.05);
      const imgSize = Math.max(1, cardW - 2 * padding);
      const s = Math.min(imgSize / img.naturalWidth, imgSize / img.naturalHeight) * 1.8;
      const nw = Math.max(1, Math.round(img.naturalWidth * s));
      const nh = Math.max(1, Math.round(img.naturalHeight * s));
      ctx.drawImage(img, cx + (cardW - nw) / 2, cy + (cardH - nh) / 2, nw, nh);

      // 选中框（UI_itemBox.png）
      const selImg = getImage('UI_itemBox.png');
      if (selImg) {
        const selW = cardW + 110;
        const selH = cardH + 110;
        ctx.drawImage(selImg, cx - 55, cy - 55, selW, selH);
      }
    }
  }

  // ── 2. 对话框（760×200 居中，与 Python ITEM_PROMPT 一致） ──
  const ITEM_PROMPT_WIDTH = 760;
  const ITEM_PROMPT_HEIGHT = 200;
  const dialogX = (DESIGN_W - ITEM_PROMPT_WIDTH) / 2;
  const dialogY = (DESIGN_H - ITEM_PROMPT_HEIGHT) / 2;

  // 对话框底图（与 Python get_dialog_background 一致）
  const dlgBg = getImage('UI_dialogue_01.png');
  if (dlgBg) {
    ctx.drawImage(dlgBg, dialogX, dialogY, ITEM_PROMPT_WIDTH, ITEM_PROMPT_HEIGHT);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    _roundRectPath(ctx, dialogX, dialogY, ITEM_PROMPT_WIDTH, ITEM_PROMPT_HEIGHT, 12);
    ctx.fill();
  }

  // 文字（两排居中，与对话框文字大小一致）
  ctx.fillStyle = '#000';
  ctx.font = `bold ${45 * UI_SCALE}px "Microsoft YaHei", "SimHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 解析文字：提取"获得物品"和【物品名】
  const textMatch = (gs.itemFeedbackText || '').match(/^(.*?)[【\[](.+?)[】\]]$/);
  const line1 = textMatch ? textMatch[1].trim() : gs.itemFeedbackText;
  const line2 = textMatch ? `【${textMatch[2]}】` : '';
  const lineHeight = 45 * UI_SCALE * 1.3;
  const centerY = dialogY + ITEM_PROMPT_HEIGHT / 2;
  if (line2) {
    ctx.fillText(line1, DESIGN_W / 2, centerY - lineHeight / 2);
    ctx.fillText(line2, DESIGN_W / 2, centerY + lineHeight / 2);
  } else {
    ctx.fillText(line1, DESIGN_W / 2, centerY);
  }

  // ── 3. 弹跳绿色三角（仅 prompt 阶段） ──
  if (gs.itemFeedbackPhase === 'prompt') {
    const TRI_SIZE = 33;
    const TRI_COLOR = '#67CD23';
    const TRI_OUTLINE = 3;
    const BOUNCE_SPEED = 3.0;
    const BOUNCE_AMPLITUDE = 12;

    const t = gs.hintAnimationTime * BOUNCE_SPEED;
    const bounceOffset = Math.abs(Math.sin(t * Math.PI)) * BOUNCE_AMPLITUDE;
    const triCx = dialogX + ITEM_PROMPT_WIDTH / 2;
    const baseY = dialogY + ITEM_PROMPT_HEIGHT - 3;

    const topY = baseY - TRI_SIZE + bounceOffset;
    const botY = baseY + bounceOffset;

    // 描边
    if (TRI_OUTLINE > 0) {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(triCx - TRI_SIZE / 2 - TRI_OUTLINE, topY - TRI_OUTLINE);
      ctx.lineTo(triCx + TRI_SIZE / 2 + TRI_OUTLINE, topY - TRI_OUTLINE);
      ctx.lineTo(triCx, botY + TRI_OUTLINE);
      ctx.closePath();
      ctx.fill();
    }
    // 三角填充
    ctx.fillStyle = TRI_COLOR;
    ctx.beginPath();
    ctx.moveTo(triCx - TRI_SIZE / 2, topY);
    ctx.lineTo(triCx + TRI_SIZE / 2, topY);
    ctx.lineTo(triCx, botY);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ==================== 卡片叠加层（show_card / show_item） ====================
// 与 Python draw_showing_character / draw_showing_item 对齐
function drawCardOverlay() {
  if (!gameState || !gameState.cardOverlayActive) return;
  if (!gameState.showingCharacter && !gameState.showingItem) return;

  const gs = gameState;

  // 卡片尺寸（与 Python 一致）
  const baseCardSize = Math.min(DESIGN_W * 0.08, DESIGN_H * 0.1);
  const cardW = Math.round(baseCardSize * 1.5);
  const cardH = cardW;
  const x = (DESIGN_W - cardW) / 2;
  const y = Math.round(DESIGN_H * 0.09);

  let image = null;
  if (gs.showingCharacter && gs.showingCharacter.image) {
    image = getImage(gs.showingCharacter.image);
  } else if (gs.showingItem && gs.showingItem.image) {
    image = getImage(gs.showingItem.image);
  }

  ctx.save();

  // 绘制卡片图片
  if (image) {
    const padding = Math.round(cardW * 0.05);
    const imgSize = Math.max(1, cardW - 2 * padding);
    const s = Math.min(imgSize / image.naturalWidth, imgSize / image.naturalHeight) * 1.8;
    const nw = Math.max(1, Math.round(image.naturalWidth * s));
    const nh = Math.max(1, Math.round(image.naturalHeight * s));
    ctx.drawImage(image, x + (cardW - nw) / 2, y + (cardH - nh) / 2, nw, nh);
  }

  // 绘制选中框（与 Python UI_itemBox.png 一致）
  const selImg = getImage('UI_itemBox.png');
  const selW = cardW + 110;
  const selH = cardH + 110;
  if (selImg) {
    ctx.drawImage(selImg, x - 55, y - 55, selW, selH);
  } else {
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.strokeRect(x - 55, y - 55, selW, selH);
  }

  ctx.restore();
}

init();

// ==================== PWA 后台恢复 ====================

// iOS PWA 从 bfcache 恢复时页面状态可能丢失，强制刷新
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    console.log('[PWA] 从缓存恢复，刷新...');
    location.reload();
  }
});

// ==================== 调试面板 ====================

function toggleDebug() {
  if (debugPanel.style.display === 'none' || !debugPanel.style.display) {
    debugPanel.style.display = 'block';
    updateDebug([
      `版本: ${GAME_VERSION}.${RESOURCE_VERSION}`,
      `节点: ${Object.keys(scenarioData.nodes).length}`,
      `图片: ${imageCache.size}`,
      `触摸: ${isTouchDevice}`,
      `模式: ${gameState ? gameState.mode : '-'}`,
      `当前节点: ${gameState ? gameState.currentNodeId : '-'}`,
    ].join('\n'));
  } else {
    debugPanel.style.display = 'none';
  }
}

function updateDebug(info) {
  debugPanel.textContent = typeof info === 'string' ? info : JSON.stringify(info, null, 2);
}

// ==================== 画布坐标 ↔ 屏幕坐标 ====================

function canvasToScreen(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: rect.left + (cx / DESIGN_W) * rect.width,
    y: rect.top + (cy / DESIGN_H) * rect.height
  };
}

function screenToCanvas(sx, sy) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((sx - rect.left) / rect.width) * DESIGN_W,
    y: ((sy - rect.top) / rect.height) * DESIGN_H
  };
}
