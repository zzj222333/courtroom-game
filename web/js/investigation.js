// ==================== 调查模式 ====================

// 光标常量（与 Python 一致：两个图标源文件内容密度不同，需不同绘制尺寸）
const INV_CURSOR_SIZE = 80;         // 眼睛图标（UI_Eye_01）
const INV_CURSOR_HOVER_SIZE = 120;  // 放大镜图标（与 Python INVESTIGATE_CURSOR_HOVER_SIZE 一致）
const INV_MARK_SIZE = 80;
const INV_CLOSE_RANGE = 88; // 靠近调查点的距离阈值

/** 启动场景调查 */
function startSceneInvestigation() {
  // 由 gamestate.js GameState.startInvestigation() 调用
  // 设置为调查模式
  gameState.mode = 'investigation';
  gameState.investigationActive = true;
  gameState.investigationCursorX = DESIGN_W / 2;
  gameState.investigationCursorY = DESIGN_H / 2;

  // 隐藏系统鼠标（Canvas 上绘制自定义光标）
  canvas.style.cursor = 'none';

  // 触摸交互状态
  gameState._invTouchHandledClick = false;
  gameState._invDialogueActive = false;
  gameState._invJustTriggered = false;
  gameState._invLastTriggeredX = gameState.investigationCursorX;
  gameState._invLastTriggeredY = gameState.investigationCursorY;

  // 移动端保护期：进入调查后 200ms 内忽略触摸，防止"调查-离开"循环
  if (_IS_MOBILE) {
    activateMobileGuard();
  }

  // 隐藏对话框
  hideDialogBox();
  hideMenus();

  console.log(`[Investigation] 开始调查，${gameState.investigationPoints.length} 个调查点`);
}

/** 检查光标是否悬停在调查点上 */
function investigationCheck(state) {
  const cx = state.investigationCursorX;
  const cy = state.investigationCursorY;
  for (const pt of state.investigationPoints) {
    if (Math.abs(cx - pt.x) <= INV_CLOSE_RANGE && Math.abs(cy - pt.y) <= INV_CLOSE_RANGE) {
      return pt;
    }
  }
  return null;
}

/** 触发调查点 */
function investigationTrigger(point) {
  if (!gameState) return;

  try { playSound('sfx_investigate_find'); } catch (_) {}

  // 保存当前光标位置（对话叠加期放大镜固定在原地，不吸附到调查点）
  gameState._invLastTriggeredX = gameState.investigationCursorX;
  gameState._invLastTriggeredY = gameState.investigationCursorY;

  const repeatable = point.repeatable || false;
  const flagKey = `investigated_${gameState.currentNodeId}_${point.id}`;
  const already = gameState.flags[flagKey] || false;

  let dialogues;
  if (already && point.dialogues_after) {
    dialogues = point.dialogues_after;
  } else {
    dialogues = point.dialogues;
  }

  // 保存 flag 以便对话结束后标记
  gameState._invPendingFlag = null;
  if (!repeatable && !already) {
    gameState._invPendingFlag = flagKey;
  }

  // 设置"已发现"标记（用于问号图标持久显示）
  if (!already) {
    gameState.flags[`discovered_${gameState.currentNodeId}_${point.id}`] = true;
  }

  // 保存调查前的光标位置（用于对话后恢复）
  gameState._invResumeCursorX = gameState.investigationCursorX;
  gameState._invResumeCursorY = gameState.investigationCursorY;

  // 检查 puzzle（与 Python 一致：有 answer 字段即数字密码锁，type 默认 'number'）
  const rawPuzzle = point.puzzle ? point.puzzle : (point.puzzle_marker ? point : null);
  if (rawPuzzle) {
    const ptype = rawPuzzle.type || (rawPuzzle.answer !== undefined ? 'number' : null);
    if (ptype === 'number') {
      gameState._invPendingPuzzle = { ...rawPuzzle, _pointId: point.id, type: 'number' };
    } else {
      gameState._invPendingPuzzle = null;
    }
  } else {
    gameState._invPendingPuzzle = null;
  }

  // 检查 trigger_event
  if (point.trigger_event) {
    gameState._invPendingEvent = { ...point.trigger_event };
  } else {
    gameState._invPendingEvent = null;
  }

  // 设置对话队列
  gameState.dialogueQueue = dialogues;
  gameState.dialogueIndex = 0;

  // 保持 investigation 模式 + 叠加对话层（标记/放大镜不消失）
  gameState._invDialogueActive = true;
  gameState._invJustTriggered = true;

  gameState.startDialogueForInvestigation();
}

/** 退出调查模式 */
function exitInvestigation() {
  if (!gameState) return;

  try { playSound('sfx_ui_confirm'); } catch (_) {}

  // 检查是否所有点都已调查
  const allDoneKey = `${gameState.currentNodeId}_all_done`;
  if (!gameState.flags[allDoneKey]) {
    const [investigated, total] = getInvestigationProgress();
    if (total > 0 && investigated >= total) {
      gameState.flags[allDoneKey] = true;
    }
  }

  gameState._invDialogueActive = false;
  gameState._invJustTriggered = false;
  gameState.investigationActive = false;
  gameState.investigationPoints = [];
  gameState._invTouchHandledClick = false;
  canvas.style.cursor = 'default';

  // 重新进入当前节点（触发 auto_dialogues 检查）
  gameState.enterNode(gameState.currentNodeId);
}

/** 获取调查进度 */
function getInvestigationProgress() {
  const pts = gameState.investigationPoints;
  let total = pts.length;
  let investigated = 0;
  for (const pt of pts) {
    if (pt.puzzle || pt.puzzle_marker) {
      const flagKey = `puzzle_solved_${pt.id}`;
      if (gameState.flags[flagKey]) investigated++;
    } else {
      const flagKey = `investigated_${gameState.currentNodeId}_${pt.id}`;
      if (gameState.flags[flagKey]) investigated++;
    }
  }
  return [investigated, total];
}

// ==================== 调查绘制 ====================

// 缓存已调查标记图片的缩放
let _invCheckImg = null;
let _invQuestionImg = null;
let _invCursorNormal = null;
let _invCursorHover = null;

function getInvImage(filename, size) {
  const img = getImage(filename);
  if (!img || !img.complete) return null;
  // 与 Python 一致：强制正方形缩放（pygame smoothscale 到 size×size）
  return { img, w: size, h: size };
}

/** 绘制调查 UI */
function drawInvestigation() {
  // _invDialogueActive 时允许在 dialogue 模式下绘制调查层（标记+放大镜+退出按钮不消失）
  if (!gameState || (gameState.mode !== 'investigation' && !gameState._invDialogueActive)) return;
  // 物品反馈激活时不绘制，避免勾图标遮挡物品图片和消息框
  if (gameState.itemFeedbackActive) return;

  // 1. 绘制已调查标记（勾/问号）
  drawInvestigationMarks();

  // 2. 绘制光标（普通圆/放大镜）
  drawInvestigationCursor();

  // 3. 绘制退出按钮
  drawExitButton();

  // 4. 绘制调查进度
  drawInvestigationProgress();

  // 5. 调试：显示光标坐标
  if (gameState.debug) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(10, 10, 220, 30);
    ctx.fillStyle = '#ff0';
    ctx.font = `${16 * UI_SCALE}px sans-serif`;
    ctx.fillText(`X: ${Math.round(gameState.investigationCursorX)}, Y: ${Math.round(gameState.investigationCursorY)}`, 18, 32);
  }
}

function drawInvestigationMarks() {
  for (const pt of gameState.investigationPoints) {
    let useImg = null;

    const isPuzzle = pt.puzzle || pt.puzzle_marker;
    if (isPuzzle) {
      const solvedKey = `puzzle_solved_${pt.id}`;
      if (gameState.flags[solvedKey]) {
        useImg = 'UI_Gou_01.png';
      } else {
        const discoveredKey = `discovered_${gameState.currentNodeId}_${pt.id}`;
        if (gameState.flags[discoveredKey]) {
          useImg = 'UI_Gou_02.png';
        }
      }
    } else {
      const flagKey = `investigated_${gameState.currentNodeId}_${pt.id}`;
      if (gameState.flags[flagKey]) {
        useImg = 'UI_Gou_01.png';
      }
    }

    if (useImg) {
      const info = getInvImage(useImg, INV_MARK_SIZE);
      if (info) {
        ctx.drawImage(info.img,
          pt.x - info.w / 2, pt.y - info.h / 2,
          info.w, info.h);
      }
    }
  }
}

function drawInvestigationCursor() {
  const dlgActive = gameState._invDialogueActive;

  // ── 调查对话叠加中：放大镜固定在原地，触摸模式保持 1.5x ──
  if (dlgActive) {
    const size = mouse._isTouch ? Math.round(INV_CURSOR_HOVER_SIZE * 1.5) : INV_CURSOR_HOVER_SIZE;
    const cx = gameState._invLastTriggeredX ?? gameState.investigationCursorX;
    const cy = gameState._invLastTriggeredY ?? gameState.investigationCursorY;
    const info = getInvImage('UI_Eye_02.png', size);
    if (info) {
      ctx.drawImage(info.img,
        cx - info.w / 2, cy - info.h / 2,
        info.w, info.h);
    }
    return;
  }

  // ── 悬停调查点时切换图标，触摸模式放大镜 1.5x ──
  const point = investigationCheck(gameState);
  let size, filename;
  if (point) {
    // 触摸屏：1.5 倍大；鼠标/手柄：正常 hover 尺寸
    size = mouse._isTouch ? Math.round(INV_CURSOR_HOVER_SIZE * 1.5) : INV_CURSOR_HOVER_SIZE;
    filename = 'UI_Eye_02.png';
  } else {
    size = INV_CURSOR_SIZE;
    filename = 'UI_Eye_01.png';
  }

  const info = getInvImage(filename, size);
  if (info) {
    ctx.drawImage(info.img,
      gameState.investigationCursorX - info.w / 2,
      gameState.investigationCursorY - info.h / 2,
      info.w, info.h);
  }

  // 手柄模式：悬停调查点时显示 A 键图标（与 Python 一致）
  if (!gamepad.focusByMouse && point) {
    const aImg = getGamepadIcon('a');
    if (aImg && aImg.complete) {
      const gap = 6;
      const aX = gameState.investigationCursorX + size / 2 + gap - 50;
      const aY = gameState.investigationCursorY + size / 2 + gap - 100;
      ctx.drawImage(aImg, aX, aY, GAMEPAD_ICON_SIZE, GAMEPAD_ICON_SIZE);
    }
  }
}

// ---- 退出按钮常量 ----
const EXIT_BTN_W = 720;
const EXIT_BTN_H = 72;
const INV_CHAR_MARGIN_BOTTOM = 15;
let _investExitHighlight = false;  // 移动端退出按钮高亮状态

function drawExitButton() {
  const btnW = EXIT_BTN_W * UI_SCALE;
  const btnH = EXIT_BTN_H * UI_SCALE;
  const btnX = (DESIGN_W - btnW) / 2;
  const btnY = DESIGN_H - INV_CHAR_MARGIN_BOTTOM - btnH; // 与 Python 原型一致

  // 检测 hover（移动端跳过，由独立触摸高亮机制控制）
  let hover = false;
  if (!_IS_MOBILE) {
    if (gamepad.focusByMouse) {
      hover = (mouse.canvasX >= btnX && mouse.canvasX <= btnX + btnW &&
               mouse.canvasY >= btnY && mouse.canvasY <= btnY + btnH);
    } else {
      const cx = gameState.investigationCursorX;
      const cy = gameState.investigationCursorY;
      hover = (cx >= btnX && cx <= btnX + btnW && cy >= btnY && cy <= btnY + btnH);
    }
  }

  // 绘制按钮背景
  const bgFile = hover ? 'UI_button_01_high.png' : 'UI_button_03.png';
  const bgImg = getImage(bgFile);
  if (bgImg && bgImg.complete) {
    ctx.drawImage(bgImg, btnX, btnY, btnW, btnH);
  } else {
    ctx.fillStyle = hover ? 'rgba(255,213,141,0.94)' : 'rgba(255,255,255,0.86)';
    ctx.fillRect(btnX, btnY, btnW, btnH);
  }

  // 绘制文字
  ctx.fillStyle = '#000';
  ctx.font = `bold ${42 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('结束调查', btnX + btnW / 2, btnY + btnH / 2);

  // 手柄模式：退出按钮 B 键图标（与"返回"按钮一致，按钮内右侧 10px）
  if (gamepad.usingGamepad) {
    const _bImg = getGamepadIcon('b');
    if (_bImg && _bImg.complete) {
      const _iconSize = GAMEPAD_ICON_SIZE;
      const _cx = btnX + btnW - 10 - _iconSize / 2;
      const _cy = btnY + btnH / 2;
      ctx.drawImage(_bImg, _cx - _iconSize / 2, _cy - _iconSize / 2, _iconSize, _iconSize);
    }
  }

  // 移动端高亮
  if (_investExitHighlight) {
    const hImg = getImage('UI_button_01_high.png');
    if (hImg) {
      ctx.drawImage(hImg, btnX, btnY, btnW, btnH);
      ctx.fillStyle = '#000';
      ctx.font = `bold ${42 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('结束调查', btnX + btnW / 2, btnY + btnH / 2);
      ctx.textAlign = 'left';
    }
  }

  // 控制鼠标可见性
  if (hover) {
    canvas.style.cursor = 'pointer';
  } else if (gamepad.focusByMouse) {
    canvas.style.cursor = 'none';
  } else {
    canvas.style.cursor = 'none';
  }

  // 存储退出按钮 rect 供点击检测
  gameState._exitBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };
}

// ---- 进度显示 ----
const PROGRESS_BG_FILE = 'UI_button_16.png';
let _progressBgImg = null;
let _progressCache = '';

function drawInvestigationProgress() {
  const [investigated, total] = getInvestigationProgress();
  if (total <= 0) return;

  // 底图
  const bgImg = getImage(PROGRESS_BG_FILE);
  if (bgImg && bgImg.complete) {
    const bgW = 195;
    const bgH = bgW * (bgImg.naturalHeight / bgImg.naturalWidth);
    const bgX = 1813 - bgW / 2;
    const bgY = 1045 - bgH / 2;
    ctx.drawImage(bgImg, bgX, bgY, bgW, bgH);
  }

  // 文字
  const text = `${investigated} / ${total}`;
  ctx.fillStyle = '#fff';
  ctx.font = '36px "Microsoft YaHei","SimHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 1813, 1045);
}
