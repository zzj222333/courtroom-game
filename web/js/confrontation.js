// ==================== 质问系统 ====================
// 逆转裁判风格对峙——游戏中最复杂的模块
// UI 完全对齐 Python 原型：陈述文本在对话框中渲染，Canvas 叠加箭头/按钮/计数器
// 注意：Canvas 内部分辨率 = DESIGN_W × DESIGN_H，所有坐标直接用设计坐标，不需要乘 scale

// ── 布局常量（与 Python draw_confrontation_arrows_and_buttons 一致，均为设计坐标）──
const CONFRONT_BTN_W = 720;              // MENU_WIDTH
const CONFRONT_BTN_H = 72;               // MENU_ITEM_HEIGHT
const CONFRONT_ARROW_SIZE = 72 * 2;      // MENU_ITEM_HEIGHT * 2
const CONFRONT_ARROW_GAP = -15;          // 箭头与对话框间距
const CONFRONT_COUNTER_X = 762;           // 陈述计数器 X 中心（与 Python 一致）
const CONFRONT_COUNTER_Y = 1050;          // 陈述计数器 Y 中心（与 Python 一致）

// ── 陈述开始动画常量（与 Python CONFRONT_INTRO_BUTTON 一致）──
const CONFRONT_INTRO_BTN_W = 600;        // CONFRONT_INTRO_BUTTON_WIDTH
const CONFRONT_INTRO_BTN_H = 129;        // CONFRONT_INTRO_BUTTON_HEIGHT
const CONFRONT_INTRO_SLIDE_IN = 0.5;     // 滑入时长（秒）
const CONFRONT_INTRO_HOLD = 1.0;         // 停留时长（秒）
const CONFRONT_INTRO_SLIDE_OUT = 0.5;    // 滑出时长（秒）

// ── 按钮滑入动画状态 ──
let _confrontBtnOffset = -CONFRONT_BTN_W; // 初始在屏幕左侧外
let _confrontBtnAnimActive = false;

// ── 陈述开始动画状态 ──
let _introAnimPhase = 'none';    // none | slide_in | hold | slide_out
let _introAnimTimer = 0;
let _introAnimOffset = -CONFRONT_INTRO_BTN_W;
let _introAnimAlpha = 0;
let _introAnimNodeId = null;     // 缓存的质问节点ID

/** 启动陈述开始动画（与 Python start_confrontation_statement 一致）
 *  从左侧滑入"陈述开始"按钮，停留后滑出，然后进入实际质问
 */
function startConfrontIntroAnim(nodeId) {
  const node = scenarioData.nodes[nodeId];
  if (!node || node.type !== 'confrontation_statement') {
    // 无节点直接开始质问
    startConfrontation(nodeId);
    return;
  }
  const gs = gameState;
  // 设置立绘（与 Python 一致：动画期间显示被质问者）
  if (node.speaker) {
    gs.setDisplayCharacter(node.speaker, node.side || 'right', '01');
  }
  _introAnimNodeId = nodeId;
  _introAnimPhase = 'slide_in';
  _introAnimTimer = CONFRONT_INTRO_SLIDE_IN;
  _introAnimOffset = -CONFRONT_INTRO_BTN_W;
  _introAnimAlpha = 0;
  gs.mode = 'confrontation_intro_anim';
  try { playSound('sfx_dialogue_confront_intro'); } catch (_) {}
  console.log(`[Confront] 陈述开始动画: ${nodeId}`);
}

/** 陈述开始动画更新（每帧调用） */
function updateIntroAnim(dt) {
  const gs = gameState;
  if (!gs || gs.mode !== 'confrontation_intro_anim') return;

  _introAnimTimer -= dt;

  if (_introAnimPhase === 'slide_in') {
    if (_introAnimTimer <= 0) {
      _introAnimOffset = 0;
      _introAnimAlpha = 255;
      _introAnimPhase = 'hold';
      _introAnimTimer = CONFRONT_INTRO_HOLD;
    } else {
      const progress = 1.0 - (_introAnimTimer / CONFRONT_INTRO_SLIDE_IN);
      _introAnimOffset = -CONFRONT_INTRO_BTN_W + progress * CONFRONT_INTRO_BTN_W;
      _introAnimAlpha = Math.round(255 * progress);
    }
  } else if (_introAnimPhase === 'hold') {
    _introAnimAlpha = 255;
    if (_introAnimTimer <= 0) {
      _introAnimPhase = 'slide_out';
      _introAnimOffset = 0;
      _introAnimTimer = CONFRONT_INTRO_SLIDE_OUT;
    }
  } else if (_introAnimPhase === 'slide_out') {
    if (_introAnimTimer <= 0) {
      _introAnimPhase = 'none';
      _introAnimOffset = CONFRONT_INTRO_BTN_W;
      _introAnimAlpha = 0;
      // 动画结束，进入实际质问
      const nodeId = _introAnimNodeId;
      _introAnimNodeId = null;
      startConfrontation(nodeId);
    } else {
      const progress = 1.0 - (_introAnimTimer / CONFRONT_INTRO_SLIDE_OUT);
      _introAnimOffset = progress * CONFRONT_INTRO_BTN_W;
      _introAnimAlpha = Math.round(255 * (1 - progress));
    }
  }
}

/** 绘制陈述开始动画（Canvas 叠加层） */
function drawIntroAnim() {
  const gs = gameState;
  if (!gs || gs.mode !== 'confrontation_intro_anim' || _introAnimAlpha <= 0) return;

  const btnW = CONFRONT_INTRO_BTN_W;
  const btnH = CONFRONT_INTRO_BTN_H;
  const baseX = (DESIGN_W - btnW) / 2;
  const baseY = (DESIGN_H - btnH) / 2;
  const x = baseX + _introAnimOffset;

  ctx.globalAlpha = _introAnimAlpha / 255;

  // 底图 UI_button_08.png（与 Python get_confront_intro_button_background 一致）
  const bg = getImage('UI_button_08.png');
  if (bg) {
    ctx.drawImage(bg, x, baseY, btnW, btnH);
  } else {
    ctx.fillStyle = 'rgba(200,200,200,0.8)';
    _roundRectPath(ctx, x, baseY, btnW, btnH, 12);
    ctx.fill();
  }

  // "陈述开始" 文字
  ctx.fillStyle = '#000';
  ctx.font = `${50 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('陈述开始', x + btnW / 2, baseY + btnH / 2);

  ctx.globalAlpha = 1;
}

/** 开始质问（实际启动，由动画结束后或直接调用） */
function startConfrontation(nodeId) {
  const node = scenarioData.nodes[nodeId];
  if (!node || node.type !== 'confrontation_statement') {
    console.error(`[Confront] 无效节点: ${nodeId}`);
    return;
  }

  const gs = gameState;
  gs.mode = 'confrontation';
  gs.currentNodeId = nodeId;
  gs.confrontationState = node;
  // 确保 __node_id__ 已设置（用于持久化键和 retry 恢复）
  if (!node.__node_id__) node.__node_id__ = nodeId;

  // 清除序列节点残留状态（关键：防止追问/举证对话结束后 currentSequenceNode.next 导致意外跳转）
  gs.currentSequenceNode = null;
  gs.currentSequenceNodeId = null;
  gs.pendingProofFailResume = false;

  // 与 Python 一致：检查是否有持久化的修改数据（追问/举证导致的替换或追加）
  const confrontNodeId = node.__node_id__ || nodeId;
  const persisted = gs.confrontationPersistedStatements[confrontNodeId];
  if (persisted && persisted.statements) {
    gs.confrontationStatements = JSON.parse(JSON.stringify(persisted.statements));
    gs.confrontationIndex = persisted.index || 0;
    // 与 Python 一致：从原始数据恢复未消费的 append 数据（防止重入丢失追加陈述）
    const origStmts = node.statements || [];
    for (let i = 0; i < gs.confrontationStatements.length && i < origStmts.length; i++) {
      const stmt = gs.confrontationStatements[i];
      const orig = origStmts[i];
      if (stmt._has_appended) continue; // 已消费，跳过
      if (orig.append_statements && !stmt.append_statements) {
        stmt.append_statements = orig.append_statements;
        stmt.result_type = orig.result_type || 3;
      } else if (orig.append_statement && !stmt.append_statement) {
        stmt.append_statement = orig.append_statement;
        stmt.result_type = orig.result_type || 3;
      }
    }
    console.log(`[Confront] 从持久化恢复: nodeId=${confrontNodeId}, ${gs.confrontationStatements.length} 句, index=${gs.confrontationIndex}`);
  } else {
    gs.confrontationStatements = JSON.parse(JSON.stringify(node.statements || []));
    gs.confrontationIndex = 0;
  }
  // 写回持久化（确保当前数据被记录）
  if (!gs.confrontationPersistedStatements[confrontNodeId]) {
    gs.confrontationPersistedStatements[confrontNodeId] = {};
  }
  gs.confrontationPersistedStatements[confrontNodeId].statements = gs.confrontationStatements;
  gs.confrontationPersistedStatements[confrontNodeId].index = gs.confrontationIndex;
  gs.confrontationShowButtons = true;
  gs.confrontationButtonFocus = _IS_MOBILE ? -1 : 0;
  gs.confrontationPendingOutro = false;
  gs.confrontationDoneFlag = null;
  gs.confrontationProofActive = false;
  gs.confrontationProofTarget = null;
  gs._confrontBtnHasAnimated = false;
  gs._summaryBtnRects = null;   // 防止上一次残留的 summary 矩形拦截点击
  gs._summaryOptions = null;

  // 设置说话人
  if (node.speaker) {
    gs.setDisplayCharacter(node.speaker, node.side || 'right', '01');
  }

  // 设置背景（如果有）
  if (node.background) {
    gs.currentBgName = node.background;
    setBackground(node.background);
  }

  // 保存进入质问前的 BGM（与 Python confrontation_prev_bgm 一致）
  gs._confrontationPrevBgm = gs.currentBgm;

  // BGM 切换
  if (node.confrontation_bgm) {
    gs.currentBgm = node.confrontation_bgm;
    try { playBgm(node.confrontation_bgm, 0); } catch (_) {}
  }

  // 按钮滑入动画重置（从左侧外滑入）
  _confrontBtnOffset = -CONFRONT_BTN_W;
  _confrontBtnAnimActive = true;
  gs._confrontBtnHasAnimated = true;

  // 显示当前陈述在对话框中（与 Python show_current_statement 一致）
  _showConfrontStatementDialog();

  console.log(`[Confront] 开始质问: ${nodeId}, ${gs.confrontationStatements.length} 句陈述`);
}

/** 触发 outro（最后一句右箭头或全部陈述追问完毕后调用） */
function _triggerConfrontOutro() {
  const gs = gameState;
  if (!gs || !gs.confrontationState) return;
  gs.confrontationPendingOutro = true;
  // 获取 outro 节点（支持 outro_override）
  let outro = gs.confrontationState.outro;
  const nodeId = gs.currentNodeId;
  if (nodeId && gs.confrontationPersistedStatements && gs.confrontationPersistedStatements[nodeId]) {
    const persisted = gs.confrontationPersistedStatements[nodeId];
    if (persisted && persisted.outro_override) {
      outro = persisted.outro_override;
    }
  }
  if (outro) {
    gs.mode = 'dialogue';
    hideConfrontCounter();
    gs.enterNode(outro);
    return;
  }
  // 无 outro 节点：直接显示总结界面
  showConfrontationSummary();
}

/** 在对话框中显示当前陈述文本（与 Python show_current_statement 一致，带逐字打字效果） */
function _showConfrontStatementDialog() {
  const gs = gameState;
  if (!gs || !gs.confrontationState) return;
  const stmt = gs.confrontationStatements[gs.confrontationIndex];
  if (!stmt) return;
  // 与 Python 一致：支持 per-statement speaker_override / side_override
  let speakerId = gs.confrontationState.speaker;
  let side = gs.confrontationState.side || 'right';
  if (stmt.speaker_override) speakerId = stmt.speaker_override;
  if (stmt.side_override) side = stmt.side_override;
  // 更新立绘（如果说话人或侧边发生变化）
  if (speakerId && (speakerId !== gs.displaySpeaker || side !== gs.displaySide)) {
    gs.setDisplayCharacter(speakerId, side, '01');
  }
  const speakerName = gs.getCharacterInfo(speakerId)?.name || speakerId;

  // 设置打字机状态（与 startDialogue 一致）
  gs.fullText = stmt.text || '';
  gs.textOffset = 0;
  gs.typingIndex = 0;
  gs.textPageEnd = gs.fullText.length; // 陈述框不使用分页
  gs.typingComplete = false;
  gs.lastTypingSoundChar = -1;

  // 打字音效（与 startDialogue 一致）
  const info = gs.getCharacterInfo(speakerId);
  const gender = (info && info.gender) ? info.gender : 'male';
  if (gs.fullText.indexOf('内心独白') !== -1) {
    gs.currentTypingSound = 'sfx_dialogue_inner_voice';
  } else if (gender === 'female') {
    gs.currentTypingSound = 'sfx_dialogue_typing_female';
  } else {
    gs.currentTypingSound = 'sfx_dialogue_typing_male';
  }

  // 陈述框固定偏左：始终按 right 站位显示对话框（与 Python 一致）
  gs._confrontFixedSide = 'right';

  // 显示对话框（名字 + 空文本，打字机逐字填充）
  showDialogBox(speakerName, '');
  // 质问模式下跳过按钮始终隐藏（showDialogBox 会默认显示它，必须立即关掉避免闪烁）
  if (skipBtnEl) skipBtnEl.style.display = 'none';
  showHintArrow(false);

  // 打字完成后回调：显示按钮
  gs._confrontTypingDoneCb = true;
}

/** 选择指定索引的陈述 */
function selectConfrontationStatement(index) {
  const gs = gameState;
  if (!gs || gs.mode !== 'confrontation') return;
  if (index < 0 || index >= gs.confrontationStatements.length) return;
  gs.confrontationIndex = index;
}

/** 执行追问 */
function executeFollowUp() {
  const gs = gameState;
  if (!gs || gs.mode !== 'confrontation') return;
  if (gs.confrontationPendingOutro) return;

  const stmt = gs.confrontationStatements[gs.confrontationIndex];
  if (!stmt || !stmt.follow_up) {
    console.log('[Confront] 当前陈述无追问');
    return;
  }

  const followNode = scenarioData.nodes[stmt.follow_up];
  if (!followNode) {
    console.error(`[Confront] 追问节点不存在: ${stmt.follow_up}`);
    return;
  }

  console.log(`[Confront] === 追问开始 === idx=${gs.confrontationIndex} follow_up=${stmt.follow_up} result_type=${stmt.result_type}`);
  console.log(`[Confront] 当前陈述数据:`, JSON.stringify(stmt, null, 2));

  // 保存质问恢复状态
  gs.confrontationResumeState = {
    prevIndex: gs.confrontationIndex,
    stmt: stmt,
    resultType: stmt.result_type || 1,
    updateText: stmt.update_text || null,
    newFollowUp: stmt.new_follow_up || null,
    appendStmt: stmt.append_statement || null,
    appendStmts: stmt.append_statements || null
  };

  // 与 Python 一致：若陈述定义了 set_outro，持久化到 outro_override，永久替换节点默认 outro
  if (stmt.set_outro && gs.confrontationState) {
    const pid = gs.currentNodeId;
    if (pid) {
      if (!gs.confrontationPersistedStatements[pid]) {
        gs.confrontationPersistedStatements[pid] = {};
      }
      gs.confrontationPersistedStatements[pid].outro_override = stmt.set_outro;
      console.log(`[Confront] set_outro 持久化: ${stmt.set_outro}`);
    }
  }

  // 切换到对话模式播放追问对话
  try { playSound('voice_ba_wait_01'); } catch (_) {}
  gs.currentSequenceNodeId = stmt.follow_up;
  gs.dialogueQueue = followNode.dialogues || [];
  gs.dialogueIndex = 0;
  gs.mode = 'dialogue';
  gs.startDialogue();
  console.log(`[Confront] 追问开始: ${stmt.follow_up} 共 ${gs.dialogueQueue.length} 句对话`);
}

/** 处理追问结果（在 _onDialogueQueueEnd 中调用） */
function applyFollowUpResult() {
  const gs = gameState;
  const resume = gs.confrontationResumeState;
  if (!resume) {
    console.log('[Confront] applyFollowUpResult: resumeState 为空');
    return;
  }

  const resultType = resume.resultType;
  console.log(`[Confront] === applyFollowUpResult === resultType=${resultType} prevIndex=${resume.prevIndex}`);

  switch (resultType) {
    case 1:
      // 推进到下一句
      console.log(`[Confront] resultType=1: 推进索引 ${gs.confrontationIndex} → ${gs.confrontationIndex + 1}`);
      gs.confrontationIndex++;
      break;

    case 2:
      // 更新文本和后续追问，并执行链式替换（与 Python apply_follow_up_result 一致）
      const stmt = resume.stmt || gs.confrontationStatements[resume.prevIndex];
      if (stmt) {
        console.log(`[Confront] case2 处理前 stmt:`, JSON.stringify(stmt, null, 2));
        
        // 更新文本（pop 语义：消费一次性的 update_text）
        if (stmt.update_text !== undefined) {
          console.log(`[Confront] 更新文本: "${stmt.text}" → "${stmt.update_text}"`);
          stmt.text = stmt.update_text;
          delete stmt.update_text;
        } else {
          console.log(`[Confront] 无 update_text，跳过文本更新`);
        }
        
        // 更新后续追问
        if (stmt.new_follow_up !== undefined) {
          console.log(`[Confront] 更新 follow_up: "${stmt.follow_up}" → "${stmt.new_follow_up}"`);
          stmt.follow_up = stmt.new_follow_up;
          delete stmt.new_follow_up;
        } else {
          console.log(`[Confront] 无 new_follow_up，跳过跟进更新`);
        }
        
        // 通用链式替换：将 next_X → X，next_next_X → next_X，……，支持无限层级
        for (const keyBase of ['update_text', 'new_follow_up']) {
          let level = 1;
          while (true) {
            const srcKey = 'next_'.repeat(level) + keyBase;
            const dstKey = 'next_'.repeat(level - 1) + keyBase;
            if (stmt[srcKey] !== undefined) {
              console.log(`[Confront] 链式移位 level=${level}: ${srcKey} → ${dstKey}`);
              stmt[dstKey] = stmt[srcKey];
              delete stmt[srcKey];
              level++;
            } else {
              break;
            }
          }
        }
        
        // 证据链替换（仅支持单层 next_evidence）
        if (stmt.next_evidence !== undefined) {
          console.log(`[Confront] 证据移位: next_evidence → evidence`);
          stmt.evidence = stmt.next_evidence;
          delete stmt.next_evidence;
        }
        
        // 更新 result_type（与 Python 一致）
        if (stmt.append_statement || stmt.append_statements) {
          stmt.result_type = 3;
          console.log(`[Confront] result_type 更新为 3 (有追加陈述)`);
        } else if (stmt.update_text !== undefined) {
          stmt.result_type = 2;
          console.log(`[Confront] result_type 保持 2 (还有下一层 update_text)`);
        } else {
          stmt.result_type = 1;
          console.log(`[Confront] result_type 更新为 1 (无更多更新)`);
        }
        
        console.log(`[Confront] case2 处理后 stmt:`, JSON.stringify(stmt, null, 2));
      } else {
        console.log(`[Confront] case2: stmt 为空！prevIndex=${resume.prevIndex}`);
      }
      // result_type 2 不推进索引
      break;

    case 3:
      // 追加新陈述（与 Python 一致：支持数组和单个，消费原始数据防止重复追加）
      {
        console.log(`[Confront] resultType=3: 追加陈述`);
        // 优先取数组（append_statements），回退到单个（append_statement）
        let appendList = resume.appendStmts;
        if (!appendList && resume.appendStmt) {
          appendList = [resume.appendStmt];
        }
        if (appendList && Array.isArray(appendList) && appendList.length > 0) {
          // 与 Python 一致：为每条新陈述设置默认值
          for (const newStmt of appendList) {
            if (newStmt.result_type === undefined) newStmt.result_type = 1;
            if (newStmt.follow_up === undefined) newStmt.follow_up = null;
          }
          gs.confrontationStatements.splice(resume.prevIndex + 1, 0, ...appendList.map(s => JSON.parse(JSON.stringify(s))));
          console.log(`[Confront] 追加 ${appendList.length} 条陈述完成`);
        }
        // 消费原始陈述的追加数据 + 设置 _has_appended 防止重复追加
        const origStmt = gs.confrontationStatements[resume.prevIndex];
        if (origStmt) {
          delete origStmt.append_statement;
          delete origStmt.append_statements;
          origStmt._has_appended = true;
          origStmt.result_type = 1;
        }
        gs.confrontationIndex++;
        // 同步追加后的陈述到持久化（防止 retry 时丢失追加数据）
        if (gs.confrontationState) {
          const syncId = gs.confrontationState.__node_id__ || gs.currentNodeId;
          if (gs.confrontationPersistedStatements[syncId]) {
            gs.confrontationPersistedStatements[syncId].statements = gs.confrontationStatements;
          console.log(`[Confront] append sync: nodeId=${syncId} ${gs.confrontationStatements.length} 句已持久化`);
          }
        }
      }
      break;
  }

  gs.confrontationResumeState = null;
  console.log(`[Confront] resumeState 已清空`);
  
  // 同步 index 和 statements 到持久化（statements 是深拷贝，需要显式同步）
  if (gs.confrontationState) {
    const nodeId2 = gs.confrontationState.__node_id__ || gs.currentNodeId;
    if (gs.confrontationPersistedStatements[nodeId2]) {
      gs.confrontationPersistedStatements[nodeId2].index = gs.confrontationIndex;
      gs.confrontationPersistedStatements[nodeId2].statements = gs.confrontationStatements;
      console.log(`[Confront] result sync: nodeId=${nodeId2} index=${gs.confrontationIndex} ${gs.confrontationStatements.length} 句`);
    }
  }

  // 检查是否所有陈述都已推进完
  if (gs.confrontationIndex >= gs.confrontationStatements.length) {
    gs.confrontationPendingOutro = true;
    console.log(`[Confront] 所有陈述已推进完，播放 outro`);
    // 自动播放 outro（支持 outro_override，与 Python advance_to_next_statement 一致）
    let outro = gs.confrontationState.outro;
    const nodeId3 = gs.currentNodeId;
    if (nodeId3 && gs.confrontationPersistedStatements && gs.confrontationPersistedStatements[nodeId3]) {
      const persisted3 = gs.confrontationPersistedStatements[nodeId3];
      if (persisted3 && persisted3.outro_override) {
        outro = persisted3.outro_override;
      }
    }
    if (outro) {
      gs.mode = 'dialogue';
      hideConfrontCounter();
      gs.enterNode(outro);
      return;
    }
  }

  // 回到质问模式
  gs.mode = 'confrontation';
  gs.confrontationShowButtons = true;
  gs.confrontationButtonFocus = _IS_MOBILE ? -1 : 0;
  // 按钮已动画过，直接显示
  _confrontBtnOffset = 0;
  _confrontBtnAnimActive = false;
  // 恢复立绘到质问状态（追问时可能切换了说话人）
  const confrontNode = gs.confrontationState;
  if (confrontNode && confrontNode.speaker) {
    gs.setDisplayCharacter(confrontNode.speaker, confrontNode.side || 'right', '01');
  }
  // 显示当前陈述在对话框中
  _showConfrontStatementDialog();
  console.log(`[Confront] 恢复质问模式，当前陈述 ${gs.confrontationIndex + 1}/${gs.confrontationStatements.length}`);
}

/** 执行举证（与 Python execute_proof 一致：始终打开物品选择界面） */
function executeProof() {
  const gs = gameState;
  if (!gs || gs.mode !== 'confrontation') return;
  if (gs.confrontationPendingOutro) return;

  const stmt = gs.confrontationStatements[gs.confrontationIndex];

  // 进入举证模式：打开物品栏，标记为 proof 模式（无论该陈述有无 evidence 配置）
  gs.confrontationProofActive = true;
  gs.confrontationProofTarget = stmt;
  gs.mode = 'menu';
  gs._subMenu = 'inventory';
  if (typeof _invBtnHighlight !== 'undefined') _invBtnHighlight = null;
  gs.inventoryMode = 'item';
  gs.inventoryAction = 'proof';
  gs.selectedItemIndex = 0;
  _menuNeedsRedraw = true;
  try { playSound('sfx_ui_confirm'); } catch (_) {}
  console.log('[Confront] 举证模式：打开物品栏');
}

/** 检查举证结果（在 inventoryShowItem 中调用） */
function checkProof(itemId) {
  const gs = gameState;
  // 与 Python execute_proof 一致：举证瞬间播放 sfx_confront_present
  try { playSound('sfx_confront_present'); } catch (_) {}
  try { playSound('voice_ba_present_01'); } catch (_) {}

  const stmt = gs.confrontationProofTarget;
  if (!stmt || !stmt.evidence) {
    _handleProofFail(itemId);
    return;
  }

  const evidenceEntry = stmt.evidence[itemId];
  if (!evidenceEntry) {
    _handleProofFail(itemId);
    return;
  }

  // 与 Python execute_proof 一致：evidence 映射中的条目需有 "dialogue" 才算成功；
  // 仅有 fail_dialogue 的条目属于"特定物品的特殊失败对白"
  if (!evidenceEntry.dialogue) {
    _handleProofFail(itemId);
    return;
  }

  // 举证成功
  gs.confrontationProofActive = false;
  gs.confrontationProofTarget = null;
  gs.inventoryAction = 'show';

  // 立即设置卡片叠加层（与 Python execute_proof 一致：关闭物品栏前设置，避免视觉闪烁）
  const itemDef = gs._getItemDef(itemId);
  if (itemDef) {
    gs.showingItem = { id: itemId, ...itemDef };
    gs.showingCharacter = null;
    gs.cardOverlayActive = true;
    gs.cardOverlayStay = true;
  }

  // 播放成功对话
  const dialogueNodeId = evidenceEntry.dialogue;
  if (dialogueNodeId) {
    const dlgNode = scenarioData.nodes[dialogueNodeId];
    if (dlgNode && dlgNode.dialogues) {
      // 保存举证效果的 resume 状态
      gs.confrontationResumeState = {
        isProof: true,
        effect: evidenceEntry.effect || {},
        proofBgm: evidenceEntry.proof_bgm || null
      };

      // 处理 proof_bgm：在指定行切换 BGM
      if (evidenceEntry.proof_bgm) {
        const pb = evidenceEntry.proof_bgm;
        gs._pendingProofBgm = pb;
      }

      // 标记待显示证物卡片（防止 startDialogue 清除逻辑误删）
      gs._pendingProofShow = { type: 'item', data: gs.showingItem };

      gs.currentSequenceNodeId = dialogueNodeId;
      gs.dialogueQueue = dlgNode.dialogues;
      gs.dialogueIndex = 0;
      gs.mode = 'dialogue';
      gs.startDialogue();
      console.log(`[Confront] 举证成功: ${itemId} → ${dialogueNodeId}`);
      return;
    }
  }

  // 无对话，直接应用效果
  _applyProofEffect(evidenceEntry.effect || {});
}

/** 检查人物举证结果（与 Python execute_character_proof + _get_character_proof_result 一致） */
function checkCharacterProof(charId) {
  const gs = gameState;
  if (!gs.confrontationState) return;

  const stmt = gs.confrontationStatements[gs.confrontationIndex];
  const currentSpeaker = gs.displaySpeaker || 'Player_Ma';

  // 从 scenarioData.character_proofs[说话人][人物ID] 查找
  const chData = scenarioData.character_proofs;
  if (!chData) { _handleProofFail(); return; }

  const speakerProofs = chData[currentSpeaker];
  if (!speakerProofs) { _handleProofFail(); return; }

  const proofData = speakerProofs[charId];
  if (!proofData) { _handleProofFail(); return; }

  const proofDialogues = proofData.dialogue;
  const proofEffect = proofData.effect || {};

  if (proofDialogues) {
    // 举证成功
    try { playSound('voice_ba_present_01'); } catch (_) {}
    gs.confrontationProofActive = false;
    gs.confrontationProofTarget = null;
    gs.confrontationProofEffect = proofEffect;
    gs.confrontationResumeState = {
      prevIndex: gs.confrontationIndex,
      resultType: 1,
      updateText: null,
      newFollowUp: null,
      appendStmt: null,
      isProof: true,
      effect: proofEffect
    };

    // 立即设置卡片叠加层（与 Python execute_character_proof 一致）
    const chData2 = gs._getChapterData();
    const chChars2 = (chData2.characters || {});
    const chDef = chChars2[charId] || charactersData[charId];
    if (chDef) {
      gs.showingCharacter = { id: charId, ...chDef };
      gs.showingItem = null;
      gs.cardOverlayActive = true;
      gs.cardOverlayStay = true;
    }

    // 标记待显示人物卡片（防止 startDialogue 清除逻辑误删）
    gs._pendingProofShow = { type: 'character', data: gs.showingCharacter };

    gs.currentSequenceNodeId = `char_proof_${currentSpeaker}_${charId}`;
    gs.dialogueQueue = Array.isArray(proofDialogues) ? proofDialogues : [proofDialogues];
    gs.dialogueIndex = 0;
    gs.mode = 'dialogue';
    gs.startDialogue();
    console.log(`[Confront] 人物举证成功: ${charId} → ${currentSpeaker}`);
    return;
  }

  _handleProofFail();
}

/** 举证失败处理（与 Python 一致：调查阶段不扣血，只播放失败对话后回到陈述） */
function _handleProofFail(itemId) {
  const gs = gameState;
  gs.confrontationProofActive = false;
  gs.confrontationProofTarget = null;
  gs.inventoryAction = 'show';

  // 三级查找失败对话（与 Python execute_proof 一致）：
  //   1. stmt.evidence[itemId].fail_dialogue   — 特定物品的特殊失败对白
  //   2. stmt.default_proof_fail_dialogue      — 该陈述的默认失败对白
  //   3. confrontationState.default_proof_fail_dialogue — 节点级默认失败对白
  const stmt = gs.confrontationStatements[gs.confrontationIndex];
  let failNodeId = null;
  if (stmt && stmt.evidence && itemId) {
    const ev = stmt.evidence[itemId];
    if (ev && ev.fail_dialogue) {
      failNodeId = ev.fail_dialogue;
    }
  }
  if (!failNodeId && stmt && stmt.default_proof_fail_dialogue) {
    failNodeId = stmt.default_proof_fail_dialogue;
  }
  if (!failNodeId && gs.confrontationState && gs.confrontationState.default_proof_fail_dialogue) {
    failNodeId = gs.confrontationState.default_proof_fail_dialogue;
  }
  if (failNodeId) {
    // 设置 resume 标记：失败对话结束后恢复陈述模式
    gs.pendingProofFailResume = true;
    const failNode = scenarioData.nodes[failNodeId];
    if (failNode && failNode.dialogues) {
      gs.dialogueQueue = failNode.dialogues;
      gs.dialogueIndex = 0;
      gs.mode = 'dialogue';
      gs.startDialogue();
      console.log(`[Confront] 举证失败，播放失败对话: ${failNodeId}`);
      return;
    }
  }

  // 无失败对话，直接回到陈述
  gs.pendingProofFailResume = false;
  gs.confrontationShowButtons = true;
  gs.mode = 'confrontation';
  // 与 Python 一致：立绘回到质问说话人（陈述者）
  if (gs.confrontationState && gs.confrontationState.speaker) {
    gs.setDisplayCharacter(gs.confrontationState.speaker, gs.confrontationState.side || 'right', '01');
  }
  _showConfrontStatementDialog();
  console.log('[Confront] 举证失败，无失败对话，回到陈述');
}

/** 应用举证效果 */
function _applyProofEffect(effect) {
  const gs = gameState;

  if (effect.set_flag) {
    for (const [k, v] of Object.entries(effect.set_flag)) {
      gs.flags[k] = v;
    }
    // 背景全局替换（与 Python bg_triggers 一致）
    try { applyBgTriggers(gs.flags); } catch (_) {}
  }

  if (effect.trigger_event) {
    // trigger_event 特殊处理：事件播放后自动恢复流程
    const resumeState = {
      mode: 'confrontation',
      _invResumeNode: effect.trigger_event.resume_node || null,
      _invSuccessIcon: effect.trigger_event.success_icon || false
    };
    gs.mode = 'event_trigger';
    gs.triggerEvent(effect.trigger_event, resumeState);
    return;
  }

  // 独立质问胜利（不带事件），仅播放胜利图标动画（与 Python apply_proof_effect 一致）
  if (effect.confrontation_success) {
    const cs = effect.confrontation_success;
    startConfrontationSuccess(cs.resume_node);
    return;
  }

  // 结束质问（与 Python 一致：进入 outro 或直接返回）
  if (effect.end_confrontation) {
    gs.confrontationPendingOutro = true;
    let outro = gs.confrontationState?.outro;
    const nid = gs.currentNodeId;
    if (nid && gs.confrontationPersistedStatements?.[nid]?.outro_override) {
      outro = gs.confrontationPersistedStatements[nid].outro_override;
    }
    if (outro) {
      gs.mode = 'dialogue';
      hideConfrontCounter();
      gs.enterNode(outro);
      return;
    }
    return;
  }

  // 否则应用类似追问的效果（与 Python apply_proof_effect 的 result_type 分支一致）
  const idx = gs.confrontationIndex;
  const resultType = effect.result_type || 1;
  if (resultType === 1) {
    // 推进到下一句
    gs.confrontationIndex++;
  } else if (resultType === 2) {
    // 更新当前陈述文本与追问，并支持连锁更新（next_*）与证据表替换（new_evidence）
    const stmt = gs.confrontationStatements[idx];
    if (stmt) {
      if (effect.update_text) stmt.text = effect.update_text;
      if (effect.new_follow_up) stmt.follow_up = effect.new_follow_up;
      // 支持举证后继续追问替换：将 next_* 写回 stmt，待下次追问时消费
      if (effect.next_update_text) stmt.update_text = effect.next_update_text;
      if (effect.next_new_follow_up) stmt.new_follow_up = effect.next_new_follow_up;
      // 支持举证后更新证据映射表（用于连锁举证）
      if (effect.new_evidence) stmt.evidence = effect.new_evidence;
      // 保持 result_type=2 以便下一次追问可触发更新（与 Python 一致）
      stmt.result_type = 2;
    }
  } else if (resultType === 3) {
    // 追加新陈述（支持数组和单个，与 Python apply_proof_effect 一致）
    let appendList = effect.append_statements;
    if (!appendList && effect.append_statement) {
      appendList = [effect.append_statement];
    }
    if (appendList && Array.isArray(appendList) && appendList.length > 0) {
      for (const newStmt of appendList) {
        if (newStmt.result_type === undefined) newStmt.result_type = 1;
        if (newStmt.follow_up === undefined) newStmt.follow_up = null;
      }
      gs.confrontationStatements.splice(idx + 1, 0, ...appendList.map(s => JSON.parse(JSON.stringify(s))));
    }
    gs.confrontationIndex++;
  }

  // 与 Python 一致：set_outro 举证后永久替换节点默认 outro
  if (effect.set_outro && gs.confrontationState) {
    const pid = gs.currentNodeId;
    if (pid) {
      if (!gs.confrontationPersistedStatements[pid]) {
        gs.confrontationPersistedStatements[pid] = {};
      }
      gs.confrontationPersistedStatements[pid].outro_override = effect.set_outro;
      console.log(`[Confront] 举证 set_outro 持久化: ${effect.set_outro}`);
    }
  }

  // 同步持久化索引
  if (gs.confrontationState) {
    const nodeId2 = gs.confrontationState.__node_id__ || gs.currentNodeId;
    if (gs.confrontationPersistedStatements[nodeId2]) {
      gs.confrontationPersistedStatements[nodeId2].index = gs.confrontationIndex;
    }
  }

  // 检查是否所有陈述都已推进完
  if (gs.confrontationIndex >= gs.confrontationStatements.length) {
    gs.confrontationPendingOutro = true;
    let outro = gs.confrontationState?.outro;
    const nid2 = gs.currentNodeId;
    if (nid2 && gs.confrontationPersistedStatements?.[nid2]?.outro_override) {
      outro = gs.confrontationPersistedStatements[nid2].outro_override;
    }
    if (outro) {
      gs.mode = 'dialogue';
      hideConfrontCounter();
      gs.enterNode(outro);
      return;
    }
  }

  // 回到质问模式并重新显示当前陈述（文本可能已被 update_text 替换）
  gs.mode = 'confrontation';
  gs.confrontationShowButtons = true;
  gs.confrontationButtonFocus = _IS_MOBILE ? -1 : 0;
  _confrontBtnOffset = 0;
  _confrontBtnAnimActive = false;
  // 恢复立绘到质问说话人
  if (gs.confrontationState && gs.confrontationState.speaker) {
    gs.setDisplayCharacter(gs.confrontationState.speaker, gs.confrontationState.side || 'right', '01');
  }
  _showConfrontStatementDialog();
}

/** 质问胜利动画（与 Python start_confrontation_success 一致：复用事件胜利图标动画） */
function startConfrontationSuccess(resumeNode) {
  const gs = gameState;
  gs.confrontationShowButtons = false;
  _confrontBtnAnimActive = false;
  _confrontBtnOffset = -CONFRONT_BTN_W;

  // 切到 event_trigger 模式：阻止 tryAdvanceDialogue 接收二次点击；
  // 胜利图标动画（eventPhase=success_icon）由 updateEventState / drawEvent 处理
  gs.mode = 'event_trigger';

  // 设置胜利图标动画（复用 event_success_icon_* 字段，与 Python / triggerEvent 一致）
  const iconImg = getImage('UI_success_01.png');
  const imgSize = Math.round(DESIGN_H * 0.25 * gs._EVENT_IMAGE_SCALE);
  const iconH = Math.round(imgSize * 0.35);
  const iconW = iconImg ? Math.round(iconImg.naturalWidth * iconH / (iconImg.naturalHeight || 1)) : 0;
  gs.successIconW = iconW;
  gs.successIconH = iconH;
  gs.successIconCx = DESIGN_W / 2;
  gs.successIconCy = DESIGN_H / 2;
  gs.successIconOffset = -iconW;
  gs.successIconAlpha = 0;
  gs.successIconPhase = 'slide_in';
  gs.successIconTimer = 0.5;
  gs.eventPhase = 'success_icon';
  gs.eventImage = null; // 无事件底图，仅显示胜利图标
  gs.eventResume = { next_node: resumeNode };
  // 与 Python 一致：胜利图标出场时播放音效
  try { playSound('sfx_puzzle_success'); } catch (_) {}
  console.log(`[Confront] 质问胜利动画 → ${resumeNode}`);
}

/** 展示质问总结界面
 *  @param {object|boolean} summaryConfig - 序列节点的 confrontation_summary 配置
 *      对象 → 审理质问模式（显示"再来一遍"/"保存游戏"）
 *      true  → 调查质问模式（显示"再问一遍"/"结束质问"）
 */
function showConfrontationSummary(summaryConfig) {
  const gs = gameState;
  gs.mode = 'confrontation';
  gs.confrontationSummaryConfig = (summaryConfig && typeof summaryConfig === 'object') ? summaryConfig : null;
  gs.confrontationShowButtons = false;
  gs.confrontationPendingOutro = true;

  // 区分案情审理和调查质问（与 Python draw_confrontation_summary 一致）
  const isTrial = !!gs.confrontationSummaryConfig;
  gs._summaryOptions = isTrial
    ? [
        { text: '再来一遍', action: 'retry' },
        { text: '保存游戏', action: 'save' }
      ]
    : [
        { text: '再问一遍', action: 'retry' },
        { text: '结束质问', action: 'end' }
      ];
  gs._summaryFocus = _IS_MOBILE ? -1 : 0;

  // 审理模式：设置立绘和概要文字
  if (isTrial) {
    const cfg = gs.confrontationSummaryConfig;
    if (cfg.speaker) {
      gs.setDisplayCharacter(cfg.speaker, cfg.side || 'left', cfg.expression || '01');
    }
  }

  // ── 将总结文本注入打字机系统（与 Python self.full_text = prompt_text 一致） ──
  const summaryText = (isTrial && gs.confrontationSummaryConfig && gs.confrontationSummaryConfig.text)
    ? gs.confrontationSummaryConfig.text
    : '好吧，看来话都说完了。不知有没有遗漏什么细节，要不要重新问一遍呢？';
  const speakerName = (isTrial && gs.confrontationSummaryConfig && gs.confrontationSummaryConfig.speaker)
    ? (gs.getCharacterInfo(gs.confrontationSummaryConfig.speaker)?.name || gs.confrontationSummaryConfig.speaker)
    : (gs.getCharacterInfo('Player_Ba')?.name || '包尚');

  // 临时切换 mode 为 dialogue，让 showDialogBox 使用普通对话框样式
  const savedMode = gs.mode;
  gs.mode = 'dialogue';
  showDialogBox(speakerName, '');
  gs.mode = savedMode;

  // 注入文本到打字机系统
  gs.fullText = summaryText;
  gs.textOffset = 0;
  gs.typingIndex = 0;
  gs.typingComplete = false;
  gs.textPageEnd = summaryText.length;
  gs.textPageStart = 0;
  gs.textPages = [summaryText];

  // 更新对话框文本（由打字机系统逐字显示）
  updateDialogText(summaryText, 'confrontation');

  // 确保对话框可见
  if (dialogBoxEl) dialogBoxEl.style.display = 'block';
  if (nameBoxEl) nameBoxEl.style.display = 'block';
}

/** 处理总结界面选择 */
function handleSummarySelect(action) {
  const gs = gameState;
  console.log(`[SummarySelect] action=${action} summaryBtnRects=${gs._summaryBtnRects != null} confrontState=${gs.confrontationState != null}`);

  // ── 保存游戏（审理质问专用，与 Python 一致） ──
  if (action === 'save') {
    gs._confrontationSummaryExitRequested = true;
    gs._subMenu = 'options_menu';
    gs.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
    playSound('sfx_ui_confirm');
    return;
  }

  if (action === 'retry') {
    gs._confrontationSummaryExitRequested = false;
    // 重置到第一句
    gs.confrontationIndex = 0;
    gs.confrontationPendingOutro = false;
    gs._summaryOptions = null;
    gs._summaryBtnRects = null;
    // 重置索引但保留持久化数据（追问过的陈述不会丢失）
    const node = gs.confrontationState;
    if (node) {
      const nodeId2 = node.__node_id__;
      if (!nodeId2) {
        console.error('[SummarySelect] retry: confrontationState.__node_id__ 为空!');
      }
      // 从持久化恢复（深拷贝以断开引用，再写回持久化确保后续修改可追踪）
      const statementsCopy = (() => {
        const p = nodeId2 ? gs.confrontationPersistedStatements[nodeId2] : null;
        return (p && p.statements) ? JSON.parse(JSON.stringify(p.statements)) : JSON.parse(JSON.stringify(node.statements || []));
      })();
      gs.confrontationStatements = statementsCopy;
      // 写回持久化（新副本成为持久化的主数据）
      if (nodeId2) {
        if (!gs.confrontationPersistedStatements[nodeId2]) {
          gs.confrontationPersistedStatements[nodeId2] = {};
        }
        gs.confrontationPersistedStatements[nodeId2].statements = statementsCopy;
        gs.confrontationPersistedStatements[nodeId2].index = 0;
      }
      // 恢复 currentNodeId 到陈述节点（outro 播放后可能已被覆盖）
      gs.currentNodeId = nodeId2;
      console.log(`[SummarySelect] retry: nodeId=${nodeId2} ${gs.confrontationStatements.length} 句`);
      console.log(`[SummarySelect] retry persistence:`, JSON.stringify(nodeId2 ? gs.confrontationPersistedStatements[nodeId2] : null));
      // 恢复立绘（outro对话结束时可能被清掉）
      if (node.speaker) {
        gs.setDisplayCharacter(node.speaker, node.side || 'right', '01');
      }
    }
    gs.confrontationShowButtons = true;
    gs.mode = 'confrontation';
    // 重新显示陈述对话框
    _showConfrontStatementDialog();
  } else {
    gs._confrontationSummaryExitRequested = false;
    // 结束质问：重置持久化索引（下次进入从第一句开始），但保留陈述数据（追问结果不丢失）
    if (gs.confrontationState) {
      const endNodeId = gs.confrontationState.__node_id__ || gs.currentNodeId;
      if (gs.confrontationPersistedStatements[endNodeId]) {
        gs.confrontationPersistedStatements[endNodeId].index = 0;
      }
    }
    gs.confrontationState = null;
    gs.confrontationStatements = [];
    gs.confrontationPendingOutro = false;
    gs._summaryOptions = null;
    gs._summaryBtnRects = null;
    gs._confrontBtnHasAnimated = false;
    hideConfrontCounter();

    // 清除质问残留状态（与 clearConfrontationState 对齐）
    gs._pendingProofBgm = null;
    gs.displaySpeaker = null;
    gs.prevSpeaker = null;
    gs.charTransitionTime = 0;

    // 隐藏对话框（关键：否则对话框和文字会残留）
    hideDialogBox();

    // 标记质问完成的 flag
    if (gs.confrontationDoneFlag) {
      gs.flags[gs.confrontationDoneFlag] = true;
    }

    // 回到菜单
    gs.mode = 'menu';
    if (gs.menuNodeId) {
      const menuNode = scenarioData.nodes[gs.menuNodeId];
      if (menuNode) gs.showMenu(gs.menuNodeId, menuNode);
    }
  }
}

// ── 事件后恢复质问流程 ──

/** trigger_event 播放完后恢复质问（由 _resumeFromEvent 调用） */
function resumeConfrontationAfterEvent() {
  const gs = gameState;
  gs.mode = 'confrontation';
  gs.confrontationShowButtons = true;
  gs.confrontationButtonFocus = _IS_MOBILE ? -1 : 0;
  // 与 Python 一致：立绘回到质问说话人（陈述者）
  if (gs.confrontationState && gs.confrontationState.speaker) {
    gs.setDisplayCharacter(gs.confrontationState.speaker, gs.confrontationState.side || 'right', '01');
  }

  // 检查是否所有陈述已推进完
  if (gs.confrontationIndex >= gs.confrontationStatements.length) {
    gs.confrontationPendingOutro = true;
    let outro = gs.confrontationState?.outro;
    const nid3 = gs.currentNodeId;
    if (nid3 && gs.confrontationPersistedStatements?.[nid3]?.outro_override) {
      outro = gs.confrontationPersistedStatements[nid3].outro_override;
    }
    if (outro) {
      gs.mode = 'dialogue';
      hideConfrontCounter();
      gs.enterNode(outro);
    }
  }
}

// ── 绘制质问 UI（Canvas 叠加层：箭头 + 按钮 + 计数器 + "陈述中"标签） ──
// 陈述文本由 DOM 对话框渲染（_showConfrontStatementDialog），不在 Canvas 中绘制
// 无半透明黑底——背景 + 立绘由游戏主循环正常渲染（与 Python draw_frame 一致）

/**
 * 绘制质问 UI 叠加层
 * 由 renderUI() 在 confrontation 模式下调用
 * Canvas 内部分辨率 = DESIGN_W × DESIGN_H，所有坐标直接用设计坐标，不乘 scale
 * 陈述文本/名字框/立绘/背景由游戏主循环正常渲染，此处只叠加交互元素
 */
function drawConfrontation() {
  const gs = gameState;
  if (!gs || (gs.mode !== 'confrontation' && gs.mode !== 'confrontation_summary')) {
    // 非陈述/总结模式时确保计数器隐藏
    hideConfrontCounter();
    return;
  }

  const total = gs.confrontationStatements.length;
  const stmtIdx = gs.confrontationIndex;

  // ── 获取对话框位置（设计坐标，与 showDialogBox 一致，使用 _confrontFixedSide） ──
  let dialogX = (DESIGN_W - DIALOG_W) / 2;
  const effectiveSide = gs._confrontFixedSide || (gs.displaySide || 'right');
  if (gs.displaySpeaker) {
    const side = effectiveSide;
    let charW = 0;
    const charImg = getCharImage(gs.displaySpeaker, gs.displayExpression || '01');
    if (charImg && charImg.naturalWidth) {
      charW = Math.round(charImg.naturalWidth * (_CHAR_HEIGHT / charImg.naturalHeight));
    }
    if (side === 'left') {
      dialogX = _PLAYER_MARGIN_LEFT + charW + DIALOG_GAP_TO_CHAR;
    } else {
      dialogX = DESIGN_W - charW - _NPC_MARGIN_RIGHT - DIALOG_W - DIALOG_GAP_TO_CHAR;
    }
  }
  const dialogY = DESIGN_H - DIALOG_H - DIALOG_BOTTOM_MARGIN;

  // ── 按钮滑入动画更新 ──
  if (_confrontBtnAnimActive) {
    _confrontBtnOffset += (0 - _confrontBtnOffset) * 0.15;
    if (Math.abs(_confrontBtnOffset) < 1) {
      _confrontBtnOffset = 0;
      _confrontBtnAnimActive = false;
    }
  }

  // ── 鼠标位置（设计坐标） ──
  const canvasMouse = { x: mouse.canvasX || 0, y: mouse.canvasY || 0 };

  // ── 举证/追问按钮（屏幕中央垂直排列，与 Python 一致） ──
  if (gs.confrontationShowButtons && !gs.confrontationPendingOutro) {
    const btnW = CONFRONT_BTN_W * UI_SCALE;
    const btnH = CONFRONT_BTN_H * UI_SCALE;
    const baseX = (DESIGN_W - btnW) / 2;
    const baseY = Math.floor((DESIGN_H - 2 * btnH) / 2);
    const currentX = Math.floor(baseX + _confrontBtnOffset);

    const proofY = baseY;
    const askY = baseY + btnH;
    const proofHover = !_IS_MOBILE && (canvasMouse.x >= currentX && canvasMouse.x <= currentX + btnW
      && canvasMouse.y >= proofY && canvasMouse.y <= proofY + btnH);
    const askHover = !_IS_MOBILE && (canvasMouse.x >= currentX && canvasMouse.x <= currentX + btnW
      && canvasMouse.y >= askY && canvasMouse.y <= askY + btnH);

    if (proofHover) gs.confrontationButtonFocus = 0;
    else if (askHover) gs.confrontationButtonFocus = 1;

    const proofFocus = (gs.confrontationButtonFocus === 0);
    const askFocus = (gs.confrontationButtonFocus === 1);

    _drawConfrontBtn(currentX, proofY, btnW, btnH, '举证', proofFocus, 'UI_button_06.png');
    _drawConfrontBtn(currentX, askY, btnW, btnH, '追问', askFocus, 'UI_button_07.png');

    gs._confrontationBtnRects = [
      { x: currentX, y: proofY, w: btnW, h: btnH, action: 'proof' },
      { x: currentX, y: askY, w: btnW, h: btnH, action: 'follow_up' }
    ];

    // 手柄模式：举证按钮 Y 键 + 追问按钮 X 键图标（与 Python 一致）
    if (gamepad.usingGamepad) {
      drawGamepadIcon(ctx, 'y', gs._confrontationBtnRects[0], 4, -40);
      drawGamepadIcon(ctx, 'x', gs._confrontationBtnRects[1], 4, -40);
    }
  } else {
    gs._confrontationBtnRects = null;
  }

  // ── 左右绿色三角形箭头（对话框两侧，与 Python 一致）
  // 总结模式下不显示箭头 ──
  const arrowW = CONFRONT_ARROW_SIZE * UI_SCALE;
  const arrowH = CONFRONT_ARROW_SIZE * UI_SCALE;
  const gap = CONFRONT_ARROW_GAP;
  const showArrows = !gs.confrontationPendingOutro && gs.confrontationShowButtons;

  // 左箭头
  if (showArrows && total > 1 && stmtIdx > 0) {
    const lx = dialogX - arrowW - gap;
    const ly = dialogY + (DIALOG_H - arrowH) / 2;
    const leftHover = !_IS_MOBILE && (canvasMouse.x >= lx && canvasMouse.x <= lx + arrowW
      && canvasMouse.y >= ly && canvasMouse.y <= ly + arrowH);
    _drawTriangleArrow(lx, ly, arrowW, arrowH, 'left', leftHover);
    gs._confrontArrowLeft = { x: lx, y: ly, w: arrowW, h: arrowH };
  } else {
    gs._confrontArrowLeft = null;
  }

  // 右箭头（只要陈述列表不为空就显示右箭头，总结模式下不显示）
  if (showArrows && total > 0) {
    const rx = dialogX + DIALOG_W + gap;
    const ry = dialogY + (DIALOG_H - arrowH) / 2;
    const rightHover = !_IS_MOBILE && (canvasMouse.x >= rx && canvasMouse.x <= rx + arrowW
      && canvasMouse.y >= ry && canvasMouse.y <= ry + arrowH);
    _drawTriangleArrow(rx, ry, arrowW, arrowH, 'right', rightHover);
    gs._confrontArrowRight = { x: rx, y: ry, w: arrowW, h: arrowH };
  } else {
    gs._confrontArrowRight = null;
  }

  // ── 陈述计数器（DOM，打字完成后显示） ──
  if (gs.confrontationShowButtons) {
    _drawConfrontCounter(total, stmtIdx);
  } else {
    hideConfrontCounter();
  }

  // ── "陈述中"标签（与陈述框同时显示，总结模式下隐藏） ──
  if (gs.confrontationShowButtons && !gs.confrontationPendingOutro) {
    _drawStatementLabel(dialogX, dialogY);
  }

  // ── 总结界面 ──
  if (gs.confrontationPendingOutro && gs._summaryOptions) {
    _drawConfrontSummary();
  }

  // ── 血量图标已由 main.js drawBloodIcons() 统一绘制 ──
}

/** 绘制质问按钮（底图 + 文字），所有参数为设计坐标 */
function _drawConfrontBtn(x, y, w, h, text, isFocus, bgImg) {
  // 悬停时用 UI_button_01_high.png，否则用指定底图（与 Python get_proof/ask_button_background 一致）
  const bg = getImage(isFocus ? 'UI_button_01_high.png' : bgImg);
  if (bg) {
    ctx.drawImage(bg, x, y, w, h);
  } else {
    ctx.fillStyle = isFocus ? 'rgba(255,213,141,0.9)' : 'rgba(200,200,200,0.6)';
    ctx.strokeStyle = isFocus ? 'rgb(167,92,26)' : 'rgba(167,92,26,0.3)';
    ctx.lineWidth = isFocus ? 3 : 1;
    _roundRectPath(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#000';
  ctx.font = `bold ${MENU_FONT_SIZE * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 中文字符视觉居中：Canvas middle 基于字体度量，中文视觉上偏上，需微调下移
  ctx.fillText(text, x + w / 2, y + h / 2 + MENU_FONT_SIZE * UI_SCALE * 0.08);
}

/** 绘制绿色三角形箭头（与 Python draw_confrontation_arrows_and_buttons 一致） */
function _drawTriangleArrow(x, y, w, h, direction, isHover) {
  const triColor = isHover ? [150, 255, 0] : [103, 205, 35];
  const borderColor = isHover ? [255, 255, 255] : [0, 0, 0];
  const borderThickness = isHover ? 3 : 2;

  let pts;
  if (direction === 'left') {
    pts = [
      [x + w * 0.2, y + h / 2],
      [x + w * 0.8, y + h * 0.2],
      [x + w * 0.8, y + h * 0.8]
    ];
  } else {
    pts = [
      [x + w * 0.8, y + h / 2],
      [x + w * 0.2, y + h * 0.2],
      [x + w * 0.2, y + h * 0.8]
    ];
  }

  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.lineTo(pts[2][0], pts[2][1]);
  ctx.closePath();
  ctx.fillStyle = `rgb(${triColor[0]},${triColor[1]},${triColor[2]})`;
  ctx.fill();
  ctx.strokeStyle = `rgb(${borderColor[0]},${borderColor[1]},${borderColor[2]})`;
  ctx.lineWidth = borderThickness;
  ctx.stroke();
}

/** 绘制陈述计数器（DOM 元素，避免被对话框遮挡） */
function _drawConfrontCounter(total, current) {
  showConfrontCounter(total, current);
}

/** 绘制"陈述中"标签（与 Python draw_confrontation_arrows_and_buttons 末尾一致，设计坐标） */
function _drawStatementLabel(dialogX, dialogY) {
  const labelW = 140;   // SKIP_BUTTON_WIDTH
  const labelH = 48;    // SKIP_BUTTON_HEIGHT
  const labelGap = 8;   // SKIP_BUTTON_GAP
  const labelX = dialogX + DIALOG_W - labelW;
  const labelY = dialogY - labelH - labelGap;

  ctx.fillStyle = 'rgba(200,200,200,200)';
  ctx.fillRect(labelX, labelY, labelW, labelH);
  ctx.strokeStyle = 'rgba(0,0,0,100)';
  ctx.lineWidth = 1;
  ctx.strokeRect(labelX, labelY, labelW, labelH);

  ctx.fillStyle = 'rgba(0,0,0,200)';
  ctx.font = `bold ${28 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('陈述中', labelX + labelW / 2, labelY + labelH / 2 + 28 * UI_SCALE * 0.08);
}

/** 绘制总结界面（与 Python draw_confrontation_summary 一致） */
function _drawConfrontSummary() {
  const gs = gameState;
  const btnW = CONFRONT_BTN_W * UI_SCALE;
  const btnH = CONFRONT_BTN_H * UI_SCALE;
  const baseX = (DESIGN_W - btnW) / 2;
  const totalBtnH = 2 * btnH;
  const baseY = Math.floor((DESIGN_H - totalBtnH) / 2);

  const canvasMouse = { x: mouse.canvasX || 0, y: mouse.canvasY || 0 };
  gs._summaryBtnRects = gs._summaryOptions.map((opt, i) => {
    const x = baseX;
    const y = baseY + i * btnH;
    const hover = !_IS_MOBILE && (canvasMouse.x >= x && canvasMouse.x <= x + btnW
      && canvasMouse.y >= y && canvasMouse.y <= y + btnH);
    if (hover && gamepad.focusByMouse) gs._summaryFocus = i;
    const isFocus = (gs._summaryFocus === i);
    // "再问一遍" 用举证按钮底图（UI_button_06.png），"结束质问" 用返回按钮底图（UI_button_03.png）
    const bgImg = i === 0 ? 'UI_button_06.png' : 'UI_button_03.png';
    _drawConfrontBtn(x, y, btnW, btnH, opt.text, isFocus, bgImg);
    return { x: x, y: y, w: btnW, h: btnH, action: opt.action };
  });

  // 手柄模式：焦点按钮 A 键图标（与 Python 一致）
  if (gamepad.usingGamepad && gs._summaryBtnRects) {
    const focusRect = gs._summaryBtnRects[gs._summaryFocus];
    if (focusRect) drawGamepadIcon(ctx, 'a', focusRect, 4, -40);
  }
}

/** 绘制生命条（仅案情审理模式） */
function _drawConfrontBlood(gs) {
  const bloodX = DESIGN_W - 280;
  const bloodY = 30;
  const bloodW = 250;
  const bloodH = 30;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  _roundRectPath(ctx, bloodX, bloodY, bloodW, bloodH, 6);
  ctx.fill();

  const bloodRatio = gs.blood / gs.maxBlood;
  ctx.fillStyle = bloodRatio > 0.5 ? '#4CAF50' : (bloodRatio > 0.25 ? '#FF9800' : '#f44336');
  _roundRectPath(ctx, bloodX + 2, bloodY + 2, (bloodW - 4) * bloodRatio, bloodH - 4, 4);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${18 * UI_SCALE}px "Microsoft YaHei","SimHei",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`生命 ${gs.blood}/${gs.maxBlood}`, bloodX + bloodW / 2, bloodY + bloodH / 2);
}