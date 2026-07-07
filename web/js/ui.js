// ==================== UI 绘制系统 ====================
// DOM 层负责：对话框、按钮、菜单

// 移动端触摸辅助：轻触后先显示高亮图，120ms 后再触发效果
// hoverBg = 高亮背景图 URL；触摸后立即切换，定时器到期恢复 + 触发
const _MOBILE_TAP_DELAY = 120;
function _bindMobileTap(el, fn, hoverBg) {
  if (!_IS_MOBILE || !el) return;
  const normalBg = el.style.backgroundImage;
  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (isMobileGuardActive()) return;
    activateMobileGuard();
    if (hoverBg) el.style.backgroundImage = `url(${hoverBg})`;
    setTimeout(() => {
      if (hoverBg) el.style.backgroundImage = normalBg;
      fn(e);
    }, _MOBILE_TAP_DELAY);
  }, { passive: false });
}

// MENU constants (matching Pygame)
const MENU_W = 720;
const MENU_ITEM_H = 72;
const MENU_FONT_SIZE = 42;
const BOTTOM_BTN_W = 280;
const BOTTOM_BTN_H = 72;

// -- 对话框 DOM 元素 --
let dialogBoxEl = null;
let dialogBgEl = null;
let nameBoxEl = null;
let nameTextEl = null;
let dialogTextEl = null;
let hintArrowEl = null;
let confrontCounterEl = null;

// -- 菜单 DOM 元素 --
let menuContainerEl = null;
let menuOptionsCache = null;
let menuOptionEls = [];
let menuBottomBtns = []; // [物品栏, 调查, 离开]
let menuGameBtnEl = null;  // 左上角"菜单"按钮
let menuGameStartEl = null; // 菜单按钮下方的 Start 手柄图标
let leaveContainerEl = null;
let leaveOptionEls = [];
let leaveBackEl = null;
let leaveMenuCache = null;
let settingsContainerEl = null;

// 设计分辨率下的常量
const DIALOG_W = 1125;
const DIALOG_H = 300;
const DIALOG_BOTTOM = 15;
// 对话框底部间距（独立于 DIALOG_BOTTOM，后者的 15 还被名字框水平边距用）
const DIALOG_BOTTOM_MARGIN = 35;
const CHAR_MARGIN_BOTTOM = 15;
const NAME_FONT_SIZE = 48;
const TEXT_FONT_SIZE = 45;
const TEXT_PADDING = 22;
const NAMEBOX_PAD_X = 22;
const NAMEBOX_PAD_Y = 8;
const NAMEBOX_COLOR = 'rgba(255, 197, 135, 0.8)';

// 对话框距角色的水平间距（与 Python DIALOG_GAP_TO_CHAR 一致）
const DIALOG_GAP_TO_CHAR = -90;

function getScale() {
  return parseFloat(uiLayer.style.width || DESIGN_W) / DESIGN_W;
}

const SKIP_BTN_W = 140;
const SKIP_BTN_H = 48;
const SKIP_BTN_GAP = 8;
const SKIP_FONT_SIZE = 28;

let skipBtnEl = null;

function createDialogElements() {
  if (dialogBoxEl) return;
  const scale = getScale();

  nameBoxEl = document.createElement('div');
  nameBoxEl.id = 'name-box';
  nameBoxEl.style.cssText = `
    position: absolute; background: ${NAMEBOX_COLOR};
    border: 2px solid rgba(0,0,0,0.8);
    padding: ${scale*NAMEBOX_PAD_Y}px ${scale*NAMEBOX_PAD_X}px;
    pointer-events: none; display: none; z-index: 51; white-space: nowrap;
  `;
  nameTextEl = document.createElement('span');
  nameTextEl.style.cssText = `color:#000; font-family:'Microsoft YaHei','SimHei',sans-serif; font-weight:bold; font-size:${scale*NAME_FONT_SIZE*UI_SCALE}px;`;
  nameBoxEl.appendChild(nameTextEl);
  uiLayer.appendChild(nameBoxEl);

  dialogBoxEl = document.createElement('div');
  dialogBoxEl.id = 'dialog-box';
  dialogBoxEl.style.cssText = `
    position: absolute; width:${scale*DIALOG_W}px; height:${scale*DIALOG_H}px;
    bottom:${scale*DIALOG_BOTTOM_MARGIN}px; pointer-events:auto; display:none; z-index:50;
  `;
  dialogBgEl = document.createElement('div');
  // 对话框底图：质问模式用 UI_dialogue_05.png，其他模式用 UI_dialogue_01.png（与 Python 一致）
  const dlgBgImg = (gameState && gameState.mode === 'confrontation') ? 'UI_dialogue_05.png' : 'UI_dialogue_01.png';
  dialogBgEl.style.cssText = `position:absolute; inset:0; background-image:url('../${dlgBgImg}'); background-size:100% 100%; pointer-events:none;`;
  dialogBoxEl.appendChild(dialogBgEl);

  dialogTextEl = document.createElement('div');
  dialogTextEl.style.cssText = `
    position:absolute; left:${scale*TEXT_PADDING}px; top:${scale*TEXT_PADDING}px;
    right:${scale*TEXT_PADDING}px; bottom:${scale*TEXT_PADDING}px;
    color:#000; font-family:'Microsoft YaHei','SimHei',sans-serif;
    font-size:${scale*TEXT_FONT_SIZE*(_IS_MOBILE ? 1.4 : UI_SCALE)}px; line-height:1.35; overflow:hidden;
    word-break:break-all;
  `;
  dialogBoxEl.appendChild(dialogTextEl);

  hintArrowEl = document.createElement('div');
  hintArrowEl.style.cssText = `
    position:absolute; left:50%; bottom:-28px; transform:translateX(-50%);
    width:0; height:0;
    border-left:${scale*21.45}px solid transparent;
    border-right:${scale*21.45}px solid transparent;
    border-top:${scale*37.7}px solid rgb(103,205,35);
    pointer-events:none; display:none;
    filter: drop-shadow(0 1px 0 rgba(0,0,0,0.5))
            drop-shadow(0 -1px 0 rgba(0,0,0,0.5))
            drop-shadow(1px 0 0 rgba(0,0,0,0.5))
            drop-shadow(-1px 0 0 rgba(0,0,0,0.5));
  `;
  dialogBoxEl.appendChild(hintArrowEl);
  uiLayer.appendChild(dialogBoxEl);

  // ---- 略过对话按钮 ----
  skipBtnEl = document.createElement('div');
  skipBtnEl.id = 'skip-btn';
  skipBtnEl.style.cssText = `
    position: absolute; display: none; z-index: 52;
    width: ${scale*SKIP_BTN_W}px; height: ${scale*SKIP_BTN_H}px;
    background: rgba(200,200,200,0.78);
    border: 2px solid rgba(0,0,0,0.78);
    border-radius: 4px;
    cursor: pointer; pointer-events: auto;
    align-items: center; justify-content: center;
    font-family: 'Microsoft YaHei','SimHei',sans-serif; font-weight: bold;
    font-size: ${scale*SKIP_FONT_SIZE*UI_SCALE}px; color: #000;
    -webkit-tap-highlight-color: transparent;
  `;
  skipBtnEl.textContent = '略过对话';
  skipBtnEl.addEventListener('mouseenter', () => {
    skipBtnEl.style.background = 'rgba(170,170,170,0.86)';
  });
  skipBtnEl.addEventListener('mouseleave', () => {
    skipBtnEl.style.background = 'rgba(200,200,200,0.78)';
  });
  skipBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState && gameState.mode === 'dialogue') {
      gameState.skipDialogue();
    }
  });
  _bindMobileTap(skipBtnEl, () => {
    if (gameState && gameState.mode === 'dialogue') {
      gameState.skipDialogue();
    }
  });
  uiLayer.appendChild(skipBtnEl);

  // ---- 陈述计数器 DOM（与 Python draw_confrontation_statement_counter 一致） ----
  // Python: counter_x, counter_y = 762, 1050，设计分辨率 1920x1080
  // CSS: bottom = (DESIGN_H - 1050 - 30) * scale = 0, left = 762 * scale, translateX(-50%)
  confrontCounterEl = document.createElement('div');
  confrontCounterEl.id = 'confront-counter';
  confrontCounterEl.style.cssText = `
    position: absolute; display: none; z-index: 52;
    bottom: 0px; left: ${scale * 762}px; transform: translateX(-50%);
    pointer-events: none;
    background-image: url('../UI_button_16.png'); background-size: 100% 100%;
    width: ${scale * 195}px; height: ${scale * 60}px;
    color: #fff; font-weight: bold; font-size: ${scale * 36}px;
    font-family: 'Microsoft YaHei','SimHei',sans-serif;
    text-align: center; line-height: ${scale * 60}px;
  `;
  uiLayer.appendChild(confrontCounterEl);
}

function rebuildDialogElements() {
  if (nameBoxEl) { nameBoxEl.remove(); nameBoxEl = null; }
  if (dialogBoxEl) { dialogBoxEl.remove(); dialogBoxEl = null; }
  if (skipBtnEl) { skipBtnEl.remove(); skipBtnEl = null; }
  if (confrontCounterEl) { confrontCounterEl.remove(); confrontCounterEl = null; }
  nameTextEl = null; dialogTextEl = null; dialogBgEl = null; hintArrowEl = null;
  createDialogElements();
}

function showDialogBox(speakerName, text) {
  if (!dialogBoxEl) createDialogElements();
  const scale = getScale();
  const dlgW = scale * DIALOG_W;
  const dlgH = scale * DIALOG_H;
  const bottom = scale * DIALOG_BOTTOM_MARGIN;

  // 动态切换对话框底图（质问模式用 UI_dialogue_05.png，其他用 UI_dialogue_01.png）
  const dlgBgImg = (gameState && gameState.mode === 'confrontation') ? 'UI_dialogue_05.png' : 'UI_dialogue_01.png';
  const bgUrl = `url('../${dlgBgImg}')`;
  if (dialogBgEl && dialogBgEl.style.backgroundImage !== bgUrl) {
    dialogBgEl.style.backgroundImage = bgUrl;
  }
  // 根据角色左右站位计算对话框水平位置（与 Python draw_dialogue_screen 一致）
  // 质问模式：陈述框固定偏左（陈述人站右边）
  var left = (parseFloat(uiLayer.style.width) - dlgW) / 2; // 默认居中
  var effectiveSide = (gameState && gameState.mode === 'confrontation' && gameState._confrontFixedSide) || (gameState && gameState.displaySide) || 'right';
  if (gameState && gameState.displaySpeaker) {
    var side = effectiveSide;
    var charW = 0;
    // 从立绘系统获取角色渲染宽度（_CHAR_HEIGHT / _NPC_MARGIN_RIGHT 定义在 main.js）
    var charImg = getCharImage(gameState.displaySpeaker, gameState.displayExpression || '01');
    if (charImg && charImg.naturalWidth) {
      var imgScale = _CHAR_HEIGHT / charImg.naturalHeight;
      charW = Math.round(charImg.naturalWidth * imgScale);
    }
    if (side === 'left') {
      // 角色在左 → 对话框在角色右侧
      left = (_PLAYER_MARGIN_LEFT + charW + DIALOG_GAP_TO_CHAR) * scale;
    } else {
      // 角色在右 → 对话框在角色左侧
      left = (DESIGN_W - charW - _NPC_MARGIN_RIGHT - DIALOG_W - DIALOG_GAP_TO_CHAR) * scale;
    }
    // 防止溢出屏幕
    left = Math.max(0, Math.min(parseFloat(uiLayer.style.width) - dlgW, left));
  }
  dialogBoxEl.style.display = 'block';
  dialogBoxEl.style.left = left + 'px';
  dialogBoxEl.style.bottom = bottom + 'px';
  dialogBoxEl.style.width = dlgW + 'px';
  dialogBoxEl.style.height = dlgH + 'px';
  dialogTextEl.textContent = text || '';
  console.log(`[UI-DEBUG] showDialogBox text set: text="${(text || '').substring(0, 30)}" len=${(text || '').length} mode=${gameState?.mode} dialogIdx=${gameState?.dialogueIndex}/${gameState?.dialogueQueue?.length}`);
  if (speakerName) {
    nameTextEl.textContent = speakerName;
    nameBoxEl.style.display = 'block';
    // 与对话框使用相同的 effectiveSide（质问模式固定 right）
    nameBoxEl.style.bottom = bottom + 'px';
    if (effectiveSide === 'left') {
      nameBoxEl.style.left = (scale * DIALOG_BOTTOM) + 'px';
    } else {
      const nameW = nameBoxEl.offsetWidth;
      nameBoxEl.style.left = (parseFloat(uiLayer.style.width) - nameW - scale * DIALOG_BOTTOM) + 'px';
    }
  } else {
    nameBoxEl.style.display = 'none';
  }

  // 略过对话按钮：对话框右上角上方（与 Python 一致：仅 test_mode 或已播放序列可见）
  // 排除：调查对话、展示物品/人物对话（这些不走 sequence 节点，无法通过 playedSequences 判断）
  if (skipBtnEl) {
    const isExcluded = gameState._invDialogueActive || gameState.talkingAboutItem || gameState.talkingAboutCharacter;
    const canSkip = gameState && (gameState.testMode || (!isExcluded && gameState.playedSequences && gameState.playedSequences.has(gameState.currentSequenceNodeId)));
    if (skipBtnEl.style.display !== (canSkip ? 'flex' : 'none')) {
      dbgPush(`SKIP canSkip=${canSkip} tm=${gameState.testMode}`);
      console.log(`[SKIP-BTN] canSkip=${canSkip} testMode=${gameState.testMode} isExcluded=${isExcluded} mode=${gameState.mode}`);
    }
    skipBtnEl.style.display = canSkip ? 'flex' : 'none';
    skipBtnEl.style.width = (scale*SKIP_BTN_W*UI_SCALE) + 'px';
    skipBtnEl.style.height = (scale*SKIP_BTN_H*UI_SCALE) + 'px';
    skipBtnEl.style.fontSize = (scale*SKIP_FONT_SIZE*UI_SCALE) + 'px';
    skipBtnEl.style.left = (left + dlgW - scale*SKIP_BTN_W*UI_SCALE) + 'px';
    // 在对话框上方，间隙 SKIP_BTN_GAP
    skipBtnEl.style.bottom = (bottom + dlgH + scale*SKIP_BTN_GAP) + 'px';
  }
}

/**
 * 在 Canvas 上绘制跳过按钮 RB 手柄图标（与 Python text_adventure.py:7299-7300 一致）
 * 跳过按钮是 DOM 元素，但手柄图标需要画在 Canvas 上，每帧由游戏循环调用。
 */
function drawSkipGamepadIcon(ctx) {
  if (!gamepad.usingGamepad) return;
  if (!gameState || gameState.mode !== 'dialogue') return;

  // 与 showDialogBox 中相同的 canSkip 逻辑
  const isExcluded = gameState._invDialogueActive || gameState.talkingAboutItem || gameState.talkingAboutCharacter;
  const canSkip = gameState.testMode || (!isExcluded && gameState.playedSequences && gameState.playedSequences.has(gameState.currentSequenceNodeId));
  if (!canSkip) return;

  // 计算对话框在设计坐标中的 X 位置（与 drawChoiceDialogue / showDialogBox 一致）
  let dialogX = (DESIGN_W - DIALOG_W) / 2;
  if (gameState.displaySpeaker) {
    const side = gameState.displaySide || 'right';
    let charW = 0;
    const charImg = getCharImage(gameState.displaySpeaker, gameState.displayExpression || '01');
    if (charImg && charImg.naturalWidth) {
      charW = Math.round(charImg.naturalWidth * (_CHAR_HEIGHT / charImg.naturalHeight));
    }
    if (side === 'left') {
      dialogX = _PLAYER_MARGIN_LEFT + charW + DIALOG_GAP_TO_CHAR;
    } else {
      dialogX = DESIGN_W - charW - _NPC_MARGIN_RIGHT - DIALOG_W - DIALOG_GAP_TO_CHAR;
    }
  }

  // 跳过按钮在设计坐标中的位置（与 showDialogBox DOM 定位一致）
  const skipX = dialogX + DIALOG_W - SKIP_BTN_W * UI_SCALE;
  const skipY = DESIGN_H - DIALOG_BOTTOM_MARGIN - DIALOG_H - SKIP_BTN_GAP - SKIP_BTN_H * UI_SCALE;
  const skipRect = {
    x: skipX,
    y: skipY,
    w: SKIP_BTN_W * UI_SCALE,
    h: SKIP_BTN_H * UI_SCALE
  };

  drawGamepadIcon(ctx, 'rb', skipRect, 4, 0, 0, 'left');
}

function repositionDialog() {
  if (!dialogBoxEl || dialogBoxEl.style.display === 'none') return;
  const scale = getScale();
  const dlgW = scale * DIALOG_W;
  const dlgH = scale * DIALOG_H;
  const bottom = scale * DIALOG_BOTTOM_MARGIN;

  // 使用 effectiveSide（与 showDialogBox 一致），确保质问模式下固定偏左
  var effectiveSide = (gameState && gameState.mode === 'confrontation' && gameState._confrontFixedSide) || (gameState && gameState.displaySide) || 'right';
  var left = (parseFloat(uiLayer.style.width) - dlgW) / 2;
  if (gameState && gameState.displaySpeaker) {
    var side = effectiveSide;
    var charW = 0;
    var charImg = getCharImage(gameState.displaySpeaker, gameState.displayExpression || '01');
    if (charImg && charImg.naturalWidth) {
      var imgScale = _CHAR_HEIGHT / charImg.naturalHeight;
      charW = Math.round(charImg.naturalWidth * imgScale);
    }
    if (side === 'left') {
      left = (_PLAYER_MARGIN_LEFT + charW + DIALOG_GAP_TO_CHAR) * scale;
    } else {
      left = (DESIGN_W - charW - _NPC_MARGIN_RIGHT - DIALOG_W - DIALOG_GAP_TO_CHAR) * scale;
    }
    left = Math.max(0, Math.min(parseFloat(uiLayer.style.width) - dlgW, left));
  }
  dialogBoxEl.style.width = dlgW + 'px'; dialogBoxEl.style.height = dlgH + 'px';
  dialogBoxEl.style.left = left + 'px'; dialogBoxEl.style.bottom = bottom + 'px';
  dialogTextEl.style.fontSize = (scale*TEXT_FONT_SIZE*(_IS_MOBILE ? 1.4 : UI_SCALE))+'px';
  dialogTextEl.style.left = (scale*TEXT_PADDING)+'px'; dialogTextEl.style.top = (scale*TEXT_PADDING)+'px';
  dialogTextEl.style.right = (scale*TEXT_PADDING)+'px'; dialogTextEl.style.bottom = (scale*TEXT_PADDING)+'px';
  if (nameTextEl) nameTextEl.style.fontSize = (scale*NAME_FONT_SIZE*UI_SCALE)+'px';
  nameBoxEl.style.padding = (scale*NAMEBOX_PAD_Y)+'px '+(scale*NAMEBOX_PAD_X)+'px';
  if (nameBoxEl.style.display !== 'none') {
    nameBoxEl.style.bottom = bottom + 'px';
    if (effectiveSide === 'left') {
      nameBoxEl.style.left = (scale * DIALOG_BOTTOM) + 'px';
    } else {
      const nameW = nameBoxEl.offsetWidth;
      nameBoxEl.style.left = (parseFloat(uiLayer.style.width) - nameW - scale * DIALOG_BOTTOM) + 'px';
    }
  }
  if (skipBtnEl && skipBtnEl.style.display !== 'none') {
    skipBtnEl.style.left = (left + dlgW - scale*SKIP_BTN_W*UI_SCALE) + 'px';
    skipBtnEl.style.bottom = (bottom + dlgH + scale*SKIP_BTN_GAP) + 'px';
    skipBtnEl.style.width = (scale*SKIP_BTN_W*UI_SCALE) + 'px';
    skipBtnEl.style.height = (scale*SKIP_BTN_H*UI_SCALE) + 'px';
    skipBtnEl.style.fontSize = (scale*SKIP_FONT_SIZE*UI_SCALE) + 'px';
  }
}

function hideDialogBox() {
  if (dialogBoxEl) {
    console.log(`[UI-DEBUG] hideDialogBox: textContent="${(dialogBoxEl.textContent || '').substring(0, 30)}" display=${dialogBoxEl.style.display}`);
    dialogBoxEl.style.display = 'none';
  }
  if (nameBoxEl) nameBoxEl.style.display = 'none';
  if (skipBtnEl) skipBtnEl.style.display = 'none';
  hideConfrontCounter();
}

function showConfrontCounter(total, current) {
  if (!confrontCounterEl) return;
  const scale = getScale();
  confrontCounterEl.style.display = 'block';
  confrontCounterEl.textContent = `${current + 1} / ${total}`;
  confrontCounterEl.style.bottom = '0px';
  confrontCounterEl.style.left = (scale * 762) + 'px';
}

function hideConfrontCounter() {
  if (confrontCounterEl) confrontCounterEl.style.display = 'none';
}

function updateDialogText(text) {
  if (dialogTextEl) dialogTextEl.textContent = text;
}

let _hintVisible = false;

function showHintArrow(visible) {
  _hintVisible = visible;
  if (hintArrowEl) hintArrowEl.style.display = visible ? 'block' : 'none';
}

/**
 * 测量对话框中一页能容纳多少字符（分页断点）
 * 用隐藏的测量元素，逐步增加文字直到超出高度
 * 返回第一个超出高度的字符索引
 */
let _measureEl = null;
function _ensureMeasureEl() {
  if (_measureEl) return _measureEl;
  _measureEl = document.createElement('div');
  _measureEl.style.cssText = `
    position: absolute; visibility: hidden; z-index: -1;
    font-family: 'Microsoft YaHei','SimHei',sans-serif;
    line-height: 1.35; white-space: pre-wrap;
  `;
  document.body.appendChild(_measureEl);
  return _measureEl;
}

function measurePageBreak(fullText) {
  if (!dialogTextEl) return fullText.length;
  const scale = getScale();
  // 可用高度 = 对话框高度（scrollHeight 包含隐含 padding 高度，因此用完整高度比较）
  const maxH = scale * DIALOG_H;

  // 直接在对话框元素上测量，保证宽度、字体、行高等所有样式完全一致
  // 临时解除 overflow:hidden 让 scrollHeight 能反映完整内容高度
  const savedText = dialogTextEl.textContent;
  const savedOverflow = dialogTextEl.style.overflow;
  dialogTextEl.style.overflow = 'visible';

  // 二分查找：找到最后一个 scrollHeight <= maxH 的位置
  let lo = 0, hi = fullText.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    dialogTextEl.textContent = fullText.substring(0, mid);
    // 强制回流，确保 scrollHeight 反映最新布局
    void dialogTextEl.offsetHeight;
    if (dialogTextEl.scrollHeight <= maxH) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  // 恢复对话框内容和样式
  dialogTextEl.textContent = savedText;
  dialogTextEl.style.overflow = savedOverflow || 'hidden';
  // lo = 最后一个不超出的位置
  // 直接使用二分查找结果，不回退标点，保证每页铺满
  const breakIdx = lo;

  // 至少返回 1 个字符，防止分页无限循环
  return Math.max(1, breakIdx);
}

function updateHintBounce(t) {
  if (!hintArrowEl || !_hintVisible) return;
  const scale = getScale();
  const bounce = Math.abs(Math.sin(t * 3.0 * Math.PI)) * 12 * scale;
  hintArrowEl.style.bottom = (-28 * scale + bounce) + 'px';
  if (_gpDialogIconEl && _gpDialogIconEl.style.display !== 'none') {
    _gpDialogIconEl.style.bottom = (-28 * scale + bounce) + 'px';
  }
}

// ==================== 场景菜单 ====================

function _createSceneMenuUI() {
  if (menuContainerEl) return;
  menuContainerEl = document.createElement('div');
  menuContainerEl.id = 'menu-container';
  menuContainerEl.style.cssText = 'position:absolute; inset:0; pointer-events:auto; display:none;';
  // 空白区域点击不传播（防止意外触发）
  menuContainerEl.addEventListener('click', e => { e.stopPropagation(); });
  uiLayer.appendChild(menuContainerEl);
}

function drawSceneMenu(options, focusIndex) {
  _createSceneMenuUI();
  if (!gameState || gameState.mode !== 'menu') return;
  if (gameState._subMenu === 'leave') { drawLeaveMenu(); return; }
  if (gameState._subMenu === 'settings') { drawSettings(); return; }
  if (gameState._subMenu === 'options_menu') { drawOptionsMenu(); return; }

  menuContainerEl.style.display = 'block';
  if (leaveContainerEl) leaveContainerEl.style.display = 'none';
  if (settingsContainerEl) settingsContainerEl.style.display = 'none';

  const scale = getScale();
  const uiW = parseFloat(uiLayer.style.width);

  _rebuildMenuOptions(options, focusIndex, scale, uiW);
  if (!gameState.isSubMenu) {
    _rebuildBottomButtons(scale, uiW);
    _rebuildMenuGameBtn(scale, uiW);
  } else {
    // 子菜单：清除残留的底部按钮/游戏按钮
    menuBottomBtns.forEach(el => el.remove());
    menuBottomBtns = [];
    if (menuGameBtnEl) { menuGameBtnEl.remove(); menuGameBtnEl = null; }
    if (menuGameStartEl) { menuGameStartEl.remove(); menuGameStartEl = null; }
  }
}

function _rebuildMenuOptions(options, focusIndex, scale, uiW) {
  // ── 缓存检查：scale/uiW/visited 状态变化时需重建（对话完回来勾标记需更新） ──
  const visitedSig = gameState.visitedNodes ? options.filter(o => o.target && gameState.visitedNodes.has(o.target)).length : 0;
  const cacheKey = JSON.stringify(options.map(o => ({text: o.text, target: o.target}))) + `|s=${scale}|w=${uiW}|v=${visitedSig}`;
  if (menuOptionsCache === cacheKey && menuOptionEls.length === options.length) {
    // 选项没变，只更新焦点高亮 + 手柄图标显隐
    menuOptionEls.forEach((btn, i) => {
      const isFocused = (i === focusIndex);
      const img = _getMenuOptionBgImage(optForBg(i), isFocused);
      btn.style.backgroundImage = `url(${img})`;
      // 更新手柄 A 键图标显隐（聚焦显示，移走消失，与 Python 一致）
      const gpEls = btn.querySelectorAll('img[data-gp-icon]');
      gpEls.forEach(el => {
        const isA = el.dataset.gpIcon === 'a';
        const isB = el.dataset.gpIcon === 'b';
        if (isA) el.style.display = (gamepad.usingGamepad && isFocused) ? 'block' : 'none';
        // B 键常驻，不需要改
      });
    });
    return;
  }
  menuOptionsCache = cacheKey;

  // ── 选项变了，重建 ──
  menuOptionEls.forEach(el => el.remove());
  menuOptionEls = [];

  const isSub = gameState && gameState.isSubMenu;
  const btnW = scale * MENU_W;
  const btnH = scale * MENU_ITEM_H * UI_SCALE;
  const totalH = options.length * btnH;
  // 子菜单垂直居中（无底部按钮）；场景菜单上移 60px 给底部按钮留空间
  const startY = isSub
    ? (parseFloat(uiLayer.style.height) - totalH) / 2
    : (parseFloat(uiLayer.style.height) - totalH) / 2 - scale * 60;
  const slideTargets = (gameState && gameState._slideTargets) || new Set();

  options.forEach((opt, i) => {
    const isFocused = (i === focusIndex);
    const img = _getMenuOptionBgImage(opt, isFocused);
    const shouldSlide = opt.target && slideTargets.has(opt.target);

    const btn = document.createElement('div');
    btn.style.cssText = `
      position: absolute; left: ${(uiW - btnW)/2}px; top: ${startY + i*btnH}px;
      width: ${btnW}px; height: ${btnH}px;
      background-image: url(${img}); background-size: 100% 100%;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Microsoft YaHei','SimHei',sans-serif; font-weight: bold;
      font-size: ${scale*MENU_FONT_SIZE*UI_SCALE}px; color: #000; cursor: pointer;
      pointer-events: auto; -webkit-tap-highlight-color: transparent;
      ${shouldSlide ? 'transform: translateX(-720px); transition: transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94);' : ''}
    `;
    btn.textContent = opt.text || '(无文本)';
    btn.dataset.index = i;
    btn.addEventListener('mouseenter', () => {
      if (gameState.sceneFocusIndex !== i) {
        gameState.sceneFocusIndex = i;
        gameState._updatePreviewFromFocus();
        _menuNeedsRedraw = true;
      }
    });
    btn.addEventListener('click', () => {
      gameState.sceneFocusIndex = i;
      gameState.menuConfirm();
    });
    // 移动端：轻触显示高亮图，120ms 后触发
    const hoverBg = _getMenuOptionBgImage(opt, true);
    _bindMobileTap(btn, () => {
      gameState.sceneFocusIndex = i;
      gameState._updatePreviewFromFocus();
      _menuNeedsRedraw = true;
      gameState.menuConfirm();
    }, hoverBg);
    // ── 勾标记：子菜单中已对话过的选项右侧显示勾图标（与 Python UI_GOU_MARK 一致） ──
    if (isSub && !opt.is_back && !opt.is_confrontation && !opt.is_case_trial && opt.target) {
      const targetId = opt.target;
      const showCheck = opt.is_card_game ? (gameState.cardGamesCompleted && gameState.cardGamesCompleted.has(targetId)) : (gameState.visitedNodes && gameState.visitedNodes.has(targetId));
      if (showCheck) {
        const checkImg = document.createElement('img');
        checkImg.src = '../UI_Gou_01.png';
        checkImg.style.cssText = `
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          height: ${Math.round(btnH * 80 / 72)}px; pointer-events: none;
        `;
        btn.appendChild(checkImg);
      }
    }

    // ── 手柄图标：选项按钮右侧（与 Python draw_gamepad_icon gap=4 offset_x=-40 一致） ──
    // Python: cx = btn_rect.right + 4 + icon_width/2 - 40 → 图标中心在按钮右边缘附近，图标半幅伸出外侧
    const _gpIconName = opt.is_back ? 'b' : 'a';
    const _gpImg = getGamepadIcon(_gpIconName);
    // 所有选项都创建图标元素：B 键常驻显示，A 键根据焦点显隐（缓存分支通过 display 切换）
    if (_gpImg) {
      const _gpEl = document.createElement('img');
      _gpEl.src = _gpImg.src;
      _gpEl.dataset.gpIcon = _gpIconName;  // 便于缓存命中时更新显隐
      const _iconPx = Math.round(70 * scale);
      _gpEl.style.cssText = `
        position: absolute; pointer-events: none;
        height: ${_iconPx}px; width: auto;
        top: 50%; transform: translateY(-50%);
        right: ${Math.round(-34 * scale)}px;
        display: ${gamepad.usingGamepad && (opt.is_back || isFocused) ? 'block' : 'none'};
      `;
      btn.appendChild(_gpEl);
    }

    menuContainerEl.appendChild(btn);
    menuOptionEls.push(btn);
    if (shouldSlide) {
      void btn.offsetHeight;
      btn.style.transform = 'translateX(0)';
    }
  });

  // 只保留一帧的滑入标记
  if (gameState) gameState._slideTargets = null;
}

/** 根据选项类型获取按钮背景图（与 Pygame get_button_background / get_back_button_background 一致） */
function _getMenuOptionBgImage(opt, hover) {
  if (!opt) return hover ? '../UI_button_01_high.png' : '../UI_button_01.png';
  if (opt.is_back) return hover ? '../UI_button_01_high.png' : '../UI_button_03.png';
  if (opt.is_show_item || opt.is_card_game) return hover ? '../UI_button_01_high.png' : '../UI_button_04.png';
  if (opt.is_confrontation || opt.is_case_trial) return hover ? '../UI_button_01_high.png' : '../UI_button_06.png';
  // 普通选项
  return hover ? '../UI_button_01_high.png' : '../UI_button_01.png';
}

/** 获取缓存中的第 i 个选项（用于高亮刷新） */
function optForBg(i) {
  if (!gameState || !gameState.menuOptions || i >= gameState.menuOptions.length) return null;
  return gameState.menuOptions[i];
}

function _rebuildBottomButtons(scale, uiW) {
  menuBottomBtns.forEach(el => el.remove());
  menuBottomBtns = [];

  const fullW = scale * MENU_W;          // 720*scale — 与 Pygame LEAVE_BUTTON_WIDTH 一致
  const halfW = fullW / 2;               // 360*scale — 正好一半
  const btnH = scale * MENU_ITEM_H * UI_SCALE;      // 72*scale
  const uiH = parseFloat(uiLayer.style.height);
  const gap = scale * 12;                // 行间距
  const btnUpOffset = scale * 20;        // 底部按钮整体上移 20px
  const yTop = uiH - scale * CHAR_MARGIN_BOTTOM - btnH * 2 - gap - btnUpOffset;
  const yBot = uiH - scale * CHAR_MARGIN_BOTTOM - btnH - btnUpOffset;
  const xStart = (uiW - fullW) / 2;      // 居中
  const optCount = gameState.menuOptions.length;

  // 与 Pygame draw_leave_button 完全相同的位置:
  // 物品栏(左半) / 调查(右半) / 离开此地(全宽下排)
  let btns;
  if (gameState._hideInventoryBtn) {
    // 渐进教学：物品栏隐藏，调查保持原位（右半）
    btns = [
      { text: '调查',   key: 'inv',   x: xStart + halfW, y: yTop, w: halfW, h: btnH, idx: optCount },
      { text: '离开此地', key: 'leave', x: xStart,         y: yBot, w: fullW, h: btnH, idx: optCount + 1 },
    ];
  } else {
    btns = [
      { text: '物品栏', key: 'item',  x: xStart,         y: yTop, w: halfW, h: btnH, idx: optCount },
      { text: '调查',   key: 'inv',   x: xStart + halfW, y: yTop, w: halfW, h: btnH, idx: optCount + 1 },
      { text: '离开此地', key: 'leave', x: xStart,         y: yBot, w: fullW, h: btnH, idx: optCount + 2 },
    ];
  }

  btns.forEach(cfg => {
    const isFocused = (gameState.sceneFocusIndex === cfg.idx);
    const img = _getBtnBgImage(cfg.key, isFocused);
    const btn = document.createElement('div');
    btn.style.cssText = `
      position: absolute; left: ${cfg.x}px; top: ${cfg.y}px;
      width: ${cfg.w}px; height: ${cfg.h}px;
      background-image: url(${img}); background-size: 100% 100%;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Microsoft YaHei','SimHei',sans-serif; font-weight: bold;
      font-size: ${scale*MENU_FONT_SIZE*UI_SCALE}px; color: #000; cursor: pointer;
      pointer-events: auto; -webkit-tap-highlight-color: transparent;
    `;
    btn.textContent = cfg.text;

    // mouseenter：高亮当前按钮
    btn.addEventListener('mouseenter', () => {
      if (gameState.sceneFocusIndex !== cfg.idx) {
        gameState.sceneFocusIndex = cfg.idx;
        _menuNeedsRedraw = true;
      }
    });
    // mouseleave：如果不在子菜单，不变（可能已通过键盘移动了焦点）
    // 不做任何事，让键盘焦点保持

    // 点击
    btn.addEventListener('click', () => {
      gameState.sceneFocusIndex = cfg.idx;
      gameState.menuConfirm();
    });
    // 移动端：轻触显示高亮图，120ms 后触发
    if (_IS_MOBILE) {
      const hoverBg = _getBtnBgImage(cfg.key, true);
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (isMobileGuardActive()) return;
        activateMobileGuard();
        btn.style.backgroundImage = `url(${hoverBg})`;
        setTimeout(() => {
          btn.style.backgroundImage = `url(${_getBtnBgImage(cfg.key, false)})`;
          gameState.sceneFocusIndex = cfg.idx;
          _menuNeedsRedraw = true;
          gameState.menuConfirm();
        }, _MOBILE_TAP_DELAY);
      }, { passive: false });
    }
    menuContainerEl.appendChild(btn);
    menuBottomBtns.push(btn);

    // ── 手柄图标（与 Python gap=4 offset_x=-40 一致，图标半幅伸出按钮外侧） ──
    const _gpIconName = cfg.key === 'item' ? 'back' : cfg.key === 'inv' ? 'x' : cfg.key === 'leave' ? 'y' : null;
    if (_gpIconName) {
      const _gpImg = getGamepadIcon(_gpIconName);
      if (_gpImg) {
        const _gpEl = document.createElement('img');
        _gpEl.src = _gpImg.src;
        const _iconPx = Math.round(70 * scale);
        const _isLeft = cfg.key === 'item';  // Back 图标在左侧（Python align="left" offset_x=40）
        _gpEl.style.cssText = `
          position: absolute; pointer-events: none;
          height: ${_iconPx}px; width: auto;
          top: 50%; transform: translateY(-50%);
          ${_isLeft ? `left: ${Math.round(-34 * scale)}px;` : `right: ${Math.round(-34 * scale)}px;`}
          display: ${gamepad.usingGamepad ? 'block' : 'none'};
        `;
        btn.appendChild(_gpEl);
      }
    }
  });
}

// ==================== 左上角「菜单」按钮（与 Pygame UI_button_Menu 一致） ====================

const MENU_GAME_BTN_DESIGN_W = 109;  // Pygame: MENU_GAME_BUTTON_DISPLAY_WIDTH
const MENU_GAME_BTN_CENTER_X = 73;   // Pygame: MENU_GAME_BUTTON_CENTER_X
const MENU_GAME_BTN_CENTER_Y = 61;   // Pygame: MENU_GAME_BUTTON_CENTER_Y

function _rebuildMenuGameBtn(scale, uiW) {
  if (menuGameBtnEl) { menuGameBtnEl.remove(); menuGameBtnEl = null; }
  if (menuGameStartEl) { menuGameStartEl.remove(); menuGameStartEl = null; }

  const btn = document.createElement('div');
  menuGameBtnEl = btn;

  // 移动端放大按钮尺寸
  const mobileScale = _IS_MOBILE ? UI_SCALE : 1;
  const btnW = scale * MENU_GAME_BTN_DESIGN_W * mobileScale;
  // 加载图片计算高度（与 Pygame 等比缩放逻辑一致）
  const testImg = new Image();
  testImg.src = '../UI_button_Menu.png';
  let btnH = scale * 55 * mobileScale; // fallback 高度
  if (testImg.complete && testImg.naturalWidth) {
    btnH = Math.round(testImg.naturalHeight * (btnW / testImg.naturalWidth));
  } else {
    testImg.onload = () => {
      const h = Math.round(testImg.naturalHeight * (btnW / testImg.naturalWidth));
      btn.style.height = h + 'px';
      btn.style.top = ((scale * (MENU_GAME_BTN_CENTER_Y + centerYOffset)) - h / 2) + 'px';
    };
  }
  // 移动端：按钮放大后左侧可能超出屏幕，向右偏移确保不被裁掉；下移20px
  let centerX = scale * MENU_GAME_BTN_CENTER_X;
  const centerYOffset = _IS_MOBILE ? 20 : 0;
  if (_IS_MOBILE) {
    const btnLeftEdge = centerX - btnW / 2;
    if (btnLeftEdge < 0) centerX -= btnLeftEdge; // 贴左边
  }
  const btnX = centerX - btnW / 2;
  const btnY = scale * (MENU_GAME_BTN_CENTER_Y + centerYOffset) - btnH / 2;

  btn.style.cssText = `
    position: absolute; left: ${btnX}px; top: ${btnY}px;
    width: ${btnW}px; height: ${btnH}px;
    background-image: url(../UI_button_Menu.png); background-size: 100% 100%;
    cursor: pointer; pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundImage = 'url(../UI_button_Menu_high.png)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundImage = 'url(../UI_button_Menu.png)';
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    playSound('sfx_ui_skip');
    gameState._subMenu = 'options_menu';
    gameState.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
    hideMenus();
    hideDialogBox();
  });

  menuContainerEl.appendChild(btn);

  // ── 手柄 START 图标（按钮下方） ──
  if (gamepad.usingGamepad) {
    const _startImg = getGamepadIcon('start');
    if (_startImg) {
      const _startEl = document.createElement('img');
      _startEl.src = _startImg.src;
      const _iconH = Math.round(70 * scale);
      _startEl.style.cssText = `
        position: absolute; pointer-events: none;
        left: ${centerX - _iconH / 2}px;
        top: ${btnY + btnH + (4 - 20) * scale}px;
        height: ${_iconH}px; width: auto;
      `;
      menuContainerEl.appendChild(_startEl);
      menuGameStartEl = _startEl;
    }
  }
}

function _getBtnBgImage(key, hover) {
  switch (key) {
    case 'item':  return hover ? '../UI_button_02_high.png' : '../UI_button_02.png';
    case 'inv':   return hover ? '../UI_button_02_high.png' : '../UI_button_09.png';
    case 'leave': return hover ? '../UI_button_01_high.png' : '../UI_button_05.png';
    default:      return '../UI_button_01.png';
  }
}

// ==================== 底部按钮rect计算（供hover检测用） ====================

/** 返回底部三按钮在 canvas 设计空间的 rect 数组 [{id, x, y, w, h, idx}] */
function getBottomButtonRects() {
  if (!gameState) return [];
  const scale = getScale();
  const uiW = parseFloat(uiLayer.style.width);
  const fullW = scale * MENU_W;
  const halfW = fullW / 2;
  const btnH = scale * MENU_ITEM_H * UI_SCALE;
  const uiH = parseFloat(uiLayer.style.height);
  const gap = scale * 12;
  const yTop = uiH - scale * CHAR_MARGIN_BOTTOM - btnH * 2 - gap;
  const yBot = uiH - scale * CHAR_MARGIN_BOTTOM - btnH;
  const xStart = (uiW - fullW) / 2;
  const optCount = gameState.menuOptions.length;

  return [
    { id: 'item',  x: xStart,         y: yTop, w: halfW, h: btnH, idx: optCount },
    { id: 'inv',   x: xStart + halfW, y: yTop, w: halfW, h: btnH, idx: optCount + 1 },
    { id: 'leave', x: xStart,         y: yBot, w: fullW, h: btnH, idx: optCount + 2 },
  ];
}

/** 鼠标在底部按钮上悬停时更新焦点，返回是否发生了变化 */
function checkMenuHover(canvasX, canvasY) {
  if (!gameState || gameState.mode !== 'menu') return false;
  if (gameState._subMenu) return false;
  const rects = getBottomButtonRects();
  let changed = false;
  for (const r of rects) {
    if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
      if (gameState.sceneFocusIndex !== r.idx) {
        gameState.sceneFocusIndex = r.idx;
        changed = true;
      }
      return changed;
    }
  }
  return changed;
}

// ==================== 离开菜单 ====================

/** 离开菜单按钮图片（与 Python draw_menu 一致）：
 *  目的地: UI_button_01.png / UI_button_01_high.png  (get_button_background)
 *  返回:   UI_button_03.png / UI_button_01_high.png  (get_back_button_background)
 */
function _getLeaveBtnBgImage(isBack, hover) {
  if (isBack) return hover ? '../UI_button_01_high.png' : '../UI_button_03.png';
  return hover ? '../UI_button_01_high.png' : '../UI_button_01.png';
}

function _createLeaveUI() {
  if (leaveContainerEl) return;
  leaveContainerEl = document.createElement('div');
  leaveContainerEl.id = 'leave-container';
  leaveContainerEl.style.cssText = 'position:absolute; inset:0; pointer-events:auto; display:none;';
  // 空白区域点击不传播（防止意外触发菜单返回）
  leaveContainerEl.addEventListener('click', e => { e.stopPropagation(); });
  uiLayer.appendChild(leaveContainerEl);
}

function drawLeaveMenu() {
  _createLeaveUI();
  if (!gameState || gameState._subMenu !== 'leave') return;

  menuContainerEl.style.display = 'none';
  leaveContainerEl.style.display = 'block';

  const scale = getScale();
  const uiW = parseFloat(uiLayer.style.width);
  const uiH = parseFloat(uiLayer.style.height);
  const dests = gameState.menuDestinations || [];

  // ── 缓存检查：目的地/scale/uiW 变化时需重建 ──
  const cacheKey = JSON.stringify(dests.map(d => ({text: d.text, target: d.target}))) + `|s=${scale}|w=${uiW}`;
  if (leaveMenuCache === cacheKey && leaveOptionEls.length === dests.length && leaveBackEl) {
    _refreshLeaveFocus(gameState.sceneFocusIndex);
    return;
  }
  leaveMenuCache = cacheKey;

  console.log(`[DEBUG-LEAVE] drawLeaveMenu dests=${dests.length} dests=[${dests.map(d=>d.text).join(',')}]`);

  // 清除旧按钮
  leaveOptionEls.forEach(el => el.remove());
  leaveOptionEls = [];
  if (leaveBackEl) { leaveBackEl.remove(); leaveBackEl = null; }

  const btnW = scale * MENU_W;
  const btnH = scale * MENU_ITEM_H * UI_SCALE;
  const totalItems = dests.length + 1; // + 返回
  const totalH = totalItems * btnH + scale * 16;
  const startY = (uiH - totalH) / 2;
  const slideTargets = (gameState && gameState._slideTargets) || new Set();

  dests.forEach((dest, i) => {
    const isFocused = (gameState.sceneFocusIndex === i);
    const img = _getLeaveBtnBgImage(false, isFocused);
    const shouldSlide = dest.target && slideTargets.has(dest.target);
    const btn = document.createElement('div');
    btn.className = 'leave-option';
    btn.style.cssText = `
      position: absolute; left: ${(uiW - btnW) / 2}px; top: ${startY + i * btnH}px;
      width: ${btnW}px; height: ${btnH}px;
      background-image: url(${img}); background-size: 100% 100%;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Microsoft YaHei','SimHei',sans-serif; font-weight: bold;
      font-size: ${scale * MENU_FONT_SIZE * UI_SCALE}px; color: #000; cursor: pointer;
      pointer-events: auto; -webkit-tap-highlight-color: transparent;
      ${shouldSlide ? 'transform: translateX(-720px); transition: transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94);' : ''}
    `;
    btn.textContent = dest.text || '(无文本)';
    console.log(`[DEBUG-LEAVE] btn[${i}] "${dest.text}" at (${(uiW-btnW)/2},${startY+i*btnH}) size=${btnW}x${btnH}`);

    btn.addEventListener('mouseenter', () => {
      if (gameState._subMenu !== 'leave') return;
      _refreshLeaveFocus(i);
    });
    btn.addEventListener('click', (e) => {
      console.log(`[DEBUG-LEAVE] CLICK btn[${i}] "${dest.text}"`);
      gameState.sceneFocusIndex = i;
      gameState.menuConfirm();
    });
    // 移动端：轻触显示高亮图，120ms 后触发
    if (_IS_MOBILE) {
      const hoverBg = _getLeaveBtnBgImage(false, true);
      const normalBg = _getLeaveBtnBgImage(false, false);
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (isMobileGuardActive()) return;
        activateMobileGuard();
        btn.style.backgroundImage = `url(${hoverBg})`;
        setTimeout(() => {
          btn.style.backgroundImage = `url(${normalBg})`;
          gameState.sceneFocusIndex = i;
          gameState.menuConfirm();
        }, _MOBILE_TAP_DELAY);
      }, { passive: false });
    }
    leaveContainerEl.appendChild(btn);
    leaveOptionEls.push(btn);

    // ── 手柄图标：目的地选项 → A 键（仅聚焦显示，与 Python draw_leave_menu 一致） ──
    if (gamepad.usingGamepad) {
      const _aImg = getGamepadIcon('a');
      if (_aImg) {
        const _aEl = document.createElement('img');
        _aEl.src = _aImg.src;
        const _iconPx = Math.round(70 * scale);
        _aEl.style.cssText = `
          position: absolute; pointer-events: none;
          height: ${_iconPx}px; width: auto;
          top: 50%; transform: translateY(-50%);
          right: ${Math.round(-34 * scale)}px;
          display: ${isFocused ? 'inline' : 'none'};
        `;
        btn.appendChild(_aEl);
      }
    }

    // ── 触发滑入动画（强制回流后设置目标值） ──
    if (shouldSlide) {
      void btn.offsetHeight;
      btn.style.transform = 'translateX(0)';
    }
  });

  // 返回按钮（永不滑动）
  const backIdx = dests.length;
  const backImg = _getLeaveBtnBgImage(true, (gameState.sceneFocusIndex === backIdx));
  leaveBackEl = document.createElement('div');
  leaveBackEl.className = 'leave-back';
  leaveBackEl.style.cssText = `
    position: absolute; left: ${(uiW - btnW) / 2}px; top: ${startY + backIdx * btnH + scale * 16}px;
    width: ${btnW}px; height: ${btnH}px;
    background-image: url(${backImg}); background-size: 100% 100%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Microsoft YaHei','SimHei',sans-serif; font-weight: bold;
    font-size: ${scale * MENU_FONT_SIZE * UI_SCALE}px; color: #000; cursor: pointer;
    pointer-events: auto; -webkit-tap-highlight-color: transparent;
  `;
  leaveBackEl.textContent = '返回';
  leaveBackEl.addEventListener('mouseenter', () => {
    if (gameState._subMenu !== 'leave') return;
    _refreshLeaveFocus(backIdx);
  });
  leaveBackEl.addEventListener('click', () => {
    gameState.sceneFocusIndex = backIdx;
    gameState.menuConfirm();
  });
  _bindMobileTap(leaveBackEl, () => {
    gameState.sceneFocusIndex = backIdx;
    gameState.menuConfirm();
  }, _getLeaveBtnBgImage(true, true));
  leaveContainerEl.appendChild(leaveBackEl);

  // ── 手柄图标：返回按钮 → B 键（原型：常驻显示） ──
  if (gamepad.usingGamepad) {
    const _bImg = getGamepadIcon('b');
    if (_bImg) {
      const _bEl = document.createElement('img');
      _bEl.src = _bImg.src;
      const _iconPx = Math.round(70 * scale);
      _bEl.style.cssText = `
        position: absolute; pointer-events: none;
        height: ${_iconPx}px; width: auto;
        top: 50%; transform: translateY(-50%);
        right: 10px;
      `;
      leaveBackEl.appendChild(_bEl);
    }
  }

  // 清除滑入标记
  gameState._slideTargets = null;
}

/** 重新渲染单个离开菜单按钮的高亮 */
function _refreshLeaveFocus(idx) {
  gameState.sceneFocusIndex = idx;
  const dests = gameState.menuDestinations || [];
  const backIdx = dests.length;

  dests.forEach((_, i) => {
    if (i < leaveOptionEls.length) {
      leaveOptionEls[i].style.backgroundImage = `url(${_getLeaveBtnBgImage(false, i === idx)})`;
      // 切换 A 图标显隐
      const icon = leaveOptionEls[i].querySelector('img');
      if (icon) icon.style.display = (i === idx) ? 'inline' : 'none';
    }
  });
  if (leaveBackEl) {
    leaveBackEl.style.backgroundImage = `url(${_getLeaveBtnBgImage(true, idx === backIdx)})`;
  }
}

// ==================== 选项菜单（ESC弹出） ====================
// 与 Pygame 一致：底图 bg_menu_04 + 标题 bg_menu_04_01 + 关闭按钮 UI_Xa_01 + 3个菜单按钮

const OPTIONS_MENU_BTNS = [
  { normal: 'bg_menu_button_02.png', hover: 'bg_menu_button_02_high.png' },
  { normal: 'bg_menu_button_05.png', hover: 'bg_menu_button_05_high.png' },
  { normal: 'bg_menu_button_03.png', hover: 'bg_menu_button_03_high.png' },
  { normal: 'bg_menu_button_04.png', hover: 'bg_menu_button_04_high.png' },
];
const OPTIONS_BTN_CENTER_X = 613;
const OPTIONS_BTN_GAP = 231;
const OPTIONS_BTN_CENTER_Y = 583;
const OPTIONS_BTN_HEIGHT = 523;  // 与标题界面 TITLE_BTN_TARGET_H 一致
const OPTIONS_CLOSE_X = 1533;
const OPTIONS_CLOSE_Y = 301;

function drawOptionsMenu() {
  if (!gameState || gameState._subMenu !== 'options_menu') return;

  // 隐藏 DOM 菜单
  menuContainerEl && (menuContainerEl.style.display = 'none');
  leaveContainerEl && (leaveContainerEl.style.display = 'none');
  settingsContainerEl && (settingsContainerEl.style.display = 'none');


  // Canvas 绘制底图 bg_menu_04（与 Pygame options_bg 一致）
  const bg = getImage('bg_menu_04.png');
  if (bg && bg.complete) {
    ctx.drawImage(bg, 0, 0, DESIGN_W, DESIGN_H);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  }

  // 标题图 bg_menu_04_01（与 Pygame load_menu_title(target_width=324) + draw_menu_title(center_x=978, center_y=192) 一致）
  const title = getImage('bg_menu_04_01.png');
  if (title && title.complete) {
    const titleW = 324;
    const titleH = titleW * (title.naturalHeight / title.naturalWidth);
    const titleX = 978 - titleW / 2;
    const titleY = 192 - titleH / 2;
    ctx.drawImage(title, titleX, titleY, titleW, titleH);
  }

  // 关闭按钮 UI_Xa_01 (center at 1533, 301, 移动端按 UI_SCALE 放大)
  const closeHover = gameState._optionsCloseHover || false;
  const closeFile = closeHover ? 'UI_Xa_01_high.png' : 'UI_Xa_01.png';
  const closeImg = getImage(closeFile);
  if (closeImg && closeImg.complete) {
    const closeW = Math.round(133 * UI_SCALE);
    const scale = closeW / closeImg.naturalWidth;
    const closeH = closeImg.naturalHeight * scale;
    const closeX = OPTIONS_CLOSE_X - closeW / 2;
    const closeY = OPTIONS_CLOSE_Y - closeH / 2;
    ctx.drawImage(closeImg, closeX, closeY, closeW, closeH);
    // 存储 rect 供点击检测
    gameState._optionsCloseRect = { x: closeX, y: closeY, w: closeW, h: closeH };
  }

  // 3个菜单按钮
  gameState._optionsBtnRects = [];
  OPTIONS_MENU_BTNS.forEach((cfg, i) => {
    const isFocused = (gameState.optionsMenuFocus === i);
    const imgFile = isFocused ? cfg.hover : cfg.normal;
    const img = getImage(imgFile);
    if (img && img.complete) {
      const btnH = OPTIONS_BTN_HEIGHT;
      const btnW = btnH * (img.naturalWidth / img.naturalHeight);
      const cx = OPTIONS_BTN_CENTER_X + i * OPTIONS_BTN_GAP;
      const cy = OPTIONS_BTN_CENTER_Y;
      ctx.drawImage(img, cx - btnW / 2, cy - btnH / 2, btnW, btnH);
      gameState._optionsBtnRects.push({ x: cx - btnW / 2, y: cy - btnH / 2, w: btnW, h: btnH, index: i });
    }
  });

  // 手柄模式：焦点按钮下方绘制 A 键图标（与 Python 一致）
  if (gamepad.usingGamepad && gameState.optionsMenuFocus >= 0) {
    const rect = gameState._optionsBtnRects[gameState.optionsMenuFocus];
    if (rect) drawGamepadIconBelow(ctx, 'a', rect, -70);
  }

  // 手柄模式：关闭按钮下方绘制 B 键图标（与 Python text_adventure.py:11781-11783 一致）
  if (gamepad.usingGamepad && gameState._optionsCloseRect) {
    drawGamepadIconBelow(ctx, 'b', gameState._optionsCloseRect, -55, 40);
  }
}

function _execOptionsMenuChoice(index) {
  playSound('sfx_ui_confirm');
  if (index === 0) {
    // 设置选项 → settings sub-panel
    gameState._subMenu = 'settings';
    gameState.settingsMenuFocus = _IS_MOBILE ? -1 : 0;
  } else if (index === 1) {
    // 保存游戏 → 进入保存界面（从选项菜单进入，显示背景图+标题图）
    gameState._subMenu = null;
    gameState._saveFromOptions = true;
    gameState.uiMode = 'save';
    gameState.saveIndexFocus = _IS_MOBILE ? -1 : 0;
  } else if (index === 2) {
    // 读取游戏 → 进入读取界面（从选项菜单进入，返回时回到选项菜单）
    gameState._subMenu = null;
    gameState._saveFromOptions = true;
    gameState.uiMode = 'load';
    gameState.saveIndexFocus = _IS_MOBILE ? -1 : 0;
  } else if (index === 3) {
    // 退出游戏 → 淡出回到标题画面（与 Python 一致：fade to main_menu）
    gameState._subMenu = null;
    gameState._settingsFromTitle = false;
    // 启动淡出过渡（使用引擎内置 fade 系统）
    gameState.fadePhase = 'fade_out';
    gameState.fadeTimer = 0;
    gameState.fadeAlpha = 0;
    gameState.fadeCallback = function() {
      gameState.uiMode = 'title';
      gameState.titleFocus = _IS_MOBILE ? -1 : 0;
      gameState.mode = 'menu';
    };
    playSound('sfx_ui_confirm');
  }
}

/** 检测选项菜单的 hover 状态（在每帧调用 update 时更新） */
function updateOptionsMenuHover(canvasX, canvasY) {
  if (!gameState || gameState._subMenu !== 'options_menu') return;
  if (_IS_MOBILE) return;  // 移动端不依赖坐标 hover

  // 关闭按钮 hover
  if (gameState._optionsCloseRect) {
    const r = gameState._optionsCloseRect;
    gameState._optionsCloseHover = (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h);
  }

  // 按钮 hover（只在鼠标/触摸模式下更新）
  if (gamepad.focusByMouse && gameState._optionsBtnRects) {
    for (const r of gameState._optionsBtnRects) {
      if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
        gameState.optionsMenuFocus = r.index;
        return;
      }
    }
  }
}

/** 处理选项菜单的 click 事件，返回 true 表示已处理 */
function handleOptionsMenuClick(canvasX, canvasY) {
  if (!gameState || gameState._subMenu !== 'options_menu') return false;

  // 关闭按钮
  if (gameState._optionsCloseRect) {
    const r = gameState._optionsCloseRect;
    if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
      playSound('sfx_ui_cancel');
      const inSavePrompt = (gameState.mode === 'save_prompt');
      gameState._subMenu = null;
      // 在 save_prompt 模式下关闭选项菜单 → 继续剧情（与 Python 一致）
      if (inSavePrompt) gameState._continueFromSavePrompt();
      return true;
    }
  }

  // 菜单按钮
  if (gameState._optionsBtnRects) {
    for (const r of gameState._optionsBtnRects) {
      if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
        gameState.optionsMenuFocus = r.index;
        _execOptionsMenuChoice(r.index);
        return true;
      }
    }
  }

  // 按钮外区域：不响应（只允许关闭按钮/ESC退出，与设置面板行为一致）
  return true;
}

// ==================== 设置面板（全 Canvas 绘制） ====================

// 布局常量（与 Pygame draw_settings_menu 完全一致）
const S_ITEM_Y0 = 440;       // 第0行 top
const S_ITEM_GAP = 110;      // 行间距
const S_LABEL_X = 600;       // 标签 center_x
const S_CTRL_X = 950;        // 控件 left edge
const S_CTRL_W = 350;        // 控件宽度
const S_CTRL_H = 60;         // 行高
const S_SLIDER_H = 16;       // 滑块条高度
const S_SLIDER_OFF_Y = 22;   // 滑块条在行内的 top 偏移 = (CTRL_H - SLIDER_H)/2
const S_KNOB_R = 10;         // 滑块圆钮半径
const S_BACK_CX = 1533;      // 返回按钮 center_x
const S_BACK_CY = 301;       // 返回按钮 center_y

/**
 * Canvas 绘制设置面板全部内容，并存储各控件的 rect 供点击检测。
 * 在 renderUI 中每帧调用。
 */
function drawSettings() {
  if (!gameState || gameState._subMenu !== 'settings') return;

  // 隐藏其他 DOM 菜单
  menuContainerEl && (menuContainerEl.style.display = 'none');
  leaveContainerEl && (leaveContainerEl.style.display = 'none');
  if (settingsContainerEl) settingsContainerEl.style.display = 'none';

  // ---- 底图（与 Python 一致：标题入口用 bg_menu_03，游戏菜单入口用 bg_menu_04 + 标题图） ----
  if (gameState._settingsFromTitle) {
    // 标题画面进入 → bg_menu_03
    const bg = getImage('bg_menu_03.png');
    if (bg && bg.complete) {
      ctx.drawImage(bg, 0, 0, DESIGN_W, DESIGN_H);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
  } else {
    // 游戏菜单进入 → bg_menu_04 + 标题图 bg_menu_04_03
    const bg = getImage('bg_menu_04.png');
    if (bg && bg.complete) {
      ctx.drawImage(bg, 0, 0, DESIGN_W, DESIGN_H);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
    const title = getImage('bg_menu_04_03.png');
    if (title && title.complete) {
      const titleW = 324;
      const titleH = titleW * (title.naturalHeight / title.naturalWidth);
      const titleX = 978 - titleW / 2;
      const titleY = 192 - titleH / 2;
      ctx.drawImage(title, titleX, titleY, titleW, titleH);
    }
  }

  // ---- 焦点高亮：UI_button_03_high 拉伸 1.7 倍 ----
  const focus = gameState.settingsMenuFocus;
  if (focus >= 0 && focus < 3) {
    const highImg = getImage('UI_button_03_high.png');
    if (highImg && highImg.complete) {
      const highW = Math.round(S_CTRL_W * 1.7);
      const highY = S_ITEM_Y0 + focus * S_ITEM_GAP;
      ctx.drawImage(highImg, S_CTRL_X - 150, highY, highW, S_CTRL_H);
    }
  }

  // ---- 三条设置行 ----
  const vol0 = gameState.muted ? 0 : 1;  // 静音时视作 0
  const volBgm = gameState.bgmVolume;
  const volSfx = gameState.sfxVolume;

  _drawSettingsRow(0, '静音', null, vol0, '#777', true);               // 静音行：文字"开启"/"关闭"
  _drawSettingsRow(1, '音乐音量', 'bgm', volBgm, 'rgb(100,160,100)');  // BGM 滑块
  _drawSettingsRow(2, '音效音量', 'sfx', volSfx, 'rgb(100,140,160)');  // SFX 滑块

  // 存储三行整行 rect（供 hover 检测，与 Python row_rects 一致）
  gameState._settingsRowRects = [
    { x: S_CTRL_X, y: S_ITEM_Y0, w: S_CTRL_W, h: S_CTRL_H },
    { x: S_CTRL_X, y: S_ITEM_Y0 + S_ITEM_GAP, w: S_CTRL_W, h: S_CTRL_H },
    { x: S_CTRL_X, y: S_ITEM_Y0 + S_ITEM_GAP * 2, w: S_CTRL_W, h: S_CTRL_H },
  ];

  // ---- 返回按钮 UI_Up_01 (center 1533,301, 移动端按 UI_SCALE 放大) ----
  const backImg = getImage('UI_Up_01.png');
  const backHover = (gameState.settingsMenuFocus === 3);
  const backFile = backHover ? 'UI_Up_01_high.png' : 'UI_Up_01.png';
  const backSrc = getImage(backFile);
  if (backSrc && backSrc.complete) {
    const bw = Math.round(133 * UI_SCALE);
    const bh = Math.round(backSrc.naturalHeight * (bw / backSrc.naturalWidth));
    const bx = S_BACK_CX - bw / 2, by = S_BACK_CY - bh / 2;
    ctx.drawImage(backSrc, bx, by, bw, bh);
    gameState._settingsBackRect = { x: bx, y: by, w: bw, h: bh };
  }

  // 手柄模式：设置行 A 键图标（与 Python 一致）
  if (gamepad.usingGamepad && focus === 0 && gameState._settingsRowRects && gameState._settingsRowRects[0]) {
    drawGamepadIcon(ctx, 'a', gameState._settingsRowRects[0], 4, -40);
  }
  // 手柄模式：返回按钮 B 键图标（常驻，按钮下方居中，与存档界面 B 键一致）
  if (gamepad.usingGamepad && gameState._settingsBackRect) {
    drawGamepadIconBelow(ctx, 'b', gameState._settingsBackRect, -55, 40);
  }
}

/** 绘制一行设置项 */
function _drawSettingsRow(rowIdx, label, sliderType, value, fillColor, isMute) {
  const rowY = S_ITEM_Y0 + rowIdx * S_ITEM_GAP;
  const rowCY = rowY + S_CTRL_H / 2;

  // 标签（与 Pygame menu_font = get_font(42) 对齐，但 CSS 渲染略大，适当缩小）
  ctx.fillStyle = '#000';
  ctx.font = `${32 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, S_LABEL_X, rowCY);

  if (isMute) {
    // 静音文字
    const muteText = gameState.muted ? '关闭' : '开启';
    ctx.font = `${28 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
    ctx.fillText(muteText, S_CTRL_X + S_CTRL_W / 2, rowCY);
    // 存储 rect（覆盖整行控件区域）
    gameState._settingsMuteRect = { x: S_CTRL_X, y: rowY, w: S_CTRL_W, h: S_CTRL_H };
    return;
  }

  // 滑块轨道
  const sliderY = rowY + S_SLIDER_OFF_Y;
  const sliderRect = { x: S_CTRL_X, y: sliderY, w: S_CTRL_W, h: S_SLIDER_H };

  // 灰色轨道背景
  ctx.fillStyle = 'rgb(200,200,200)';
  _roundRect(sliderRect.x, sliderRect.y, sliderRect.w, sliderRect.h, S_KNOB_R);

  // 填充条
  const fillW = Math.round(S_CTRL_W * value);
  if (fillW > 0) {
    ctx.fillStyle = fillColor;
    _roundRect(sliderRect.x, sliderRect.y, fillW, S_SLIDER_H, S_KNOB_R);
  }

  // 圆形拖钮
  const knobX = sliderRect.x + fillW;
  const knobY = sliderRect.y + S_SLIDER_H / 2;
  ctx.beginPath();
  ctx.arc(knobX, knobY, S_KNOB_R, 0, Math.PI * 2);
  ctx.fill();

  // 存储 rect（使用整行高度 60px 作为点击/拖拽区域，手指触摸更友好）
  const rowRect = { x: S_CTRL_X, y: rowY, w: S_CTRL_W, h: S_CTRL_H };
  if (sliderType === 'bgm') gameState._settingsBgmRect = rowRect;
  else gameState._settingsSfxRect = rowRect;
}

/** 圆角矩形填充（仅支持等半径圆角） */
function _roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

/** loadSettings / saveSettings 定义在 save.js 中（IndexedDB 版本） */

// ==================== 全屏按钮 ====================

function createFullscreenButton() {
  if (document.getElementById('fs-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'fs-btn';
  btn.textContent = '⛶';
  btn.title = '全屏';
  btn.style.cssText = `
    position: absolute; top: 8px; right: 56px;
    width: 44px; height: 44px;
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 6px;
    color: #fff; font-size: 22px; cursor: pointer;
    z-index: 100; pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
  `;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const el = document.documentElement;
      const f = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
      if (f) f.call(el).catch(() => {});
    }
  });
  uiLayer.appendChild(btn);
}

function createReloadButton() {
  if (document.getElementById('reload-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'reload-btn';
  btn.textContent = '↻';
  btn.title = '刷新游戏';
  btn.style.cssText = `
    position: absolute;
    top: 8px; right: 8px;
    width: 44px; height: 44px;
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 6px;
    color: #fff; font-size: 22px; cursor: pointer;
    z-index: 100; pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
  `;
  btn.addEventListener('click', e => { e.stopPropagation(); location.reload(true); });
  uiLayer.appendChild(btn);
}

/** 定位刷新按钮位置（标题画面：右上角；游戏中：紧贴场景名称标签左侧） */
function positionReloadButton() {
  const btn = document.getElementById('reload-btn');
  if (!btn) return;
  const gs = gameState;
  if (!gs || gs.mode === 'event_trigger' || gs.fadePhase) {
    btn.style.display = 'none';
    return;
  }

  const scale = getScale();
  // 尺寸和字号按 UI_SCALE 放大（与跳过按钮等 DOM 元素一致）
  const btnW = Math.round(44 * scale * UI_SCALE);
  const btnH = Math.round(44 * scale * UI_SCALE);
  const btnFontSize = (22 * scale * UI_SCALE) + 'px';

  // 标题画面：右上角固定位置（不受 _uiSceneLabel 影响）
  if (gs.uiMode === 'title') {
    btn.style.display = 'block';
    btn.style.left = '';
    btn.style.right = Math.round(8 * scale) + 'px';
    btn.style.top = Math.round(8 * scale) + 'px';
    btn.style.width = btnW + 'px';
    btn.style.height = btnH + 'px';
    btn.style.fontSize = btnFontSize;
    return;
  }

  // 游戏中：紧贴场景名称标签左侧
  if (!gs._uiSceneLabel) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'block';

  const uiW = parseFloat(uiLayer.style.width);

  // 场景名称 Canvas 位置：中心 (1725, 30)，宽度 384*UI_SCALE（与 drawSceneLabel 对齐）
  let labelCenterX = 1725 * scale;
  let labelW = 384 * UI_SCALE * scale;

  // 移动端：与 drawSceneLabel() 相同的向左偏移，避免右侧超出画面
  if (_IS_MOBILE) {
    const rightEdge = labelCenterX + labelW / 2;
    const limitW = DESIGN_W * scale;
    if (rightEdge > limitW) labelCenterX -= (rightEdge - limitW);
  }

  const gap = 6 * scale;

  // [↻] 紧贴场景名称左侧
  const btnCenterY = (_IS_MOBILE ? 50 : 30) * scale;
  const btnX = labelCenterX - labelW / 2 - gap - btnW;
  const btnY = btnCenterY - btnH / 2;

  btn.style.left = btnX + 'px';
  btn.style.right = '';
  btn.style.top = btnY + 'px';
  btn.style.width = btnW + 'px';
  btn.style.height = btnH + 'px';
  btn.style.fontSize = btnFontSize;
}

// ==================== 物品栏（阶段 4） ====================

let inventoryContainerEl = null;
let inventoryCardsWrapper = null;
let inventoryArrowLeft = null;
let inventoryArrowRight = null;
let inventoryInfoName = null;
let inventoryInfoDesc = null;
let inventoryBtnShow = null;
let inventoryBtnClose = null;
let inventoryBtnToggle = null;

/** 物品栏常量（设计分辨率 1920×1080） */
const INV_CARD_W = 160;
const INV_CARD_H = 160;
const INV_CARD_GAP = 14;
const INV_CARD_VISIBLE = 5;
const INV_CAROUSEL_TOP = 120;
const INV_INFO_TOP = 360;
const INV_INFO_W = 600;
const INV_INFO_H = 120;
const INV_BTN_W = 200;
const INV_BTN_H = 60;
const INV_BTN_GAP = 20;
const INV_BTN_TOP = 510;

function getItemImageUrl(itemId) {
  const itemsDef = scenarioData && scenarioData.items ? scenarioData.items : {};
  const itemDef = itemsDef[itemId];
  if (itemDef && itemDef.image) return BASE_PATH + '/' + itemDef.image;
  return null;
}

function _createInventoryUI() {
  if (inventoryContainerEl) return;

  const container = document.createElement('div');
  container.id = 'inventory-container';
  container.style.cssText = `
    position: absolute; inset: 0; display: none; z-index: 60;
    background: rgba(0,0,0,0.65);
    pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
  `;
  // 点击空白区域关闭（举证对白模式下不允许）
  container.addEventListener('click', (e) => {
    if (e.target === container) {
      if (gameState && gameState._inProofInterrupt) return;
      _hideInventory();
    }
  });
  uiLayer.appendChild(container);
  inventoryContainerEl = container;

  // ── 标题 ──
  const title = document.createElement('div');
  title.id = 'inv-title';
  title.textContent = '物品栏';
  title.style.cssText = `
    position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
    color: #fff; font-family: 'Microsoft YaHei','SimHei',sans-serif;
    font-size: 36px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
    pointer-events: none; z-index: 61;
  `;
  container.appendChild(title);

  // ── 进度文字 ──
  const progress = document.createElement('div');
  progress.id = 'inv-progress';
  progress.style.cssText = `
    position: absolute; top: 65px; left: 50%; transform: translateX(-50%);
    color: rgba(255,255,255,0.7); font-family: 'Microsoft YaHei','SimHei',sans-serif;
    font-size: 18px; pointer-events: none; z-index: 61;
  `;
  container.appendChild(progress);

  // ── 左箭头 ──
  const arrL = document.createElement('div');
  arrL.id = 'inv-arrow-left';
  arrL.textContent = '◀';
  arrL.style.cssText = `
    position: absolute; z-index: 62; cursor: pointer;
    color: #fff; font-size: 40px; text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
    display: flex; align-items: center; justify-content: center;
    width: 50px; height: 80px; user-select: none;
    -webkit-tap-highlight-color: transparent;
  `;
  arrL.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState) { gameState.inventoryPrev(); _updateInventoryUI(); }
  });
  _bindMobileTap(arrL, () => {
    if (gameState) { gameState.inventoryPrev(); _updateInventoryUI(); }
  });
  container.appendChild(arrL);
  inventoryArrowLeft = arrL;

  // ── 卡片容器 ──
  const wrapper = document.createElement('div');
  wrapper.id = 'inv-cards-wrapper';
  wrapper.style.cssText = `
    position: absolute; z-index: 61; overflow: hidden;
    pointer-events: none;
  `;
  container.appendChild(wrapper);
  inventoryCardsWrapper = wrapper;

  // ── 右箭头 ──
  const arrR = document.createElement('div');
  arrR.id = 'inv-arrow-right';
  arrR.textContent = '▶';
  arrR.style.cssText = `
    position: absolute; z-index: 62; cursor: pointer;
    color: #fff; font-size: 40px; text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
    display: flex; align-items: center; justify-content: center;
    width: 50px; height: 80px; user-select: none;
    -webkit-tap-highlight-color: transparent;
  `;
  arrR.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState) { gameState.inventoryNext(); _updateInventoryUI(); }
  });
  _bindMobileTap(arrR, () => {
    if (gameState) { gameState.inventoryNext(); _updateInventoryUI(); }
  });
  container.appendChild(arrR);
  inventoryArrowRight = arrR;

  // ── 信息框 ──
  const info = document.createElement('div');
  info.id = 'inv-info';
  info.style.cssText = `
    position: absolute; z-index: 61; pointer-events: none;
    background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.3);
    border-radius: 8px; padding: 12px 16px;
    display: flex; flex-direction: column; justify-content: center;
  `;
  container.appendChild(info);

  const infoName = document.createElement('div');
  infoName.id = 'inv-info-name';
  infoName.style.cssText = `
    color: #FFD700; font-family: 'Microsoft YaHei','SimHei',sans-serif;
    font-size: 22px; font-weight: bold; margin-bottom: 6px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  `;
  info.appendChild(infoName);
  inventoryInfoName = infoName;

  const infoDesc = document.createElement('div');
  infoDesc.id = 'inv-info-desc';
  infoDesc.style.cssText = `
    color: #ddd; font-family: 'Microsoft YaHei','SimHei',sans-serif;
    font-size: 16px; line-height: 1.4;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  `;
  info.appendChild(infoDesc);
  inventoryInfoDesc = infoDesc;

  // ── 按钮 ──
  const btnShow = document.createElement('div');
  btnShow.id = 'inv-btn-show';
  btnShow.textContent = '展示';
  btnShow.style.cssText = `
    position: absolute; z-index: 62; cursor: pointer;
    background: rgba(255,213,141,0.9); border: 2px solid rgb(167,92,26);
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-family: 'Microsoft YaHei','SimHei',sans-serif; font-weight: bold;
    font-size: 24px; color: #000; user-select: none;
    pointer-events: auto; -webkit-tap-highlight-color: transparent;
  `;
  btnShow.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState) gameState.inventoryShowItem();
  });
  _bindMobileTap(btnShow, () => {
    if (gameState) gameState.inventoryShowItem();
  });
  btnShow.addEventListener('mouseenter', () => {
    btnShow.style.background = 'rgba(255,230,170,0.95)';
  });
  btnShow.addEventListener('mouseleave', () => {
    btnShow.style.background = 'rgba(255,213,141,0.9)';
  });
  container.appendChild(btnShow);
  inventoryBtnShow = btnShow;

  // ── 展示按钮 → Y 键图标 ──
  if (gamepad.usingGamepad) {
    const _yImg = getGamepadIcon('y');
    if (_yImg) {
      const _yEl = document.createElement('img');
      _yEl.src = _yImg.src;
      _yEl.style.cssText = `
        position: absolute; pointer-events: none;
        height: ${Math.round(70 * scale)}px; width: auto;
        top: 50%; transform: translateY(-50%);
        right: 8px;
      `;
      btnShow.appendChild(_yEl);
    }
  }

  const btnClose = document.createElement('div');
  btnClose.id = 'inv-btn-close';
  btnClose.textContent = '关闭';
  btnClose.style.cssText = `
    position: absolute; z-index: 62; cursor: pointer;
    background: rgba(200,200,200,0.85); border: 2px solid rgba(100,100,100,0.8);
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-family: 'Microsoft YaHei','SimHei',sans-serif; font-weight: bold;
    font-size: 24px; color: #000; user-select: none;
    pointer-events: auto; -webkit-tap-highlight-color: transparent;
  `;
  btnClose.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState && gameState._inProofInterrupt) return;
    _hideInventory();
  });
  _bindMobileTap(btnClose, () => {
    if (gameState && gameState._inProofInterrupt) return;
    _hideInventory();
  });
  btnClose.addEventListener('mouseenter', () => {
    btnClose.style.background = 'rgba(220,220,220,0.95)';
  });
  btnClose.addEventListener('mouseleave', () => {
    btnClose.style.background = 'rgba(200,200,200,0.85)';
  });
  container.appendChild(btnClose);
  inventoryBtnClose = btnClose;

  // ── 关闭按钮 → B 键图标 ──
  if (gamepad.usingGamepad) {
    const _bImg = getGamepadIcon('b');
    if (_bImg) {
      const _bEl = document.createElement('img');
      _bEl.src = _bImg.src;
      _bEl.style.cssText = `
        position: absolute; pointer-events: none;
        height: ${Math.round(70 * scale)}px; width: auto;
        top: 50%; transform: translateY(-50%);
        right: 8px;
      `;
      btnClose.appendChild(_bEl);
    }
  }

  // ── 切换模式按钮（物品/人物） ──
  const btnToggle = document.createElement('div');
  btnToggle.id = 'inv-btn-toggle';
  btnToggle.textContent = '切换人物';
  btnToggle.style.cssText = `
    position: absolute; z-index: 61; cursor: pointer;
    background: rgba(255,213,141,0.85); border: 2px solid rgba(167,92,26,0.6);
    border-radius: 6px; display: flex; align-items: center; justify-content: center;
    font-family: 'Microsoft YaHei','SimHei',sans-serif; font-weight: bold;
    font-size: 18px; color: #000; user-select: none;
    pointer-events: auto; -webkit-tap-highlight-color: transparent;
  `;
  btnToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState) {
      gameState.toggleInventoryMode();
      _updateInventoryUI();
    }
  });
  _bindMobileTap(btnToggle, () => {
    if (gameState) {
      gameState.toggleInventoryMode();
      _updateInventoryUI();
    }
  });
  btnToggle.addEventListener('mouseenter', () => {
    btnToggle.style.background = 'rgba(255,230,170,0.95)';
  });
  btnToggle.addEventListener('mouseleave', () => {
    btnToggle.style.background = 'rgba(255,213,141,0.85)';
  });
  container.appendChild(btnToggle);
  inventoryBtnToggle = btnToggle;

  // ── 切换按钮 → RB 键图标（按钮下方居中） ──
  if (gamepad.usingGamepad) {
    const _rbImg = getGamepadIcon('rb');
    if (_rbImg) {
      const _rbEl = document.createElement('img');
      _rbEl.src = _rbImg.src;
      _rbEl.style.cssText = `
        position: absolute; pointer-events: none;
        height: 20px; width: auto;
        left: 50%; transform: translateX(-50%);
        bottom: -24px;
      `;
      btnToggle.appendChild(_rbEl);
    }
  }
}

/** 计算并更新所有物品栏 DOM 元素的位置和内容 */
function _updateInventoryUI() {
  if (!gameState || !inventoryContainerEl || inventoryContainerEl.style.display === 'none') return;
  const scale = getScale();
  const uiW = parseFloat(uiLayer.style.width);
  const uiH = parseFloat(uiLayer.style.height);

  const selIdx = gameState.selectedItemIndex;

  // 更新标题和进度
  const titleEl = document.getElementById('inv-title');
  if (titleEl) {
    if (gameState.inventoryMode === 'character') {
      titleEl.textContent = '人物';
    } else {
      titleEl.textContent = '物品栏';
    }
  }
  const toggleBtnText = gameState.inventoryMode === 'character' ? '切换物品' : '切换人物';
  if (inventoryBtnToggle) {
    inventoryBtnToggle.textContent = toggleBtnText;
    const tw = 120 * scale;
    const th = 40 * scale;
    inventoryBtnToggle.style.width = tw + 'px';
    inventoryBtnToggle.style.height = th + 'px';
    inventoryBtnToggle.style.fontSize = (18 * scale * UI_SCALE) + 'px';
    inventoryBtnToggle.style.left = (uiW - tw - 20 * scale) + 'px';
    inventoryBtnToggle.style.top = (20 * scale) + 'px';
  }

  if (gameState.inventoryMode === 'character') {
    _updateInventoryUICharacter(scale, uiW, uiH, selIdx);
    return;
  }

  // ── 物品模式 ──
  const inv = gameState.inventory;
  const total = inv.length;

  // 更新进度
  const progressEl = document.getElementById('inv-progress');
  if (progressEl) {
    progressEl.textContent = `${selIdx + 1} / ${total}`;
  }

  // ── 轮播：计算整体布局 ──
  const cardW = scale * INV_CARD_W;
  const cardH = scale * INV_CARD_H;
  const gap = scale * INV_CARD_GAP;
  const visible = Math.min(INV_CARD_VISIBLE, total);
  const visibleW = visible * cardW + (visible - 1) * gap;
  const carouselLeft = (uiW - visibleW) / 2;
  const carouselTop = scale * INV_CAROUSEL_TOP;

  // 更新箭头位置
  if (inventoryArrowLeft) {
    inventoryArrowLeft.style.left = (carouselLeft - 40 * scale) + 'px';
    inventoryArrowLeft.style.top = (carouselTop + (cardH - 80 * scale) / 2) + 'px';
    inventoryArrowLeft.style.fontSize = (40 * scale) + 'px';
  }
  if (inventoryArrowRight) {
    inventoryArrowRight.style.left = (carouselLeft + visibleW + 40 * scale - 50 * scale) + 'px';
    inventoryArrowRight.style.top = (carouselTop + (cardH - 80 * scale) / 2) + 'px';
    inventoryArrowRight.style.fontSize = (40 * scale) + 'px';
  }

  // ── 构建卡片 ──
  inventoryCardsWrapper.style.left = '0px';
  inventoryCardsWrapper.style.top = '0px';
  inventoryCardsWrapper.style.width = uiW + 'px';
  inventoryCardsWrapper.style.height = (carouselTop + cardH) + 'px';
  // 移除旧卡片
  const oldCards = inventoryCardsWrapper.querySelectorAll('.inv-card');
  oldCards.forEach(el => el.remove());

  const itemsDef = scenarioData && scenarioData.items ? scenarioData.items : {};

  inv.forEach((invItem, idx) => {
    const itemDef = itemsDef[invItem.id];
    if (!itemDef) return;

    const isSelected = (idx === selIdx);
    const cardScale = isSelected ? 1.15 : 0.9;
    const cw = Math.round(cardW * cardScale);
    const ch = Math.round(cardH * cardScale);

    // 卡片居中定位：从可见窗口中心偏移
    const offsetFromCenter = idx - selIdx;
    const centerX = carouselLeft + visibleW / 2;
    const cx = centerX + offsetFromCenter * (cardW + gap);

    const card = document.createElement('div');
    card.className = 'inv-card';
    card.style.cssText = `
      position: absolute; z-index: ${isSelected ? 63 : 61};
      left: ${cx - cw/2}px; top: ${carouselTop + (cardH - ch) / 2}px;
      width: ${cw}px; height: ${ch}px;
      border: ${isSelected ? '3px' : '2px'} solid ${isSelected ? '#FFD700' : 'rgba(255,255,255,0.3)'};
      border-radius: 8px; overflow: hidden;
      background: rgba(0,0,0,0.4);
      transition: transform 0.3s, border 0.3s, width 0.3s, height 0.3s, left 0.3s, top 0.3s;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      pointer-events: auto; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    `;

    // 物品图片
    if (itemDef.image) {
      const img = getImage(itemDef.image);
      if (img) {
        const imgMaxW = cw - 20;
        const imgMaxH = ch - 20;
        const imgScale = Math.min(imgMaxW / img.naturalWidth, imgMaxH / img.naturalHeight, 1);
        const iw = Math.round(img.naturalWidth * imgScale);
        const ih = Math.round(img.naturalHeight * imgScale);
        const imgEl = document.createElement('img');
        imgEl.src = img.src;
        imgEl.style.cssText = `
          width: ${iw}px; height: ${ih}px; object-fit: contain;
          pointer-events: none; user-select: none; -webkit-user-drag: none;
        `;
        card.appendChild(imgEl);
      }
    }

    // 物品名称（选中时显示）
    if (isSelected || true) {
      const nameEl = document.createElement('div');
      nameEl.textContent = itemDef.name || invItem.id;
      nameEl.style.cssText = `
        color: ${isSelected ? '#FFD700' : '#aaa'};
        font-family: 'Microsoft YaHei','SimHei',sans-serif;
        font-size: ${isSelected ? (13 * scale) : (11 * scale)}px;
        font-weight: ${isSelected ? 'bold' : 'normal'};
        text-align: center; margin-top: 4px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        max-width: ${cw - 10}px;
        pointer-events: none;
      `;
      card.appendChild(nameEl);
    }

    // 点击选中该卡片 → 展示
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      if (gameState.selectedItemIndex === idx) {
        gameState.inventoryShowItem();
      } else {
        gameState.selectedItemIndex = idx;
        _updateInventoryUI();
      }
    });
    _bindMobileTap(card, () => {
      if (gameState.selectedItemIndex === idx) {
        gameState.inventoryShowItem();
      } else {
        gameState.selectedItemIndex = idx;
        _updateInventoryUI();
      }
    });
    _bindMobileTap(card, () => {
      if (gameState.selectedItemIndex === idx) {
        gameState.inventoryShowItem();
      } else {
        gameState.selectedItemIndex = idx;
        _updateInventoryUI();
      }
    });

    // hover 高亮
    card.addEventListener('mouseenter', () => {
      if (!isSelected) card.style.borderColor = 'rgba(255,215,0,0.6)';
    });
    card.addEventListener('mouseleave', () => {
      if (!isSelected) card.style.borderColor = 'rgba(255,255,255,0.3)';
    });

    inventoryCardsWrapper.appendChild(card);
  });

  // ── 信息框 ──
  const selItem = gameState.getSelectedItem();
  if (selItem && inventoryInfoName && inventoryInfoDesc) {
    inventoryInfoName.textContent = selItem.name || '';
    inventoryInfoDesc.textContent = selItem.description || '';
  }
  const infoEl = document.getElementById('inv-info');
  if (infoEl) {
    const infoW = scale * INV_INFO_W;
    const infoH = scale * INV_INFO_H;
    infoEl.style.left = (uiW - infoW) / 2 + 'px';
    infoEl.style.top = (scale * INV_INFO_TOP) + 'px';
    infoEl.style.width = infoW + 'px';
    infoEl.style.height = infoH + 'px';
    inventoryInfoName.style.fontSize = (22 * scale * UI_SCALE) + 'px';
    inventoryInfoDesc.style.fontSize = (16 * scale * UI_SCALE) + 'px';
  }

  // ── 按钮 ──
  const btnW = scale * INV_BTN_W * UI_SCALE;
  const btnH = scale * INV_BTN_H * UI_SCALE;
  const btnGap = scale * INV_BTN_GAP;
  const totalBtnW = btnW * 2 + btnGap;
  const btnX = (uiW - totalBtnW) / 2;
  const btnY = scale * INV_BTN_TOP;

  if (inventoryBtnShow) {
    inventoryBtnShow.style.left = btnX + 'px';
    inventoryBtnShow.style.top = btnY + 'px';
    inventoryBtnShow.style.width = btnW + 'px';
    inventoryBtnShow.style.height = btnH + 'px';
    inventoryBtnShow.style.fontSize = (24 * scale * UI_SCALE) + 'px';
  }
  if (inventoryBtnClose) {
    inventoryBtnClose.style.left = (btnX + btnW + btnGap) + 'px';
    inventoryBtnClose.style.top = btnY + 'px';
    inventoryBtnClose.style.width = btnW + 'px';
    inventoryBtnClose.style.height = btnH + 'px';
    inventoryBtnClose.style.fontSize = (24 * scale * UI_SCALE) + 'px';
  }
}

/** 人物模式渲染 */
function _updateInventoryUICharacter(scale, uiW, uiH, selIdx) {
  // 隐藏箭头和旧卡片
  if (inventoryArrowLeft) inventoryArrowLeft.style.display = 'none';
  if (inventoryArrowRight) inventoryArrowRight.style.display = 'none';
  const oldCards = inventoryCardsWrapper.querySelectorAll('.inv-card');
  oldCards.forEach(el => el.remove());
  inventoryCardsWrapper.style.width = uiW + 'px';
  inventoryCardsWrapper.style.height = uiH + 'px';

  const charList = gameState.getCharacterList();
  const total = charList.length;
  const progressEl = document.getElementById('inv-progress');
  if (progressEl) {
    progressEl.textContent = `${selIdx + 1} / ${total}`;
  }

  // 人物卡片：横排布局（同物品模式样式）
  const cardW = scale * INV_CARD_W;
  const cardH = scale * INV_CARD_H;
  const gap = scale * INV_CARD_GAP;
  const visible = Math.min(INV_CARD_VISIBLE, total);
  const visibleW = visible * cardW + (visible - 1) * gap;
  const carouselLeft = (uiW - visibleW) / 2;
  const carouselTop = scale * INV_CAROUSEL_TOP;

  charList.forEach((charId, idx) => {
    const charData = charactersData[charId];
    if (!charData) return;

    const isSelected = (idx === selIdx);
    const cardScale = isSelected ? 1.15 : 0.9;
    const cw = Math.round(cardW * cardScale);
    const ch = Math.round(cardH * cardScale);

    const centerX = carouselLeft + visibleW / 2;
    const cx = centerX + (idx - selIdx) * (cardW + gap);

    const card = document.createElement('div');
    card.className = 'inv-card';
    card.style.cssText = `
      position: absolute; z-index: ${isSelected ? 63 : 61};
      left: ${cx - cw/2}px; top: ${carouselTop + (cardH - ch) / 2}px;
      width: ${cw}px; height: ${ch}px;
      border: ${isSelected ? '3px' : '2px'} solid ${isSelected ? '#FFD700' : 'rgba(255,255,255,0.3)'};
      border-radius: 8px; overflow: hidden;
      background: rgba(0,0,0,0.4);
      transition: transform 0.3s, border 0.3s, width 0.3s, height 0.3s, left 0.3s, top 0.3s;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      pointer-events: auto; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    `;

    // 人物头像
    const charImg = getImage(charData.image);
    if (charImg) {
      const imgMaxW = cw - 20;
      const imgMaxH = ch - 30;
      const imgS = Math.min(imgMaxW / charImg.naturalWidth, imgMaxH / charImg.naturalHeight, 1);
      const iw = Math.round(charImg.naturalWidth * imgS);
      const ih = Math.round(charImg.naturalHeight * imgS);
      const imgEl = document.createElement('img');
      imgEl.src = charImg.src;
      imgEl.style.cssText = `
        width: ${iw}px; height: ${ih}px; object-fit: contain;
        pointer-events: none; user-select: none; -webkit-user-drag: none;
      `;
      card.appendChild(imgEl);
    }

    // 人物名称
    const nameEl = document.createElement('div');
    nameEl.textContent = charData.name || charId;
    nameEl.style.cssText = `
      color: ${isSelected ? '#FFD700' : '#aaa'};
      font-family: 'Microsoft YaHei','SimHei',sans-serif;
      font-size: ${isSelected ? (13 * scale) : (11 * scale)}px;
      font-weight: ${isSelected ? 'bold' : 'normal'};
      text-align: center; margin-top: 4px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: ${cw - 10}px;
      pointer-events: none;
    `;
    card.appendChild(nameEl);

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      if (gameState.selectedItemIndex === idx) {
        gameState.inventoryShowItem();
      } else {
        gameState.selectedItemIndex = idx;
        _updateInventoryUI();
      }
    });

    card.addEventListener('mouseenter', () => {
      if (!isSelected) card.style.borderColor = 'rgba(255,215,0,0.6)';
    });
    card.addEventListener('mouseleave', () => {
      if (!isSelected) card.style.borderColor = 'rgba(255,255,255,0.3)';
    });

    inventoryCardsWrapper.appendChild(card);
  });

  // ── 信息框：显示人物描述 ──
  const selChar = gameState.getSelectedCharacter();
  if (selChar && inventoryInfoName && inventoryInfoDesc) {
    inventoryInfoName.textContent = selChar.name || '';
    inventoryInfoDesc.textContent = selChar.description || '（暂无描述）';
  }
  const infoEl = document.getElementById('inv-info');
  if (infoEl) {
    const infoW = scale * INV_INFO_W;
    const infoH = scale * INV_INFO_H;
    infoEl.style.left = (uiW - infoW) / 2 + 'px';
    infoEl.style.top = (scale * INV_INFO_TOP) + 'px';
    infoEl.style.width = infoW + 'px';
    infoEl.style.height = infoH + 'px';
    inventoryInfoName.style.fontSize = (22 * scale * UI_SCALE) + 'px';
    inventoryInfoDesc.style.fontSize = (16 * scale * UI_SCALE) + 'px';
  }

  // ── 按钮 ──
  const btnW = scale * INV_BTN_W * UI_SCALE;
  const btnH = scale * INV_BTN_H * UI_SCALE;
  const btnGap = scale * INV_BTN_GAP;
  const totalBtnW = btnW * 2 + btnGap;
  const btnX = (uiW - totalBtnW) / 2;
  const btnY = scale * INV_BTN_TOP;

  if (inventoryBtnShow) {
    inventoryBtnShow.style.left = btnX + 'px';
    inventoryBtnShow.style.top = btnY + 'px';
    inventoryBtnShow.style.width = btnW + 'px';
    inventoryBtnShow.style.height = btnH + 'px';
    inventoryBtnShow.style.fontSize = (24 * scale * UI_SCALE) + 'px';
  }
  if (inventoryBtnClose) {
    inventoryBtnClose.style.left = (btnX + btnW + btnGap) + 'px';
    inventoryBtnClose.style.top = btnY + 'px';
    inventoryBtnClose.style.width = btnW + 'px';
    inventoryBtnClose.style.height = btnH + 'px';
    inventoryBtnClose.style.fontSize = (24 * scale * UI_SCALE) + 'px';
  }
}

function drawInventory() {
  if (!gameState || gameState._subMenu !== 'inventory') {
    _hideInventory();
    return;
  }
  _createInventoryUI();
  inventoryContainerEl.style.display = 'block';
  _updateInventoryUI();
}

function _hideInventory() {
  console.log(`[DEBUG-HIDE-INV] called. _subMenu=${gameState?._subMenu} mode=${gameState?.mode} menuNodeId=${gameState?.menuNodeId} talkingAbout=${gameState?.talkingAboutItem}/${gameState?.talkingAboutCharacter}`);
  if (inventoryContainerEl) {
    inventoryContainerEl.style.display = 'none';
  }
  if (gameState && gameState._subMenu === 'inventory') {
    // 如果是在举证模式中关闭物品栏，返回质问模式
    if (gameState.confrontationProofActive) {
      gameState.confrontationProofActive = false;
      gameState.confrontationProofTarget = null;
      gameState.inventoryAction = 'show';
      gameState.mode = 'confrontation';
      gameState.confrontationShowButtons = true;
      gameState._subMenu = null;
      _menuNeedsRedraw = true;
      return;
    }
    gameState._subMenu = null;
    // 移动端：关闭物品栏后清除高亮焦点，防止残留
    if (_IS_MOBILE) gameState.sceneFocusIndex = -1;
    // 重新过滤菜单选项（展示物品/人物后 flag 可能变化，需要刷新可见选项）
    const node = scenarioData && scenarioData.nodes && scenarioData.nodes[gameState.menuNodeId];
    console.log(`[DEBUG-HIDE-INV] node found=${!!node} mode=${gameState.mode} isSubMenu=${gameState.isSubMenu}`);
    console.log(`[DEBUG-HIDE-INV] flags: wt_asked=${gameState.flags?.scene_prologue_03_wt_asked} isSubMenu=${gameState.isSubMenu}`);
    if (node && gameState.mode === 'menu') {
      let options = (node.options || []).slice();
      if (gameState.isSubMenu && !gameState.menuNodeId.startsWith('__leave__')) {
        const backIdx = options.findIndex(o => o.is_back);
        const showItemCond = node.show_item_condition || 'True';
        if (gameState.evalCondition(showItemCond)) {
          const showItemOpt = { text: '【展示物品】', target: 'show_inventory', is_show_item: true };
          if (backIdx >= 0) options.splice(backIdx, 0, showItemOpt);
          else options.push(showItemOpt);
        }
      }

      // 彩绘牌戏按钮（与 showMenu 一致：关闭物品栏后需要重新追加）
      const cardGameCfg = node?.card_game;
      if (cardGameCfg && typeof cardGameCfg === 'object') {
        const cgCondition = cardGameCfg.condition || 'True';
        if (gameState.evalCondition(cgCondition)) {
          const cgId = cardGameCfg.id || '';
          if (!options.some(o => o.is_card_game)) {
            const cardGameOpt = { text: '【彩绘牌戏】', target: cgId, is_card_game: true };
            const backIdx = options.findIndex(o => o.is_back);
            if (backIdx >= 0) {
              options.splice(backIdx, 0, cardGameOpt);
            } else {
              options.push(cardGameOpt);
            }
          }
        }
      }

      // 案情审理选项（与 showMenu 一致：关闭物品栏后需要重新追加）
      const chData = gameState._getChapterData();
      const ctCfg = chData?.case_trials?.[gameState.menuNodeId];
      if (ctCfg) {
        const unlockCond = ctCfg.unlock_condition || 'False';
        if (gameState.evalCondition(unlockCond)) {
          if (!options.some(o => o.is_case_trial)) {
            const ctOpt = { text: '【案情审理】', target: '__case_trial__', is_case_trial: true };
            const backIdx = options.findIndex(o => o.is_back);
            if (backIdx >= 0) {
              options.splice(backIdx, 0, ctOpt);
            } else {
              options.push(ctOpt);
            }
          }
        }
      }

      const oldTargets = gameState.menuSnapshots[gameState.menuNodeId];
      const beforeCount = options.length;
      gameState.menuOptions = gameState.filterOptions(options);
      const afterCount = gameState.menuOptions.length;
      // 计算新增选项，设置滑入动画标记
      const newTargets = new Set(gameState.menuOptions.map(o => o.target).filter(t => t));
      let addedCount = 0;
      if (oldTargets) {
        const added = new Set([...newTargets].filter(t => !oldTargets.has(t)));
        addedCount = added.size;
        if (added.size > 0) gameState._slideTargets = added;
      }
      gameState.menuSnapshots[gameState.menuNodeId] = newTargets;
      console.log(`[DEBUG-HIDE-INV] filtered: ${beforeCount}→${afterCount} options, newTargets=${[...newTargets].join(',')} added=${addedCount} snapshotted. menuNodeId=${gameState.menuNodeId}`);
      console.log(`[DEBUG-HIDE-INV] options text:`, gameState.menuOptions.map(o => o.text));
    }
    _menuNeedsRedraw = true;
  }
}

// ==================== 旧占位（已在专用文件中实现） ====================
// drawInvestigation 见 investigation.js

// ==================== 保存提示按钮（案情审理流程） ====================

/** 绘制保存提示按钮（与 Python draw_save_prompt 一致）
 *  两个按钮垂直排列：保存游戏 / 跳过保存
 *  按钮从右侧滑入（_savePromptBtnOffset < 0 时在屏幕外）
 */
function drawSavePrompt() {
  if (!gameState || gameState.mode !== 'save_prompt') return;
  // 转场黑屏时完全不绘制，等淡入完成后再显示
  if (gameState.fadePhase) return;
  // 存档/读档界面打开时，不绘制 save_prompt 按钮
  if (gameState.uiMode === 'save' || gameState.uiMode === 'load') return;

  const btnW = 720;   // MENU_WIDTH
  const btnH = 72;    // MENU_ITEM_HEIGHT
  const baseX = (DESIGN_W - btnW) / 2;
  const totalH = 2 * btnH;
  const baseY = (DESIGN_H - totalH) / 2;

  const offset = gameState.savePromptBtnOffset;
  const currentX = baseX + offset;

  // 存储按钮矩形供点击检测
  gameState.savePromptBtnSave = { x: currentX, y: baseY, w: btnW, h: btnH };
  gameState.savePromptBtnSkip = { x: currentX, y: baseY + btnH, w: btnW, h: btnH };

  // 按钮淡入效果：offset 从 -1500 到 0，超过 -720 开始渐变
  // 当 offset <= -720 时完全透明，offset = 0 时完全不透明
  const fadeInStart = -720;
  const fadeInEnd = 0;
  let btnAlpha = 0;
  if (offset >= fadeInStart) {
    btnAlpha = Math.min(1, (offset - fadeInStart) / (fadeInEnd - fadeInStart));
  }
  ctx.save();
  ctx.globalAlpha = btnAlpha;

  // 获取焦点状态
  const isSaveHover = (gameState.savePromptButtonFocus === 0);
  const isSkipHover = (gameState.savePromptButtonFocus === 1);

  // 保存游戏按钮（举证 UI 风格，与 Python get_proof_button_background 一致：UI_button_06.png）
  const saveBtnFile = isSaveHover ? 'UI_button_01_high.png' : 'UI_button_06.png';
  const saveBtnImg = getImage(saveBtnFile);
  if (saveBtnImg && saveBtnImg.complete) {
    ctx.drawImage(saveBtnImg, currentX, baseY, btnW, btnH);
  } else {
    // 备用纯色背景
    ctx.fillStyle = isSaveHover ? 'rgba(255,200,100,0.7)' : 'rgba(200,200,200,0.5)';
    ctx.fillRect(currentX, baseY, btnW, btnH);
  }
  ctx.fillStyle = '#000';
  ctx.font = `bold 42px "Microsoft YaHei","SimHei",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('保存游戏', currentX + btnW / 2, baseY + btnH / 2);

  // 跳过保存按钮（返回 UI 风格，与 Python get_back_button_background 一致：UI_button_03.png）
  const skipBtnFile = isSkipHover ? 'UI_button_01_high.png' : 'UI_button_03.png';
  const skipBtnImg = getImage(skipBtnFile);
  if (skipBtnImg && skipBtnImg.complete) {
    ctx.drawImage(skipBtnImg, currentX, baseY + btnH, btnW, btnH);
  } else {
    ctx.fillStyle = isSkipHover ? 'rgba(255,200,100,0.7)' : 'rgba(150,150,150,0.5)';
    ctx.fillRect(currentX, baseY + btnH, btnW, btnH);
  }
  ctx.font = `bold 42px "Microsoft YaHei","SimHei",sans-serif`;
  ctx.fillText('跳过保存', currentX + btnW / 2, baseY + btnH + btnH / 2);

  // 手柄模式：焦点按钮 A 键图标（与 Python 一致）
  if (gamepad.usingGamepad) {
    if (gameState.savePromptButtonFocus === 0 && gameState.savePromptBtnSave) {
      drawGamepadIcon(ctx, 'a', gameState.savePromptBtnSave, 4, -40);
    } else if (gameState.savePromptButtonFocus === 1 && gameState.savePromptBtnSkip) {
      drawGamepadIcon(ctx, 'a', gameState.savePromptBtnSkip, 4, -40);
    }
  }

  ctx.restore();  // 恢复 globalAlpha
}

/** 隐藏所有游戏 UI DOM 元素（game over / 回标题时使用） */
function hideAllGameUI() {
  // 隐藏固定 DOM 元素
  const els = [
    dialogBoxEl, nameBoxEl, hintArrowEl, confrontCounterEl, skipBtnEl,
    menuContainerEl, leaveContainerEl, inventoryContainerEl
  ];
  for (const el of els) {
    if (el) el.style.display = 'none';
  }
  // 移除动态创建的菜单按钮（物品栏/调查/离开 + 菜单按钮）
  if (menuBottomBtns) {
    menuBottomBtns.forEach(el => el.remove());
    menuBottomBtns = [];
  }
  if (menuGameBtnEl) { menuGameBtnEl.remove(); menuGameBtnEl = null; }
  menuOptionsCache = null;
  menuOptionEls.forEach(el => el.remove());
  menuOptionEls = [];
  // 清理离开菜单动态元素
  if (leaveOptionEls) {
    leaveOptionEls.forEach(el => el.remove());
    leaveOptionEls = [];
  }
  if (leaveBackEl) { leaveBackEl.remove(); leaveBackEl = null; }
  leaveMenuCache = null;
}

// ── DOM 手柄图标覆盖层（仅 gamepad.usingGamepad 时显示） ──

/** 保存对话 A 键图标元素（替代绿色三角提示箭头） */
let _gpDialogIconEl = null;

/** 每帧更新 DOM 手柄图标（由 renderUI 或游戏循环调用） */
function updateGamepadDomIcons() {
  // ---- 对话提示箭头：手柄模式显示 A 键图标，键鼠模式显示绿色三角 ----
  if (dialogBoxEl && hintArrowEl) {
    if (gamepad.usingGamepad && _hintVisible && gameState && gameState.mode === 'dialogue') {
      hintArrowEl.style.display = 'none';
      if (!_gpDialogIconEl) {
        _gpDialogIconEl = document.createElement('img');
        _gpDialogIconEl.style.cssText = 'position:absolute; left:50%; bottom:-28px; transform:translateX(-50%); width:70px; height:70px; pointer-events:none;';
        dialogBoxEl.appendChild(_gpDialogIconEl);
      }
      const aImg = getGamepadIcon('a');
      if (aImg && aImg.complete) {
        _gpDialogIconEl.src = aImg.src;
        _gpDialogIconEl.style.display = 'block';
      }
    } else {
      if (_gpDialogIconEl) _gpDialogIconEl.style.display = 'none';
      // 非手柄模式：恢复绿色三角显示控制（由 showHintArrow 管理显隐）
      if (!gamepad.usingGamepad) {
        hintArrowEl.style.display = _hintVisible ? 'block' : 'none';
      }
    }
  } else if (_gpDialogIconEl) {
    _gpDialogIconEl.style.display = 'none';
  }
}
