// ==================== 统一输入管理 ====================
// 键盘 + 鼠标 + 手柄 → 统一抽象层

/** 当前帧的按键状态 */
const keys = {};
const keysJustPressed = {};

/** 鼠标状态 */
const mouse = {
  x: 0, y: 0,           // 屏幕坐标
  canvasX: 0, canvasY: 0, // 设计分辨率坐标
  buttons: 0,
  wheelY: 0,
};

/** 手柄状态 */
const gamepad = {
  available: false,
  /** 从手柄输入模式（十字键/摇杆），无鼠标时为 true */
  usingGamepad: false,
  /** 仅鼠标移动重置，不受键盘事件影响 */
  focusByMouse: true,
  index: -1,
  axes: new Array(6).fill(0),
  buttons: new Array(16).fill(false),
  buttonsJustPressed: new Array(16).fill(false),
  _prevButtons: new Array(16).fill(false),
  // 十字键重复
  _hat: [0, 0],
  _hatRepeatTimer: 0,
  /** 标志：当前正在分发由手柄生成的合成键盘事件（避免被当成真实键盘） */
  _syntheticKey: false,
};

// ── 手柄映射（与 Pygame gamepad.py 一致） ──
// Chrome 标准映射: back=8 start=9；Pygame: back=6 start=7 → 两套索引均支持
const GAMEPAD_BUTTON = {
  a: 0, b: 1, x: 2, y: 3,
  lb: 4, rb: 5, back: 6, start: 7,
  backStd: 8, startStd: 9,
};

// ── 密钥映射 ──
const KEY = {
  RETURN: 'Enter', ESCAPE: 'Escape', SPACE: ' ',
  TAB: 'Tab', BACKSPACE: 'Backspace',
  LEFT: 'ArrowLeft', RIGHT: 'ArrowRight',
  UP: 'ArrowUp', DOWN: 'ArrowDown',
  A: 'a', D: 'd', W: 'w', S: 's',
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F6: 'F6',
  SHIFT: 'Shift',
};

// 手柄按钮 → 键盘按键映射（与 Python BUTTON_TO_KEY 完全一致）
const BUTTON_TO_KEY = {
  [GAMEPAD_BUTTON.a]: KEY.RETURN,    // 0 A → Enter（确认）
  [GAMEPAD_BUTTON.b]: KEY.ESCAPE,    // 1 B → Escape（取消）
  [GAMEPAD_BUTTON.x]: KEY.F3,        // 2 X → F3（调查）
  [GAMEPAD_BUTTON.y]: KEY.F1,        // 3 Y → F1（展示/举证/想法）
  [GAMEPAD_BUTTON.lb]: KEY.F4,       // 4 LB → F4（上一页）
  [GAMEPAD_BUTTON.rb]: KEY.SHIFT,    // 5 RB → Shift（切换物品/人物；谜题确认）
  [GAMEPAD_BUTTON.back]: KEY.F2,     // 6 BACK → F2（打开物品栏）
  [GAMEPAD_BUTTON.start]: KEY.F6,    // 7 START → F6（打开选项菜单）
  8: KEY.F2,                          // 8 BACK（Chrome 标准映射）
  9: KEY.F6,                          // 9 START（Chrome 标准映射）
};

// 十字键 → 方向键映射（与 Python HAT_TO_KEY 完全一致）
const HAT_TO_KEY = {
  '0,1': KEY.UP,
  '0,-1': KEY.DOWN,
  '-1,0': KEY.LEFT,
  '1,0': KEY.RIGHT,
};

// ── 事件监听（由 main.js 在 DOM 就绪后调用） ──

function setupInputListeners(canvasEl) {
  window.addEventListener('keydown', e => {
    const k = e.key;
    if (!keys[k]) keysJustPressed[k] = true;
    keys[k] = true;
    // 真实键盘 → 切回键鼠模式；手柄生成的合成事件不切换
    if (!gamepad._syntheticKey) {
      gamepad.usingGamepad = false;
    }
    // F1 拦截给调试面板（仅真实键盘）；F12 留给浏览器开发者工具；其他功能键不拦截
    if (k === 'F1') {
      if (!gamepad._syntheticKey) {
        e.preventDefault();
        toggleDebug();
      }
      return;
    } else if (k !== 'F12' && !k.startsWith('F')) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.key] = false;
  });

  canvasEl.addEventListener('mousemove', e => {
    const pos = screenToCanvas(e.clientX, e.clientY);
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.canvasX = pos.x;
    mouse.canvasY = pos.y;
    mouse._isTouch = false;
    // 鼠标移动 → 鼠标模式
    if (Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 0) {
      gamepad.focusByMouse = true;
      gamepad.usingGamepad = false;
    }
  });

  canvasEl.addEventListener('mousedown', e => {
    mouse.buttons |= (1 << e.button);
    const pos = screenToCanvas(e.clientX, e.clientY);
    mouse.canvasX = pos.x;
    mouse.canvasY = pos.y;
  });

  canvasEl.addEventListener('mouseup', e => {
    mouse.buttons &= ~(1 << e.button);
  });

  canvasEl.addEventListener('wheel', e => {
    mouse.wheelY = Math.sign(e.deltaY);
  });

  // ── 触摸事件 → 映射到鼠标状态（兼容触摸屏设备） ──
  canvasEl.addEventListener('touchstart', e => {
    if (e.touches.length === 0) return;
    e.preventDefault();
    const t = e.touches[0];
    const pos = screenToCanvas(t.clientX, t.clientY);
    mouse.x = t.clientX;
    mouse.y = t.clientY;
    mouse.canvasX = pos.x;
    mouse.canvasY = pos.y;
    mouse.buttons |= 1;          // 模拟左键按下
    mouse._isTouch = true;
  }, { passive: false });

  canvasEl.addEventListener('touchmove', e => {
    if (e.touches.length === 0) return;
    e.preventDefault();
    const t = e.touches[0];
    const pos = screenToCanvas(t.clientX, t.clientY);
    mouse.x = t.clientX;
    mouse.y = t.clientY;
    mouse.canvasX = pos.x;
    mouse.canvasY = pos.y;
  }, { passive: false });

  canvasEl.addEventListener('touchend', e => {
    e.preventDefault();
    mouse.buttons &= ~1;         // 模拟左键松开
    if (typeof gameState !== 'undefined' && gameState) gameState._settingsDragging = null;
    // 手动触发 click（touchstart 的 preventDefault 会阻止浏览器自动合成 click）
    console.log(`[INPUT-TOUCHEND] 派发synthetic click canvasX=${mouse.canvasX.toFixed(0)} canvasY=${mouse.canvasY.toFixed(0)} testMode=${typeof gameState !== 'undefined' && gameState ? gameState.testMode : '?'}`);
    if (typeof dbgPush === 'function') dbgPush(`INPUT-SYN-CLICK x=${mouse.canvasX.toFixed(0)} y=${mouse.canvasY.toFixed(0)} tm=${typeof gameState !== 'undefined' && gameState ? gameState.testMode : '?'}`);
    const click = new MouseEvent('click', { clientX: mouse.x, clientY: mouse.y, button: 0, bubbles: true });
    canvasEl.dispatchEvent(click);
  }, { passive: false });

  canvasEl.addEventListener('touchcancel', e => {
    mouse.buttons &= ~1;
    if (typeof gameState !== 'undefined' && gameState) gameState._settingsDragging = null;
  });
}

// ── 手柄事件 ──

window.addEventListener('gamepadconnected', e => {
  gamepad.available = true;
  gamepad.index = e.gamepad.index;
  console.log('[Gamepad] 连接:', e.gamepad.id);
});

window.addEventListener('gamepaddisconnected', e => {
  gamepad.available = false;
  gamepad.index = -1;
  console.log('[Gamepad] 断开:', e.gamepad ? e.gamepad.id : 'unknown');
});

// ── 每帧轮询 ──

const HAT_REPEAT_DELAY = 0.3;
const HAT_REPEAT_RATE = 0.1;

function pollInput() {
  // 清除单帧状态（每帧必须执行）
  for (const k in keysJustPressed) delete keysJustPressed[k];
  mouse.wheelY = 0;
  for (let i = 0; i < 16; i++) gamepad.buttonsJustPressed[i] = false;

  if (!gamepad.available) return;

  const gp = navigator.getGamepads()?.[gamepad.index];
  if (!gp) return;

  for (let i = 0; i < gp.buttons.length; i++) {
    const pressed = gp.buttons[i].pressed;
    gamepad.buttonsJustPressed[i] = pressed && !gamepad._prevButtons[i];
    gamepad.buttons[i] = pressed;

    if (gamepad.buttonsJustPressed[i]) {
      console.log(`[DEBUG-GP] 手柄按钮 i=${i} 按下, 映射键="${BUTTON_TO_KEY[i]}"`);
      gamepad.focusByMouse = false;
      gamepad.usingGamepad = true;
      const mappedKey = BUTTON_TO_KEY[i];
      if (mappedKey !== undefined) {
        gamepad._syntheticKey = true;
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: mappedKey, bubbles: true, cancelable: true
        }));
        gamepad._syntheticKey = false;
      }
    }
  }
  gamepad._prevButtons = [...gamepad.buttons];

  gamepad.axisCount = gp.axes.length;
  for (let i = 0; i < gp.axes.length; i++) {
    gamepad.axes[i] = gp.axes[i];
  }
  gamepad.buttonCount = gp.buttons.length;

  // 十字键（多来源检测：axes 0/1左摇杆、axes 4/5独立轴、buttons 12-15）
  let hatX = Math.round(gp.axes[0] || 0);
  let hatY = -Math.round(gp.axes[1] || 0);
  if (gp.axes.length > 4) {
    const dx = Math.round(gp.axes[4] || 0);
    const dy = -Math.round(gp.axes[5] || 0);
    if (dx !== 0) hatX = dx;
    if (dy !== 0) hatY = dy;
  }
  if (gp.buttons.length > 12) {
    if (gp.buttons[12]?.pressed) hatY = 1;
    if (gp.buttons[13]?.pressed) hatY = -1;
    if (gp.buttons[14]?.pressed) hatX = -1;
    if (gp.buttons[15]?.pressed) hatX = 1;
  }
  if (hatX !== 0 || hatY !== 0) {
    gamepad.focusByMouse = false;
    gamepad.usingGamepad = true;
  }
}

// ── 摇杆/十字键每帧更新（由 main.js 的 update 调用） ──

const DEADZONE = 0.3;
const CURSOR_SPEED = 600;

function updateGamepadMovement(dt) {
  if (!gamepad.available || gamepad.focusByMouse) return;

  // 使用 pollInput() 已缓存的 gamepad.axes / gamepad.buttons

  // 调查模式：十字键 + 左摇杆直接移动光标
  if (gameState && gameState.mode === 'investigation') {
    // 十字键（仅 D-pad 专用源，不读 axes[0]/[1] 避免与左摇杆冲突）
    let hatX = 0;
    let hatY = 0;
    if (gamepad.axisCount > 4) {
      const dx = Math.round(gamepad.axes[4] || 0);
      const dy = Math.round(gamepad.axes[5] || 0);
      if (dx !== 0) hatX = dx;
      if (dy !== 0) hatY = dy; // axes[5]: -1=UP, 1=DOWN → 与屏幕坐标一致（负=上, 正=下）
    }
    if (gamepad.buttonCount > 12) {
      if (gamepad.buttons[12]) hatY = -1; // D-pad UP → 上移
      if (gamepad.buttons[13]) hatY = 1;  // D-pad DOWN → 下移
      if (gamepad.buttons[14]) hatX = -1; // LEFT
      if (gamepad.buttons[15]) hatX = 1;  // RIGHT
    }
    if (hatX !== 0 || hatY !== 0) {
      gameState.investigationCursorX += hatX * CURSOR_SPEED * dt;
      gameState.investigationCursorY += hatY * CURSOR_SPEED * dt;
      gameState.investigationCursorX = Math.max(0, Math.min(DESIGN_W - 1, gameState.investigationCursorX));
      gameState.investigationCursorY = Math.max(0, Math.min(DESIGN_H - 1, gameState.investigationCursorY));
    }
    // 左摇杆
    const lx = gamepad.axes[0] || 0;
    const ly = gamepad.axes[1] || 0;
    const dx = Math.abs(lx) > DEADZONE ? lx : 0;
    const dy = Math.abs(ly) > DEADZONE ? ly : 0;
    if (dx !== 0 || dy !== 0) {
      gameState.investigationCursorX += dx * CURSOR_SPEED * dt;
      gameState.investigationCursorY += dy * CURSOR_SPEED * dt;
      gameState.investigationCursorX = Math.max(0, Math.min(DESIGN_W - 1, gameState.investigationCursorX));
      gameState.investigationCursorY = Math.max(0, Math.min(DESIGN_H - 1, gameState.investigationCursorY));
    }
    return;
  }

  // 非调查模式：十字键 → 方向键（带重复，与 Python update() 一致）
  let hatX = Math.round(gamepad.axes[0] || 0);
  let hatY = -Math.round(gamepad.axes[1] || 0);
  // 多来源检测：axes 4/5（D-pad 独立轴）
  if (gamepad.axisCount > 4) {
    const dx = Math.round(gamepad.axes[4] || 0);
    const dy = -Math.round(gamepad.axes[5] || 0);
    if (dx !== 0) hatX = dx;
    if (dy !== 0) hatY = dy;
  }
  // buttons 12-15（十字键按键）
  if (gamepad.buttonCount > 12) {
    if (gamepad.buttons[12]) hatY = 1;
    if (gamepad.buttons[13]) hatY = -1;
    if (gamepad.buttons[14]) hatX = -1;
    if (gamepad.buttons[15]) hatX = 1;
  }
  const hat = [hatX, hatY];

  const hatChanged = hat[0] !== gamepad._hat[0] || hat[1] !== gamepad._hat[1];
  if (hatChanged) {
    gamepad._hat = hat;
    if (hat[0] !== 0 || hat[1] !== 0) {
      // 首次按下：立即触发 + 启动重复计时器
      gamepad._hatRepeatTimer = HAT_REPEAT_DELAY;
      _dispatchHatKey(hat[0], hat[1]);
    } else {
      // 松开：重置计时器
      gamepad._hatRepeatTimer = 0;
    }
  } else if (hat[0] !== 0 || hat[1] !== 0) {
    // 保持按住 → 重复触发
    gamepad._hatRepeatTimer -= dt;
    if (gamepad._hatRepeatTimer <= 0) {
      gamepad._hatRepeatTimer = HAT_REPEAT_RATE;
      _dispatchHatKey(hat[0], hat[1]);
    }
  }
}

/** 分发十字键生成的方向键事件 */
function _dispatchHatKey(hatX, hatY) {
  const key = HAT_TO_KEY[`${hatX},${hatY}`];
  if (key) {
    gamepad._syntheticKey = true;
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: key, bubbles: true, cancelable: true
    }));
    gamepad._syntheticKey = false;
  }
}

function isKeyJustPressed(k) { return !!keysJustPressed[k]; }
function isKeyDown(k) { return !!keys[k]; }
function isGamepadButtonJustPressed(b) { return !!gamepad.buttonsJustPressed[b]; }
function isGamepadButtonDown(b) { return !!gamepad.buttons[b]; }

// ── 手柄图标系统（与 Python gamepad.py 一致） ──

/** 手柄按键 → 图标文件名映射（UI_key_xxx.png） */
const GAMEPAD_ICON_FILES = {
  a:     '038',
  b:     '037',
  x:     '036',
  y:     '035',
  rb:    '032',
  lb:    '031',
  start: '033',
  back:  '034',
};

/** 图标基础大小 */
const GAMEPAD_ICON_SIZE = 70;

/** 图标缓存 */
const _gpIconCache = {};

/** 获取手柄图标 Image 对象（惰性加载 + 缓存） */
function getGamepadIcon(name, size = GAMEPAD_ICON_SIZE) {
  const suffix = GAMEPAD_ICON_FILES[name];
  if (!suffix) return null;
  const key = `${name}_${size}`;
  if (_gpIconCache[key]) return _gpIconCache[key];
  const img = new Image();
  img.src = `../UI_key_${suffix}.png`;
  _gpIconCache[key] = img;
  return img;
}

/**
 * 在 Canvas 上绘制手柄图标（与 Python draw_gamepad_icon 一致）
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} iconName - 'a','b','x','y','rb','lb','start','back'
 * @param {{x:number,y:number,w:number,h:number}} rect - 按钮矩形（设计坐标）
 * @param {number} [gap=-70] - 图标与按钮的间距（负值=嵌入按钮内）
 * @param {number} [offsetX=0] - 水平偏移
 * @param {number} [offsetY=0] - 垂直偏移
 * @param {'right'|'left'} [align='right'] - 图标在按钮的哪一侧
 */
function drawGamepadIcon(ctx, iconName, rect, gap = -70, offsetX = 0, offsetY = 0, align = 'right') {
  if (!gamepad.usingGamepad) return;
  const img = getGamepadIcon(iconName);
  if (!img || !img.complete) return;
  const size = GAMEPAD_ICON_SIZE;
  const cx = align === 'left'
    ? rect.x - gap - size / 2 + offsetX
    : rect.x + rect.w + gap + size / 2 + offsetX;
  const cy = rect.y + rect.h / 2 + offsetY;
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
}

/**
 * 在 Canvas 上绘制手柄图标 — 按钮下方居中（与 Python draw_gamepad_icon_a / draw_gamepad_icon_b 一致）
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} iconName - 图标名
 * @param {{x:number,y:number,w:number,h:number}} rect - 按钮矩形
 * @param {number} [gap=-70] - 图标与按钮底部的间距（负值=嵌入按钮内）
 * @param {number} [offsetX=0] - 水平偏移
 * @param {number} [offsetY=0] - 垂直偏移
 */
function drawGamepadIconBelow(ctx, iconName, rect, gap = -70, offsetX = 0, offsetY = 0) {
  if (!gamepad.usingGamepad) return;
  const img = getGamepadIcon(iconName);
  if (!img || !img.complete) return;
  const size = GAMEPAD_ICON_SIZE;
  const cx = rect.x + rect.w / 2 + offsetX;
  const cy = rect.y + rect.h + gap + size / 2 + offsetY;
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
}
