// ==================== 谜题模式（数字密码锁 / 选图谜题）====================
// 与 Python text_adventure.py 的 start_puzzle / draw_puzzle / update 逻辑完全一致

// ---- 常量（与 Python 一致） ----
const PUZZLE_IMAGE_SIZE = 1440;        // 谜题画面原始像素尺寸
const PUZZLE_BUTTON_WIDTH = 360;       // 按钮宽度
const PUZZLE_BUTTON_HEIGHT = 72;       // 按钮高度
const PUZZLE_BUTTON_GAP = 2;           // 按钮间距
const PUZZLE_BUTTON_MARGIN_X = 8;      // 按钮距谜题画面右边缘的间距
const PUZZLE_FADE_TIME = 0.4;          // 谜题淡入/淡出秒数
const PUZZLE_DIGIT_POSITIONS = [[388, 1210], [741, 1210], [1099, 1210]]; // 三个数字位在底图中的坐标
const PUZZLE_DIGIT_FONT_SIZE = 100;    // 数字字号
const PUZZLE_ARROW_SIZE = 80;          // 箭头边长
const PUZZLE_ARROW_GAP = -6;            // 箭头到数字的间距
const PUZZLE_SHAKE_AMPLITUDE = 12;     // 抖动幅度
const PUZZLE_SHAKE_SPEED = 50.0;       // 抖动频率
const PUZZLE_SHAKE_DURATION = 0.8;     // 抖动持续时间
const PUZZLE_SWAP_FADE_DURATION = 0.3; // 底图切换淡入淡出时长
const PUZZLE_SUCCESS_DELAY = 1.0;      // 切换完成后等待时间
const PUZZLE_DIALOG_WIDTH = 1125;      // DIALOG_WIDTH
const PUZZLE_BOTTOM_MARGIN = 15;       // DIALOG_BOTTOM_MARGIN
const PUZZLE_ICON_SLIDE_IN = 0.5;      // 成功图标滑入时长
const PUZZLE_ICON_HOLD = 1.0;          // 成功图标停留时长
const PUZZLE_ICON_SLIDE_OUT = 0.5;     // 成功图标滑出时长
const PUZZLE_B_SUB_SIZE = 438;        // 子图原始像素尺寸（与 Python 一致）
const PUZZLE_B_ANIM_DURATION = 0.35;  // 子图滑入动画时长

const PUZZLE_CONFIRM_NORMAL = 'UI_button_11.png';
const PUZZLE_CONFIRM_HOVER = 'UI_button_01_high.png';
const PUZZLE_RETURN_NORMAL = 'UI_button_12.png';
const PUZZLE_RETURN_HOVER = 'UI_button_01_high.png';

const PUZZLE_DIALOG_BG = 'UI_dialogue_02.png';

/** 计算谜题图片尺寸与位置（与 Python draw_puzzle 一致） */
function _puzzleLayout() {
  const gs = gameState;
  const baseImgSize = DESIGN_H * 0.25;              // 270
  const imgSize = Math.round(baseImgSize * gs._EVENT_IMAGE_SCALE); // 891
  const imgGap = gs._EVENT_IMG_GAP;                 // 5
  const boxH = gs._EVENT_DIALOG_HEIGHT;            // 150
  const boxY = DESIGN_H - boxH - PUZZLE_BOTTOM_MARGIN;
  const imgBottom = boxY - imgGap;
  const imgTop = imgBottom - imgSize;
  const imgX = Math.floor((DESIGN_W - imgSize) / 2);
  const imgScale = imgSize / PUZZLE_IMAGE_SIZE;
  return { imgSize, imgGap, boxH, boxY, imgBottom, imgTop, imgX, imgScale };
}

/** 开始谜题（与 Python start_puzzle 一致，仅实现数字密码锁 type A） */
function startPuzzle(puzzleConfig) {
  const gs = gameState;
  gs.puzzleConfig = puzzleConfig;
  gs.puzzleOverlay = puzzleConfig.overlay || null;
  gs.puzzleText = puzzleConfig.text || null;
  gs.puzzleAlpha = 0;
  gs.puzzlePhase = 'fade_in';
  gs.puzzleFadeTimer = PUZZLE_FADE_TIME;
  gs.puzzleHintTime = 0;
  gs.puzzleDigits = [1, 1, 1];
  gs.puzzleArrowRects = [];
  gs.puzzleDialogMode = null;
  gs.puzzleFocusIndex = 0;
  gs.puzzleImgAlpha = 255;
  gs.puzzleSuccessImgAlpha = 0;
  gs.puzzleSuccessImage = null;
  gs.puzzleShakeX = 0;
  gs.puzzleShakeY = 0;
  gs.puzzleShakeTimer = 0;
  gs.puzzleSuccessSwapTimer = 0;
  gs.puzzleSuccessDelayTimer = 0;
  gs.puzzleSuccessIconImg = null;
  gs.puzzleIconImg = null;
  gs.puzzleSuccessIconPhase = null;
  gs.mode = 'puzzle';
  canvas.style.cursor = 'default';

  gs.puzzleImage = puzzleConfig.image || null;

  // 成功特效第二张底图（image_02.ext）
  const configImg = gs.puzzleImage || '';
  if (configImg && configImg.indexOf('.') > -1) {
    const dotIdx = configImg.lastIndexOf('.');
    const successImg = `${configImg.substring(0, dotIdx)}_02${configImg.substring(dotIdx)}`;
    if (getImage(successImg)) {
      gs.puzzleSuccessImage = successImg;
    }
  }

  const lay = _puzzleLayout();
  gs.puzzleImgX = lay.imgX;
  gs.puzzleImgTop = lay.imgTop;

  // ── 类型 B：选图谜题（彩绘牌戏） ──
  const pages = puzzleConfig.pages;
  if (pages && Array.isArray(pages) && pages.length > 0) {
    gs.puzzleIsTypeB = true;
    gs.puzzleBPages = pages;
    gs.puzzleBPageSelections = new Array(pages.length).fill(null);
    gs.puzzleBCurrentPage = 0;
    gs.puzzleBSubImages = [];
    gs.puzzleBActiveSub = null;
    gs.puzzleBAnims = [];
    gs.puzzleBSubDisplaySize = Math.round(PUZZLE_B_SUB_SIZE * lay.imgSize / PUZZLE_IMAGE_SIZE);
    const halfSub = gs.puzzleBSubDisplaySize / 2;
    gs.puzzleBTargetX = Math.round(pages[0].target_x * lay.imgScale) - halfSub;
    gs.puzzleBTargetY = Math.round(pages[0].target_y * lay.imgScale) - halfSub;
    // 使用第一页的底图作为谜题底图
    gs.puzzleImage = pages[0].image || gs.puzzleImage;
    // 预加载所有页底图与子图
    for (const page of pages) {
      if (page.image) getImage(page.image);
      for (const sub of (page.sub_images || [])) {
        if (sub.image) getImage(sub.image);
      }
    }
    _switchToPuzzlePage(0);
  } else {
    gs.puzzleIsTypeB = false;
  }

  // 类型 B：初始化键盘导航项
  if (gs.puzzleIsTypeB) {
    _rebuildPuzzleKeyboardItems();
  }

  console.log(`[Puzzle] 开始谜题, image=${gs.puzzleImage}, overlay=${gs.puzzleOverlay}, answer=${puzzleConfig.answer}, typeB=${gs.puzzleIsTypeB}`);
}

/** 切换到指定页（与 Python _switch_to_page 一致） */
function _switchToPuzzlePage(pageIdx) {
  const gs = gameState;
  if (!gs.puzzleBPages || pageIdx < 0 || pageIdx >= gs.puzzleBPages.length) return;
  const lay = _puzzleLayout();
  const halfSub = gs.puzzleBSubDisplaySize / 2;
  const page = gs.puzzleBPages[pageIdx];
  gs.puzzleBCurrentPage = pageIdx;
  gs.puzzleImage = page.image || gs.puzzleImage;
  // 根据显示坐标构建子图
  gs.puzzleBSubImages = [];
  const savedSel = gs.puzzleBPageSelections[pageIdx];
  const targetX = Math.round(page.target_x * lay.imgScale) - halfSub;
  const targetY = Math.round(page.target_y * lay.imgScale) - halfSub;
  gs.puzzleBTargetX = targetX;
  gs.puzzleBTargetY = targetY;
  for (const sub of (page.sub_images || [])) {
    const originX = Math.round(sub.x * lay.imgScale) - halfSub;
    const originY = Math.round(sub.y * lay.imgScale) - halfSub;
    let curX = originX, curY = originY;
    if (savedSel === sub.id) {
      curX = targetX; curY = targetY;
    }
    gs.puzzleBSubImages.push({
      id: sub.id,
      image: sub.image,
      originX, originY,
      curX, curY,
      rect: { x: 0, y: 0, w: gs.puzzleBSubDisplaySize, h: gs.puzzleBSubDisplaySize }
    });
  }
  // 根据 savedSel 设置 activeSub
  gs.puzzleBActiveSub = savedSel !== null
    ? gs.puzzleBSubImages.findIndex(s => s.id === savedSel)
    : null;
  if (gs.puzzleBActiveSub < 0) gs.puzzleBActiveSub = null;
  // 清除动画
  gs.puzzleBAnims = [];
  gs.puzzleAlpha = 0;
  gs.puzzlePhase = 'fade_in';
  gs.puzzleFadeTimer = PUZZLE_FADE_TIME;
  _rebuildPuzzleKeyboardItems();
}

/** 上一幅（与 Python _do_puzzle_prev_page 一致，仅类型 B 有效） */
function puzzlePrevPage() {
  const gs = gameState;
  if (!gs.puzzleIsTypeB) return;
  const pages = gs.puzzleBPages;
  if (!pages) return;
  const pageIdx = gs.puzzleBCurrentPage;
  if (pageIdx <= 0) return;
  try { playSound('sfx_ui_confirm'); } catch (_) {}
  // 保存当前页选择
  if (gs.puzzleBActiveSub !== null && gs.puzzleBActiveSub >= 0) {
    gs.puzzleBPageSelections[pageIdx] = gs.puzzleBSubImages[gs.puzzleBActiveSub].id;
  } else {
    gs.puzzleBPageSelections[pageIdx] = null;
  }
  _switchToPuzzlePage(pageIdx - 1);
}

/** 确认答案（与 Python _do_puzzle_confirm 一致，数字密码锁分支） */
function puzzleConfirm() {
  const gs = gameState;
  const config = gs.puzzleConfig || {};
  const pointId = config._pointId || '';

  // ── 类型 B：选图谜题分支 ──
  if (gs.puzzleIsTypeB) {
    try { playSound('sfx_ui_confirm'); } catch (_) {}
    const pages = gs.puzzleBPages;
    const pageIdx = gs.puzzleBCurrentPage;
    // 保存当前页选择
    if (gs.puzzleBActiveSub !== null && gs.puzzleBActiveSub >= 0) {
      gs.puzzleBPageSelections[pageIdx] = gs.puzzleBSubImages[gs.puzzleBActiveSub].id;
    } else {
      gs.puzzleBPageSelections[pageIdx] = null;
    }
    if (pageIdx < pages.length - 1) {
      // 非最后一页 → 切换到下一页
      _switchToPuzzlePage(pageIdx + 1);
    } else {
      // 最后一页 → 判定全部答案
      let allCorrect = true;
      for (let i = 0; i < pages.length; i++) {
        if (gs.puzzleBPageSelections[i] !== pages[i].answer) {
          allCorrect = false;
          break;
        }
      }
      if (allCorrect) {
        // 成功（与类型 A 成功流程一致）
        gs.flags[`puzzle_solved_${pointId}`] = true;
        gs.flags[`investigated_${gs.currentNodeId}_${pointId}`] = true;
        try { playSound('sfx_puzzle_success'); } catch (_) {}
        try { playVoice('voice_ba_puzzle_success_01'); } catch (_) {}
        gs.puzzleDialogMode = 'success';
        gs.puzzleSuccessIconImg = 'UI_success_01.png';
        gs.puzzleSuccessIconOffset = -800;
        gs.puzzleSuccessIconAlpha = 0;
        gs.puzzleShakeX = 0;
        gs.puzzleShakeY = 0;
        gs.puzzlePhase = 'typeb_success_shake';
        gs.puzzleShakeTimer = PUZZLE_SHAKE_DURATION;
        gs.puzzleAlpha = 255;
      } else {
        // 失败（与类型 A 失败流程一致）
        try { playSound('sfx_puzzle_fail'); } catch (_) {}
        gs.puzzleDialogMode = 'fail';
        gs.puzzleAlpha = 0;
        gs.puzzlePhase = 'fade_in';
        gs.puzzleFadeTimer = PUZZLE_FADE_TIME;
        gs.puzzleFocusIndex = 0;
        const defaultFail = [
          { speaker: 'Player_Ba', side: 'left', text: '好像不太对啊，是遗漏了什么吗？得再仔细想想。', expression: '06' }
        ];
        const failDialogues = config.fail_dialogues || defaultFail;
        // 重置所有页选择以重新尝试
        gs.puzzleBPageSelections = new Array(gs.puzzleBPages.length).fill(null);
        gs.dialogueQueue = [...failDialogues];
        gs.dialogueIndex = 0;
        gs.mode = 'dialogue';
        gs.startDialogue();
      }
    }
    return;
  }

  const answer = config.answer;
  if (answer === undefined || answer === null) return;

  try { playSound('sfx_ui_confirm'); } catch (_) {}

  const entered = gs.puzzleDigits[0] * 100 + gs.puzzleDigits[1] * 10 + gs.puzzleDigits[2];

  if (entered === answer) {
    // 成功
    try { playSound('sfx_puzzle_success'); } catch (_) {}
    try { playVoice('voice_ba_puzzle_success_01'); } catch (_) {}
    gs.flags[`puzzle_solved_${pointId}`] = true;
    gs.flags[`investigated_${gs.currentNodeId}_${pointId}`] = true;
    gs.puzzleDialogMode = 'success';

    if (gs.puzzleSuccessImage) {
      gs.puzzleImgAlpha = 255;
      gs.puzzleSuccessImgAlpha = 0;
      gs.puzzleShakeX = 0;
      gs.puzzleShakeY = 0;
      gs.puzzlePhase = 'success_shake';
      gs.puzzleShakeTimer = PUZZLE_SHAKE_DURATION;
      gs.puzzleAlpha = 255;
    } else {
      // 无成功底图：直接播放成功对话
      _startPuzzleSuccessDialogues();
    }
  } else {
    // 失败
    try { playSound('sfx_puzzle_fail'); } catch (_) {}
    gs.puzzleDialogMode = 'fail';
    gs.puzzleAlpha = 0;
    gs.puzzlePhase = 'fade_in';
    gs.puzzleFocusIndex = 0;
    const defaultFail = [
      { speaker: 'Player_Ba', side: 'left', text: '好像不太对啊，是遗漏了什么吗？得再仔细想想。', expression: '06' }
    ];
    const failDialogues = config.fail_dialogues || defaultFail;
    gs.dialogueQueue = failDialogues;
    gs.dialogueIndex = 0;
    gs.mode = 'dialogue';
    gs.startDialogue();
  }
}

/** 返回（与 Python 返回按钮逻辑一致） */
function puzzleReturn() {
  const gs = gameState;
  try { playSound('sfx_ui_confirm'); } catch (_) {}
  gs.puzzlePhase = 'fade_out';
  gs.puzzleFadeTimer = PUZZLE_FADE_TIME;
}

/** 改变数字（与 Python 箭头点击逻辑一致） */
function puzzleChangeDigit(digitIdx, isUp) {
  const gs = gameState;
  if (isUp) {
    gs.puzzleDigits[digitIdx] = (gs.puzzleDigits[digitIdx] + 1) % 10;
  } else {
    gs.puzzleDigits[digitIdx] = (gs.puzzleDigits[digitIdx] + 9) % 10;
  }
  try { playSound('sfx_key_turn'); } catch (_) {}
}

/** 播放成功对话（与 Python 一致） */
function _startPuzzleSuccessDialogues() {
  const gs = gameState;
  const config = gs.puzzleConfig || {};
  gs.dialogueQueue = config.success_dialogues || [];
  gs.dialogueIndex = 0;
  gs.mode = 'dialogue';
  gs.startDialogue();
}

/** 谜题淡出后恢复调查（与 Python fade_out 末尾一致） */
function _exitPuzzleToInvestigation() {
  const gs = gameState;
  gs.puzzleImage = null;
  gs.puzzleOverlay = null;
  gs.puzzleSuccessImage = null;
  gs.puzzleAlpha = 0;
  gs.puzzlePhase = 'fade_in';
  gs.puzzleShakeX = 0;
  gs.puzzleShakeY = 0;
  gs.puzzleDialogMode = null;
  // 重置类型 B 状态
  gs.puzzleIsTypeB = false;
  gs.puzzleBSubImages = [];
  gs.puzzleBAnims = [];
  gs.puzzleBActiveSub = null;

  // 清除立绘残留，确保调查界面无角色显示
  gs.displaySpeaker = null;
  gs.displayExpression = '01';
  gs._refreshInvestigationPoints();
  gs.investigationActive = true;
  gs.mode = 'investigation';
  canvas.style.cursor = 'none';
  console.log('[Puzzle] 退出谜题，恢复调查');
}

/** 牌戏谜题返回：淡出后播放 returning 对话再回菜单（与 Python 一致） */
function _exitPuzzleToCardGameReturn() {
  const gs = gameState;
  gs.puzzleImage = null;
  gs.puzzleOverlay = null;
  gs.puzzleSuccessImage = null;
  gs.puzzleAlpha = 0;
  gs.puzzlePhase = 'fade_in';
  gs.puzzleShakeX = 0;
  gs.puzzleShakeY = 0;
  gs.puzzleDialogMode = null;
  // 重置类型 B 状态
  gs.puzzleIsTypeB = false;
  gs.puzzleBSubImages = [];
  gs.puzzleBAnims = [];
  gs.puzzleBActiveSub = null;

  gs.cardGameStage = 'returning';
  gs.dialogueQueue = [{
    speaker: 'Player_Ba',
    side: 'left',
    text: '先进行到这里吧，一会儿再继续。',
    expression: '04'
  }];
  gs.dialogueIndex = 0;
  gs.setDisplayCharacter('Player_Ba', 'left', '04');
  gs.mode = 'dialogue';
  gs.startDialogue();
  console.log('[Puzzle] 牌戏谜题返回，播放 returning 对话');
}

/** 谜题更新（与 Python update 中 puzzle_phase 分支一致） */
function updatePuzzle(dt) {
  const gs = gameState;
  if (gs.mode !== 'puzzle') return;

  // 类型 B 子图滑动动画更新
  if (gs.puzzleIsTypeB) {
    updatePuzzleTypeB(dt);
  }

  const phase = gs.puzzlePhase;

  if (phase === 'fade_in') {
    const dtC = Math.min(dt, 0.05);
    gs.puzzleFadeTimer -= dtC;
    if (gs.puzzleFadeTimer <= 0) {
      gs.puzzleAlpha = 255;
      gs.puzzlePhase = 'display';
    } else {
      gs.puzzleAlpha = Math.round(255 * (1 - gs.puzzleFadeTimer / PUZZLE_FADE_TIME));
    }
  } else if (phase === 'display') {
    gs.puzzleHintTime += dt;
  } else if (phase === 'fade_out') {
    const dtC = Math.min(dt, 0.05);
    gs.puzzleFadeTimer -= dtC;
    if (gs.puzzleFadeTimer <= 0) {
      if (gs.cardGameActive) {
        _exitPuzzleToCardGameReturn();
      } else {
        _exitPuzzleToInvestigation();
      }
    } else {
      gs.puzzleAlpha = Math.round(255 * (gs.puzzleFadeTimer / PUZZLE_FADE_TIME));
    }
  } else if (phase === 'success_shake') {
    gs.puzzleShakeTimer -= dt;
    if (gs.puzzleShakeTimer <= 0) {
      gs.puzzleShakeX = 0;
      gs.puzzleShakeY = 0;
      gs.puzzlePhase = 'success_img_swap';
      gs.puzzleSuccessSwapTimer = PUZZLE_SWAP_FADE_DURATION;
    } else {
      const decay = gs.puzzleShakeTimer / PUZZLE_SHAKE_DURATION;
      const amp = PUZZLE_SHAKE_AMPLITUDE * decay;
      const t = gs.puzzleShakeTimer * PUZZLE_SHAKE_SPEED;
      gs.puzzleShakeX = Math.sin(t * 1.7) * amp;
      gs.puzzleShakeY = Math.cos(t * 1.3) * amp;
    }
  } else if (phase === 'success_img_swap') {
    gs.puzzleSuccessSwapTimer -= dt;
    if (gs.puzzleSuccessSwapTimer <= 0) {
      gs.puzzleImgAlpha = 0;
      gs.puzzleSuccessImgAlpha = 255;
      gs.puzzlePhase = 'success_wait';
      gs.puzzleSuccessDelayTimer = PUZZLE_SUCCESS_DELAY;
    } else {
      const progress = 1 - gs.puzzleSuccessSwapTimer / PUZZLE_SWAP_FADE_DURATION;
      gs.puzzleImgAlpha = Math.round(255 * (1 - progress));
      gs.puzzleSuccessImgAlpha = Math.round(255 * progress);
      if (gs.puzzleSuccessSwapTimer <= 0.05) {
        gs.puzzleImgAlpha = 0;
        gs.puzzleSuccessImgAlpha = 255;
      }
    }
  } else if (phase === 'success_wait') {
    gs.puzzleSuccessDelayTimer -= dt;
    if (gs.puzzleSuccessDelayTimer <= 0) {
      gs.puzzlePhase = 'num_success_fadeout';
      gs.puzzleFadeTimer = 0.5;
      gs.puzzleFadeTotal = 0.5;
      gs.puzzleAlpha = 255;
    }
  } else if (phase === 'typeb_success_shake') {
    gs.puzzleShakeTimer -= dt;
    if (gs.puzzleShakeTimer <= 0) {
      gs.puzzleShakeX = 0;
      gs.puzzleShakeY = 0;
      // 类型 B 无需底图切换，直接进入成功图标动画
      _preparePuzzleSuccessIcon();
      gs.puzzlePhase = 'num_success_icon_anim';
      gs.puzzleSuccessIconPhase = 'slide_in';
      gs.puzzleSuccessIconTimer = PUZZLE_ICON_SLIDE_IN;
      gs.puzzleSuccessIconOffset = -gs.puzzleIconW;
      gs.puzzleSuccessIconAlpha = 0;
    } else {
      const decay = gs.puzzleShakeTimer / PUZZLE_SHAKE_DURATION;
      const amp = PUZZLE_SHAKE_AMPLITUDE * decay;
      const t = gs.puzzleShakeTimer * PUZZLE_SHAKE_SPEED;
      gs.puzzleShakeX = Math.sin(t * 1.7) * amp;
      gs.puzzleShakeY = Math.cos(t * 1.3) * amp;
    }
  } else if (phase === 'num_success_fadeout') {
    const dtC = Math.min(dt, 0.05);
    gs.puzzleFadeTimer -= dtC;
    if (gs.puzzleFadeTimer <= 0) {
      gs.puzzleAlpha = 0;
      gs.puzzleImage = null;
      gs.puzzleOverlay = null;
      gs.puzzleSuccessImage = null;
      _preparePuzzleSuccessIcon();
      gs.puzzlePhase = 'num_success_icon_anim';
      gs.puzzleSuccessIconPhase = 'slide_in';
      gs.puzzleSuccessIconTimer = 0.5;
      gs.puzzleSuccessIconOffset = -gs.puzzleIconW;
      gs.puzzleSuccessIconAlpha = 0;
    } else {
      gs.puzzleAlpha = Math.round(255 * (gs.puzzleFadeTimer / gs.puzzleFadeTotal));
    }
  } else if (phase === 'num_success_icon_anim') {
    _updatePuzzleSuccessIconAnim(dt, 0.5);
  }
}

/** 准备成功图标（与 Python num_success_fadeout 末尾一致） */
function _preparePuzzleSuccessIcon() {
  const gs = gameState;
  const lay = _puzzleLayout();
  const imgSize = lay.imgSize;
  const imgTop = lay.imgTop;
  const imgX = lay.imgX;

  const iconH = Math.round(imgSize * 0.16 * 2);
  const rawImg = getImage('UI_success_01.png');
  let iconW = iconH;
  if (rawImg && rawImg.naturalWidth > 0) {
    iconW = Math.round(rawImg.naturalWidth * iconH / rawImg.naturalHeight);
  }
  gs.puzzleIconImg = 'UI_success_01.png';
  gs.puzzleIconW = iconW;
  gs.puzzleIconH = iconH;
  gs.puzzleIconCx = imgX + Math.floor(imgSize / 2);
  gs.puzzleIconCy = imgTop + Math.floor(imgSize / 2);
}

/** 成功图标动画更新（slide_in → hold → slide_out） */
function _updatePuzzleSuccessIconAnim(dt, slideDur) {
  const gs = gameState;
  const phase = gs.puzzleSuccessIconPhase;
  const targetX = gs.puzzleIconCx - Math.floor(gs.puzzleIconW / 2);

  if (phase === 'slide_in') {
    gs.puzzleSuccessIconTimer -= dt;
    if (gs.puzzleSuccessIconTimer <= 0) {
      gs.puzzleSuccessIconOffset = targetX;
      gs.puzzleSuccessIconAlpha = 255;
      gs.puzzleSuccessIconPhase = 'hold';
      gs.puzzleSuccessIconTimer = PUZZLE_ICON_HOLD;
    } else {
      const progress = 1.0 - (gs.puzzleSuccessIconTimer / slideDur);
      gs.puzzleSuccessIconOffset = targetX - gs.puzzleIconW + progress * gs.puzzleIconW;
      gs.puzzleSuccessIconAlpha = Math.round(255 * progress);
    }
  } else if (phase === 'hold') {
    gs.puzzleSuccessIconTimer -= dt;
    gs.puzzleSuccessIconOffset = targetX;
    gs.puzzleSuccessIconAlpha = 255;
    if (gs.puzzleSuccessIconTimer <= 0) {
      gs.puzzleSuccessIconPhase = 'slide_out';
      gs.puzzleSuccessIconTimer = PUZZLE_ICON_SLIDE_OUT;
    }
  } else if (phase === 'slide_out') {
    gs.puzzleSuccessIconTimer -= dt;
    if (gs.puzzleSuccessIconTimer <= 0) {
      gs.puzzleSuccessIconImg = null;
      gs.puzzleIconImg = null;
      gs.puzzleSuccessIconPhase = null;
      gs.puzzleAlpha = 0;
      gs.puzzlePhase = 'fade_in';
      gs.puzzleImage = null;
      gs.puzzleOverlay = null;
      if (gs.puzzleIsTypeB) {
        gs.puzzleBSubImages = [];
        gs.puzzleBAnims = [];
        gs.puzzleBActiveSub = null;
      }
      _startPuzzleSuccessDialogues();
    } else {
      const progress = 1.0 - (gs.puzzleSuccessIconTimer / PUZZLE_ICON_SLIDE_OUT);
      gs.puzzleSuccessIconOffset = targetX + progress * (gs.puzzleIconW * 2);
      gs.puzzleSuccessIconAlpha = Math.round(255 * (1 - progress));
    }
  }
}

// ==================== 谜题绘制 ====================

/** 绘制谜题 UI（与 Python draw_puzzle 一致） */
function drawPuzzle() {
  const gs = gameState;
  if (gs.mode !== 'puzzle') return;

  // 成功图标动画阶段：仅绘制图标
  if (gs.puzzlePhase === 'num_success_icon_anim') {
    if (gs.puzzleIconImg) {
      const iconImg = getImage(gs.puzzleIconImg);
      if (iconImg && gs.puzzleSuccessIconAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = gs.puzzleSuccessIconAlpha / 255;
        const drawX = gs.puzzleSuccessIconOffset;
        const drawY = gs.puzzleIconCy - Math.floor(gs.puzzleIconH / 2);
        ctx.drawImage(iconImg, drawX, drawY, gs.puzzleIconW, gs.puzzleIconH);
        ctx.restore();
      }
    }
    return;
  }

  if (!gs.puzzleImage) return;
  const alpha = Math.round(gs.puzzleAlpha);
  if (alpha <= 0) return;

  // 类型 B：选图谜题绘制分支
  if (gs.puzzleIsTypeB) {
    drawPuzzleTypeB(alpha);
    return;
  }

  const lay = _puzzleLayout();
  const { imgSize, boxH, boxY, imgBottom, imgTop, imgX, imgScale } = lay;
  const boxW = PUZZLE_DIALOG_WIDTH;
  const boxX = (DESIGN_W - boxW) / 2;

  // 成功特效期间使用整体抖动偏移
  const inSuccess = ['success_shake', 'success_img_swap', 'success_wait'].includes(gs.puzzlePhase);
  let shakeX = 0, shakeY = 0;
  if (inSuccess) {
    shakeX = Math.round(gs.puzzleShakeX);
    shakeY = Math.round(gs.puzzleShakeY);
  }

  // 选择当前绘制的底图与 alpha
  let drawKey, drawAlpha;
  if (['success_img_swap', 'success_wait'].includes(gs.puzzlePhase) && gs.puzzleSuccessImage) {
    drawKey = gs.puzzleSuccessImage;
    drawAlpha = gs.puzzleSuccessImgAlpha;
  } else if (gs.puzzlePhase === 'num_success_fadeout' && gs.puzzleSuccessImage) {
    drawKey = gs.puzzleSuccessImage;
    drawAlpha = gs.puzzleAlpha;
  } else {
    drawKey = gs.puzzleImage;
    drawAlpha = (gs.puzzlePhase === 'success_img_swap' || gs.puzzlePhase === 'success_wait') ? gs.puzzleImgAlpha : alpha;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // 绘制底图
  const mainImg = getImage(drawKey);
  if (mainImg && drawAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = drawAlpha / 255;
    ctx.drawImage(mainImg, imgX, imgTop, imgSize, imgSize);
    ctx.restore();
  }

  // 绘制次底图（PasswordBox_001.png）：覆盖在底图上，宽度与底图一致，保持比例，下方对齐
  if (gs.puzzleOverlay) {
    const overlayImg = getImage(gs.puzzleOverlay);
    if (overlayImg && overlayImg.naturalWidth > 0) {
      const overlayH = Math.round(imgSize * overlayImg.naturalHeight / overlayImg.naturalWidth);
      const overlayTop = imgBottom - overlayH;
      ctx.save();
      ctx.globalAlpha = alpha / 255;
      ctx.drawImage(overlayImg, imgX, overlayTop, imgSize, overlayH);
      ctx.restore();
    }
  }

  // 绘制对话框背景
  ctx.save();
  ctx.globalAlpha = alpha / 255;
  const dlBg = getImage(PUZZLE_DIALOG_BG);
  if (dlBg) {
    ctx.drawImage(dlBg, boxX, boxY, boxW, boxH);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
  }
  ctx.restore();

  // 绘制对话框文字
  let puzzleText = gs.puzzleText;
  if (!puzzleText) {
    puzzleText = '请使用【上下箭头】选择数字，按下【确定】完成密码输入，按下【返回】则退出谜题。';
  }
  const fontSize = 42; // FONT_SIZE - 3
  ctx.save();
  ctx.globalAlpha = alpha / 255;
  ctx.fillStyle = '#000';
  ctx.font = `${fontSize}px "Microsoft YaHei", "SimHei", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const maxW = boxW - 120;
  const lines = _wrapText(ctx, puzzleText, maxW);
  const lineH = fontSize + 6;
  const textH = lines.length * lineH;
  const padding = Math.max(Math.floor((boxH - textH) / 2), 10);
  let yOff = boxY + padding;
  for (const line of lines) {
    ctx.fillText(line, boxX + 40, yOff);
    yOff += lineH;
  }
  ctx.restore();

  // 绘制右侧按钮：紧贴次底图右上方
  // 宽度保持 PUZZLE_BUTTON_WIDTH，高度参考对话选项按钮（MENU_ITEM_H * UI_SCALE）
  const btnW = PUZZLE_BUTTON_WIDTH;
  const btnH = MENU_ITEM_H * UI_SCALE;
  const btnFont = MENU_FONT_SIZE * UI_SCALE;
  const imgRight = imgX + imgSize;
  const btnX = imgRight + PUZZLE_BUTTON_MARGIN_X;

  // overlay_btn_top：次底图顶部（无 overlay 时为 img_top）
  let overlayBtnTop = imgTop;
  if (gs.puzzleOverlay) {
    const overlayImg = getImage(gs.puzzleOverlay);
    if (overlayImg && overlayImg.naturalWidth > 0) {
      const overlayH = Math.round(imgSize * overlayImg.naturalHeight / overlayImg.naturalWidth);
      overlayBtnTop = imgBottom - overlayH;
    }
  }
  const btnBaseY = overlayBtnTop;
  const confirmY = btnBaseY + 4;
  const returnY = confirmY + btnH + PUZZLE_BUTTON_GAP;

  const canvasMx = mouse.canvasX;
  const canvasMy = mouse.canvasY;
  const useMouseHover = gamepad.focusByMouse;

  // 确定按钮
  const btn1Hover = useMouseHover
    ? (canvasMx >= btnX && canvasMx <= btnX + btnW && canvasMy >= confirmY && canvasMy <= confirmY + btnH)
    : (!gamepad.focusByMouse && gs.puzzleFocusIndex === 3);
  const btn1BgFile = btn1Hover ? PUZZLE_CONFIRM_HOVER : PUZZLE_CONFIRM_NORMAL;
  const btn1Bg = getImage(btn1BgFile);
  ctx.save();
  ctx.globalAlpha = alpha / 255;
  if (btn1Bg) {
    ctx.drawImage(btn1Bg, btnX, confirmY, btnW, btnH);
  } else {
    ctx.fillStyle = btn1Hover ? 'rgba(255,213,141,0.95)' : 'rgba(255,255,255,0.9)';
    ctx.fillRect(btnX, confirmY, btnW, btnH);
  }
  ctx.fillStyle = '#000';
  ctx.font = `bold ${btnFont}px "Microsoft YaHei", "SimHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('确定', btnX + btnW / 2, confirmY + btnH / 2);
  ctx.restore();
  gs.puzzleConfirmRect = { x: btnX, y: confirmY, w: btnW, h: btnH };

  // 返回按钮
  const returnHover = useMouseHover
    ? (canvasMx >= btnX && canvasMx <= btnX + btnW && canvasMy >= returnY && canvasMy <= returnY + btnH)
    : (!gamepad.focusByMouse && gs.puzzleFocusIndex === 4);
  const returnBgFile = returnHover ? PUZZLE_RETURN_HOVER : PUZZLE_RETURN_NORMAL;
  const returnBg = getImage(returnBgFile);
  ctx.save();
  ctx.globalAlpha = alpha / 255;
  if (returnBg) {
    ctx.drawImage(returnBg, btnX, returnY, btnW, btnH);
  } else {
    ctx.fillStyle = returnHover ? 'rgba(255,213,141,0.95)' : 'rgba(255,255,255,0.9)';
    ctx.fillRect(btnX, returnY, btnW, btnH);
  }
  ctx.fillStyle = '#000';
  ctx.font = `bold ${btnFont}px "Microsoft YaHei", "SimHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('返回', btnX + btnW / 2, returnY + btnH / 2);
  ctx.restore();
  gs.puzzleReturnRect = { x: btnX, y: returnY, w: btnW, h: btnH };

  // ── 手柄图标（与 Python draw_puzzle 一致） ──
  drawGamepadIcon(ctx, 'rb', gs.puzzleConfirmRect, 4, -40);
  drawGamepadIcon(ctx, 'b', gs.puzzleReturnRect, 4, -40);

  // 数字位 + 箭头（仅数字密码谜题）
  _drawPuzzleDigits(alpha, imgX, imgTop, imgScale, canvasMx, canvasMy);

  ctx.restore(); // shake translate
}

/** 绘制三个数字位 + 上下箭头（与 Python draw_puzzle 数字分支一致） */
function _drawPuzzleDigits(alpha, imgX, imgTop, imgScale, canvasMx, canvasMy) {
  const gs = gameState;
  const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const digitFont = PUZZLE_DIGIT_FONT_SIZE;
  const strokeColor = '#eedd6f';
  const strokeW = 5;
  const focusColor = '#00a03c';

  // 移动端：箭头放大 1.8 倍，上排箭头下移 10px，下排箭头下移 5px（避免遮挡数字）
  const arrowSz = _IS_MOBILE ? PUZZLE_ARROW_SIZE * 1.8 : PUZZLE_ARROW_SIZE;
  const arrowGap = PUZZLE_ARROW_GAP;
  const upArrowExtraOffset = _IS_MOBILE ? 10 : 0;
  const downArrowExtraOffset = _IS_MOBILE ? 5 : 0;

  gs.puzzleArrowRects = [];

  ctx.save();
  ctx.globalAlpha = alpha / 255;

  for (let idx = 0; idx < PUZZLE_DIGIT_POSITIONS.length; idx++) {
    const [ox, oy] = PUZZLE_DIGIT_POSITIONS[idx];
    const cx = imgX + ox * imgScale;
    const cy = imgTop + oy * imgScale;

    const kbdFocus = !gamepad.focusByMouse && gs.puzzleFocusIndex === idx;
    const digitStr = chineseNums[gs.puzzleDigits[idx]];

    ctx.font = `${digitFont}px "Microsoft YaHei", "SimHei", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const metrics = ctx.measureText(digitStr);
    const digitW = metrics.width;
    const digitH = digitFont; // 近似

    // 焦点框
    if (kbdFocus) {
      const upTop = cy - digitH / 2 - arrowGap - arrowSz + upArrowExtraOffset;
      const downBottom = cy + digitH / 2 + arrowGap + arrowSz + downArrowExtraOffset;
      ctx.strokeStyle = focusColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(cx - digitW / 2 - 12, upTop - 6, digitW + 24, downBottom - upTop + 12);
    }

    // 描边
    ctx.fillStyle = strokeColor;
    for (let dx = -strokeW; dx <= strokeW; dx += strokeW) {
      for (let dy = -strokeW; dy <= strokeW; dy += strokeW) {
        if (dx === 0 && dy === 0) continue;
        ctx.fillText(digitStr, cx - digitW / 2 + dx, cy - digitH / 2 + dy);
      }
    }

    // 数字本体
    ctx.fillStyle = '#000';
    ctx.fillText(digitStr, cx - digitW / 2, cy - digitH / 2);

    // 上箭头（移动端下移 10px）
    const upRect = {
      x: cx - arrowSz / 2, y: cy - digitH / 2 - arrowGap - arrowSz + upArrowExtraOffset,
      w: arrowSz, h: arrowSz
    };
    const upHover = (canvasMx >= upRect.x && canvasMx <= upRect.x + arrowSz &&
                     canvasMy >= upRect.y && canvasMy <= upRect.y + arrowSz) || kbdFocus;
    gs.puzzleArrowRects.push(upRect);
    _drawArrow(upRect, 'up', upHover);

    // 下箭头（移动端下移 5px）
    const downRect = {
      x: cx - arrowSz / 2, y: cy + digitH / 2 + arrowGap + downArrowExtraOffset,
      w: arrowSz, h: arrowSz
    };
    const downHover = (canvasMx >= downRect.x && canvasMx <= downRect.x + arrowSz &&
                       canvasMy >= downRect.y && canvasMy <= downRect.y + arrowSz) || kbdFocus;
    gs.puzzleArrowRects.push(downRect);
    _drawArrow(downRect, 'down', downHover);
  }

  ctx.restore();
}

/** 绘制三角箭头（与 Python pygame.draw.polygon 一致） */
function _drawArrow(rect, dir, hover) {
  const triColor = hover ? '#96ff00' : '#67cd23';
  const borderColor = hover ? '#ffffff' : '#000000';
  const borderThickness = hover ? 5 : 2;

  let pts;
  if (dir === 'up') {
    pts = [
      [rect.x + rect.w * 0.5, rect.y + rect.h * 0.2],
      [rect.x + rect.w * 0.2, rect.y + rect.h * 0.8],
      [rect.x + rect.w * 0.8, rect.y + rect.h * 0.8],
    ];
  } else {
    pts = [
      [rect.x + rect.w * 0.5, rect.y + rect.h * 0.8],
      [rect.x + rect.w * 0.2, rect.y + rect.h * 0.2],
      [rect.x + rect.w * 0.8, rect.y + rect.h * 0.2],
    ];
  }

  ctx.fillStyle = triColor;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.lineTo(pts[2][0], pts[2][1]);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderThickness;
  ctx.stroke();
}

// ==================== 类型 B：选图谜题 ====================

/** 绘制类型 B 谜题（选图，与 Python draw_puzzle type B 一致） */
function drawPuzzleTypeB(alpha) {
  const gs = gameState;
  const lay = _puzzleLayout();
  const { imgSize, boxH, boxY, imgBottom, imgTop, imgX, imgScale } = lay;
  const ctx2 = ctx;
  const boxW = PUZZLE_DIALOG_WIDTH;
  const boxX = (DESIGN_W - boxW) / 2;

  // 更新子图在画布上的显示坐标与 rect（相对 imgX/imgTop）
  for (const sub of gs.puzzleBSubImages) {
    sub.rect.x = imgX + sub.curX;
    sub.rect.y = imgTop + sub.curY;
    sub.rect.w = gs.puzzleBSubDisplaySize;
    sub.rect.h = gs.puzzleBSubDisplaySize;
  }

  // 成功抖动期间整体偏移
  const inSuccess = gs.puzzlePhase === 'typeb_success_shake';
  let shakeX = 0, shakeY = 0;
  if (inSuccess) {
    shakeX = Math.round(gs.puzzleShakeX);
    shakeY = Math.round(gs.puzzleShakeY);
  }

  // 鼠标坐标与焦点标志
  const canvasMx = mouse.canvasX;
  const canvasMy = mouse.canvasY;
  const useMouseHover = gamepad.focusByMouse;

  ctx2.save();
  ctx2.translate(shakeX, shakeY);
  ctx2.globalAlpha = alpha / 255;

  // 绘制底图
  const bgImg = getImage(gs.puzzleImage);
  if (bgImg) {
    ctx2.drawImage(bgImg, imgX, imgTop, imgSize, imgSize);
  }

  // ── 计算焦点子图索引（鼠标 hover 或键盘 focus）──
  let focusSubIdx = null;
  if (gs.puzzlePhase === 'display' && gs.puzzleBAnims.length === 0) {
    if (useMouseHover) {
      // 鼠标 hover
      for (let idx = 0; idx < gs.puzzleBSubImages.length; idx++) {
        if (gs.puzzleBActiveSub !== null && idx === gs.puzzleBActiveSub) continue;
        const sub = gs.puzzleBSubImages[idx];
        if (canvasMx >= sub.rect.x && canvasMx <= sub.rect.x + sub.rect.w &&
            canvasMy >= sub.rect.y && canvasMy <= sub.rect.y + sub.rect.h) {
          focusSubIdx = idx;
          break;
        }
      }
    } else {
      // 键盘/手柄焦点
      const items = gs.puzzleKeyboardItems;
      if (items && items.length > 0) {
        const fi = gs.puzzleFocusIndex;
        if (fi >= 0 && fi < items.length && typeof items[fi] === 'number') {
          focusSubIdx = items[fi];
        }
      }
    }
  }
  // 播放焦点切换音效
  if (focusSubIdx !== gs.puzzleBPrevFocus && focusSubIdx !== null) {
    try { playSound('sfx_frame_choice'); } catch (_) {}
  }
  gs.puzzleBPrevFocus = focusSubIdx;

  // 绘制当前页子图（含动画位置），焦点子图上移 40px
  for (let i = 0; i < gs.puzzleBSubImages.length; i++) {
    const sub = gs.puzzleBSubImages[i];
    const sImg = getImage(sub.image);
    if (!sImg) continue;
    let drawX = sub.rect.x;
    let drawY = sub.rect.y;
    // 焦点抬升 40px（仅 PC 端，移动端不做）
    if (!_IS_MOBILE && i === focusSubIdx) {
      drawY -= 40;
    }
    ctx2.drawImage(sImg, drawX, drawY, sub.rect.w, sub.rect.h);
  }

  ctx2.restore();

  // ── 绘制对话框背景 + 文字 ──
  ctx2.save();
  ctx2.globalAlpha = alpha / 255;
  const dlBg = getImage(PUZZLE_DIALOG_BG);
  if (dlBg) {
    ctx2.drawImage(dlBg, boxX, boxY, boxW, boxH);
  } else {
    ctx2.fillStyle = 'rgba(255,255,255,0.95)';
    ctx2.fillRect(boxX, boxY, boxW, boxH);
  }
  ctx2.restore();

  // 绘制对话框文字
  let puzzleText = gs.puzzleText;
  if (!puzzleText) {
    puzzleText = '请选择正确的图案放到空位上，按下【确定】完成，按下【返回】则退出谜题。';
  }
  const fontSize = 42;
  ctx2.save();
  ctx2.globalAlpha = alpha / 255;
  ctx2.fillStyle = '#000';
  ctx2.font = `${fontSize}px "Microsoft YaHei", "SimHei", sans-serif`;
  ctx2.textAlign = 'left';
  ctx2.textBaseline = 'top';
  const maxW = boxW - 120;
  const lines = _wrapText(ctx2, puzzleText, maxW);
  const lineH = fontSize + 6;
  const textH = lines.length * lineH;
  const padding = Math.max(Math.floor((boxH - textH) / 2), 10);
  let yOff = boxY + padding;
  for (const line of lines) {
    ctx2.fillText(line, boxX + 40, yOff);
    yOff += lineH;
  }
  ctx2.restore();

  // ── 绘制右侧按钮（与 Python draw_puzzle type B 一致） ──
  const btnW = PUZZLE_BUTTON_WIDTH;
  const btnH = MENU_ITEM_H * UI_SCALE;
  const btnFont = MENU_FONT_SIZE * UI_SCALE;
  const imgRight = imgX + imgSize;
  const btnX = imgRight + PUZZLE_BUTTON_MARGIN_X;
  const btnBaseY = imgTop;
  const confirmY = btnBaseY + 4 + 600; // Python: confirm_y = img_top + 4 + 600

  const totalPages = gs.puzzleBPages.length;
  const curPage = gs.puzzleBCurrentPage;
  const isMulti = totalPages > 1;
  const showPrev = isMulti && curPage > 0;

  const confirmText = curPage < totalPages - 1 ? '下一幅' : '确定';

  // 页码指示文字（仅多页时显示，Python 8014-8030）
  if (isMulti) {
    const pageFontSize = (MENU_FONT_SIZE + 10) * UI_SCALE;
    const pageText = `${curPage + 1}/${totalPages}`;
    const pageX = btnX;
    const pageY = confirmY - pageFontSize - 10;
    ctx2.save();
    ctx2.globalAlpha = alpha / 255;
    ctx2.font = `bold ${pageFontSize}px "Microsoft YaHei", "SimHei", sans-serif`;
    ctx2.textAlign = 'left';
    ctx2.textBaseline = 'top';
    // 8 方向黑色描边
    ctx2.fillStyle = '#000';
    for (const dx of [-2, 0, 2]) {
      for (const dy of [-2, 0, 2]) {
        if (dx === 0 && dy === 0) continue;
        ctx2.fillText(pageText, pageX + dx, pageY + dy);
      }
    }
    ctx2.fillStyle = 'rgb(220,200,40)';
    ctx2.fillText(pageText, pageX, pageY);
    ctx2.restore();
  }

  // ── 键盘焦点按钮索引（用于按钮 hover 判定）──
  const items4Btn = gs.puzzleKeyboardItems || [];
  const fi4Btn = gs.puzzleFocusIndex;
  const kbdFocusItem = (!useMouseHover && fi4Btn >= 0 && fi4Btn < items4Btn.length) ? items4Btn[fi4Btn] : null;

  // 确定按钮
  const btn1Hover = useMouseHover
    ? (canvasMx >= btnX && canvasMx <= btnX + btnW && canvasMy >= confirmY && canvasMy <= confirmY + btnH)
    : (kbdFocusItem === 'confirm');
  const btn1BgFile = btn1Hover ? PUZZLE_CONFIRM_HOVER : PUZZLE_CONFIRM_NORMAL;
  const btn1Bg = getImage(btn1BgFile);
  ctx2.save();
  ctx2.globalAlpha = alpha / 255;
  if (btn1Bg) {
    ctx2.drawImage(btn1Bg, btnX, confirmY, btnW, btnH);
  } else {
    ctx2.fillStyle = btn1Hover ? 'rgba(255,213,141,0.95)' : 'rgba(255,255,255,0.9)';
    ctx2.fillRect(btnX, confirmY, btnW, btnH);
  }
  ctx2.fillStyle = '#000';
  ctx2.font = `bold ${btnFont}px "Microsoft YaHei", "SimHei", sans-serif`;
  ctx2.textAlign = 'center';
  ctx2.textBaseline = 'middle';
  ctx2.fillText(confirmText, btnX + btnW / 2, confirmY + btnH / 2);
  ctx2.restore();
  gs.puzzleConfirmRect = { x: btnX, y: confirmY, w: btnW, h: btnH };

  // 上一幅按钮（多页且当前页 > 0 时显示，Python 8057-8097）
  let btn2Bottom = confirmY + btnH;
  if (showPrev) {
    const prevY = btn2Bottom + PUZZLE_BUTTON_GAP;
    const prevHover = useMouseHover
      ? (canvasMx >= btnX && canvasMx <= btnX + btnW && canvasMy >= prevY && canvasMy <= prevY + btnH)
      : (kbdFocusItem === 'prev');
    const prevBgFile = prevHover ? PUZZLE_CONFIRM_HOVER : PUZZLE_CONFIRM_NORMAL;
    const prevBg = getImage(prevBgFile);
    ctx2.save();
    ctx2.globalAlpha = alpha / 255;
    if (prevBg) {
      ctx2.drawImage(prevBg, btnX, prevY, btnW, btnH);
    } else {
      ctx2.fillStyle = prevHover ? 'rgba(255,213,141,0.95)' : 'rgba(255,255,255,0.9)';
      ctx2.fillRect(btnX, prevY, btnW, btnH);
    }
    ctx2.fillStyle = '#000';
    ctx2.font = `bold ${btnFont}px "Microsoft YaHei", "SimHei", sans-serif`;
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.fillText('上一幅', btnX + btnW / 2, prevY + btnH / 2);
    ctx2.restore();
    gs.puzzlePrevRect = { x: btnX, y: prevY, w: btnW, h: btnH };
    btn2Bottom = prevY + btnH;
  } else {
    gs.puzzlePrevRect = null;
  }

  // 返回按钮
  const returnY = btn2Bottom + PUZZLE_BUTTON_GAP;
  const returnHover = useMouseHover
    ? (canvasMx >= btnX && canvasMx <= btnX + btnW && canvasMy >= returnY && canvasMy <= returnY + btnH)
    : (kbdFocusItem === 'return');
  const returnBgFile = returnHover ? PUZZLE_RETURN_HOVER : PUZZLE_RETURN_NORMAL;
  const returnBg = getImage(returnBgFile);
  ctx2.save();
  ctx2.globalAlpha = alpha / 255;
  if (returnBg) {
    ctx2.drawImage(returnBg, btnX, returnY, btnW, btnH);
  } else {
    ctx2.fillStyle = returnHover ? 'rgba(255,213,141,0.95)' : 'rgba(255,255,255,0.9)';
    ctx2.fillRect(btnX, returnY, btnW, btnH);
  }
  ctx2.fillStyle = '#000';
  ctx2.font = `bold ${btnFont}px "Microsoft YaHei", "SimHei", sans-serif`;
  ctx2.textAlign = 'center';
  ctx2.textBaseline = 'middle';
  ctx2.fillText('返回', btnX + btnW / 2, returnY + btnH / 2);
  ctx2.restore();
  gs.puzzleReturnRect = { x: btnX, y: returnY, w: btnW, h: btnH };

  // ── 手柄图标（与 Python draw_puzzle 一致） ──
  // A 键：焦点子图下方居中
  if (!gamepad.focusByMouse) {
    const fi = gs.puzzleFocusIndex;
    const items = gs.puzzleKeyboardItems;
    if (items && 0 <= fi && fi < items.length && typeof items[fi] === 'number') {
      const subIdx = items[fi];
      if (0 <= subIdx && subIdx < gs.puzzleBSubImages.length) {
        const sub = gs.puzzleBSubImages[subIdx];
        const subX = imgX + (sub.curX || 0);
        const subY = imgTop + (sub.curY || 0);
        const subSz = gs.puzzleBSubDisplaySize || PUZZLE_B_SUB_SIZE * imgScale;
        const subRect = { x: subX, y: subY, w: subSz, h: subSz };
        drawGamepadIconBelow(ctx2, 'a', subRect, -10 - GAMEPAD_ICON_SIZE / 2, 0);
      }
    }
  }
  // 返回 → B 键
  drawGamepadIcon(ctx2, 'b', gs.puzzleReturnRect, 4, -40);
  // 确定/下一幅 → RB 键
  drawGamepadIcon(ctx2, 'rb', gs.puzzleConfirmRect, 4, -40);
  // 上一幅 → LB 键
  if (showPrev && gs.puzzlePrevRect) {
    drawGamepadIcon(ctx2, 'lb', gs.puzzlePrevRect, 4, -40);
  }
}

/** 更新类型 B 谜题动画（与 Python update 一致） */
function updatePuzzleTypeB(dt) {
  const gs = gameState;
  // 更新子图滑动动画
  const anims = gs.puzzleBAnims;
  for (let i = anims.length - 1; i >= 0; i--) {
    const anim = anims[i];
    anim.timer += dt;
    const progress = Math.min(anim.timer / anim.duration, 1);
    const sub = gs.puzzleBSubImages[anim.subIdx];
    if (sub) {
      sub.curX = anim.fromX + (anim.toX - anim.fromX) * progress;
      sub.curY = anim.fromY + (anim.toY - anim.fromY) * progress;
    }
    if (progress >= 1) {
      anims.splice(i, 1);
    }
  }
}

/** 重建谜题键盘导航项列表（与 Python _rebuild_puzzle_keyboard_items 一致） */
function _rebuildPuzzleKeyboardItems() {
  const gs = gameState;
  const items = [];
  if (gs.puzzleBSubImages) {
    for (let idx = 0; idx < gs.puzzleBSubImages.length; idx++) {
      if (idx !== gs.puzzleBActiveSub) {
        items.push(idx);
      }
    }
  }
  items.push('confirm');
  if (gs.puzzleBPages && gs.puzzleBPages.length > 1 && gs.puzzleBCurrentPage > 0) {
    items.push('prev');
  }
  items.push('return');
  gs.puzzleKeyboardItems = items;
}

/** 键盘/手柄选中子图（与 Python select_puzzle_sub 一致） */
function selectPuzzleSub(idx, fromKeyboard) {
  const gs = gameState;
  if (idx < 0 || idx >= gs.puzzleBSubImages.length) return;
  if (gs.puzzleBAnims.length > 0) return;
  try { playSound('sfx_frame_move'); } catch (_) {}
  const sub = gs.puzzleBSubImages[idx];
  if (gs.puzzleBActiveSub === idx) {
    // 取消选中：滑回原位
    gs.puzzleBAnims.push({
      subIdx: idx, fromX: sub.curX, fromY: sub.curY,
      toX: sub.originX, toY: sub.originY, timer: 0, duration: PUZZLE_B_ANIM_DURATION
    });
    gs.puzzleBActiveSub = null;
  } else if (gs.puzzleBActiveSub !== null && gs.puzzleBActiveSub >= 0) {
    // 已有选中，先滑回
    const oldSub = gs.puzzleBSubImages[gs.puzzleBActiveSub];
    gs.puzzleBAnims.push({
      subIdx: gs.puzzleBActiveSub, fromX: oldSub.curX, fromY: oldSub.curY,
      toX: oldSub.originX, toY: oldSub.originY, timer: 0, duration: PUZZLE_B_ANIM_DURATION
    });
    // 新选滑至目标
    gs.puzzleBAnims.push({
      subIdx: idx, fromX: sub.curX, fromY: sub.curY,
      toX: gs.puzzleBTargetX, toY: gs.puzzleBTargetY, timer: 0, duration: PUZZLE_B_ANIM_DURATION
    });
    gs.puzzleBActiveSub = idx;
  } else {
    // 无选中，直接滑至目标
    gs.puzzleBAnims.push({
      subIdx: idx, fromX: sub.curX, fromY: sub.curY,
      toX: gs.puzzleBTargetX, toY: gs.puzzleBTargetY, timer: 0, duration: PUZZLE_B_ANIM_DURATION
    });
    gs.puzzleBActiveSub = idx;
  }
  if (fromKeyboard) {
    _rebuildPuzzleKeyboardItems();
    const subIndices = gs.puzzleKeyboardItems
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => typeof item === 'number')
      .map(({ i }) => i);
    gs.puzzleFocusIndex = subIndices.length > 0 ? subIndices[0] : 0;
  }
}

/** 类型 B 点击处理：点击子图选中/取消，返回是否命中 */
function puzzleTypeBClick(canvasMx, canvasMy) {
  const gs = gameState;
  if (gs.puzzlePhase !== 'display') return false;
  if (gs.puzzleBAnims.length > 0) return false; // 动画进行中不响应

  // 检测子图点击
  const subImages = gs.puzzleBSubImages;
  for (let idx = 0; idx < subImages.length; idx++) {
    const sub = subImages[idx];
    if (canvasMx >= sub.rect.x && canvasMx <= sub.rect.x + sub.rect.w &&
        canvasMy >= sub.rect.y && canvasMy <= sub.rect.y + sub.rect.h) {
      try { playSound('sfx_frame_move'); } catch (_) {}
      if (gs.puzzleBActiveSub === idx) {
        // 取消选中：滑回原位
        gs.puzzleBAnims.push({
          subIdx: idx, fromX: sub.curX, fromY: sub.curY,
          toX: sub.originX, toY: sub.originY, timer: 0, duration: PUZZLE_B_ANIM_DURATION
        });
        gs.puzzleBActiveSub = null;
      } else {
        // 若已有选中子图，先滑回原位
        if (gs.puzzleBActiveSub !== null && gs.puzzleBActiveSub >= 0) {
          const oldSub = subImages[gs.puzzleBActiveSub];
          gs.puzzleBAnims.push({
            subIdx: gs.puzzleBActiveSub, fromX: oldSub.curX, fromY: oldSub.curY,
            toX: oldSub.originX, toY: oldSub.originY, timer: 0, duration: PUZZLE_B_ANIM_DURATION
          });
        }
        // 将新选中子图滑至目标位
        gs.puzzleBAnims.push({
          subIdx: idx, fromX: sub.curX, fromY: sub.curY,
          toX: gs.puzzleBTargetX, toY: gs.puzzleBTargetY, timer: 0, duration: PUZZLE_B_ANIM_DURATION
        });
        gs.puzzleBActiveSub = idx;
      }
      return true;
    }
  }

  // 上一幅按钮（多页时切换到上一页）
  if (gs.puzzlePrevRect &&
      canvasMx >= gs.puzzlePrevRect.x && canvasMx <= gs.puzzlePrevRect.x + gs.puzzlePrevRect.w &&
      canvasMy >= gs.puzzlePrevRect.y && canvasMy <= gs.puzzlePrevRect.y + gs.puzzlePrevRect.h) {
    try { playSound('sfx_ui_confirm'); } catch (_) {}
    // 切换到上一页
    if (gs.puzzleBCurrentPage > 0) {
      _switchToPuzzlePage(gs.puzzleBCurrentPage - 1);
    }
    return true;
  }

  return false;
}

