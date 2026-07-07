// ==================== 物品栏 Canvas 渲染系统 ====================
// 与 Pygame draw_inventory 完全对齐，支持物品/人物双模式
// 三套界面共用：展示物品(show)、物品栏(inventory)、举证对白(proof)
// 全部使用 Canvas 绘制，不依赖 DOM

// ── 移动端按钮高亮状态（Canvas overlay） ──
let _invBtnHighlight = null; // { name: 'show'|'back', timer, x, y, w, h }

// ── 设计分辨率 ──
// DESIGN_W=1920, DESIGN_H=1080（定义在 main.js）
// 图片使用全局 imageCache（定义在 engine.js），通过 getImage(name) 获取

// ==================== 辅助函数 ====================

/** 换行缓存 */
const _wrapCache = {};
function _invWrapText(text, font, maxWidth) {
  const key = text + '|' + font + '|' + maxWidth;
  if (_wrapCache[key]) return _wrapCache[key];
  const tc = document.createElement('canvas').getContext('2d');
  tc.font = font;
  const lines = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (tc.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  _wrapCache[key] = lines;
  return lines;
}

function _invIsHover(mx, my, x, y, w, h) {
  return mx >= x && mx <= x + w && my >= y && my <= y + h;
}

/** 点击矩形检测缓存（每帧由 drawInventoryCanvas 刷新） */
const _invRects = {};
function _invStoreRect(name, x, y, w, h) {
  _invRects[name] = { x, y, w, h };
}
function _invHitRect(name, mx, my) {
  const r = _invRects[name];
  if (!r) return false;
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

// ==================== 绘制辅助 ====================

function _invDrawArrow(c, x, y, w, h, dir, hover) {
  const triColor = hover ? 'rgb(150,255,0)' : 'rgb(103,205,35)';
  const borderColor = hover ? '#fff' : '#000';
  const borderW = hover ? 5 : 2;
  c.save();
  c.beginPath();
  if (dir === 'left') {
    c.moveTo(x + w * 0.2, y + h * 0.5);
    c.lineTo(x + w * 0.8, y + h * 0.2);
    c.lineTo(x + w * 0.8, y + h * 0.8);
  } else {
    c.moveTo(x + w * 0.8, y + h * 0.5);
    c.lineTo(x + w * 0.2, y + h * 0.2);
    c.lineTo(x + w * 0.2, y + h * 0.8);
  }
  c.closePath();
  c.fillStyle = triColor;
  c.fill();
  c.strokeStyle = borderColor;
  c.lineWidth = borderW;
  c.stroke();
  c.restore();
}

function _invDrawButton(c, x, y, w, h, hover, label, isBack) {
  // 与 Python 一致：返回按钮用 UI_button_03，普通按钮用 UI_button_02
  let bgName;
  if (isBack) {
    bgName = hover ? 'UI_button_01_high.png' : 'UI_button_03.png';
  } else {
    bgName = hover ? 'UI_button_02_high.png' : 'UI_button_02.png';
  }
  const bgImg = getImage(bgName);
  const sh = _IS_MOBILE ? h * UI_SCALE : h; // 移动端高度放大
  if (bgImg) {
    // 移动端：宽度保持原始，高度放大（不保持比例）
    c.drawImage(bgImg, x, y, w, sh);
  } else {
    c.fillStyle = hover ? 'rgba(255,213,141,0.94)' : 'rgba(200,200,200,0.8)';
    c.beginPath();
    c.roundRect(x, y, w, sh, 8);
    c.fill();
  }
  c.fillStyle = '#000';
  c.font = `bold ${42 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  // 文字在实际图片区域内居中（sh = 实际绘制高度）+ 中文视觉微调下移
  c.fillText(label, x + w / 2, y + sh / 2 + 42 * UI_SCALE * 0.08);
  c.textAlign = 'left';
}

// ==================== 主渲染函数 ====================

function drawInventoryCanvas() {
  if (!gameState || gameState._subMenu !== 'inventory') return;

  const isCharacterMode = (gameState.inventoryMode === 'character');
  const isProof = (gameState.inventoryAction === 'proof');
  const isThought = (gameState.inventoryAction === 'thought');

  // 获取列表
  let itemList, totalCount, selectedIndex;
  if (isCharacterMode) {
    const charList = gameState.getCharacterList();
    // 与 Python 一致：从 scenario.json chapters.{chapter}.characters 读取 face_*.png 头像
    const chData = gameState._getChapterData();
    const chChars = (chData.characters || {});
    itemList = charList.map(id => {
      const ch = chChars[id] || charactersData[id];
      return ch ? { id, name: ch.name || id, description: ch.description || '', image: ch.image || '' } : null;
    }).filter(Boolean);
    totalCount = itemList.length;
    selectedIndex = gameState.selectedItemIndex;
  } else {
    // inventory 已存储完整物品信息（id/name/description/image）
    itemList = gameState.inventory.slice();
    totalCount = itemList.length;
    selectedIndex = gameState.selectedItemIndex;
  }

  // 空列表提示
  if (totalCount === 0) {
    ctx.fillStyle = '#c8c8c8';
    ctx.font = `bold ${36 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isCharacterMode ? '暂无人物' : '暂无物品', DESIGN_W / 2, DESIGN_H / 2);
    ctx.textAlign = 'left';
    return;
  }

  // ── 卡片参数（与 Pygame 一致） ──
  const baseCardSize = Math.min(DESIGN_W * 0.08, DESIGN_H * 0.1);
  const cardW = Math.round(baseCardSize * 1.5);
  const cardH = cardW;
  const cardSpacing = Math.round(DESIGN_W * 0.055);
  const cols = Math.min(5, totalCount);
  const totalItemsWidth = cols * cardW + (cols - 1) * cardSpacing;

  let startX = (DESIGN_W - totalItemsWidth) / 2;
  const margin = 40;
  if (startX < margin) startX = margin;
  if (startX + totalItemsWidth > DESIGN_W - margin) startX = DESIGN_W - margin - totalItemsWidth;
  startX = Math.round(startX);

  const startY = Math.round(DESIGN_H * 0.09);
  const inventoryYOffset = 50;
  const centerCol = Math.floor(cols / 2);

  // ── 动画状态 ──
  const animActive = gameState.invAnimActive;
  const animFrom = gameState.invAnimFromIdx;
  const animTo = gameState.invAnimToIdx;
  const animProgress = gameState.invAnimProgress;
  const animDirection = gameState.invAnimDirection;
  const currentCenter = animActive ? animFrom : selectedIndex;

  function getVisibleIndices(centerIdx) {
    const half = Math.floor(cols / 2);
    const indices = [];
    for (let i = 0; i < cols; i++) {
      let idx = (centerIdx + i - half) % totalCount;
      if (idx < 0) idx += totalCount;
      indices.push(idx);
    }
    return indices;
  }

  // ── 背景条（与 Pygame get_inventory_strip_cached 一致） ──
  const gradientWidth = 500;
  const marginY = 70;
  const edgeHeight = 7;
  const stripX = startX - gradientWidth;
  const stripY = startY - marginY;
  const stripH = cardH + 2 * marginY;

  ctx.save();
  for (let x = 0; x < gradientWidth; x++) {
    const a = 0.9 * (x / gradientWidth);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(stripX + x, stripY, 1, stripH);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(stripX + gradientWidth, stripY, totalItemsWidth, stripH);
  for (let x = 0; x < gradientWidth; x++) {
    const a = 0.9 * ((gradientWidth - x) / gradientWidth);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(stripX + gradientWidth + totalItemsWidth + x, stripY, 1, stripH);
  }
  for (let x = 0; x < gradientWidth; x++) {
    const a = 0.8 * (x / gradientWidth);
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(stripX + x, stripY, 1, edgeHeight);
    ctx.fillRect(stripX + x, stripY + stripH - edgeHeight, 1, edgeHeight);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(stripX + gradientWidth, stripY, totalItemsWidth, edgeHeight);
  ctx.fillRect(stripX + gradientWidth, stripY + stripH - edgeHeight, totalItemsWidth, edgeHeight);
  for (let x = 0; x < gradientWidth; x++) {
    const a = 0.8 * ((gradientWidth - x) / gradientWidth);
    const x0 = stripX + gradientWidth + totalItemsWidth + x;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(x0, stripY, 1, edgeHeight);
    ctx.fillRect(x0, stripY + stripH - edgeHeight, 1, edgeHeight);
  }
  ctx.restore();

  // ── 绘制卡片 ──
  const bgColors = ['rgb(220,180,140)', 'rgb(180,220,140)', 'rgb(160,160,180)', 'rgb(200,180,220)', 'rgb(220,160,160)'];
  const currentIndices = getVisibleIndices(currentCenter);

  function drawCard(item, x, y, w, h, colIdx) {
    ctx.fillStyle = bgColors[colIdx % bgColors.length];
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    if (item && item.image) {
      const img = getImage(item.image);
      if (img) {
        const padding = Math.round(w * 0.05);
        const imgSize = Math.max(1, w - 2 * padding);
        const s = Math.min(imgSize / img.naturalWidth, imgSize / img.naturalHeight) * 1.8;
        const nw = Math.max(1, Math.round(img.naturalWidth * s));
        const nh = Math.max(1, Math.round(img.naturalHeight * s));
        ctx.drawImage(img, x + (w - nw) / 2, y + (h - nh) / 2, nw, nh);
      }
    }
  }

  // ── 卡片渲染（带动画） ──
  if (animActive && animTo !== -1) {
    const nextIndices = getVisibleIndices(animTo);
    const sp = animProgress * animProgress * (3 - 2 * animProgress);
    const slideOff = -(sp * (cardW + cardSpacing) * animDirection);
    const slideOffNext = ((1 - sp) * (cardW + cardSpacing) * animDirection);
    for (let col = 0; col < cols; col++) {
      drawCard(itemList[currentIndices[col]], Math.round(startX + col * (cardW + cardSpacing) + slideOff), startY, cardW, cardH, col);
    }
    for (let col = 0; col < cols; col++) {
      drawCard(itemList[nextIndices[col]], Math.round(startX + col * (cardW + cardSpacing) + slideOffNext), startY, cardW, cardH, col);
    }
  } else {
    for (let col = 0; col < cols; col++) {
      const itemIdx = currentIndices[col];
      const item = itemList[itemIdx];
      if (isCharacterMode && gameState.holdShowingCharacterUntilInventoryReady && itemIdx === selectedIndex) continue;
      if (!isCharacterMode && gameState.holdShowingItemUntilInventoryReady && itemIdx === selectedIndex) continue;
      const x = startX + col * (cardW + cardSpacing);
      drawCard(item, x, startY, cardW, cardH, col);
      // 选择框
      if (col === centerCol && itemIdx === selectedIndex) {
        const selImg = getImage('UI_itemBox.png');
        const selW = cardW + 110, selH = cardH + 110;
        if (selImg) {
          ctx.drawImage(selImg, x - 55, startY - 55, selW, selH);
        } else {
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 4;
          ctx.strokeRect(x - 55, startY - 55, selW, selH);
        }
      }
    }
  }

  // ── 控制区域 ──
  const controlY = startY + cardH + Math.round(DESIGN_H * 0.05) + inventoryYOffset;
  const maxTotalWidth = 5 * cardW + 4 * cardSpacing;
  const showButtonWidth = Math.round(maxTotalWidth * 0.58);
  const backButtonWidth = Math.round(maxTotalWidth * 0.42);
  const buttonHeight = 72;
  const arrowSize = Math.round(buttonHeight * 1.5 * UI_SCALE);

  // ── 左箭头 ──
  const laX = Math.round((DESIGN_W - backButtonWidth) / 2 - arrowSize - 20);
  const laY = controlY + Math.round((buttonHeight - arrowSize) / 2);
  _invDrawArrow(ctx, laX, laY, arrowSize, arrowSize, 'left', !_IS_MOBILE && _invIsHover(mouse.canvasX, mouse.canvasY, laX, laY, arrowSize, arrowSize));
  _invStoreRect('leftArrow', laX, laY, arrowSize, arrowSize);

  // ── 展示/举证按钮（移动端单独上移 20px） ──
  const sbX = Math.round((DESIGN_W - backButtonWidth) / 2);
  const sbY = controlY + (_IS_MOBILE ? -20 : 0);
  const sbHover = !_IS_MOBILE && _invIsHover(mouse.canvasX, mouse.canvasY, sbX, sbY, backButtonWidth, buttonHeight);
  const showLabel = isProof ? '【举证】' : (isThought ? '【想法】' : (isCharacterMode ? '【展示人物】' : '【展示物品】'));
  _invDrawButton(ctx, sbX, sbY, backButtonWidth, buttonHeight, sbHover, showLabel);
  _invStoreRect('show', sbX, sbY, backButtonWidth, buttonHeight);
  // ── 移动端高亮：绘制 _high.png + 重绘文字 ──
  if (_invBtnHighlight && _invBtnHighlight.name === 'show') {
    const hImg = getImage('UI_button_02_high.png');
    if (hImg) {
      const sh = _IS_MOBILE ? buttonHeight * UI_SCALE : buttonHeight;
      ctx.drawImage(hImg, sbX, sbY, backButtonWidth, sh);
      ctx.fillStyle = '#000';
      ctx.font = `bold ${42 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(showLabel, sbX + backButtonWidth / 2, sbY + sh / 2 + 42 * UI_SCALE * 0.08);
      ctx.textAlign = 'left';
    }
  }
  // ── 手柄图标：展示/举证/想法按钮 → Y 键（与 Python 一致） ──
  if (gamepad.usingGamepad) {
    drawGamepadIcon(ctx, 'y', { x: sbX, y: sbY, w: backButtonWidth, h: buttonHeight }, 4, -95);
  }

  // ── 右箭头 ──
  const raX = Math.round((DESIGN_W + backButtonWidth) / 2 + 20);
  _invDrawArrow(ctx, raX, laY, arrowSize, arrowSize, 'right', !_IS_MOBILE && _invIsHover(mouse.canvasX, mouse.canvasY, raX, laY, arrowSize, arrowSize));
  _invStoreRect('rightArrow', raX, laY, arrowSize, arrowSize);

  // ── 信息框 ──
  const displayIdx = animActive ? animTo : selectedIndex;
  let infoBoxHeight = 0;
  if (displayIdx >= 0 && displayIdx < totalCount) {
    const item = itemList[displayIdx];
    const infoW = showButtonWidth;
    infoBoxHeight = Math.round(DESIGN_H * 0.48);
    const infoX = Math.round((DESIGN_W - infoW) / 2);
    const infoY = controlY + buttonHeight + 10;

    const infoBg = getImage('UI_dialogue_03.png');
    if (infoBg) {
      ctx.drawImage(infoBg, infoX, infoY, infoW, infoBoxHeight);
    } else {
      ctx.fillStyle = 'rgba(255,245,230,0.9)';
      ctx.beginPath();
      ctx.roundRect(infoX, infoY, infoW, infoBoxHeight, 8);
      ctx.fill();
    }

    // 名称（与 Python 一致：info_rect.y + 20）
    // Canvas ascent≈3 远小于 Pygame ascent≈40，文字基线偏高，需向下微调
    const TEXT_Y_OFFSET = 16 + (_IS_MOBILE ? -30 : 0);
    ctx.fillStyle = '#F3DB9E';
    ctx.font = `${48 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const nameY = infoY + 20 + TEXT_Y_OFFSET;
    ctx.fillText(item.name || '', infoX + infoW / 2, nameY);
    // Python Font.get_height() 对 48px 字体返回 ≈ 55px
    const nameTextH = 55;

    // 描述（与 Python inventory_desc_font 40px 一致）
    const descText = item.description || '';
    ctx.fillStyle = '#000';
    ctx.font = `${40 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
    ctx.textAlign = 'left';
    const descMargin = 60;
    const descLines = _invWrapText(descText, ctx.font, infoW - descMargin);
    // Python desc_font.get_linesize() 对 40px 字体返回 ≈ 52px
    const lineHeight = 52;
    const descStartY = nameY + nameTextH + 15 + (_IS_MOBILE ? 30 : 0);
    const availH = infoBoxHeight - (descStartY - infoY) - 20;
    const maxLines = Math.min(Math.max(1, Math.floor(availH / lineHeight)), descLines.length);
    for (let i = 0; i < maxLines; i++) {
      ctx.fillText(descLines[i], infoX + descMargin / 2, descStartY + i * lineHeight);
    }

  }

  // ── 返回按钮（举证对白模式不显示） ──
  if (!gameState._inProofInterrupt) {
    const bkX = Math.round((DESIGN_W - showButtonWidth) / 2);
    const bkY = controlY + buttonHeight + infoBoxHeight;
    const bkHover = !_IS_MOBILE && _invIsHover(mouse.canvasX, mouse.canvasY, bkX, bkY, showButtonWidth, buttonHeight);
    _invDrawButton(ctx, bkX, bkY, showButtonWidth, buttonHeight, bkHover, '【返回】', true);
    _invStoreRect('back', bkX, bkY, showButtonWidth, buttonHeight);
    // ── 移动端高亮：绘制 _high.png + 重绘文字 ──
    if (_invBtnHighlight && _invBtnHighlight.name === 'back') {
      const hImg = getImage('UI_button_01_high.png');
      if (hImg) {
        const sh = _IS_MOBILE ? buttonHeight * UI_SCALE : buttonHeight;
        ctx.drawImage(hImg, bkX, bkY, showButtonWidth, sh);
        ctx.fillStyle = '#000';
        ctx.font = `bold ${42 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('【返回】', bkX + showButtonWidth / 2, bkY + sh / 2 + 42 * UI_SCALE * 0.08);
        ctx.textAlign = 'left';
      }
    }
    // ── 手柄图标：返回按钮 → B 键（与 Python 一致） ──
    if (gamepad.usingGamepad) {
      drawGamepadIcon(ctx, 'b', { x: bkX, y: bkY, w: showButtonWidth, h: buttonHeight }, 4, -40);
    }
  }

  // ── 切换按钮（竖排文字，右侧） ──
  const toggleScale = 0.6;
  const toggleImg = getImage('UI_button_13.png');
  const toggleImgHov = getImage('UI_button_13_high.png');
  if (toggleImg) {
    const tw = Math.round(toggleImg.naturalWidth * toggleScale);
    const th = Math.round(toggleImg.naturalHeight * toggleScale);
    const tx = 1811 - tw / 2;
    const ty = 173 - th / 2;
    const togHover = !_IS_MOBILE && _invIsHover(mouse.canvasX, mouse.canvasY, tx, ty, tw, th);
    ctx.drawImage(togHover && toggleImgHov ? toggleImgHov : toggleImg, tx, ty, tw, th);

    const label = isCharacterMode ? '切换物品' : '切换人物';
    ctx.fillStyle = '#000';
    ctx.font = `bold ${36 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ch = 36, sp = 12;
    const totalH = label.length * ch + (label.length - 1) * sp;
    const textStartY = ty + (th - totalH) / 2;
    for (let i = 0; i < label.length; i++) {
      ctx.fillText(label[i], tx + tw / 2, textStartY + i * (ch + sp) + ch / 2);
    }
    ctx.textAlign = 'left';
    _invStoreRect('toggle', tx, ty, tw, th);

    // ── 手柄图标：切换按钮 → RB 键（按钮底部下方，与 Python 一致） ──
    if (gamepad.usingGamepad) {
      drawGamepadIconBelow(ctx, 'rb', { x: tx, y: ty, w: tw, h: th }, -30, 0, 0);
    }
  }
}

// ==================== 点击处理 ====================

function inventoryCanvasClick(mx, my) {
  if (!gameState || gameState._subMenu !== 'inventory') return false;

  if (_invHitRect('leftArrow', mx, my))  { try { playSound('sfx_ui_cursor_move'); } catch (_) {} gameState.inventoryPrev(); return true; }
  if (_invHitRect('rightArrow', mx, my)) { try { playSound('sfx_ui_cursor_move'); } catch (_) {} gameState.inventoryNext(); return true; }
  if (_invHitRect('show', mx, my)) {
    try { playSound('sfx_ui_confirm'); } catch (_) {}
    if (_IS_MOBILE) activateMobileGuard(500);
    if (gameState.inventoryAction === 'show') {
      gameState.inventoryShowItem();
    } else if (gameState.inventoryAction === 'proof') {
      gameState.inventoryShowItem();
    } else {
      gameState.inventoryShowThought();
    }
    return true;
  }
  if (_invHitRect('back', mx, my))       { try { playSound('sfx_ui_confirm'); } catch (_) {} _hideInventory(); return true; }
  if (_invHitRect('toggle', mx, my))     { gameState.toggleInventoryMode(); return true; }

  // 点击卡片（与 drawInventoryCanvas 同样的布局计算）
  const isCharacterMode = (gameState.inventoryMode === 'character');
  const totalCount = isCharacterMode ? gameState.getCharacterList().length : gameState.inventory.length;
  if (totalCount <= 0) return false;

  const baseCardSize = Math.min(DESIGN_W * 0.08, DESIGN_H * 0.1);
  const cardW = Math.round(baseCardSize * 1.5);
  const cardSpacing = Math.round(DESIGN_W * 0.055);
  const cols = Math.min(5, totalCount);
  const totalItemsWidth = cols * cardW + (cols - 1) * cardSpacing;
  let startX = (DESIGN_W - totalItemsWidth) / 2;
  const margin = 40;
  if (startX < margin) startX = margin;
  if (startX + totalItemsWidth > DESIGN_W - margin) startX = DESIGN_W - margin - totalItemsWidth;
  startX = Math.round(startX);
  const startY = Math.round(DESIGN_H * 0.09);
  const centerCol = Math.floor(cols / 2);
  const half = centerCol;

  for (let col = 0; col < cols; col++) {
    const cx = startX + col * (cardW + cardSpacing);
    if (mx >= cx && mx <= cx + cardW && my >= startY && my <= startY + cardW) {
      let itemIdx = (gameState.selectedItemIndex + col - half) % totalCount;
      if (itemIdx < 0) itemIdx += totalCount;
      if (itemIdx === gameState.selectedItemIndex) {
        if (gameState.inventoryAction === 'show') {
          gameState.inventoryShowItem();
        } else if (gameState.inventoryAction === 'proof') {
          gameState.inventoryShowItem();
        } else {
          gameState.inventoryShowThought();
        }
      } else {
        gameState.selectedItemIndex = itemIdx;
      }
      return true;
    }
  }
  return false;
}

// ── 移动端触摸：轻触显示高亮图，120ms 后触发 ──
(function () {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const DELAY = 120;
  const HOVER_IMAGES = { show: 'UI_button_02_high.png', back: 'UI_button_01_high.png' };
  canvas.addEventListener('touchstart', (e) => {
    if (!_IS_MOBILE || !gameState || gameState._subMenu !== 'inventory') return;
    if (isMobileGuardActive()) return;
    const t = e.touches[0];
    if (!t) return;
    const pos = screenToCanvas(t.clientX, t.clientY);
    const mx = pos.x, my = pos.y;
    function hit(name) { return _invHitRect(name, mx, my); }
    let btnName = null;
    if (hit('show')) btnName = 'show';
    else if (hit('back')) btnName = 'back';
    if (!btnName) return;
    activateMobileGuard();
    const r = _invRects[btnName];
    _invBtnHighlight = { name: btnName, x: r.x, y: r.y, w: r.w, h: r.h, timer: null };
    _invBtnHighlight.timer = setTimeout(() => {
      _invBtnHighlight = null;
      inventoryCanvasClick(mx, my);
    }, DELAY);
  }, { passive: false });
})();
