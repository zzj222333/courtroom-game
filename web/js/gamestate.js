// ==================== GameState ====================
// 从 Pygame 版 GameState 逐字段翻译

class GameState {
  constructor() {
    // -- 全局状态 --
    this.mode = 'dialogue';       // 当前模式
    this.uiMode = 'title';        // UI 子模式：'title' | 'settings' | 'save' | 'load' | null
    this.running = true;

    // -- 标题画面 --
    this.titleFocus = 0;          // 键盘焦点索引（0-3）— 运行时由 _IS_MOBILE 决定
    this.titleBtnRects = [];      // 按钮矩形数组（Canvas 坐标）
    this._settingsFromTitle = false; // 设置面板从标题进入（关闭时回标题而非选项菜单）

    // -- 剧情流程 --
    this.currentNodeId = null;
    this.currentSequenceNode = null;
    this.currentSequenceNodeId = null;
    this.menuNodeId = null;
    this.menuStack = [];
    this.dialogueQueue = [];
    this.dialogueIndex = 0;
    this.flags = {};
    this.visitedNodes = new Set();
    this.playedSequences = new Set();
    this.triggeredAutoIds = new Set();

    // -- 角色显示 --
    this.displaySpeaker = null;
    this.displaySide = 'right';
    this.displayExpression = '01';
    this.prevSpeaker = null;
    this.prevSide = 'right';
    this.prevExpression = '01';
    this.charTransitionTime = 0;
    this.charFadeToNone = false;
    this.charShakeOffsetX = 0;
    this.charShakeOffsetY = 0;
    this.foregroundAlpha = 255;

    // -- 打字机状态 --
    this.fullText = '';
    this.textOffset = 0;
    this.typingIndex = 0;         // 浮点，当前显示字符数（相对于 textOffset）
    this.textPageEnd = 0;         // 当前页结束位置（fullText 中的索引）
    this.typingComplete = false;
    this.typingSpeed = 22;        // 字/秒
    this.lastTypingSoundChar = -1;
    this.currentTypingSound = 'sfx_dialogue_typing_male';
    this.hintAnimationTime = 0;   // 三角跳动计时

    // -- 背景 --
    this.currentBgName = null;
    this.prevBg = null;
    this.bgTransitionTime = 0;
    this.sceneLabel = null;
    this._uiSceneLabel = null;    // 持久显示的场所名称（含时间前缀，如"某时 乡间小路"）
    this._inSceneFade = false;
    this._pendingAutoTarget = null;

    // -- BGM --
    this.currentBgm = null;
    this.bgmVolume = 0.5;
    this.sfxVolume = 0.7;
    this.muted = false;
    this.ambientSounds = [];
    this.ambientTimer = 0;

    // -- 菜单 --
    this.menuOptions = [];
    this.menuDestinations = [];
    this.sceneFocusIndex = 0;
    this.menuPrompt = '';
    this.isSubMenu = false;
    this.focusByMouse = true;
    this.prevMousePos = { x: 0, y: 0 };

    // － 选项滑入动画（新增选项/目的地从左侧划入，与 Pygame animating_options 一致）
    this._slideTargets = null;         // Set<string> | null — 本次需要动画的 target 集合
    this.menuSnapshots = {};           // { [nodeId]: Set<string> } — 已见过选项的 target 快照
    this._hideInventoryBtn = false;  // 渐进教学关卡隐藏物品栏按钮

    // -- 调查 --
    this.investigationPoints = [];
    this.investigationCursorX = DESIGN_W / 2;
    this.investigationCursorY = DESIGN_H / 2;
    this.investigationActive = false;
    this._invPendingFlag = undefined;
    this._invPendingPuzzle = null;
    this._invPendingEvent = null;
    this._invResumeNodeAfterDlg = null;
    this._invSuccessIconPending = false;

    // -- 物品 --
    this.inventory = [];
    this._appliedDescriptionUpdates = new Set(); // 已应用的描述更新（防重复）
    this.selectedItemIndex = 0;
    this.showInventory = false;
    this.showingItem = null;
    this.showingCharacter = null;
    this.inventoryMode = 'item';   // 'item' | 'character'
    this.inventoryAction = 'show'; // 'show' | 'thought' | 'proof'
    this.inventoryFocusIndex = 0;
    this.unlockedCharacters = new Set();

    // -- 对峙 --
    this.confrontationState = null;
    this.confrontationStatements = [];
    this.confrontationIndex = 0;
    this.confrontationShowButtons = false;
    this.confrontationButtonFocus = 0;
    this.confrontationResumeState = null;
    this.confrontationPendingOutro = false;
    this.confrontationDoneFlag = null;
    this.confrontationPersistedStatements = {};
    this._confrontBtnHasAnimated = false;
    this.confrontationProofActive = false;
    this.confrontationProofTarget = null;
    this._confrontationPrevBgm = null;
    this._pendingProofBgm = null;
    this.confrontationSummaryConfig = null;        // 总结界面配置（审理质问=对象，调查=null）
    this.confrontationIntroId = null;              // 质问开场节点 ID（用于重来）
    this.confrontationPrevMenu = null;             // 质问前的菜单节点（结束后返回）
    this._confrontationSummaryExitRequested = false; // 审理保存后打开选项菜单的标记

    // -- 生命值 --
    this.blood = 5;
    this._inCaseTrial = false;
    this._activeCaseTrialMenu = null;
    // -- 游戏结束阶段 --
    this.gameOverActive = false;       // 是否处于 game over 流程
    this.gameOverPhase = null;         // "dialogue" | "event" | "text" | "fade_out"
    this.gameOverConfig = null;        // case_trials 中的 game_over 配置
    this.gameOverTextTimer = 0;        // text/fade_out 阶段计时器
    this.gameOverTextAlpha = 0;        // 文字透明度 (0-255)
    this._chapterRemindersSuppressed = false;
    this.chapterReminderCounters = {};           // {reminderId: counter} 场景旅行计数
    this._reminderConditionsMet = {};             // {reminderId: was_condition_met_last_check}
    this._forceChapterReminderCheck = false;      // 读档后强制触发一次
    this._pendingSceneTravel = false;              // 从离开菜单选择目的地时置 True

    // -- 保存提示（案情审理流程中的 save_prompt 模式，与 Python text_adventure.py 一致） --
    this.savePromptNextNode = null;
    this.savePromptBtnSave = null;
    this.savePromptBtnSkip = null;
    this.savePromptBtnOffset = -720;  // -MENU_WIDTH 初始在屏幕左侧外（与 Python 原型一致）
    this.savePromptBtnAnimActive = false;
    this.savePromptButtonFocus = -1;  // -1=无焦点, 0=保存, 1=跳过
    this.SAVE_PROMPT_BTN_ANIM_DURATION = 0.3;
    this.savePromptSpeaker = null;
    this.savePromptText = '';
    this.savePromptTypingIndex = 0;
    this.savePromptTypingComplete = false;

    this._justLoaded = false;  // 读档标记，save_prompt 时跳过

    this.maxBlood = 5;

    // -- 物品反馈动画 --
    this.itemFeedbackActive = false;
    this.itemFeedbackItem = null;
    this.itemFeedbackText = '';
    this.itemFeedbackTimer = 0;
    this.itemFeedbackType = 'loss'; // 'loss' | 'gain'
    this.itemFeedbackPhase = 'prompt'; // 'prompt' | 'fading'
    this.hintAnimationTime = 0;
    this.gainResumeState = null; // 物品获得前保存的状态（mode/cursor/dialogue等）

    // -- 展示物品/人物状态（与 Python talking_about_item/character 一致） --
    this.talkingAboutItem = false;
    this.talkingAboutCharacter = false;
    this.savedDisplaySpeaker = null;
    this.savedDisplaySide = null;
    this._pendingItemTalkEffects = null; // 展示物品对话后的 effects（set_flag 等）
    this.inventoryAction = 'show'; // 'show' | 'proof' | 'thought'

    // -- 卡片叠加 --
    this.cardOverlayActive = false;
    this.cardOverlayStay = false;
    this._prevCardType = null;
    this._prevCardId = null;

    // -- 物品栏动画（与 Pygame inv_anim_* 一致） --
    this.invAnimActive = false;
    this.invAnimFromIdx = -1;
    this.invAnimToIdx = -1;
    this.invAnimProgress = 1.0;
    this.invAnimDirection = 0;  // -1=左, 1=右
    this.holdShowingItemUntilInventoryReady = false;
    this.holdShowingCharacterUntilInventoryReady = false;

    // -- 选项对白（与 Python text_adventure.py 一致） --
    this.choiceActive = false;
    this.choiceConfig = null;          // 完整 choice_dialogue 节点数据
    this.choiceNextNode = null;        // 正确后的 next 节点
    this.choiceFailDialogue = null;    // 整体失败对话（血量归零）
    this.choiceFailNext = null;        // 血量归零后跳转
    this.choiceTriggerIndex = -1;      // trigger_choice 行索引
    this.choiceTriggerLine = null;     // trigger_choice 行数据副本
    this.choiceList = [];              // 当前选项列表
    this.choiceSelected = 0;           // 当前焦点选项索引
    this.choiceActive2 = false;        // 是否正在等待玩家选择（与 Python choice_active 一致）
    this.choiceBtnAnimOffset = -720;   // 按钮滑入动画偏移（初始在屏幕左侧外）
    this.choiceContinueDone = false;   // 正确选择后对话已播完
    this.choiceBtnRects = [];          // 按钮矩形（点击检测）

    // -- 举证对白（与 Python text_adventure.py 一致） --
    this._inProofInterrupt = false;
    this._proofInterruptNodeId = null;
    this._proofInterruptConfig = null;
    this._proofInterruptFailPending = false;
    this._proofInterruptSuccessNext = null;

    // -- 保存/读取 --
    this.savePromptActive = false;
    this.savePromptConfig = null;
    this._saveFromOptions = false;     // 保存界面从选项菜单进入（显示bg_menu_04背景+标题图）
    this.saveIndexFocus = 0;           // 保存界面焦点索引（0-6）

    // -- 对话选项（menu options 预览，与 Pygame preview_speaker 一致） --
    this.previewSpeaker = null;
    this.previewAlpha = 0;
    this.previewTargetAlpha = 0;

    // 预览立绘淡入淡出速度（与 Pygame PREVIEW_FADE_TIME = 0.4 一致）
    this._PREVIEW_FADE_TIME = 0.4;

    // -- 测试/调试 --
    this.testMode = false;
    this.debug = false;

    // -- 全局覆盖 --
    this.bgOverrides = {};
    this._inSceneFade = false;
    this._pendingAutoTarget = null;
    this._sceneEntryDelay = 0;

    // ── 场景转场（黑幕淡入淡出）──
    this.fadeAlpha = 0;           // 0-255
    this.fadePhase = null;        // null | fade_out | hold_black | fade_in
    this.fadeTimer = 0;
    this.fadeCallback = null;
    this.sceneLabelText = null;   // 转场文字
    this._FADE_OUT_TIME = 0.3;
    this._FADE_HOLD_TIME = 1.5;
    this._FADE_IN_TIME = 0.3;

    // ── 事件系统 ──
    this.eventPhase = 'idle';           // idle | fade_in | display | fade_out | success_icon
    this.eventImage = null;             // 当前显示的事件图片文件名
    this.eventFrames = [];              // intro_event.frames 数组
    this.eventFrameIndex = 0;           // 当前帧索引
    this.eventResume = null;            // 事件结束后恢复的状态 {mode, next_node, ...}
    this.eventAlpha = 0;               // 整体透明度 (0-255)
    this.eventImgAlpha = 0;            // 图片透明度 (0-255)
    this.eventFadeTimer = 0;           // 淡入淡出计时器 (秒)
    this.eventAutoAdvance = false;     // 是否自动推进帧
    this.eventAutoTimer = 0;           // 自动推进等待计时器
    this.eventTypingIndex = 0;         // 事件文字打字机索引
    this.eventTransitionPhase = null;  // null | img_fade_out | img_fade_in
    this.eventTransitionTimer = 0;
    this.eventNextFrameIndex = 0;
    this.eventVoiceFrameDelay = 1.0;   // 语音帧延迟
    this._eventVoicePlayIndex = -1;    // 已播放语音的帧索引（防止重复触发）
    this._EVENT_FADE_DURATION = 0.4;
    this._EVENT_IMG_TRANSITION_DURATION = 0.2;
    this._EVENT_DIALOG_HEIGHT = 150;
    this._EVENT_IMG_GAP = 5;
    this._EVENT_IMAGE_SCALE = 3.3;

    // ── success_icon 胜利图标动画 ──
    this.successIconFlag = false;       // 当前事件是否带 success_icon
    this.successIconPhase = null;       // null | 'slide_in' | 'hold' | 'slide_out'
    this.successIconTimer = 0;
    this.successIconOffset = 0;         // X偏移（从屏幕左侧 → 居中 → 右侧）
    this.successIconAlpha = 0;
    this.successIconCx = 0;            // 图标中心 X
    this.successIconCy = 0;            // 图标中心 Y
    this.successIconW = 0;
    this.successIconH = 0;

    // -- 谜题（与 Python GameState 字段一致） --
    this.puzzleConfig = null;             // 当前谜题完整配置
    this.puzzleImage = null;              // 底图文件名
    this.puzzleOverlay = null;            // 次底图文件名（PasswordBox_001.png）
    this.puzzleText = null;               // 对话框文字
    this.puzzleAlpha = 0;                 // 当前整体透明度 0-255
    this.puzzlePhase = 'fade_in';         // fade_in | display | fade_out | success_shake | success_img_swap | success_wait | num_success_fadeout | num_success_icon_anim
    this.puzzleFadeTimer = 0;
    this.puzzleFadeTotal = 0;
    this.puzzleHintTime = 0;
    this.puzzleConfirmRect = null;        // 确定按钮矩形 {x,y,w,h}
    this.puzzleReturnRect = null;         // 返回按钮矩形
    this.puzzleDialogMode = null;         // "success" / "fail" / null（对话结束后决定回谜题或推进）
    this.puzzleDigits = [1, 1, 1];        // 三个数字位 0-9，初始均为"一"
    this.puzzleArrowRects = [];           // 六个箭头矩形 [0上,0下, 1上,1下, 2上,2下]
    this.puzzleSuccessImage = null;      // 成功特效第二张底图（puzzle_001_02.png）
    this.puzzleImgAlpha = 255;            // 当前底图 alpha
    this.puzzleSuccessImgAlpha = 0;       // 成功底图 alpha
    this.puzzleShakeX = 0;                // 抖动 X 偏移
    this.puzzleShakeY = 0;                // 抖动 Y 偏移
    this.puzzleShakeTimer = 0;
    this.puzzleSuccessSwapTimer = 0;
    this.puzzleSuccessDelayTimer = 0;
    this.puzzleFocusIndex = 0;            // 0-2: 数字位, 3: 确定按钮, 4: 返回按钮
    this.puzzleKeyboardItems = [];        // Type B 键盘导航项列表（int=子图索引, "confirm"/"prev"/"return"=按钮）
    this.puzzleBPrevFocus = null;         // 上次焦点子图索引（用于音效触发）
    this.puzzleBHoverIdx = null;          // 鼠标悬浮子图索引
    this.puzzleImgX = 0;
    this.puzzleImgTop = 0;
    this.puzzleSuccessIconImg = null;     // 成功图标图片（仅动画期间）
    this.puzzleSuccessIconOffset = 0;
    this.puzzleSuccessIconAlpha = 0;
    this.puzzleSuccessIconTimer = 0;
    this.puzzleSuccessIconPhase = null;   // null | 'slide_in' | 'hold' | 'slide_out'
    this.puzzleIconImg = null;
    this.puzzleIconCx = 0;
    this.puzzleIconCy = 0;
    this.puzzleIconW = 0;
    this.puzzleIconH = 0;
    this.puzzleResumeMode = 'investigation'; // 谜题退出后恢复的模式：'investigation' | 'card_game'

    // -- 彩绘牌戏状态 --
    this.cardGamesCompleted = new Set(); // 已完成的牌戏 ID 集合
    this.cardGameActive = false;
    this.cardGameId = null;
    this.cardGameConfig = null;
    this.cardGameReturnMenu = null;
    this.cardGameStage = null; // "intro" | "playing" | "returning"

    // -- 扣血动画（与 Python blood_deduct_anim_* 一致） --
    this.bloodDeductAnimActive = false;
    this.bloodDeductAnimTimer = 0;
    this.bloodDeductAnimScale = 1.0;
    this.bloodDeductAnimAlpha = 255;
  }

  // ==================== 核心方法 ====================

  /** 获取当前章节的数据对象（chapters.{current_chapter}） */
  _getChapterData() {
    if (!scenarioData) return {};
    const chapter = scenarioData.current_chapter || 'prologue';
    return (scenarioData.chapters && scenarioData.chapters[chapter]) || {};
  }

  /** 从 scenarioData 中获取物品定义（与 Python 一致：chapters.{chapter}.items） */
  _getItemDef(itemId) {
    if (!scenarioData) return null;
    // 优先从顶层 items 查（如果有的话）
    if (scenarioData.items && scenarioData.items[itemId]) return scenarioData.items[itemId];
    // 其次从 chapters.{current_chapter}.items 查
    const chData = this._getChapterData();
    return (chData.items && chData.items[itemId]) || null;
  }

  /** 查找角色信息 */
  getCharacterInfo(speakerId) {
    if (!speakerId || !charactersData) return null;
    return charactersData[speakerId] || null;
  }

  /** 获取角色显示名称 */
  getDisplayName(speakerId) {
    const info = this.getCharacterInfo(speakerId);
    if (!info) return speakerId || '???';
    return info.display_name || info.name || speakerId;
  }

  /** 设置当前显示角色 */
  setDisplayCharacter(speaker, side, expression) {
    side = side || 'right';
    expression = expression || '01';

    // 自动解锁角色
    if (speaker && charactersData && charactersData[speaker]) {
      this.unlockedCharacters.add(speaker);
    }

    // 完全相同 → 跳过
    if (speaker === this.displaySpeaker && side === this.displaySide && expression === this.displayExpression) {
      return;
    }

    if (speaker !== null && speaker !== undefined) {
      // 同人同边仅换表情 → 交叉淡入淡出；换人/换边 → 纯淡入
      if (speaker === this.displaySpeaker && side === this.displaySide) {
        this.prevSpeaker = this.displaySpeaker;
        this.prevSide = this.displaySide;
        this.prevExpression = this.displayExpression;
      } else {
        this.prevSpeaker = null;
        this.prevSide = null;
        this.prevExpression = null;
      }
      this.displaySpeaker = speaker;
      this.displaySide = side;
      this.displayExpression = expression;
      this.charTransitionTime = 0.25;
      this.charFadeToNone = false;
    } else {
      // speaker 为 null → 淡出到无，保留当前立绘至 prev 用于淡出渲染
      this.prevSpeaker = this.displaySpeaker;
      this.prevSide = this.displaySide;
      this.prevExpression = this.displayExpression;
      this.charTransitionTime = 0.25;
      this.charFadeToNone = true;
    }
  }

  /** 评估条件字符串 */
  evalCondition(cond) {
    if (!cond || cond === 'True' || cond === 'true') return true;
    if (cond === 'False' || cond === 'false') return false;

    // 处理 and / or 复合条件（与 Python eval_condition 一致）
    // 优先级：先拆 or，再拆 and（与 Python 一致）
    const orParts = this._splitCondition(cond, ' or ');
    if (orParts.length > 1) {
      return orParts.some(p => this.evalCondition(p));
    }
    const andParts = this._splitCondition(cond, ' and ');
    if (andParts.length > 1) {
      return andParts.every(p => this.evalCondition(p));
    }

    // not 前缀
    const notMatch = cond.match(/^not\s+(\w+)$/);
    if (notMatch) return !this.flags[notMatch[1]];

    // 不等于: flag_name != value
    const neqMatch = cond.match(/^(\w+)\s*!=\s*(\w+)$/);
    if (neqMatch) {
      const [, flag, val] = neqMatch;
      const flagVal = this.flags[flag];
      if (val === 'True' || val === 'true') return !flagVal;
      if (val === 'False' || val === 'false') return !!flagVal;
      return flagVal !== val;
    }

    // 等于: flag_name == value
    const eqMatch = cond.match(/^(\w+)\s*==\s*(\w+)$/);
    if (eqMatch) {
      const [, flag, val] = eqMatch;
      const flagVal = this.flags[flag];
      if (val === 'True' || val === 'true') return !!flagVal;
      if (val === 'False' || val === 'false') return !flagVal;
      return flagVal === val;
    }

    // 单独 flag
    return !!this.flags[cond.trim()];
  }

  /** 按分隔符拆分条件，尊重括号内的内容 */
  _splitCondition(cond, sep) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (let i = 0; i < cond.length; i++) {
      const ch = cond[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (depth === 0 && cond.substring(i, i + sep.length) === sep) {
        parts.push(current);
        current = '';
        i += sep.length - 1;
      } else {
        current += ch;
      }
    }
    parts.push(current);
    return parts;
  }

  /** 过滤选项：保留满足条件的 */
  filterOptions(options) {
    if (!options) return [];
    return options.filter(opt => this.evalCondition(opt.condition || 'True'));
  }

  // ==================== 质问状态清理 ====================

  /** 清除所有质问状态，恢复进入质问前的 BGM（与 Python clear_confrontation_state 一致） */
  clearConfrontationState() {
    // 恢复进入质问前的 BGM
    if (this._confrontationPrevBgm !== null) {
      try { playBgm(this._confrontationPrevBgm); } catch (_) {}
      this._confrontationPrevBgm = null;
    }
    this.confrontationState = null;
    this.confrontationStatements = [];
    this.confrontationIndex = 0;
    this.confrontationResumeState = null;
    this.confrontationShowButtons = false;
    this.confrontationPendingOutro = false;
    this.confrontationProofActive = false;
    this.confrontationProofTarget = null;
    this.confrontationDoneFlag = null;
    // 清除举证 BGM 信号（防止 advanceDialogue 残留触发）
    this._pendingProofBgm = null;
    // 清除质问残留立绘（防止切换场景时旧人物仍显示）
    this.displaySpeaker = null;
    this.prevSpeaker = null;
    this.charTransitionTime = 0;
    // 清除选项对白状态
    this.choiceActive = false;
    this.choiceActive2 = false;
    this.choiceConfig = null;
    this.choiceContinueDone = false;
    // 清除举证对白状态
    this._inProofInterrupt = false;
    this._proofInterruptNodeId = null;
    this._proofInterruptConfig = null;
    this._proofInterruptFailPending = false;
    this._proofInterruptSuccessNext = null;
  }

  // ==================== 节点进入 ====================

  enterNode(nodeId) {
    // 特殊节点：回到标题画面
    if (nodeId === '__main_menu__') {
      this.mode = 'menu';
      this.uiMode = 'title';
      this._inCaseTrial = false;
      this._proofInterruptFailPending = false;
      this.clearConfrontationState();
      this._subMenu = null;
      this._uiSceneLabel = null;
      this.sceneLabel = null;
      this.investigationActive = false;
      this.showingCharacter = null;
      this.showingItem = null;
      this.displaySpeaker = null;
      this.prevSpeaker = null;
      // 隐藏所有 UI DOM 元素
      if (typeof hideAllGameUI === 'function') hideAllGameUI();
      console.log('[GameState] → 标题画面');
      return;
    }

    const nodes = scenarioData.nodes;
    const node = nodes[nodeId];
    if (!node) {
      console.error(`[GameState] 节点不存在: ${nodeId}`);
      return;
    }
    console.log(`[EnterNode] ${nodeId} type=${node.type || 'sequence'} from=${this.currentNodeId || 'none'}`);

    // 场景切换淡入淡出（与 Python _fade_enter_callback 一致）
    if (node.scene_label && !this._inSceneFade && !this.fadePhase) {
      const newLabel = node.scene_label;
      if (newLabel !== this.sceneLabel) {
        console.log(`[Fade] 场景标签切换: "${this.sceneLabel}" → "${newLabel}"，进入节点 ${nodeId}`);
        // 清除卡片叠加层立绘（与 Python 一致：场景切换时清除残留立绘）
        this.showingCharacter = null;
        this.cardOverlayActive = false;
        this.cardOverlayStay = false;
        // 立即清除对话立绘（不启动淡出动画），避免 fade in 时闪现旧场景立绘
        this.displaySpeaker = null;
        this.prevSpeaker = null;
        this.charTransitionTime = 0;
        this.charFadeToNone = false;
        this.previewSpeaker = null;
        this.previewTargetAlpha = 0;
        this.sceneLabelText = node.scene_label_title || node.scene_label;
        this._startFadeTransition(() => this._fadeEnterCallback(nodeId));
        return;
      }
    }

    this.visitedNodes.add(nodeId);
    this.currentNodeId = nodeId;

    // 进入周府庭院时自动解锁亦心、香巧、阿癫的人物卡片（与 Python 一致）
    if (nodeId === 'scene_prologue_04' && !this.unlockedCharacters.has('Player_Bao')) {
      this.unlockedCharacters.add('Player_Bao');
      this.unlockedCharacters.add('Player_XQ');
      this.unlockedCharacters.add('Player_LX');
      this.selectedItemIndex = 0;
      console.log(`[Characters] 进入scene_prologue_04 → 解锁3人物(Bao/XQ/LX)`);
    }

    // 背景切换（应用 bgOverrides）
    if (node.background) {
      const overriddenBg = this.bgOverrides[node.background] || node.background;
      if (overriddenBg !== this.currentBgName) {
        this.prevBg = this.currentBgName;
        this.currentBgName = overriddenBg;
        setBackground(overriddenBg);
      }
    }
    if (node.ambient_sounds) {
      this.ambientSounds = node.ambient_sounds;
      this.ambientTimer = Math.random() * 5;
    } else if (node.background) {
      this.ambientSounds = [];
      this.ambientTimer = 0;
    }
    // 只有有 background 的节点才更新 sceneLabel（匹配 Python：防止 auto_dialogue 节点清空 sceneLabel 导致重复黑屏）
    if (node.background !== undefined) {
      this.sceneLabel = node.scene_label || null;
      this._uiSceneLabel = this.sceneLabel;  // 只显示场景名称（如"乡间小路"），不含时间前缀
    }

    // BGM
    if (node.bgm && node.bgm !== this.currentBgm) {
      this.currentBgm = node.bgm;
      try { playBgm(node.bgm, node.bgm_start || 0); } catch (_) {}
    }

    // 角色设置
    if (node.speaker) {
      this.setDisplayCharacter(node.speaker, node.side || 'right', '01');
    }

    // 自动对话
    let autoDialogues = node.auto_dialogues || null;
    if (autoDialogues === null) {
      const autoId = node.auto_dialogue;
      if (autoId) autoDialogues = [{ target: autoId, condition: 'True', id: autoId }];
    }
    if (autoDialogues && node.background) {
      for (const entry of autoDialogues) {
        const targetId = entry.target || entry;
        const cond = entry.condition || 'True';
        const autoKey = entry.id || targetId;
        if (targetId && !this.triggeredAutoIds.has(autoKey)) {
          if (this.evalCondition(cond)) {
            this.triggeredAutoIds.add(autoKey);
            if (this._inSceneFade) {
              this._pendingAutoTarget = targetId;
            } else {
              this.enterNode(targetId);
            }
            return;
          }
        }
      }
    }

    // 节点类型分发
    const nodeType = node.type || 'sequence';

    // 进入非菜单节点时清除预览角色
    if (nodeType !== 'menu') {
      this.setPreviewCharacter(null);
    }

    // intro_event：开场动画事件优先处理
    if (node.intro_event) {
      const nextNode = node.intro_event_resume || nodeId;
      this.startIntroEvent(node.intro_event, nextNode);
      return;
    }

    // on_enter：节点进入时播放的对话
    if (node.on_enter) {
      this.dialogueQueue = node.on_enter;
      this.dialogueIndex = 0;
      this.mode = 'dialogue';
      this.startDialogue();
      return;
    }

    switch (nodeType) {
      case 'menu':
        this._inCaseTrial = false;
        this.clearConfrontationState();
        // 与 Python enter_node 一致：先检查章节提醒，触发则跳过 showMenu
        if (!this._checkChapterReminders()) {
          this.showMenu(nodeId, node);
        }
        break;

      case 'sequence':
        this.currentSequenceNode = node;
        this.currentSequenceNodeId = nodeId;
        // 有 confrontation_summary 对象的节点 → 标记 pendingOutro，确保 _onDialogueQueueEnd 正确显示总结界面
        // 注意：只匹配对象（{speaker, text, ...}），不匹配布尔值 true（陈述节点的标记）
        if (node.confrontation_summary && typeof node.confrontation_summary === 'object') {
          this.confrontationPendingOutro = true;
        }
        // 有 save_prompt 且无对话时，直接进入 save_prompt 模式
        // 避免 startDialogue → 空队列 → _onDialogueQueueEnd 同步调用 _continueFromSavePrompt 导致跳过
        if (node.save_prompt && (!node.dialogues || node.dialogues.length === 0)) {
          this.savePromptNextNode = node.next;
          if (this._justLoaded === true) {
            this._justLoaded = false;
            this._continueFromSavePrompt();
          } else {
            this.mode = 'save_prompt';
            const sp = node.save_prompt;
            const speaker = sp.speaker || 'Player_Ba';
            const side = sp.side || 'left';
            const expression = sp.expression || '01';
            const promptText = sp.text || '是否要现今为止的进度保存一下？';
            this.setDisplayCharacter(speaker, side, expression);
            this.savePromptSpeaker = speaker;
            this.fullText = promptText;
            this.textOffset = 0;
            this.typingIndex = 0;
            this.typingComplete = false;
            this.lastTypingSoundChar = -1;
            if (this.fullText.indexOf('内心独白') !== -1) {
              this.currentTypingSound = 'sfx_dialogue_inner_voice';
            } else {
              const info = this.getCharacterInfo(speaker);
              const gender = (info && info.gender) ? info.gender : 'male';
              this.currentTypingSound = (gender === 'female') ? 'sfx_dialogue_typing_female' : 'sfx_dialogue_typing_male';
            }
            this.savePromptBtnOffset = -720;
            this.savePromptBtnAnimActive = true;
            this.savePromptButtonFocus = (typeof gamepad !== 'undefined' && gamepad.usingGamepad) ? 0 : -1;
            this.dialogueQueue = [];
            this.dialogueIndex = 0;
            showDialogBox(this.getDisplayName(speaker), '');
            showHintArrow(false);
            this.textPageEnd = measurePageBreak(this.fullText);
          }
          break;
        }
        this.dialogueQueue = node.dialogues || [];
        this.dialogueIndex = 0;
        this.mode = 'dialogue';
        this.startDialogue();
        break;

      case 'confrontation_statement':
        console.log(`[enterNode] 进入质问: ${nodeId}`);
        startConfrontIntroAnim(nodeId);
        break;

      case 'proof_interrupt':
        // 与 Python enter_node proof_interrupt 分支一致
        this.currentSequenceNode = node;
        this.currentSequenceNodeId = nodeId;
        this._proofInterruptNodeId = nodeId;
        this._proofInterruptConfig = node.proof || {};
        this.dialogueQueue = node.dialogues || [];
        this.dialogueIndex = 0;
        this.mode = 'dialogue';
        this.startDialogue();
        break;

      case 'choice_dialogue':
        // 与 Python enter_node choice_dialogue 分支一致
        this.choiceConfig = node;
        this.choiceNextNode = node.next || null;
        this.choiceFailDialogue = node.fail_dialogue || null;
        this.choiceFailNext = node.fail_next || null;
        this.choiceTriggerIndex = -1;
        this.choiceActive = false;
        this.choiceActive2 = false;
        this.choiceContinueDone = false;
        // 查找 trigger_choice 行索引
        const cdDialogues = node.dialogues || [];
        for (let ci = 0; ci < cdDialogues.length; ci++) {
          const cd = cdDialogues[ci];
          if (cd && typeof cd === 'object' && cd.trigger_choice) {
            this.choiceTriggerIndex = ci;
            break;
          }
        }
        this.choiceTriggerLine = (this.choiceTriggerIndex >= 0)
          ? { ...cdDialogues[this.choiceTriggerIndex] }
          : null;
        this.choiceList = [];
        this.dialogueQueue = [...cdDialogues];
        this.dialogueIndex = 0;
        this.mode = 'dialogue';
        this.startDialogue();
        break;

      default:
        console.log(`[enterNode] 未知类型 ${nodeType}，尝试 next`);
        if (node.next) {
          this.enterNode(node.next);
        }
    }
  }

  // ==================== 菜单 ====================

  /** 设置预览角色（与 Pygame set_preview_character 一致） */
  setPreviewCharacter(speaker) {
    if (speaker === this.previewSpeaker) return;
    if (speaker === null) {
      this.previewTargetAlpha = 0;
    } else {
      this.previewSpeaker = speaker;
      this.previewTargetAlpha = 255;
    }
  }

  /** 根据当前焦点位置更新预览角色（与 Pygame draw_menu 中 preview_speaker 逻辑一致） */
  _updatePreviewFromFocus() {
    if (this.mode !== 'menu') return;
    const idx = this.sceneFocusIndex;
    // 获取菜单节点的 speaker（作为默认预览角色）
    const menuNode = scenarioData.nodes[this.menuNodeId];
    const nodeSpeaker = menuNode?.speaker || null;
    if (idx >= 0 && idx < this.menuOptions.length) {
      const opt = this.menuOptions[idx];
      // 选项级 preview_speaker 优先，否则回退到菜单节点 speaker
      this.setPreviewCharacter(opt.preview_speaker || nodeSpeaker);
    } else if (idx >= 0) {
      // 底部按钮：回退到菜单节点 speaker（与 Pygame 一致）
      this.setPreviewCharacter(nodeSpeaker);
    } else {
      // 无焦点（移动端默认 -1）：清除预览
      this.setPreviewCharacter(null);
    }
  }

  showMenu(nodeId, node) {
    console.log(`[DEBUG-SHOWMENU] nodeId=${nodeId} opts=${(node?.options||[]).length} dests=${(node?.destinations||[]).length}`);
    this.mode = 'menu';
    this.menuNodeId = nodeId;

    // 与 Python enter_node menu 分支一致：设置立绘（无 speaker 则清除）
    const menuSpeaker = node?.speaker || null;
    const menuSide = node?.side || 'right';
    const menuExpr = node?.expression || '01';
    if (menuSpeaker) {
      this.setDisplayCharacter(menuSpeaker, menuSide, menuExpr);
    } else {
      this.setDisplayCharacter(null, menuSide);
    }
    // 菜单模式下跳过淡入过渡，直接显示立绘（防止闪烁）
    this.charTransitionTime = 0;
    this.prevSpeaker = null;
    this.charFadeToNone = false;
    // 子菜单检测：角色对话菜单（menu_ 开头、非 scene_ 开头、非 __leave__）
    this.isSubMenu = !nodeId.startsWith('scene_') && !nodeId.startsWith('__leave__');
    // 渐进教学关卡隐藏物品栏按钮（与 Pygame _hide_inventory_btn 一致）
    this._hideInventoryBtn = (nodeId === 'scene_prologue_02' || nodeId === 'scene_prologue_03');

    // 与 Pygame show_menu 一致：子菜单时添加「展示物品」按钮（放在质问按钮之后、返回按钮之前）
    let options = (node?.options || []).slice();
    if (this.isSubMenu && !this.menuNodeId.startsWith('__leave__')) {
      // 找到 is_back 选项位置，将【展示物品】插入到它之前（与原型一致：返回在最末）
      const backIdx = options.findIndex(o => o.is_back);
      const showItemCond = node?.show_item_condition || 'True';
      if (this.evalCondition(showItemCond)) {
        const showItemOpt = { text: '【展示物品】', target: 'show_inventory', is_show_item: true };
        if (backIdx >= 0) {
          options.splice(backIdx, 0, showItemOpt);
        } else {
          options.push(showItemOpt);
        }
      }
    }

    // 彩绘牌戏按钮（与 Python show_menu 一致：读取 node.card_game 并在条件满足时追加选项）
    const cardGameCfg = node?.card_game;
    if (cardGameCfg && typeof cardGameCfg === 'object') {
      const cgCondition = cardGameCfg.condition || 'True';
      if (this.evalCondition(cgCondition)) {
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

    // 案情审理选项（与 Python prepare_menu 一致：读取 case_trials 配置，条件满足时追加）
    const chData = this._getChapterData();
    const ctCfg = chData?.case_trials?.[nodeId];
    if (ctCfg) {
      const unlockCond = ctCfg.unlock_condition || 'False';
      if (this.evalCondition(unlockCond)) {
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

    this.menuOptions = this.filterOptions(options);
    this.menuDestinations = this.filterOptions(node?.destinations || []);
    this.menuPrompt = node?.menu_prompt || '';

    // 评估当前菜单的对话完成度（与 Python prepare_menu 一致）
    // 始终重新评估，不依赖旧 flag 值
    const talksDoneFlag = 'talks_' + nodeId + '_all_done';
    this.flags[talksDoneFlag] = this._checkMenuTalksDone(nodeId);

    // 移动端默认无高亮（focusByMouse 触摸时才设值），PC 端默认高亮第一个
    this.sceneFocusIndex = _IS_MOBILE ? -1 : 0;
    this.investigationActive = false;
    this.investigationPoints = [];
    this._subMenu = null; // null | 'leave' | 'settings' | 'options_menu'
    this.optionsMenuFocus = _IS_MOBILE ? -1 : 0;
    this.settingsMenuFocus = _IS_MOBILE ? -1 : 0;
    this._settingsDragging = null;    // 滑块拖拽状态: null | 'bgm' | 'sfx'

    // 与 Pygame 一致：所有菜单都 push 到 menuStack（无条件去重 push）
    if (!this.menuStack.length || this.menuStack[this.menuStack.length - 1] !== nodeId) {
      this.menuStack.push(nodeId);
    }
    if (this.isSubMenu) {
      this.sceneFocusIndex = _IS_MOBILE ? -1 : 0;
    }

    // ── 计算新增选项（滑入动画，与 Pygame show_menu 一致） ──
    const newTargets = new Set(this.menuOptions.map(o => o.target).filter(t => t));
    if (!this.menuSnapshots[nodeId]) {
      // 首次进入此菜单 → 所有选项播放动画
      this._slideTargets = newTargets;
      console.log(`  -> 首次显示，所有选项播放动画`);
    } else {
      const oldTargets = this.menuSnapshots[nodeId];
      const added = new Set([...newTargets].filter(t => !oldTargets.has(t)));
      if (added.size > 0) {
        this._slideTargets = added;
        console.log(`  -> 新增选项: ${[...added].join(',')}`);
      } else {
        this._slideTargets = null;
        console.log(`  -> 无变化，不播放动画`);
      }
    }
    this.menuSnapshots[nodeId] = newTargets;
    _menuNeedsRedraw = true;

    // 初始预览角色（与 Pygame show_menu 末尾清空 preview_speaker，
    // 但 draw_menu 每帧根据焦点重新计算 — JS 中立即根据默认焦点设置）
    if (this.isSubMenu && node?.speaker) {
      this.setPreviewCharacter(node.speaker);
    } else {
      this._updatePreviewFromFocus();
    }

    console.log(`[Menu] ${this.menuOptions.length} 选项, ${this.menuDestinations.length} 目的地, menuStack=[${this.menuStack}]`);
  }

  /** 菜单导航：上 */
  menuMoveUp() {
    if (this._subMenu === 'leave') {
      const list = this.menuDestinations;
      if (list.length === 0) return;
      this.sceneFocusIndex = (this.sceneFocusIndex - 1 + list.length + 1) % (list.length + 1);
      this._updatePreviewFromFocus();
      return;
    }
    // 场景菜单：物品栏/调查同排（← →），两者 ↑ 均到选项，↓ 均到离开
    const optCount = this.menuOptions.length;
    const total = optCount + this.bottomButtonCount();
    if (total === 0) return;
    let newIdx = this.sceneFocusIndex - 1;
    if (!this._hideInventoryBtn) {
      // 物品栏(optCount) / 调查(optCount+1) 同排 → ↑ 均到最后一个选项
      if (this.sceneFocusIndex === optCount || this.sceneFocusIndex === optCount + 1) {
        newIdx = optCount - 1;
      }
    } else {
      if (newIdx === optCount) newIdx = optCount - 1;
    }
    if (newIdx < 0) newIdx = total - 1;
    this.sceneFocusIndex = newIdx;
    this._updatePreviewFromFocus();
  }

  /** 菜单导航：下 */
  menuMoveDown() {
    if (this._subMenu === 'leave') {
      const list = this.menuDestinations;
      if (list.length === 0) return;
      this.sceneFocusIndex = (this.sceneFocusIndex + 1) % (list.length + 1);
      this._updatePreviewFromFocus();
      return;
    }
    // 场景菜单：物品栏/调查同排（← →），两者 ↑ 均到选项，↓ 均到离开
    const optCount = this.menuOptions.length;
    const total = optCount + this.bottomButtonCount();
    if (total === 0) return;
    let newIdx = this.sceneFocusIndex + 1;
    if (!this._hideInventoryBtn) {
      // 物品栏(optCount) / 调查(optCount+1) 同排 → ↓ 均到离开此地
      if (this.sceneFocusIndex === optCount || this.sceneFocusIndex === optCount + 1) {
        newIdx = optCount + 2;
      }
    } else {
      if (newIdx === optCount + 1) newIdx = 0;
    }
    if (newIdx >= total) newIdx = 0;
    this.sceneFocusIndex = newIdx;
    this._updatePreviewFromFocus();
  }

  /** 菜单确认 */
  menuConfirm() {
    console.log(`[DEBUG-MENUCONFIRM] subMenu=${this._subMenu} sceneFocusIndex=${this.sceneFocusIndex} totalOps=${this.menuOptions.length}`);
    // 移动端默认无焦点时（-1），确认不执行任何操作
    if (this.sceneFocusIndex < 0) return;
    if (this._subMenu === 'settings') {
      this.closeSettings();
      return;
    }
    if (this._subMenu === 'leave') {
      const dests = this.menuDestinations;
      try { playSound('sfx_ui_confirm'); } catch (_) {}
      if (this.sceneFocusIndex < dests.length) {
        // 选择了目的地 → 标记为场景旅行，供章节提醒计数（与 Python 一致）
        const dest = dests[this.sceneFocusIndex];
        if (dest.target) {
          this._pendingSceneTravel = true;
          this.enterNode(dest.target);
        }
      } else {
        // "返回"按钮
        this.closeLeaveMenu();
      }
      return;
    }

    // 场景菜单：选项或底部按钮
    const totalOptions = this.menuOptions.length;
    if (this.sceneFocusIndex < totalOptions) {
      this.selectMenuOption(this.sceneFocusIndex);
    } else {
      // 底部按钮（动态数量，物品栏/调查/离开）
      const btnIndex = this.sceneFocusIndex - totalOptions;
      if (this._hideInventoryBtn) {
        // 隐藏物品栏：btn[0]=调查, btn[1]=离开
        if (btnIndex === 0) this.startInvestigation();
        else if (btnIndex === 1) this.openLeaveMenu();
      } else {
        // 正常：btn[0]=物品栏, btn[1]=调查, btn[2]=离开
        if (btnIndex === 0) this.showInventoryMenu('thought');
        else if (btnIndex === 1) this.startInvestigation();
        else if (btnIndex === 2) this.openLeaveMenu();
      }
    }
  }

  /** 底部按钮数量（子菜单没有底部按钮） */
  bottomButtonCount() {
    if (this.isSubMenu) return 0;
    let count = 3; // 物品栏 + 调查 + 离开
    if (this._hideInventoryBtn) count = 2;
    return count;
  }

  /** 底部按钮起始焦点索引 */
  bottomButtonStartIndex() {
    return this.menuOptions.length;
  }

  selectMenuOption(index) {
    if (index < 0 || index >= this.menuOptions.length) return;
    const opt = this.menuOptions[index];
    if (!opt.target) return;
    console.log(`[Menu] 选择: ${opt.text} -> ${opt.target} is_back=${opt.is_back} is_show_item=${opt.is_show_item} is_confrontation=${opt.is_confrontation}`);
    // 设置 flag
    if (opt.set_flag) {
      for (const [k, v] of Object.entries(opt.set_flag)) {
        this.flags[k] = v;
      }
    }
    // 与 Pygame select_menu_option 一致：按类型分支处理
    if (opt.is_back) {
      try { playSound('sfx_ui_confirm'); } catch (_) {}
      this.returnToLastMenu();
    } else if (opt.is_show_item) {
      try { playSound('sfx_ui_confirm'); } catch (_) {}
      this.showInventoryMenu('show');
    } else if (opt.is_card_game) {
      try { playSound('sfx_ui_confirm'); } catch (_) {}
      this.startCardGame(opt.target);
    } else if (opt.is_case_trial) {
      try { playSound('sfx_ui_confirm'); } catch (_) {}
      this._inCaseTrial = true;
      this._activeCaseTrialMenu = this.menuNodeId;
      this._handleCaseTrial();
    } else if (opt.is_confrontation) {
      try { playSound('sfx_ui_confirm'); } catch (_) {}
      this.enterNode(opt.target);
    } else {
      try { playSound('sfx_ui_confirm'); } catch (_) {}
      this.enterNode(opt.target);
    }
  }

  /** 返回上一级菜单（与 Pygame return_to_last_menu 一致） */
  returnToLastMenu() {
    if (this.menuStack.length <= 1) return;
    // 场景菜单不允许回退（与 Pygame 一致）
    if (this.menuNodeId && this.menuNodeId.startsWith('scene_')) return;
    this.menuStack.pop();
    const prevNodeId = this.menuStack[this.menuStack.length - 1];
    this.enterNode(prevNodeId);
  }

  /** 打开离开菜单 */
  openLeaveMenu() {
    try { playSound('sfx_ui_confirm'); } catch (_) {}
    this._subMenu = 'leave';
    this.sceneFocusIndex = _IS_MOBILE ? -1 : 0;
    // ── 计算新增目的地（滑入动画） ──
    const key = '__leave__' + this.menuNodeId;
    const destTargets = new Set(this.menuDestinations.map(d => d.target).filter(t => t));
    if (!this.menuSnapshots[key]) {
      this._slideTargets = new Set(destTargets);
    } else {
      const old = this.menuSnapshots[key];
      const added = new Set([...destTargets].filter(t => !old.has(t)));
      this._slideTargets = added.size > 0 ? added : null;
    }
    this.menuSnapshots[key] = destTargets;
    _menuNeedsRedraw = true;
    console.log(`[Leave] ${this.menuDestinations.length} 目的地, new=${this._slideTargets?.size || 0}`);
  }

  /** 关闭离开菜单 */
  closeLeaveMenu() {
    this._subMenu = null;
    this._slideTargets = null;
    // 返回场景菜单：移动端无默认高亮，PC 端高亮"离开此地"按钮
    this.sceneFocusIndex = _IS_MOBILE ? -1 : (this.menuOptions.length - 1 >= 0 ? this.menuOptions.length - 1 : 0);
    _menuNeedsRedraw = true;
  }

  /** 打开物品栏（与 Pygame show_inventory_menu 一致：不检查空栏，直接打开）
   *  @param {string} action - 'show'(展示物品给NPC) | 'thought'(主角想法) | 'proof'(举证)
   */
  showInventoryMenu(action) {
    this._subMenu = 'inventory';
    this.inventoryMode = 'item';
    // 根据入口设置 inventoryAction（与 Python 一致）
    if (action) this.inventoryAction = action;
    if (typeof _invBtnHighlight !== 'undefined') _invBtnHighlight = null;
    if (this.inventory.length > 0) {
      this.selectedItemIndex = 0;
    } else {
      this.selectedItemIndex = -1;
    }
    this.inventoryFocusIndex = 0;
    // 清除预览立绘，防止遮挡物品栏 UI
    this.previewSpeaker = null;
    this.previewAlpha = 0;
    this.previewTargetAlpha = 0;
    _menuNeedsRedraw = true;
    try { playSound('sfx_ui_inventory_open'); } catch (_) {}
    console.log(`[Inventory] 打开物品栏，物品 ${this.inventory.length} 件，人物 ${this.getCharacterList().length} 个`);
  }

  /** 切换物品栏模式：物品 ↔ 人物 */
  toggleInventoryMode() {
    if (this._subMenu !== 'inventory') return;
    if (this.inventoryMode === 'item') {
      // 切换到人物模式
      const charList = this.getCharacterList();
      if (charList.length === 0) {
        console.log('[Inventory] 无可用人物');
        return;
      }
      this.inventoryMode = 'character';
      this.selectedItemIndex = 0;
    } else {
      // 切回物品模式
      if (this.inventory.length === 0) {
        console.log('[Inventory] 物品栏为空');
        return;
      }
      this.inventoryMode = 'item';
      this.selectedItemIndex = 0;
    }
    _menuNeedsRedraw = true;
    try { playSound('sfx_ui_confirm'); } catch (_) {}
    console.log(`[Inventory] 切换模式: ${this.inventoryMode}`);
  }

  /** 获取可用人物列表（与 Pygame 一致：unlocked 为空时显示全部人物） */
  getCharacterList() {
    if (!charactersData) return [];
    const allCharIds = Object.keys(charactersData);
    // Python: if unlocked_characters is empty → show all characters
    if (this.unlockedCharacters.size === 0) {
      return allCharIds.filter(id => id !== this.displaySpeaker);
    }
    return allCharIds.filter(id => {
      if (id === this.displaySpeaker) return false;
      return this.unlockedCharacters.has(id);
    });
  }

  /** 获取当前选中人物的数据 */
  getSelectedCharacter() {
    const charList = this.getCharacterList();
    if (charList.length === 0) return null;
    const charId = charList[this.selectedItemIndex] || null;
    if (!charId) return null;
    return charactersData[charId] || null;
  }

  /** 物品栏：上一个物品/人物（与 Python select_prev_item 一致：direction=-1） */
  inventoryPrev() {
    if (this.inventoryMode === 'character') {
      const charList = this.getCharacterList();
      const len = charList.length;
      if (len <= 1) return;
      this.invAnimActive = true;
      this.invAnimFromIdx = this.selectedItemIndex;
      this.selectedItemIndex = (this.selectedItemIndex - 1 + len) % len;
      this.invAnimToIdx = this.selectedItemIndex;
      this.invAnimProgress = 0;
      this.invAnimDirection = -1;
    } else {
      const len = this.inventory.length;
      if (len <= 1) return;
      this.invAnimActive = true;
      this.invAnimFromIdx = this.selectedItemIndex;
      this.selectedItemIndex = (this.selectedItemIndex - 1 + len) % len;
      this.invAnimToIdx = this.selectedItemIndex;
      this.invAnimProgress = 0;
      this.invAnimDirection = -1;
    }
  }

  /** 物品栏：下一个物品/人物（与 Python select_next_item 一致：direction=1） */
  inventoryNext() {
    if (this.inventoryMode === 'character') {
      const charList = this.getCharacterList();
      const len = charList.length;
      if (len <= 1) return;
      this.invAnimActive = true;
      this.invAnimFromIdx = this.selectedItemIndex;
      this.selectedItemIndex = (this.selectedItemIndex + 1) % len;
      this.invAnimToIdx = this.selectedItemIndex;
      this.invAnimProgress = 0;
      this.invAnimDirection = 1;
    } else {
      const len = this.inventory.length;
      if (len <= 1) return;
      this.invAnimActive = true;
      this.invAnimFromIdx = this.selectedItemIndex;
      this.selectedItemIndex = (this.selectedItemIndex + 1) % len;
      this.invAnimToIdx = this.selectedItemIndex;
      this.invAnimProgress = 0;
      this.invAnimDirection = 1;
    }
  }

  /** 获取当前选中物品的完整数据（inventory 已存储完整信息，直接返回） */
  getSelectedItem() {
    if (this.inventory.length === 0) return null;
    return this.inventory[this.selectedItemIndex] || null;
  }

  /** 获得物品（与 Python gain_item 一致：存储完整物品信息） */
  gainItem(itemId, showFeedback) {
    const itemDef = this._getItemDef(itemId);
    if (!itemDef) {
      console.warn(`[Item] 未知物品: ${itemId}`);
      return;
    }
    if (this.inventory.some(inv => inv.id === itemId)) {
      console.log(`[Item] 已有物品 ${itemId}，跳过`);
      return;
    }
    // 与 Python 一致：存储完整物品信息（id/name/description/image）
    this.inventory.push({
      id: itemDef.id || itemId,
      name: itemDef.name || '',
      description: itemDef.description || '',
      image: itemDef.image || ''
    });
    if (showFeedback !== false) {
      this.itemFeedbackActive = true;
      this.itemFeedbackItem = itemId;
      this.itemFeedbackText = itemDef.msg || `获得物品【${itemDef.name}】`;
      this.itemFeedbackTimer = 0;
      this.itemFeedbackType = 'gain';
      this.itemFeedbackPhase = 'prompt';
      this.hintAnimationTime = 0;
      this.mode = 'item_feedback';
      try { playSound('sfx_item_gain'); } catch (_) {}
    }
    console.log(`[Item] 获得: ${itemId}`);
  }

  /** 失去物品 */
  removeItem(itemId, showFeedback) {
    const idx = this.inventory.findIndex(inv => inv.id === itemId);
    if (idx === -1) return;
    this.inventory.splice(idx, 1);
    if (showFeedback !== false) {
      const itemDef = this._getItemDef(itemId);
      this.itemFeedbackActive = true;
      this.itemFeedbackItem = itemId;
      this.itemFeedbackText = itemDef ? `失去物品【${itemDef.name}】` : `失去 ${itemId}`;
      this.itemFeedbackTimer = 0;
      this.itemFeedbackType = 'loss';
      this.itemFeedbackPhase = 'prompt';
      this.hintAnimationTime = 0;
      this.mode = 'item_feedback';
    }
    console.log(`[Item] 失去: ${itemId}`);
  }

  // ==================== 物品/人物讯息更新系统（与 Python description_updates 一致） ====================

  /** 检查并应用描述更新（与 Python _check_and_apply_description_updates 一致）
   *  @param {string[]} flagKeys - set_flag 产生的 key 列表
   *  @returns {Array<{id,name}>} 被更新的物品列表（用于反馈提示）
   */
  _checkAndApplyDescriptionUpdates(flagKeys) {
    if (!flagKeys || !flagKeys.length) return [];
    const chData = this._getChapterData();
    const descUpdates = chData.description_updates;
    if (!descUpdates) return [];
    if (!this._appliedDescriptionUpdates) this._appliedDescriptionUpdates = new Set();

    const updatedItems = [];
    for (const flagKey of flagKeys) {
      if (this._appliedDescriptionUpdates.has(flagKey)) continue;

      // 检查物品更新
      const itemUpdate = descUpdates.items && descUpdates.items[flagKey];
      if (itemUpdate) {
        const targetId = itemUpdate.target_id;
        const updateType = itemUpdate.update_type || 'append';
        const updateText = itemUpdate.text || '';
        this._applyItemDescription(targetId, updateType, updateText);
        this._appliedDescriptionUpdates.add(flagKey);
        // 找到被更新的物品用于反馈
        const item = this.inventory.find(inv => inv.id === targetId);
        if (item) updatedItems.push({ id: targetId, name: item.name || '' });
        console.log(`[DescUpdate] 物品 ${targetId} 已更新 (${updateType}): ${flagKey}`);
      }

      // 检查人物更新
      const charUpdate = descUpdates.characters && descUpdates.characters[flagKey];
      if (charUpdate) {
        const targetId = charUpdate.target_id;
        const updateType = charUpdate.update_type || 'append';
        const updateText = charUpdate.text || '';
        this._applyCharacterDescription(targetId, updateType, updateText);
        this._appliedDescriptionUpdates.add(flagKey);
        console.log(`[DescUpdate] 人物 ${targetId} 已更新 (${updateType}): ${flagKey}`);
      }
    }
    return updatedItems;
  }

  /** 修改物品描述（与 Python _apply_item_description 一致） */
  _applyItemDescription(itemId, updateType, updateText) {
    const item = this.inventory.find(inv => inv.id === itemId);
    if (!item) return;
    if (updateType === 'replace') {
      item.description = updateText;
    } else {
      item.description = (item.description || '') + updateText;
    }
  }

  /** 修改人物描述（与 Python _apply_character_description 一致） */
  _applyCharacterDescription(targetId, updateType, updateText) {
    // 人物描述存储在 _unlockedCharacters 的详细信息中
    // 与 Python 一致：修改 character_list 中的 description
    if (!this._characterDescriptions) this._characterDescriptions = {};
    if (updateType === 'replace') {
      this._characterDescriptions[targetId] = updateText;
    } else {
      this._characterDescriptions[targetId] = (this._characterDescriptions[targetId] || '') + updateText;
    }
  }

  /** 展示当前选中项（物品 or 人物） */
  /** 展示物品给当前说话人（与 Python show_item_to_character 一致） */
  inventoryShowItem() {
    if (this.mode !== 'menu' || this._subMenu !== 'inventory') return;

    // ── 质问举证模式：检查证据（物品或人物） ──
    if (this.confrontationProofActive) {
      this._subMenu = null;
      _menuNeedsRedraw = true;
      if (this.inventoryMode === 'character') {
        // 人物举证（与 Python execute_character_proof 一致）
        const charList = this.getCharacterList();
        const charId = charList[this.selectedItemIndex];
        if (!charId) return;
        checkCharacterProof(charId);
      } else {
        const itemData = this.getSelectedItem();
        if (!itemData) return;
        checkProof(itemData.id);
      }
      return;
    }

    // ── 举证对白模式：选择物品或人物判断正确与否（与 Python 一致） ──
    if (this._inProofInterrupt) {
      if (this.inventoryMode === 'character') {
        const charList = this.getCharacterList();
        const charId = charList[this.selectedItemIndex];
        if (!charId) return;
        this._handleProofInterruptCharacterSelection(this.selectedItemIndex);
      } else {
        const itemData = this.getSelectedItem();
        if (!itemData) return;
        this._handleProofInterruptSelection(this.selectedItemIndex);
      }
      return;
    }

    if (this.inventoryMode === 'character') {
      this._inventoryShowCharacter();
      return;
    }

    // ── 物品模式 ──
    const itemData = this.getSelectedItem();
    if (!itemData) return;
    const itemId = itemData.id;

    // 与 Python show_item_to_character 一致：从 displaySpeaker 获取当前 NPC，
    // 若为空则回退到菜单节点的 speaker（防止对话结束后 displaySpeaker 被清空导致展示失败）
    let speakerId = this.displaySpeaker;
    let currentSide = this.displaySide || 'right';
    if (!speakerId) {
      const menuNode = scenarioData?.nodes?.[this.menuNodeId];
      speakerId = menuNode?.speaker || null;
      currentSide = menuNode?.side || 'right';
    }

    // 保存当前说话人（对话结束后恢复）
    this.savedDisplaySpeaker = speakerId;
    this.savedDisplaySide = currentSide;

    // 与 Python 一致：只从 item_talks[speaker][itemId] 查找对话人对物品的看法
    // 注意：item_thoughts 是独立的"想法"系统，展示物品时不会回退到主角想法
    let dialogue = null;
    this._pendingItemTalkEffects = null;
    const chData = this._getChapterData();
    const itemTalks = chData.item_talks || {};
    if (speakerId && itemTalks[speakerId] && itemTalks[speakerId][itemId]) {
      const raw = itemTalks[speakerId][itemId];
      if (Array.isArray(raw)) {
        // 格式A：纯数组
        dialogue = raw;
      } else if (raw && Array.isArray(raw.dialogues)) {
        // 格式B：{ dialogues: [...], effects: {...} }
        dialogue = raw.dialogues;
        if (raw.effects) this._pendingItemTalkEffects = raw.effects;
      } else {
        dialogue = raw;
      }
    }

    // 无定制对话 → 使用通用默认文本（与 Python show_item_to_character 一致）
    if (!dialogue) {
      dialogue = [{ speaker: speakerId || 'Player_Ba', side: currentSide, text: '我对这个东西暂时没兴趣。', expression: '01' }];
    }

    // 关闭物品栏，播放对话，标记为展示物品状态
    this._subMenu = null;
    _menuNeedsRedraw = true;
    this.talkingAboutItem = true;
    this.talkingAboutCharacter = false;
    this.dialogueQueue = dialogue;
    this.dialogueIndex = 0;
    this.mode = 'dialogue';
    this.startDialogue();
    console.log(`[Inventory] 展示物品 ${itemId} → ${speakerId}，播放对话`);
  }

  /** 显示主角对物品/人物的想法（与 Python show_item_thought / show_character_thought 一致） */
  inventoryShowThought() {
    if (this.mode !== 'menu' || this._subMenu !== 'inventory') return;
    if (this.inventoryAction === 'proof') {
      // 举证模式：走原展示流程
      this.inventoryShowItem();
      return;
    }

    const chData = this._getChapterData();
    let dialogue = null;

    if (this.inventoryMode === 'character') {
      // 人物想法：从 character_thoughts 获取
      const charList = this.getCharacterList();
      const charId = charList[this.selectedItemIndex];
      if (!charId) return;
      const charThoughts = chData.character_thoughts || {};
      dialogue = charThoughts[charId] || null;
      if (!dialogue) {
        dialogue = [{ speaker: 'Player_Ba', side: 'left', text: '我对他/她暂时没什么想法。', expression: '01' }];
      }
      // 关闭物品栏，播放想法对话
      this._subMenu = null;
      _menuNeedsRedraw = true;
      this.talkingAboutCharacter = true;
      this.talkingAboutItem = false;
      this.dialogueQueue = dialogue;
      this.dialogueIndex = 0;
      this.mode = 'dialogue';
      this.startDialogue();
      console.log(`[Inventory] 想法：人物 ${charId}`);
    } else {
      // 物品想法：从 item_thoughts 获取
      const itemData = this.getSelectedItem();
      if (!itemData) return;
      const itemThoughts = chData.item_thoughts || {};
      dialogue = itemThoughts[itemData.id] || null;
      if (!dialogue) {
        dialogue = [{ speaker: 'Player_Ba', side: 'left', text: '我暂时对这个东西没什么想法。', expression: '01' }];
      }
      // 关闭物品栏，播放想法对话
      this._subMenu = null;
      _menuNeedsRedraw = true;
      this.talkingAboutItem = true;
      this.talkingAboutCharacter = false;
      this.dialogueQueue = dialogue;
      this.dialogueIndex = 0;
      this.mode = 'dialogue';
      this.startDialogue();
      console.log(`[Inventory] 想法：物品 ${itemData.id}`);
    }
  }

  /** 展示当前选中人物给当前场景说话人 */
  /** 展示当前选中人物给当前场景说话人（与 Python show_character_to_character 一致） */
  _inventoryShowCharacter() {
    // 与 Python show_character_to_character 一致：从 displaySpeaker 获取当前 NPC，
    // 若为空则回退到菜单节点的 speaker
    let speakerId = this.displaySpeaker;
    let currentSide = this.displaySide || 'right';
    if (!speakerId) {
      const menuNode = scenarioData?.nodes?.[this.menuNodeId];
      speakerId = menuNode?.speaker || null;
      currentSide = menuNode?.side || 'right';
    }
    if (!speakerId) {
      console.log('[Inventory] 当前无场景说话人');
      return;
    }

    const charList = this.getCharacterList();
    if (charList.length === 0) return;
    const targetId = charList[this.selectedItemIndex];
    if (!targetId) return;

    // 保存当前说话人（对话结束后恢复）
    this.savedDisplaySpeaker = speakerId;
    this.savedDisplaySide = currentSide;

    // 查找 character_talks[speaker][target]（与 Python 一致：从 chapters.{chapter} 获取）
    let dialogue = null;
    this._pendingItemTalkEffects = null;
    const chapterTalks = this._getChapterData().character_talks;
    if (chapterTalks && chapterTalks[speakerId] && chapterTalks[speakerId][targetId]) {
      const raw = chapterTalks[speakerId][targetId];
      if (Array.isArray(raw)) {
        dialogue = raw;
      } else if (raw && Array.isArray(raw.dialogues)) {
        dialogue = raw.dialogues;
        if (raw.effects) this._pendingItemTalkEffects = raw.effects;
      } else {
        dialogue = raw;
      }
    }

    if (!dialogue) {
      // 默认回答（与 Python 一致）
      const defaultText = (speakerId === 'Player_ZLY') ? '我对于这个人暂时没什么要说的。' : '我对这个人不太了解。';
      dialogue = [{ speaker: speakerId, side: currentSide, text: defaultText, expression: '01' }];
    }

    // 关闭物品栏，播放对话，标记为展示人物状态
    this._subMenu = null;
    _menuNeedsRedraw = true;
    this.talkingAboutCharacter = true;
    this.talkingAboutItem = false;
    this.dialogueQueue = dialogue;
    this.dialogueIndex = 0;
    this.mode = 'dialogue';
    this.startDialogue();
    console.log(`[Inventory] 展示人物 ${speakerId} → ${targetId}，播放对话`);

    // 更新 unlockedCharacters
    this.unlockedCharacters.add(targetId);
  }

  // ==================== 举证对白 ====================

  /** 开始举证对白：打开物品栏进入举证模式（与 Python _start_proof_interrupt 一致） */
  _startProofInterrupt() {
    this._inProofInterrupt = true;
    this.mode = 'menu';
    this.inventoryMode = 'item';
    this.selectedItemIndex = 0;
    this.showInventoryMenu('proof');
  }

  /** 处理举证对白中的物品选择（与 Python _handle_proof_interrupt_selection 一致） */
  _handleProofInterruptSelection(itemIndex) {
    if (!this._proofInterruptConfig) return;
    if (!this.inventory || itemIndex < 0 || itemIndex >= this.inventory.length) return;
    const item = this.inventory[itemIndex];
    const itemId = item.id;
    const correctItem = this._proofInterruptConfig.correct_item || '';
    this.showInventory = false;
    this._subMenu = null;
    this._inProofInterrupt = false;
    _menuNeedsRedraw = true;
    if (itemId === correctItem) {
      this._finishProofInterruptSuccess();
    } else {
      this._finishProofInterruptFail();
    }
  }

  /** 举证对白：处理玩家选择的人物（与 Python _handle_proof_interrupt_character_selection 一致） */
  _handleProofInterruptCharacterSelection(charIndex) {
    if (!this._proofInterruptConfig) return;
    const charList = this.getCharacterList();
    if (!charList || charIndex < 0 || charIndex >= charList.length) return;
    const charId = charList[charIndex];
    const correctChar = this._proofInterruptConfig.correct_char || '';
    this.showInventory = false;
    this._subMenu = null;
    this._inProofInterrupt = false;
    _menuNeedsRedraw = true;
    if (charId === correctChar) {
      this._finishProofInterruptSuccess();
    } else {
      this._finishProofInterruptFail();
    }
  }

  /** 举证对白成功：播放成功对话并设置 next 节点（与 Python _finish_proof_interrupt_success 一致） */
  _finishProofInterruptSuccess() {
    const successCfg = this._proofInterruptConfig.success || {};
    const successDialogues = successCfg.dialogues || [];
    const nextNode = successCfg.next || null;
    const nodeId = this._proofInterruptNodeId;
    this._proofInterruptNodeId = null;
    this._proofInterruptConfig = null;
    if (successDialogues.length > 0) {
      this.dialogueQueue = [...successDialogues];
      this.dialogueIndex = 0;
      this.currentSequenceNodeId = nodeId;
      this.mode = 'dialogue';
      this.startDialogue();
      if (nextNode) {
        this._proofInterruptSuccessNext = nextNode;
      }
    } else if (nextNode) {
      this.mode = 'dialogue';
      this.enterNode(nextNode);
    }
  }

  /** 举证对白失败：播放失败对话并标记待重启（与 Python _finish_proof_interrupt_fail 一致） */
  _finishProofInterruptFail() {
    const failCfg = this._proofInterruptConfig.fail || {};
    const failDialogues = failCfg.dialogues || [];
    if (failDialogues.length > 0) {
      this.dialogueQueue = [...failDialogues];
      this.dialogueIndex = 0;
      this.currentSequenceNodeId = this._proofInterruptNodeId;
      this.mode = 'dialogue';
      this._proofInterruptFailPending = true;
      this.startDialogue();
    } else {
      this._restartProofInterrupt();
    }
  }

  /** 重启举证对白节点（与 Python _restart_proof_interrupt 一致） */
  _restartProofInterrupt() {
    const nodeId = this._proofInterruptNodeId;
    if (nodeId) {
      this.mode = 'dialogue';
      this.enterNode(nodeId);
    }
  }

  // ==================== 案情审理 ====================

  /** 处理案情审理按钮点击：评估 outcomes，加载审理对话（与 Python _handle_case_trial 一致） */
  _handleCaseTrial() {
    const chData = this._getChapterData();
    const trialCfg = chData?.case_trials?.[this._activeCaseTrialMenu];
    if (!trialCfg || !trialCfg.outcomes || !trialCfg.outcomes.length) {
      console.log('[CaseTrial] 未找到审理配置');
      this._inCaseTrial = false;
      return;
    }

    // 案情审理的保存提示属于剧情流程，不应被读档标记跳过（与 Python 一致）
    this._justLoaded = false;

    // 预取 chapter_reminders（用于 first_half_ready / investigation_incomplete / dialogues_incomplete 评估）
    const chapterId = scenarioData?.current_chapter || 'prologue';
    const reminders = scenarioData?.chapter_reminders?.[chapterId + '_first_half'] || null;
    let allReminderScenes = [];
    let allReminderMenus = [];
    let allReminderItemUpdates = [];
    if (reminders) {
      allReminderScenes = reminders.required_scenes || [];
      allReminderMenus = reminders.required_menus || [];
      allReminderItemUpdates = reminders.required_item_updates || [];
    }

    // 遍历 outcomes 找第一个匹配的（与 Python 优先级一致）
    // ── DEBUG：输出各场景/对话/物品更新状态 ──
    console.log('[CaseTrial-DEBUG] === 条件检查 ===');
    for (const sid of allReminderScenes) {
      console.log(`  场景: ${sid} → ${this.flags[sid + '_all_done'] ? '✅ 完成' : '❌ 未完成'}`);
    }
    for (const mid of allReminderMenus) {
      console.log(`  对话: ${mid} → ${this.flags['talks_' + mid + '_all_done'] ? '✅ 完成' : '❌ 未完成'}`);
    }
    for (const fk of allReminderItemUpdates) {
      console.log(`  物品更新: ${fk} → ${this._appliedDescriptionUpdates?.has(fk) ? '✅ 已应用' : '❌ 未应用'}`);
    }

    let matchedOutcome = null;
    for (const outcome of trialCfg.outcomes) {
      let conditionMet = false;

      if (outcome.required_scenes && Array.isArray(outcome.required_scenes)) {
        // 条件：required_scenes — 所有场景标志必须为 True
        conditionMet = outcome.required_scenes.every(sid => this.flags[sid + '_all_done']);
      } else if (outcome.condition) {
        // 条件：condition — 表达式评估
        conditionMet = this.evalCondition(outcome.condition);
      } else if (outcome.first_half_ready) {
        // 条件：first_half_ready — 所有章节提醒场景 + 对话 + 物品更新全部完成
        const scenesOk = allReminderScenes.every(sid => this.flags[sid + '_all_done']);
        const menusOk = allReminderMenus.every(mid => this.flags['talks_' + mid + '_all_done']);
        const itemsOk = allReminderItemUpdates.every(fk => this._appliedDescriptionUpdates?.has(fk));
        conditionMet = scenesOk && menusOk && itemsOk;
      } else if (outcome.investigation_incomplete) {
        // 条件：investigation_incomplete — 任一场景未完成
        conditionMet = allReminderScenes.some(sid => !this.flags[sid + '_all_done']);
      } else if (outcome.dialogues_incomplete) {
        // 条件：dialogues_incomplete — 任一菜单对话未完成或物品更新未应用
        const menusOk = allReminderMenus.every(mid => this.flags['talks_' + mid + '_all_done']);
        const itemsOk = allReminderItemUpdates.every(fk => this._appliedDescriptionUpdates?.has(fk));
        conditionMet = !menusOk || !itemsOk;
      } else {
        // 无条件字段 → 兜底 true
        conditionMet = true;
      }

      if (conditionMet) {
        matchedOutcome = outcome;
        break;
      }
    }

    if (!matchedOutcome) {
      console.log('[CaseTrial] 无匹配 outcome');
      this._inCaseTrial = false;
      return;
    }

    const nextNode = matchedOutcome.next_node || null;
    if (nextNode) {
      // 有 next_node 表示真正进入审理流程 → 永久禁用章节提醒（与 Python 一致）
      this._chapterRemindersSuppressed = true;
    }

    // 加载 outcome dialogues 作为对话队列（与 Python _handle_case_trial 一致）
    if (matchedOutcome.dialogues && matchedOutcome.dialogues.length) {
      this.currentSequenceNode = { next: nextNode, dialogues: matchedOutcome.dialogues };
      this.currentSequenceNodeId = '__case_trial__' + this._activeCaseTrialMenu;
      this.dialogueQueue = matchedOutcome.dialogues;
      this.dialogueIndex = 0;
      this.mode = 'dialogue';
      this.startDialogue();
      console.log(`[CaseTrial] 审理开始: ${matchedOutcome.id || 'unnamed'} next=${nextNode}`);
    } else {
      // 无对话，直接跳转
      if (nextNode) {
        this.enterNode(nextNode);
      } else {
        this._inCaseTrial = false;
      }
    }
  }

  // ==================== 对话完成度检查 ====================

  /** 检查指定菜单的所有对话选项是否都已访问（与 Python _check_menu_talks_done 一致）
   *  跳过 is_back / is_confrontation / is_card_game / is_case_trial 等非对话选项 */
  _checkMenuTalksDone(menuId) {
    const node = scenarioData?.nodes?.[menuId];
    if (!node) return false;
    const options = node.options || [];
    let allDone = true;
    for (const opt of options) {
      if (opt.is_back || opt.is_confrontation || opt.is_card_game || opt.is_case_trial) continue;
      const targetId = opt.target;
      if (!targetId) continue;
      const visited = this.visitedNodes.has(targetId);
      if (!visited) {
        console.log(`[MenuTalks-DEBUG] ❌ menu=${menuId} 选项未完成: text="${opt.text}" target="${targetId}" condition="${opt.condition || 'True'}"`);
        allDone = false;
      }
    }
    if (allDone) {
      console.log(`[MenuTalks-DEBUG] ✅ menu=${menuId} 全部对话选项已完成`);
    }
    return allDone;
  }

  // ==================== 保存提示继续 ====================

  /** 保存提示后继续游戏（与 Python _continue_from_save_prompt 一致） */
  _continueFromSavePrompt() {
    const nextNode = this.savePromptNextNode;
    this.savePromptNextNode = null;
    this.savePromptBtnOffset = -720;
    this.savePromptBtnAnimActive = false;
    this.savePromptButtonFocus = -1;
    this.mode = 'dialogue';
    this.dialogueQueue = [];
    this.dialogueIndex = 0;
    if (nextNode) {
      this.enterNode(nextNode);
    } else {
      this.mode = 'menu';
      if (this.confrontationPrevMenu) {
        this.enterNode(this.confrontationPrevMenu);
      } else {
        this.enterNode('scene_city_01');
      }
    }
  }

  // ==================== 章节半节提示性总结发言 ====================

  /** 检查章节半节提示性总结发言。
   *  在场景菜单进入时调用。如果某个 chapter_reminder 的触发条件满足，
   *  且符合触发时机（首次或距上次已过 recurrence_scenes 个场景），
   *  则触发对白。读档后首次进入场景时强制触发。
   *
   *  条件支持两种配置方式：
   *  - required_scenes: 指定一组场景 ID，当所有场景调查完毕时触发
   *  - condition: 直接的 condition 字符串（与 required_scenes 二选一）
   *
   *  与 Python text_adventure.py _check_chapter_reminders() 完全一致。
   *
   *  Returns:
   *      bool: True 如果触发了提醒（此时不应再 show_menu），False 否则。
   */
  _checkChapterReminders() {
    const reminders = scenarioData?.chapter_reminders;
    if (!reminders) return false;

    // 案情审理已触发 → 永久禁用上半节提示性总结发言
    if (this._chapterRemindersSuppressed) return false;

    for (const [reminderId, config] of Object.entries(reminders)) {
      const requiredScenes = config.required_scenes;
      const requireAllDialogues = config.require_all_dialogues || false;
      const condition = config.condition;
      const dialogues = config.dialogues || [];
      const recurrence = config.recurrence_scenes || 4;

      if (!dialogues.length) continue;

      // 检查触发条件
      let conditionMet = false;
      if (requiredScenes && Array.isArray(requiredScenes)) {
        // 场景调查检查
        const scenesOk = requiredScenes.every(sid => this.flags[sid + '_all_done']);

        // 对话完成检查
        let dialoguesOk = true;
        if (requireAllDialogues) {
          const requiredMenus = config.required_menus || [];
          dialoguesOk = requiredMenus.every(mid => this.flags['talks_' + mid + '_all_done']);
        }

        conditionMet = scenesOk && dialoguesOk;

        // 物品讯息更新检查
        const requiredItemUpdates = config.required_item_updates;
        if (conditionMet && requiredItemUpdates && Array.isArray(requiredItemUpdates)) {
          conditionMet = requiredItemUpdates.every(fk => this._appliedDescriptionUpdates?.has(fk));
        }
      } else if (condition) {
        conditionMet = this.evalCondition(condition);
      } else {
        conditionMet = false;
      }

      if (!conditionMet) continue;

      // 初始化计数器
      if (!(reminderId in this.chapterReminderCounters)) {
        this.chapterReminderCounters[reminderId] = 0;
      }

      const counter = this.chapterReminderCounters[reminderId];
      const wasMet = this._reminderConditionsMet[reminderId] || false;
      let shouldTrigger = false;

      if (this._forceChapterReminderCheck) {
        // 读档后强制触发一次
        shouldTrigger = true;
        this._forceChapterReminderCheck = false;
      } else if (!wasMet) {
        // 条件刚从不满足变为满足 → 触发
        shouldTrigger = true;
      } else if (this._pendingSceneTravel) {
        // 仅当玩家通过离开菜单主动前往新场景时计数
        // 角色子菜单、返回当前场景等内部导航不计数
        this._pendingSceneTravel = false;
        const newCounter = counter + 1;
        this.chapterReminderCounters[reminderId] = newCounter;
        if (newCounter >= recurrence) {
          shouldTrigger = true;
        }
      }
      // 如果 counter 已 ≥ recurrence 但本次没有旅行（待在当前场景），
      // 不触发，等待下一次旅行

      if (shouldTrigger) {
        this.chapterReminderCounters[reminderId] = 0;
        this._reminderConditionsMet[reminderId] = true;
        console.log(`[章节提醒] 触发: ${reminderId} dialogues=${dialogues.length} trigger#=${this._chapterReminderTriggerCount || 0}`);
        this._chapterReminderTriggerCount = (this._chapterReminderTriggerCount || 0) + 1;

        // 确保当前菜单节点在 menuStack 中，对话结束后能正确返回
        if (!this.menuStack.length || this.menuStack[this.menuStack.length - 1] !== this.currentNodeId) {
          this.menuStack.push(this.currentNodeId);
        }
        // 清除序列节点，让对话结束后回退到 menuStack
        this.currentSequenceNode = null;
        this.currentSequenceNodeId = null;
        this.dialogueQueue = Array.isArray(dialogues) ? dialogues : [dialogues];
        this.dialogueIndex = 0;
        this.mode = 'dialogue';
        this.startDialogue();
        return true;
      }
    }

    return false;
  }

  // ==================== 生命值与游戏结束 ====================

  /** 启动扣血动画（与 Python start_blood_deduct_animation 一致） */
  startBloodDeductAnimation() {
    this.bloodDeductAnimActive = true;
    this.bloodDeductAnimTimer = 0.55; // BLOOD_DEDUCT_ANIM_DURATION
    this.bloodDeductAnimScale = 1.0;
    this.bloodDeductAnimAlpha = 255;
    try { playSound('sfx_behit'); } catch (_) {}
  }

  /** 更新扣血动画（与 Python 血量扣减动画更新一致） */
  updateBloodDeductAnim(dt) {
    if (!this.bloodDeductAnimActive) return;
    this.bloodDeductAnimTimer = Math.max(0, this.bloodDeductAnimTimer - dt);
    if (this.bloodDeductAnimTimer <= 0) {
      this.blood = Math.max(0, this.blood - 1);
      this.bloodDeductAnimActive = false;
      console.log(`[Blood] 动画结束扣血, 剩余: ${this.blood}`);
      // 仅在审理/举证对白阶段且尚未触发 game_over 时处理（advanceDialogue 同步扣血可能已触发）
      if (this.blood <= 0 && (this._inCaseTrial || this._proofInterruptFailPending)) {
        this._inCaseTrial = false;
        this._proofInterruptFailPending = false;
        // 选项对白模式下不立即触发 game_over，由 _onDialogueQueueEnd 的 fail_next 处理
        if (!this.choiceConfig) {
          this.triggerGameOver();
        }
      }
    } else {
      const progress = 1.0 - this.bloodDeductAnimTimer / 0.55;
      this.bloodDeductAnimScale = 1.0 + progress * 1.0; // 1.0 → 2.0
      this.bloodDeductAnimAlpha = Math.floor(255 * (1.0 - progress));
    }
  }

  /** 扣除血量（与 Python deduct_blood 一致：通过动画执行，不直接扣减） */
  deductBlood(amount) {
    if (this.blood > 0 && !this.bloodDeductAnimActive) {
      this.startBloodDeductAnimation();
    }
    return this.blood;
  }

  /** 触发游戏结束（与 Python _trigger_game_over 一致） */
  triggerGameOver() {
    const chData = this._getChapterData();
    const trialCfg = chData?.case_trials?.[this._activeCaseTrialMenu];
    if (!trialCfg || !trialCfg.game_over) {
      console.log('[GameOver] 未找到 game_over 配置');
      this._inCaseTrial = false;
      this.enterNode('__main_menu__');
      return;
    }
    const go = trialCfg.game_over;
    this._inCaseTrial = false;
    this._proofInterruptFailPending = false;
    this.choiceConfig = null;
    // 设置 game over 阶段状态（与 Python 一致）
    this.gameOverActive = true;
    this.gameOverPhase = 'dialogue';
    this.gameOverConfig = go;
    console.log(`[GameOver] go config found, fail_dialogue=${go.fail_dialogue || 'none'}`);

    // 停止 BGM，播放失败 BGM
    if (go.bgm) {
      try { stopBgm(); } catch (_) {}
      try { playBgm(go.bgm, 0); } catch (_) {}
    }

    // 加载失败对话
    const failNodeId = go.fail_dialogue;
    if (failNodeId) {
      const failNode = scenarioData.nodes[failNodeId];
      console.log(`[GameOver] failNodeId=${failNodeId}, failNode=${failNode ? 'found' : 'NOT FOUND'}, dialogues=${failNode?.dialogues?.length || 0}`);
      if (failNode && failNode.dialogues && failNode.dialogues.length) {
        // 对话结束后，触发 fail_event
        this.currentSequenceNode = {
          next: '__game_over_event__',
          dialogues: failNode.dialogues,
          trigger_event: null
        };
        this.currentSequenceNodeId = '__game_over__';
        this.dialogueQueue = failNode.dialogues;
        this.dialogueIndex = 0;
        this.mode = 'dialogue';
        this.startDialogue();
        console.log('[GameOver] 播放失败对话');
        return;
      }
    }

    // 无对话，直接显示 fail_event
    this._showGameOverEvent(go);
  }

  /** 显示 game_over 事件图片 + 文本（复用 event 渲染） */
  _showGameOverEvent(go) {
    console.log(`[GameOver] _showGameOverEvent called, fail_event=${go.fail_event ? 'yes' : 'no'}`);
    if (go.fail_event) {
      this.gameOverPhase = 'event';
      // 事件结束后通过 _gameOverAdvance 推进到 text 阶段
      this.triggerEvent({
        image: go.fail_event.image,
        text: go.fail_event.text || []
      }, { _gameOverEventEnd: true });
    } else {
      // 无事件，直接进入 text 阶段
      this._gameOverAdvance();
    }
  }

  /** 游戏结束流程阶段推进（与 Python _game_over_advance 一致） */
  _gameOverAdvance() {
    const go = this.gameOverConfig;
    if (this.gameOverPhase === 'dialogue') {
      // 对话结束，清除立绘
      this.displaySpeaker = null;
      this.prevSpeaker = null;
      this.charTransitionTime = 0;
      this.dialogueQueue = [];
      this.dialogueIndex = 0;
      // 进入事件阶段
      this._showGameOverEvent(go);
    } else if (this.gameOverPhase === 'event') {
      // 事件播放完毕，进入黑屏文字阶段
      this.gameOverPhase = 'text';
      this.gameOverTextTimer = 4.0;
      this.gameOverTextAlpha = 0;
      // 清除事件画面和所有 UI
      this.eventPhase = null;
      this.eventConfig = null;
      this.eventImage = null;
      this.showingCharacter = null;
      this.showingItem = null;
      this._uiSceneLabel = null;
      this.sceneLabel = null;
      this.investigationActive = false;
      this._subMenu = null;
      this.displaySpeaker = null;
      this.prevSpeaker = null;
      // 隐藏所有 UI DOM 元素
      if (typeof hideAllGameUI === 'function') hideAllGameUI();
      console.log('[GameOver] → text 阶段（黑屏文字）');
    } else if (this.gameOverPhase === 'text') {
      // 文字显示完毕，进入淡出阶段
      this.gameOverPhase = 'fade_out';
      this.gameOverTextTimer = 1.5;
      console.log('[GameOver] → fade_out 阶段');
    } else if (this.gameOverPhase === 'fade_out') {
      // 完全淡出，回到标题画面
      try { stopBgm(); } catch (_) {}
      this.gameOverActive = false;
      this.gameOverPhase = null;
      this.gameOverConfig = null;
      this.gameOverTextAlpha = 0;
      console.log('[GameOver] → 标题画面');
      this.enterNode('__main_menu__');
    }
  }

  // ==================== 彩绘牌戏 ====================

  /** 启动彩绘牌戏（与 Python start_card_game 一致） */
  startCardGame(cardGameId) {
    const cardGames = this._getChapterData().card_games || {};
    const cgConfig = cardGames[cardGameId];
    if (!cgConfig) {
      console.log(`[牌戏] 未找到牌戏配置: ${cardGameId}`);
      return;
    }
    this.cardGameActive = true;
    this.cardGameId = cardGameId;
    this.cardGameConfig = cgConfig;
    this.cardGameReturnMenu = this.menuNodeId;
    this.cardGameStage = 'intro';
    // 设置说话人
    const menuNode = scenarioData?.nodes?.[this.menuNodeId] || {};
    const speaker = menuNode.speaker || 'Player_XQ';
    const side = menuNode.side || 'right';
    this.setDisplayCharacter(speaker, side, '01');
    // 播放 intro 对话
    const introDialogues = cgConfig.intro_dialogues || [];
    this._subMenu = null;
    _menuNeedsRedraw = true;
    this.dialogueQueue = [...introDialogues];
    this.dialogueIndex = 0;
    this.mode = 'dialogue';
    this.startDialogue();
    console.log(`[牌戏] 开始牌戏: ${cardGameId}`);
  }

  /** 牌戏 intro 对话结束后进入谜题（与 Python _advance_card_game_dialogue 一致） */
  _advanceCardGameDialogue() {
    if (!this.cardGameActive) return false;
    const cgConfig = this.cardGameConfig;
    if (!cgConfig) return false;
    const puzzleConfig = cgConfig.puzzle;
    if (puzzleConfig) {
      console.log(`[牌戏] intro 对话结束，进入谜题`);
      this.dialogueQueue = [];
      this.dialogueIndex = 0;
      this.cardGameStage = 'playing';
      startPuzzle(puzzleConfig);
      return true;
    }
    return false;
  }

  /** 牌戏结束后的奖励/清理（与 Python _finish_card_game 一致） */
  _finishCardGame(success) {
    const cgConfig = this.cardGameConfig;
    const cardGameId = this.cardGameId;
    if (success && cgConfig) {
      const completionFlag = cgConfig.completion_flag || '';
      const rewardItem = cgConfig.reward_item || '';
      const returnMenu = this.cardGameReturnMenu;
      if (completionFlag && !this.flags[completionFlag]) {
        this.flags[completionFlag] = true;
        this.cardGamesCompleted.add(cardGameId);
        console.log(`[牌戏] 首次通关: ${cardGameId}`);
        if (rewardItem) {
          const alreadyHas = this.inventory.some(item => item.id === rewardItem);
          if (!alreadyHas) {
            const itemDef = this._getItemDef(rewardItem);
            if (itemDef) {
              const msg = `获得物品【${itemDef.name}】`;
              this.cardGameFinishResumeInfo = {
                mode: 'menu',
                targetMenu: returnMenu,
                cardGameFinish: true
              };
              const itemDict = {
                id: itemDef.id,
                name: itemDef.name,
                description: itemDef.description || '',
                image: itemDef.image || ''
              };
              // 加入物品栏（reward_item 实际发放，与 gainItem 一致）
              this.inventory.push(itemDict);
              this.cardGameActive = false;
              // 播放物品获取动画
              this.showingItem = itemDict;
              this.showingCharacter = null;
              this.itemFeedbackActive = true;
              this.itemFeedbackItem = itemDict.id;
              this.itemFeedbackText = msg;
              this.itemFeedbackTimer = 0;
              this.itemFeedbackType = 'gain';
              this.itemFeedbackPhase = 'prompt';
              this.gainResumeState = {
                mode: 'menu',
                inventoryMode: 'item',
                selectedItemIndex: 0,
                cardGameFinish: true,
                targetMenu: returnMenu
              };
              if (typeof playSound === 'function') playSound('sfx_item_gain');
              this.mode = 'item_feedback';
              console.log(`[牌戏] 发放奖励物品: ${rewardItem}`);
              return;
            }
          }
        }
      }
    }
    // 无奖励或已有物品：直接返回菜单
    const returnMenu = this.cardGameReturnMenu;
    this.cardGameActive = false;
    this.cardGameId = null;
    this.cardGameConfig = null;
    this.cardGameReturnMenu = null;
    this.cardGameStage = null;
    if (returnMenu) {
      this.enterNode(returnMenu);
    }
  }

  /** 调查 */
  startInvestigation() {
    const sceneNode = scenarioData.nodes[this.currentNodeId];
    if (!sceneNode) return;

    try { playSound('sfx_ui_confirm'); } catch (_) {}

    // investigation_resets：清除旧的已调查标记
    const invResets = sceneNode.investigation_resets || {};
    for (const [flagKey, pointIds] of Object.entries(invResets)) {
      if (this.evalCondition(flagKey)) {
        for (const pid of pointIds) {
          const invFlag = `investigated_${this.currentNodeId}_${pid}`;
          if (this.flags[invFlag] !== undefined) {
            delete this.flags[invFlag];
            console.log(`[调查重置] 清除标记: ${invFlag}`);
          }
        }
      }
    }

    // 刷新调查点（条件过滤）
    this._refreshInvestigationPoints();

    // 启动调查模式
    startSceneInvestigation();
  }

  /** 刷新调查点列表（条件过滤，同 id 只取第一个满足条件的） */
  _refreshInvestigationPoints() {
    const sceneNode = scenarioData.nodes[this.currentNodeId];
    const rawPoints = sceneNode ? (sceneNode.investigate_points || []) : [];
    const activePoints = [];
    const seenIds = new Set();

    for (const pt of rawPoints) {
      const cond = pt.condition || 'True';
      if (this.evalCondition(cond)) {
        const pid = pt.id;
        if (pid && !seenIds.has(pid)) {
          activePoints.push(pt);
          seenIds.add(pid);
        }
      }
    }

    this.investigationPoints = activePoints;
  }

  /** 从对话回到调查模式 */
  _resumeInvestigation() {
    this.investigationActive = true;
    this.mode = 'investigation';
    this._invDialogueActive = false;
    this._invJustTriggered = false;
    if (this._invResumeCursorX !== undefined) {
      this.investigationCursorX = this._invResumeCursorX;
      this.investigationCursorY = this._invResumeCursorY;
    }
    this._invResumeCursorX = undefined;
    this._invResumeCursorY = undefined;
    this._invResumeNodeAfterDlg = null;
    this._invSuccessIconPending = false;
    canvas.style.cursor = 'none';
    console.log('[Investigation] 恢复调查模式');
  }

  /** 设置面板 */
  toggleSettings() {
    if (this._subMenu === 'settings') {
      this.closeSettings();
    } else {
      this._subMenu = 'settings';
      this.settingsMenuFocus = _IS_MOBILE ? -1 : 0;
    }
  }

  closeSettings() {
    this._subMenu = null;
  }

  // ==================== 对话系统 ====================

  startDialogue() {
    console.log(`[startDialogue] idx=${this.dialogueIndex} queueLen=${this.dialogueQueue.length} mode=${this.mode}`);
    try {
      this._startDialogueCore();
    } catch (e) {
      console.error(`[startDialogue] 异常:`, e.message, e.stack);
    }
  }

  /** 调查触发的对话：tag 标记 _invDialogueActive，renderUI 保留调查层 */
  startDialogueForInvestigation() {
    this._startDialogueCore();
  }

  _startDialogueCore() {
    console.log(`[DialogueCore] ENTER idx=${this.dialogueIndex} queueLen=${this.dialogueQueue.length} mode=${this.mode}`);
    // 用循环跳过无效行，避免递归导致栈溢出
    while (true) {
      // 跳过已满足条件的 gain_item 行
      while (this.dialogueIndex < this.dialogueQueue.length) {
        const d = this.dialogueQueue[this.dialogueIndex];
        if (d && typeof d === 'object' && d.gain_item) {
          const cond = d.condition;
          if (cond && !this.evalCondition(cond)) {
            this.dialogueIndex++;
            continue;
          }
        }
        break;
      }

      // 队列播完
      if (!this.dialogueQueue || this.dialogueIndex >= this.dialogueQueue.length) {
        console.log(`[DialogueCore] 队列播完, idx=${this.dialogueIndex} queueLen=${this.dialogueQueue.length}`);
        this._onDialogueQueueEnd();
        return;
      }

      const d = this.dialogueQueue[this.dialogueIndex];
      if (!d || typeof d !== 'object' || !d.text) {
        // 非对话行，跳过
        if (d && d.text === undefined) {
          console.log(`[DialogueCore] 跳过非对话行: idx=${this.dialogueIndex} keys=${Object.keys(d || {}).join(',')}`);
          this.dialogueIndex++;
          continue;  // 用循环继续，而非递归
        }
        console.warn('[Dialogue] 无效对话行:', d);
        this.dialogueIndex++;
        continue;  // 用循环继续，而非递归
      }

      // 找到有效对话行，跳出循环进入正常处理
      break;
    }

    const d = this.dialogueQueue[this.dialogueIndex];
    // ── show_card / show_item 卡片叠加层（与 Python 一致） ──
    const showCardId = d.show_card || null;
    const showItemId = d.show_item || null;
    const curCardType = showCardId ? 'character' : (showItemId ? 'item' : null);
    const curCardId = showCardId || showItemId;

    // 消费 _pendingProofShow（举证成功后第一句对话）
    let _proofCardSet = false;
    if (this._pendingProofShow) {
      const pp = this._pendingProofShow;
      this._pendingProofShow = null;
      if (pp.type === 'item') {
        this.showingItem = pp.data;
        this.showingCharacter = null;
      } else if (pp.type === 'character') {
        this.showingCharacter = pp.data;
        this.showingItem = null;
      }
      this.cardOverlayActive = true;
      this.cardOverlayStay = true;
      _proofCardSet = true;
      // 更新 prev 检测，后续 show_item/show_card 相同则保持连续
      this._prevCardType = pp.type;
      this._prevCardId = pp.data && pp.data.id;
    }

    // 检测是否连续相同卡片
    const isConsecutive = (
      (this.cardOverlayActive || _proofCardSet) && curCardType !== null &&
      this._prevCardType === curCardType && this._prevCardId === curCardId
    );

    if (isConsecutive) {
      // 连续相同卡片：保持不消失，不播放音效
      this.cardOverlayActive = true;
      this.cardOverlayStay = true;
    } else {
      // 非连续：先清除上一句残留的卡片（举证刚设置的卡片不清除）
      if (this.cardOverlayActive && !_proofCardSet) {
        this.cardOverlayActive = false;
        this.showingCharacter = null;
        this.showingItem = null;
      }
      this.cardOverlayStay = false;

      // 设置新卡片
      if (!_proofCardSet) {
        if (showCardId) {
          // 与物品栏一致：优先从 chapters.{chapter}.characters 获取 face_*.png 头像
          const chData = this._getChapterData();
          const chChars = (chData.characters || {});
          const chDef = chChars[showCardId] || charactersData[showCardId];
          if (chDef) {
            this.showingItem = null;
            this.showingCharacter = { id: showCardId, ...chDef };
            this.cardOverlayActive = true;
            this.cardOverlayStay = true;
            try { playSound('sfx_frame_move'); } catch (_) {}
          }
        } else if (showItemId) {
          const itemDef = this._getItemDef(showItemId);
          if (itemDef) {
            this.showingItem = { id: showItemId, ...itemDef };
            this.showingCharacter = null;
            this.cardOverlayActive = true;
            this.cardOverlayStay = true;
            try { playSound('sfx_frame_move'); } catch (_) {}
          }
        }
      }
    }

    // 记录当前卡片状态，供下一句连续检测
    // 举证卡片设置但本句无 show_item 时，保留 prev 不变（供下一句连续检测）
    if (!(curCardType === null && _proofCardSet)) {
      this._prevCardType = curCardType;
      this._prevCardId = curCardId;
    }

    // 设置说话人
    if (d.speaker) {
      this.setDisplayCharacter(d.speaker, d.side || 'right', d.expression || '01');
    }

    // 纯音效触发（不带动画，与 char_shake 解耦）
    if (d.sfx) {
      try { playSound(d.sfx); } catch (_) {}
    }

    // 角色抖动（char_shake）
    if (d.char_shake) {
      this.charShakeOffsetX = 0;
      this.charShakeOffsetY = 0;
      // 简易抖动：用 3 次交替偏移模拟抖动效果（持续 0.3s）
      let shakeCount = 0;
      const shakeInterval = setInterval(() => {
        if (shakeCount >= 6) {
          clearInterval(shakeInterval);
          this.charShakeOffsetX = 0;
          this.charShakeOffsetY = 0;
          return;
        }
        if (shakeCount % 2 === 0) {
          this.charShakeOffsetX = 8;
          this.charShakeOffsetY = -4;
        } else {
          this.charShakeOffsetX = -6;
          this.charShakeOffsetY = 4;
        }
        shakeCount++;
      }, 50);
      // 播放抖动音效
      if (d.char_shake.sfx) {
        try { playSound(d.char_shake.sfx); } catch (_) {}
      }
    }

// 设置文本
    this.fullText = d.text || '';

    // 打字音效：根据说话人性别选择（与 Python 一致）
    this.lastTypingSoundChar = -1;
    if (this.fullText.indexOf('内心独白') !== -1) {
      this.currentTypingSound = 'sfx_dialogue_inner_voice';
    } else {
      const info = this.getCharacterInfo(d.speaker);
      const gender = (info && info.gender) ? info.gender : 'male';
      if (gender === 'female') {
        this.currentTypingSound = 'sfx_dialogue_typing_female';
      } else {
        this.currentTypingSound = 'sfx_dialogue_typing_male';
      }
    }

    // 开始打字
    this.textOffset = 0;
    this.typingIndex = 0;
    this.typingComplete = false;
    this.mode = 'dialogue';

    // 先显示对话框（确保 dialogBoxEl 可见且尺寸正确，measurePageBreak 需要）
    showDialogBox(this.getDisplayName(d.speaker), '');
    showHintArrow(false);

    // 计算第一页的结束位置（必须在 showDialogBox 之后，否则对话框隐藏时 offsetWidth=0 导致分页失败）
    this.textPageEnd = measurePageBreak(this.fullText);

    console.log(`[TYPING-DEBUG] _startDialogueCore: idx=${this.dialogueIndex}/${this.dialogueQueue.length} typingIdx=${this.typingIndex} complete=${this.typingComplete} textOffset=${this.textOffset} textPageEnd=${this.textPageEnd} fullTextLen=${this.fullText.length} queueEnd?=${this.dialogueIndex >= this.dialogueQueue.length} fullText="${this.fullText.substring(0, 40)}"`);

    // 更新调试面板
    updateDebug([
      `模式: dialogue`,
      `节点: ${this.currentNodeId}`,
      `说话人: ${this.getDisplayName(d.speaker)}`,
      `对话: ${this.dialogueIndex + 1}/${this.dialogueQueue.length}`,
      `文本: \"${this.fullText.substring(0, 30)}...\"`,
    ].join('\n'));
  }

  /** 对话队列结束时处理 */
  _onDialogueQueueEnd() {
    console.log(`[DialogueEnd] mode=${this.mode} resumeState=${this.confrontationResumeState != null} pendingOutro=${this.confrontationPendingOutro} seqNext=${this.currentSequenceNode?.next || 'none'} seqId=${this.currentSequenceNodeId || 'none'} blood=${this.blood} _inCaseTrial=${this._inCaseTrial} _proofInterruptFailPending=${this._proofInterruptFailPending} choiceConfig=${this.choiceConfig != null}`);
    // 隐藏对话框
    hideDialogBox();

    // 清除卡片叠加层（与 Python 一致：对话结束时清除残留卡片）
    this.cardOverlayActive = false;
    this.cardOverlayStay = false;
    this.showingCharacter = null;
    this.showingItem = null;

    // ── game_over 对话结束 → 推进到 event/text 阶段（必须在举证重启之前检查） ──
    if (this.gameOverActive && this.gameOverPhase === 'dialogue') {
      this._gameOverAdvance();
      return;
    }

    // ── 举证对白：失败对话结束后重启当前节点 ──
    if (this._proofInterruptFailPending) {
      this._proofInterruptFailPending = false;
      if (this.currentSequenceNodeId) {
        this.playedSequences.add(this.currentSequenceNodeId);
      }
      this._restartProofInterrupt();
      return;
    }

    // ── 举证对白：前导对话播完后，自动进入举证界面 ──
    if (this._proofInterruptNodeId && this._proofInterruptConfig) {
      if (this.currentSequenceNodeId) {
        this.playedSequences.add(this.currentSequenceNodeId);
      }
      this._startProofInterrupt();
      return;
    }

    // ── 举证对白：成功对话播完后，进入 next 节点 ──
    if (this._proofInterruptSuccessNext) {
      if (this.currentSequenceNodeId) {
        this.playedSequences.add(this.currentSequenceNodeId);
      }
      const nextNode = this._proofInterruptSuccessNext;
      this._proofInterruptSuccessNext = null;
      this.mode = 'dialogue';
      this.enterNode(nextNode);
      return;
    }

    // ── 选项对白：正确选择后对话已播完，进入 next 节点（与 Python choice_continue_done 一致） ──
    if (this.choiceContinueDone) {
      this.choiceContinueDone = false;
      this.choiceActive = false;
      this.choiceActive2 = false;
      const cfg = this.choiceConfig;
      this.choiceConfig = null;
      const nextNode = this.choiceNextNode;
      if (nextNode) {
        this.enterNode(nextNode);
      } else {
        this.mode = 'dialogue';
      }
      return;
    }
    // ── 选项对白：失败对话结束后，血量归零 → 进入 fail_next 或 game_over ──
    if (this.choiceFailDialogue && this.choiceConfig !== null && this.blood <= 0) {
      this.choiceConfig = null;
      this.choiceActive = false;
      this.choiceActive2 = false;
      if (this.choiceFailNext) {
        this.enterNode(this.choiceFailNext);
        return;
      }
      // 无 fail_next → 触发 game_over
      this.triggerGameOver();
      return;
    }

    // ── 谜题失败对话结束，回到谜题界面（与 Python puzzle_dialog_mode == "fail" 一致） ──
    if (this.puzzleDialogMode === 'fail' && this.puzzleConfig) {
      const config = this.puzzleConfig;
      this.puzzleDialogMode = null;
      this.dialogueQueue = [];
      this.dialogueIndex = 0;
      startPuzzle(config);
      return;
    }

    // ── 举证失败对话结束后恢复陈述模式（与 Python pending_proof_fail_resume 一致） ──
    if (this.pendingProofFailResume) {
      this.pendingProofFailResume = false;
      if (this.confrontationState) {
        this.confrontationShowButtons = true;
        this.mode = 'confrontation';
        // 与 Python 一致：恢复陈述时立绘回到质问说话人（陈述者），避免被对话最后一句讲话人残留
        if (this.confrontationState.speaker) {
          this.setDisplayCharacter(this.confrontationState.speaker, this.confrontationState.side || 'right', '01');
        }
        _showConfrontStatementDialog();
        console.log('[DialogueEnd] 举证失败对话结束，恢复陈述模式');
        return;
      }
    }

    // ── 牌戏 intro 对话结束，进入谜题 ──
    if (this.cardGameActive && this.cardGameStage === 'intro') {
      this._advanceCardGameDialogue();
      return;
    }
    // ── 牌戏成功对话结束，发放奖励 ──
    if (this.cardGameActive && this.cardGameStage === 'playing') {
      this._finishCardGame(true);
      return;
    }
    // ── 牌戏返回对话结束，回菜单 ──
    if (this.cardGameActive && this.cardGameStage === 'returning') {
      this._finishCardGame(false);
      return;
    }

    // ── 展示物品/人物对话结束后返回物品栏（与 Python finish_item_talk / finish_character_talk 一致） ──
    if (this.talkingAboutItem || this.talkingAboutCharacter) {
      // ── 应用展示物品对话后的 effects（与 Python apply_current_item_talk_effect 一致） ──
      let hasDescUpdate = false;
      if (this._pendingItemTalkEffects) {
        const fx = this._pendingItemTalkEffects;
        if (fx.set_flag && typeof fx.set_flag === 'object') {
          const flagKeys = Object.keys(fx.set_flag);
          for (const [k, v] of Object.entries(fx.set_flag)) {
            this.flags[k] = v;
            console.log(`[ItemTalk] set_flag: ${k} = ${v}`);
          }
          // 检查并应用物品/人物描述更新（与 Python _check_and_apply_description_updates 一致）
          const updatedItems = this._checkAndApplyDescriptionUpdates(flagKeys);
          if (updatedItems.length > 0) {
            hasDescUpdate = true;
            // 与 Python 一致：进入 item_feedback 模式，显示物品卡片+提示框
            const ui = updatedItems[0];
            this.itemFeedbackActive = true;
            this.itemFeedbackItem = ui.id;
            this.itemFeedbackText = `讯息已更新【${ui.name}】`;
            this.itemFeedbackTimer = 0;
            this.itemFeedbackType = 'desc_update';
            this.itemFeedbackPhase = 'prompt';
            // 与 Python 一致：desc_update 和 gain 都播放 sfx_item_gain
            if (typeof playSound === 'function') playSound('sfx_item_gain');
            this.showingItem = ui.id;
            this.showingCharacter = null;
            this.mode = 'item_feedback';
            // 保存物品栏状态，反馈结束后回物品栏（与 Python gain_resume_state 一致）
            this.gainResumeState = {
              mode: 'inventory',
              inventoryMode: this.inventoryMode,
              selectedItemIndex: this.selectedItemIndex
            };
          }
        }
        this._pendingItemTalkEffects = null;
      }

      // 恢复之前保存的说话人
      if (this.savedDisplaySpeaker) {
        this.setDisplayCharacter(this.savedDisplaySpeaker, this.savedDisplaySide || 'right', '01');
        this.savedDisplaySpeaker = null;
        this.savedDisplaySide = null;
      }
      this.talkingAboutItem = false;
      this.talkingAboutCharacter = false;

      // 如果没有描述更新，直接回物品栏（与 Python finish_item_talk 一致）
      if (!hasDescUpdate) {
        // 保留当前模式和选中位置（与 Python show_inventory_menu(reset_index=False) 一致）
        const savedMode = this.inventoryMode;
        const savedIndex = this.selectedItemIndex;
        // 切回 menu 模式（关键：否则物品栏交互逻辑检查 mode !== 'menu' 会失效）
        this.mode = 'menu';
        this.state = 'menu';
        // 重新打开物品栏，保留模式和选中位置
        this._subMenu = 'inventory';
        if (typeof _invBtnHighlight !== 'undefined') _invBtnHighlight = null;
        this.inventoryMode = savedMode;
        this.selectedItemIndex = savedIndex;
        this.previewSpeaker = null;
        this.previewAlpha = 0;
      this.previewTargetAlpha = 0;
        _menuNeedsRedraw = true;
        console.log(`[Inventory] 展示对话结束，返回物品栏 mode=${savedMode} index=${savedIndex}`);
      }
      return;
    }

    // 立绘淡出（对应 Python set_display_character(None, "right")）
    // 质问系统追问/举证对话结束后不淡出立绘（applyFollowUpResult/applyProofEffect 会恢复）
    // outro 期间也不淡出（confrontationPendingOutro 标记）
    if (this.displaySpeaker && !this.confrontationResumeState && this.mode !== 'confrontation' && !this.confrontationPendingOutro) {
      this.setDisplayCharacter(null, 'right');
    }

    // ── 来自 trigger_event 的 follow_dialogues 播放完毕 ──
    if (this._invResumeNodeAfterDlg !== null) {
      this._resumeAfterEventDialogues();
      return;
    }

    // 调查触发对话完成：设置已调查标记并回到调查模式
    if (this._invResumeCursorX !== undefined) {
      this._invDialogueActive = false;
      this._invJustTriggered = false;
      const flagKey = this._invPendingFlag;
      if (flagKey) {
        this.flags[flagKey] = true;
        console.log(`[Investigation] 设定已调查: ${flagKey}`);
      }
      this._invPendingFlag = undefined;

      // 检查 puzzle（与 Python investigation_pending_puzzle 一致）
      if (this._invPendingPuzzle) {
        const puzzleConfig = this._invPendingPuzzle;
        this._invPendingPuzzle = null;
        const pointId = puzzleConfig._pointId || '';
        const solvedFlag = `puzzle_solved_${pointId}`;
        if (!this.flags[solvedFlag]) {
          // 未解决 → 启动谜题
          this._invPendingFlag = undefined;
          this.dialogueQueue = [];
          this.dialogueIndex = 0;
          startPuzzle(puzzleConfig);
          return;
        }
        // 已解决 → 回到调查
        this._resumeInvestigation();
        return;
      }

      // 检查 trigger_event：播放事件动画，完成后播放 follow_dialogues 再回到调查
      if (this._invPendingEvent) {
        const eventConfig = this._invPendingEvent;
        const followDlg = eventConfig.follow_dialogues || null;
        const successIcon = eventConfig.success_icon || false;
        const resumeNode = eventConfig.resume_node || null;
        this._invPendingEvent = null;

        // 构建 resume 状态：事件结束后恢复调查
        const resumeState = {
          mode: 'investigation',
          next_node: null,
          _invFollowDialogues: followDlg,
          _invSuccessIcon: successIcon,
          _invResumeNode: resumeNode,
          _invResumeCursorX: this._invResumeCursorX,
          _invResumeCursorY: this._invResumeCursorY
        };

        // 启动 trigger_event
        this.triggerEvent(eventConfig, resumeState);
        return;
      }

      // 回到调查模式
      this._resumeInvestigation();
      return;
    }

    // ── 质问系统：追问/举证对话结束 → 处理结果 ──
    if (this.confrontationResumeState) {
      // 记录已播放（下次同一追问/举证对话可显示跳过按钮）
      if (this.currentSequenceNodeId) {
        this.playedSequences.add(this.currentSequenceNodeId);
      }
      const isProof = this.confrontationResumeState.isProof || false;
      if (isProof) {
        // 举证对话结束 → 应用举证效果
        const effect = this.confrontationResumeState.effect || {};
        this.confrontationResumeState = null;
        _applyProofEffect(effect);
      } else {
        // 追问对话结束 → 应用追问结果
        applyFollowUpResult();
      }
      return;
    }

    // ── 质问系统：outro 对话结束 → 显示总结界面 ──
    if (this.confrontationPendingOutro && this.currentSequenceNode && this.currentSequenceNode.confrontation_summary) {
      showConfrontationSummary(this.currentSequenceNode.confrontation_summary);
      this.playedSequences.add(this.currentSequenceNodeId);
      return;
    }

    // 检查 sequence 节点的 trigger_event（对话播放完后触发事件）
      if (this.currentSequenceNode && this.currentSequenceNode.trigger_event) {
        const triggerCfg = this.currentSequenceNode.trigger_event;
        const followDlg = triggerCfg.follow_dialogues || null;
        const resumeNode = triggerCfg.resume_node || null;
        const successIcon = triggerCfg.success_icon || false;
        const nextNode = this.currentSequenceNode.next || null;

        // 构建 resume 状态
        const resumeState = {
          mode: 'dialogue',
          next_node: nextNode,
          _invFollowDialogues: followDlg,
          _invSuccessIcon: successIcon,
          _invResumeNode: resumeNode,
          _invNextNodeAfterDlg: followDlg ? nextNode : null,
        };

        // 清除 currentSequenceNode 以防止重复触发
        this.playedSequences.add(this.currentSequenceNodeId);
        this.currentSequenceNode = null;
        this.currentSequenceNodeId = null;

        // 启动 trigger_event
        this.triggerEvent(triggerCfg, resumeState);
        return;
      }

    // ── 保存提示：序列节点对话结束后触发（与 Python advance_dialogue save_prompt 一致） ──
    if (this.currentSequenceNode && this.currentSequenceNode.save_prompt) {
      console.log(`[DEBUG] save_prompt triggered on ${this.currentSequenceNodeId}, next=${this.currentSequenceNode.next}`);
      this.savePromptNextNode = this.currentSequenceNode.next;
      // 读档后跳过保存提示，直接继续
      if (this._justLoaded) {
        this._justLoaded = false;
        this._continueFromSavePrompt();
        return;
      }
      // 进入 save_prompt 模式（与 Python start_dialogue save_prompt 分支一致）
      // 复用 fullText/typingIndex/typingComplete/textPageEnd，使打字机/分页/音效系统统一工作
      this.mode = 'save_prompt';
      const sp = this.currentSequenceNode.save_prompt;
      const speaker = sp.speaker || 'Player_Ba';
      const side = sp.side || 'left';
      const expression = sp.expression || '01';
      const promptText = sp.text || '是否要现今为止的进度保存一下？';
      this.setDisplayCharacter(speaker, side, expression);
      this.savePromptSpeaker = speaker;
      this.fullText = promptText;
      this.textOffset = 0;
      this.typingIndex = 0;
      this.typingComplete = false;
      this.lastTypingSoundChar = -1;
      // 打字音效按说话人性别选择（与 Python 一致）
      if (this.fullText.indexOf('内心独白') !== -1) {
        this.currentTypingSound = 'sfx_dialogue_inner_voice';
      } else {
        const info = this.getCharacterInfo(speaker);
        const gender = (info && info.gender) ? info.gender : 'male';
        this.currentTypingSound = (gender === 'female') ? 'sfx_dialogue_typing_female' : 'sfx_dialogue_typing_male';
      }
      this.savePromptBtnOffset = -720;
      this.savePromptBtnAnimActive = true;
      // 手柄模式默认聚焦"保存"，鼠标模式无焦点
      this.savePromptButtonFocus = (typeof gamepad !== 'undefined' && gamepad.usingGamepad) ? 0 : -1;
      // 显示对话框（含说话人名，留空文本让打字系统逐字填充）
      showDialogBox(this.getDisplayName(speaker), '');
      showHintArrow(false);
      // 计算第一页结束位置（必须在 showDialogBox 之后，否则对话框隐藏时 offsetWidth=0 导致分页失败）
      this.textPageEnd = measurePageBreak(this.fullText);
      return;
    }

    // 检查 sequence 的下一个节点
    if (this.currentSequenceNode && this.currentSequenceNode.next) {
      const nextId = this.currentSequenceNode.next;
      console.log(`[DEBUG-MENU] 对话结束，currentSequenceNode.next=${JSON.stringify(nextId)} seqId=${this.currentSequenceNodeId}`);
      // 处理条件 next（{target, condition} 对象）
      if (typeof nextId === 'object' && nextId.target) {
        const targets = this._resolveConditionalNext(nextId);
        if (targets) {
          this.playedSequences.add(this.currentSequenceNodeId);
          this.enterNode(targets);
          console.log(`[DEBUG-MENU] 条件next后 mode=${this.mode} _menuNeedsRedraw=${_menuNeedsRedraw}`);
          return;
        }
      }
      this.playedSequences.add(this.currentSequenceNodeId);
      this.enterNode(nextId);
      console.log(`[DEBUG-MENU] enterNode后 mode=${this.mode} _menuNeedsRedraw=${_menuNeedsRedraw} fadePhase=${this.fadePhase} _pendingAutoTarget=${this._pendingAutoTarget}`);
      return;
    }
    // 如果是菜单模式下的自动对话，回到菜单（与 Pygame menu_stack 回退一致）
    // 优先用 menuStack 顶部节点，回退到 menuNodeId
    const fallbackId = (this.menuStack.length > 0)
      ? this.menuStack[this.menuStack.length - 1]
      : this.menuNodeId;
    if (fallbackId) {
      const fbNode = scenarioData.nodes[fallbackId];
      if (fbNode) {
        this.enterNode(fallbackId);
        return;
      }
    }
    console.log('[Dialogue] 对话结束，无后续节点');
  }

  _resolveConditionalNext(nextField) {
    // 支持对象格式 { target, condition } 和数组 [{ target, condition }, ...]
    const targets = Array.isArray(nextField) ? nextField : [nextField];
    for (const entry of targets) {
      if (this.evalCondition(entry.condition || 'True')) {
        return entry.target;
      }
    }
    return null;
  }

  advanceDialogue() {
    console.log(`[AdvanceDialogue] ENTER mode=${this.mode} typingComplete=${this.typingComplete} typingIdx=${this.typingIndex} textOffset=${this.textOffset} textPageEnd=${this.textPageEnd} fullTextLen=${this.fullText ? this.fullText.length : 'null'} dialogueIndex=${this.dialogueIndex} queueLen=${this.dialogueQueue.length}`);
    if (this.mode !== 'dialogue') return;

    // 打字未完成 → 立即显示当前页
    if (!this.typingComplete) {
      console.log(`[AdvanceDialogue] 打字未完成, 强制完成当前页`);
      this.typingIndex = this.textPageEnd - this.textOffset;
      this.typingComplete = true;
      updateDialogText(this.fullText.substring(this.textOffset, this.textPageEnd));
      showHintArrow(true);
      return;
    }

    // 跳到下一页，隐藏三角
    showHintArrow(false);

    // 当前句还有剩余文字（分页）
    const nextOffset = this.textPageEnd;
    if (nextOffset < this.fullText.length) {
      console.log(`[AdvanceDialogue] 分页: nextOffset=${nextOffset} < fullTextLen=${this.fullText.length}`);
      this.textOffset = nextOffset;
      this.typingIndex = 0;
      this.typingComplete = false;
      this.lastTypingSoundChar = -1;
      // 计算下一页结束位置
      const remainingText = this.fullText.substring(this.textOffset);
      const pageLen = measurePageBreak(remainingText);
      this.textPageEnd = this.textOffset + pageLen;
    } else {
      // 跳到下一句
      console.log(`[AdvanceDialogue] dialogueIndex++: ${this.dialogueIndex} → ${this.dialogueIndex + 1}`);
      this.dialogueIndex++;

      // ── 检查 proof_bgm 在指定行切换 BGM ──
      if (this._pendingProofBgm) {
        const pb = this._pendingProofBgm;
        if (pb.line_index !== undefined && this.dialogueIndex === pb.line_index) {
          this.currentBgm = pb.bgm;
          try { playBgm(pb.bgm, 0); } catch (_) {}
          console.log(`[Confront] 举证 BGM 切换: ${pb.bgm} (行 ${pb.line_index})`);
        }
      }

      // 检查刚完成的对话行的副作用（gain_item / set_flag）
      if (this.dialogueIndex > 0 && this.dialogueIndex <= this.dialogueQueue.length) {
        const prev = this.dialogueQueue[this.dialogueIndex - 1];
        if (prev && typeof prev === 'object') {
          if (this.dialogueIndex === this.dialogueQueue.length) {
            console.log(`[AdvanceDialogue] 最后一行 prev: text="${(prev.text||'').substring(0,20)}" blood_deduct=${!!prev.blood_deduct} _inCaseTrial=${this._inCaseTrial} blood=${this.blood}`);
          }
          // gain_item（与 Python 一致：存储完整物品信息）
          if (prev.gain_item) {
            const gi = prev.gain_item;
            const itemId = gi.id;
            if (!this.inventory.some(inv => inv.id === itemId)) {
              // 优先从章节 items 获取权威描述
              const canonical = this._getItemDef(itemId) || {};
              this.inventory.push({
                id: gi.id || itemId,
                name: gi.name || canonical.name || '',
                description: canonical.description || gi.description || '',
                image: gi.image || canonical.image || ''
              });
              // 保存恢复状态（与 Python gain_resume_state 一致）
              const resumeMode = this.investigationActive ? 'investigation' : 'dialogue';
              this.gainResumeState = {
                mode: resumeMode,
                dialogueQueue: this.dialogueQueue,
                dialogueIndex: this.dialogueIndex,
                talkingAboutItem: this.talkingAboutItem,
              };
              if (resumeMode === 'investigation') {
                this.gainResumeState.cursorX = this.investigationCursorX;
                this.gainResumeState.cursorY = this.investigationCursorY;
              }
              this.itemFeedbackActive = true;
              this.itemFeedbackItem = itemId;
              this.itemFeedbackText = gi.msg || `获得物品【${gi.name || canonical.name || itemId}】`;
              this.itemFeedbackTimer = 0;
              this.itemFeedbackType = 'gain';
              this.itemFeedbackPhase = 'prompt';
              this.hintAnimationTime = 0;
              // mode 在 startDialogue() 之后设置（startDialogue 会覆盖为 'dialogue'）
              try { playSound('sfx_item_gain'); } catch (_) {}
              console.log(`[Item] 获得: ${itemId} (resume: ${resumeMode})`);
            }
            if (gi.set_flag) {
              for (const [k, v] of Object.entries(gi.set_flag)) {
                this.flags[k] = v;
              }
            }
          }
          // set_flag
          if (prev.set_flag) {
            for (const [k, v] of Object.entries(prev.set_flag)) {
              const isNew = (this.flags[k] !== v);
              this.flags[k] = v;
              console.log(`[Flag] ${k} = ${v}`);
              // 与 Python 一致：set_flag 触发人物卡片解锁（仅首次设置时触发）
              if (isNew && k === 'scene_prologue_03_HA_unlocked' && v) {
                this.unlockedCharacters = new Set(['Player_Ba', 'Player_WT', 'Player_ZLY', 'Player_HA']);
                this.selectedItemIndex = 0;
                console.log(`[Characters] HA_unlocked → 解锁4人物`);
              }
              if (isNew && k === 'scene_prologue_04_characters_unlocked' && v) {
                this.unlockedCharacters.add('Player_Bao');
                this.unlockedCharacters.add('Player_XQ');
                this.unlockedCharacters.add('Player_LX');
                this.selectedItemIndex = 0;
                console.log(`[Characters] 04_unlocked → 追加3人物`);
              }
            }
          }
          // blood_deduct（与 Python 一致：同步扣血，血量归零立即触发 game_over）
          if (prev.blood_deduct && this._inCaseTrial && this.blood > 0) {
            this.blood -= 1;
            console.log(`[Blood] 同步扣血, 剩余: ${this.blood}`);
            if (this.blood <= 0) {
              this._inCaseTrial = false;
              console.log(`[Blood] 血量归零, 调用 triggerGameOver`);
              this.triggerGameOver();
              console.log(`[Blood] triggerGameOver 返回, mode=${this.mode} queueLen=${this.dialogueQueue.length} idx=${this.dialogueIndex}`);
              return;
            }
          }
        }
      }

      // ── 选项对白：触发行结束后，显示选项（与 Python advance_dialogue 一致） ──
      if (this.choiceConfig !== null && this.dialogueIndex - 1 === this.choiceTriggerIndex) {
        // 血量归零时：有 fail_next 则跳转，否则触发 game_over
        if (this.blood <= 0) {
          this.choiceActive = false;
          this.choiceActive2 = false;
          if (this.choiceFailNext) {
            const failNext = this.choiceFailNext;
            this.choiceConfig = null;
            this.enterNode(failNext);
          } else {
            this.choiceConfig = null;
            this.triggerGameOver();
          }
          return;
        }
        // 显示选项列表
        const choicesRaw = this.choiceConfig.choices || [];
        this.choiceList = [...choicesRaw];
        this.choiceActive = true;
        this.choiceActive2 = true;
        this.choiceSelected = 0;
        this.choiceBtnAnimOffset = -CONFRONT_BTN_W;
        this.choiceBtnRects = [];
        this.choiceTriggerIndex = -1;  // Only trigger once
        this.mode = 'choice_dialogue';
        showHintArrow(false);
        console.log(`[ChoiceDialogue] 触发行结束，显示 ${this.choiceList.length} 个选项`);
        return;
      }

      // 血量归零时不再推进对话（等待 game_over 流程接管）
      if (this.blood <= 0 && (this._inCaseTrial || this._proofInterruptFailPending)) {
        return;
      }
      // 记录 startDialogue 前的状态，用于检测是否被 triggerGameOver 重入
      const prevQueue = this.dialogueQueue;
      const prevIdx = this.dialogueIndex;
      const prevFullText = this.fullText;
      console.log(`[AdvanceDialogue] 调用 _startDialogueCore 前: idx=${this.dialogueIndex}/${this.dialogueQueue.length} mode=${this.mode} typingComplete=${this.typingComplete} fullText="${(this.fullText||'').substring(0,20)}"`);
      // 直接调用 _startDialogueCore，绕过 startDialogue 包装
      this._startDialogueCore();
      // 如果内部调用了 triggerGameOver → 加载了新队列，则不再继续
      if (this.dialogueQueue !== prevQueue || this.dialogueIndex !== prevIdx + 1) {
        console.log(`[AdvanceDialogue] 检测到重入: queueChanged=${this.dialogueQueue !== prevQueue} idxChanged=${this.dialogueIndex !== prevIdx + 1}`);
        return;
      }
      console.log(`[AdvanceDialogue] _startDialogueCore 返回后: idx=${this.dialogueIndex}/${this.dialogueQueue.length} mode=${this.mode} typingComplete=${this.typingComplete} typingIdx=${this.typingIndex} fullText="${(this.fullText||'').substring(0,20)}" textChanged=${this.fullText !== prevFullText}`);
      // _startDialogueCore 会设置 mode='dialogue'，如果有物品反馈则覆盖为 'item_feedback'
      if (this.itemFeedbackActive) {
        this.mode = 'item_feedback';
      }
    }
  }

  /** 略过对话：跳过当前所有对话，推进到下一个节点 */
  skipDialogue() {
    if (this.mode !== 'dialogue') return;
    console.log('[Skip] 略过对话');

    // ── 选项对白：略过前置对话，直接跳到触发行（与 Python skip_dialogue 一致） ──
    if (this.choiceConfig !== null && this.choiceTriggerIndex >= 0 && this.dialogueIndex <= this.choiceTriggerIndex) {
      const skipEnd = this.choiceTriggerIndex;
      // 处理被跳过行的 set_flag 副作用
      for (let si = this.dialogueIndex; si < skipEnd; si++) {
        const sd = this.dialogueQueue[si];
        if (sd && typeof sd === 'object' && sd.set_flag) {
          for (const [k, v] of Object.entries(sd.set_flag)) {
            this.flags[k] = v;
          }
        }
        if (sd && typeof sd === 'object' && sd.gain_item) {
          const gi = sd.gain_item;
          if (!this.inventory.some(inv => inv.id === gi.id)) {
            const canonical = this._getItemDef(gi.id) || {};
            this.inventory.push({
              id: gi.id,
              name: gi.name || canonical.name || '',
              description: canonical.description || gi.description || '',
              image: gi.image || canonical.image || ''
            });
          }
          if (gi.set_flag) {
            for (const [k, v] of Object.entries(gi.set_flag)) {
              this.flags[k] = v;
            }
          }
        }
      }
      // 跳到触发行，触发行会正常播放然后显示选项
      this.dialogueIndex = skipEnd;
      console.log(`[Skip] 选项对白: 跳到触发行 index=${skipEnd}`);
      // startDialogue 会播放触发行，完成后 advanceDialogue 检测到 trigger_choice → 显示选项
      this.startDialogue();
      return;
    }

    // 记录当前 sequence 为已播放
    if (this.currentSequenceNodeId) {
      this.playedSequences.add(this.currentSequenceNodeId);
    }

    // 处理当前 dialogue_index 到队列末尾之间所有条目的副作用（gain_item / set_flag / blood_deduct）
    for (let i = this.dialogueIndex; i < this.dialogueQueue.length; i++) {
      const d = this.dialogueQueue[i];
      if (!d || typeof d !== 'object') continue;
      if (d.gain_item) {
        const gi = d.gain_item;
        if (!this.inventory.some(inv => inv.id === gi.id)) {
          const canonical = this._getItemDef(gi.id) || {};
          this.inventory.push({
            id: gi.id,
            name: gi.name || canonical.name || '',
            description: canonical.description || gi.description || '',
            image: gi.image || canonical.image || ''
          });
          console.log(`[Skip] 获得: ${gi.id}`);
        }
        if (gi.set_flag) {
          for (const [k, v] of Object.entries(gi.set_flag)) {
            this.flags[k] = v;
          }
        }
      }
      if (d.set_flag) {
        for (const [k, v] of Object.entries(d.set_flag)) {
          const isNew = (this.flags[k] !== v);
          this.flags[k] = v;
          if (isNew && k === 'scene_prologue_03_HA_unlocked' && v) {
            this.unlockedCharacters = new Set(['Player_Ba', 'Player_WT', 'Player_ZLY', 'Player_HA']);
            this.selectedItemIndex = 0;
          }
          if (isNew && k === 'scene_prologue_04_characters_unlocked' && v) {
            this.unlockedCharacters.add('Player_Bao');
            this.unlockedCharacters.add('Player_XQ');
            this.unlockedCharacters.add('Player_LX');
            this.selectedItemIndex = 0;
          }
        }
      }
      // 处理 blood_deduct（与 Python skip_dialogue 一致：错误分支扣血）
      if (d.blood_deduct && this._inCaseTrial && this.blood > 0) {
        this.blood = Math.max(0, this.blood - 1);
        console.log(`[Skip] blood_deduct 触发, 剩余: ${this.blood}`);
        if (this.blood <= 0) {
          this._inCaseTrial = false;
          this.triggerGameOver();
          return;
        }
      }
    }

    // 推进到队列末尾的 next_node
    this.dialogueIndex = this.dialogueQueue.length;
    this._onDialogueQueueEnd();
  }

  /** 强制完成打字 */
  forceCompleteTyping() {
    if (!this.typingComplete) {
      this.typingIndex = this.fullText.length;
      this.typingComplete = true;
    }
  }

  // ==================== 选项对白 ====================

  /** 处理选项选择（与 Python handle_choice_selection 一致） */
  handleChoiceSelection(choiceIndex) {
    if (choiceIndex < 0 || choiceIndex >= this.choiceList.length) return;
    const choice = this.choiceList[choiceIndex];
    this.choiceActive = false;
    this.choiceActive2 = false;

    if (choice.is_correct) {
      // 正确选择：播放 success_dialogue，播完后进入 next
      const successDialogue = choice.success_dialogue || [];
      if (successDialogue.length > 0) {
        this.dialogueQueue = [...successDialogue];
        this.dialogueIndex = 0;
        this.mode = 'dialogue';
        this.choiceContinueDone = true;
        this.startDialogue();
      } else {
        // 无 success_dialogue，直接进入 next 节点
        this.choiceConfig = null;
        if (this.choiceNextNode) {
          this.enterNode(this.choiceNextNode);
        }
      }
      try { playSound('sfx_ui_confirm'); } catch (_) {}
      console.log(`[ChoiceDialogue] 正确选择: ${choice.id} ${choice.label}`);
    } else {
      // 错误选择：播放 fail_dialogue，扣血，然后重新显示选项
      const failDialogue = choice.fail_dialogue || [];
      const hasBlood = choice.blood_deduct || false;
      const shakeSfx = choice.shake_sfx || null;

      if (failDialogue.length > 0) {
        // 处理 fail_dialogue：最后一行添加血扣/抖动效果
        const processed = [...failDialogue];
        if (processed.length > 0) {
          const last = processed[processed.length - 1];
          if (last && typeof last === 'object') {
            if (hasBlood) {
              last.blood_deduct = true;
            }
            if (shakeSfx) {
              last.char_shake = { sfx: shakeSfx };
            }
          }
        }
        // 追加 trigger_choice 行以在 fail 对话后重新显示选项
        if (this.choiceTriggerLine) {
          processed.push({ ...this.choiceTriggerLine });
        }
        this.choiceTriggerIndex = processed.length - 1;
        this.dialogueQueue = processed;
        this.dialogueIndex = 0;
        this.mode = 'dialogue';
        this.startDialogue();
      } else {
        // 无 fail_dialogue，直接重新显示选项
        this.choiceActive = true;
        this.choiceActive2 = true;
        this.mode = 'choice_dialogue';
      }
      try { playSound('sfx_ui_cancel'); } catch (_) {}
      console.log(`[ChoiceDialogue] 错误选择: ${choice.id} ${choice.label} (blood_deduct=${hasBlood})`);
    }
  }

  // ==================== 事件系统 ====================

  /** 启动 intro_event（开场动画事件） */
  startIntroEvent(introConfig, nextNode) {
    this.eventTypingIndex = 0;
    this.eventAutoTimer = 0;
    this.eventAutoAdvance = introConfig.auto_advance !== false;
    this.eventFrames = introConfig.frames || [];
    this.eventImage = this.eventFrames[0] ? this.eventFrames[0].image : null;
    this.eventFrameIndex = 0;
    this.eventResume = { mode: null, next_node: nextNode };
    this.eventPhase = 'fade_in';
    this.eventAlpha = 0;
    this.eventFadeTimer = this._EVENT_FADE_DURATION;
    this.eventImgAlpha = 0;
    this.eventTransitionPhase = 'fade_in';
    this.eventTransitionTimer = this._EVENT_IMG_TRANSITION_DURATION;
    this.eventVoiceFrameDelay = 1.0;
    this._eventVoicePlayIndex = -1;
    this.currentSequenceNode = null;
    this.currentSequenceNodeId = null;
    this.mode = 'event_trigger';
    try { playSound('sfx_event_trigger'); } catch (_) {}
  }

  /** 通用事件触发器（trigger_event action） */
  triggerEvent(config, resumeState) {
    const image = config.image;
    const text = config.text;
    const frames = config.frames || (image ? [image] : []);
    const autoAdvance = config.auto_advance !== undefined ? config.auto_advance : false;

    // 构建 event_frames：每张图片对应其文字
    const eventFrames = [];
    if (typeof text === 'string' || !text) {
      // 单句文字，所有帧共享
      for (const img of frames) {
        eventFrames.push({ image: img, text: text || '' });
      }
    } else if (Array.isArray(text)) {
      if (text.length > 0 && typeof text[0] === 'string') {
        // 字符串数组：分配到各帧，帧数不足时重复最后一帧
        for (let i = 0; i < text.length; i++) {
          const img = frames[Math.min(i, frames.length - 1)] || frames[0] || '';
          eventFrames.push({ image: img, text: text[i] || '' });
        }
      } else {
        // 嵌套数组：[[句1], [句2, 句3]]
        for (let i = 0; i < frames.length; i++) {
          const lines = (Array.isArray(text[i]) ? text[i] : [text[i]]) || [''];
          for (const line of lines) {
            eventFrames.push({ image: frames[i], text: line });
          }
        }
      }
    }

    this.eventTypingIndex = 0;
    this.eventAutoTimer = 0;
    this.eventAutoAdvance = autoAdvance;
    this.eventFrames = eventFrames;
    this.eventImage = eventFrames[0] ? eventFrames[0].image : null;
    this.eventFrameIndex = 0;
    this.eventResume = resumeState;
    this.eventPhase = 'fade_in';
    this.eventAlpha = 0;
    this.eventFadeTimer = this._EVENT_FADE_DURATION;
    this.eventImgAlpha = 0;
    this.eventTransitionPhase = 'fade_in';
    this.eventTransitionTimer = this._EVENT_IMG_TRANSITION_DURATION;
    this.eventVoiceFrameDelay = 1.0;
    this.currentSequenceNode = null;
    this.currentSequenceNodeId = null;
    this.successIconFlag = !!(resumeState && resumeState._invSuccessIcon);
    this.successIconPhase = null;
    this.mode = 'event_trigger';
    // 与 Python play_event() 一致：事件开始时播放 sfx_event_trigger
    try { playSound('sfx_event_trigger'); } catch (_) {}
  }

  /** 事件结束后恢复状态 */
  _resumeFromEvent(resume) {
    resume = resume || this.eventResume;
    this.eventImage = null;
    this.eventFrames = [];
    this.eventResume = null;
    if (!resume) return;

    // ── 检查是否需要在事件后播放 follow_dialogues（来自 trigger_event） ──
    if (resume._invFollowDialogues) {
      const followDlg = resume._invFollowDialogues;
      // 恢复调查相关状态
      this._invResumeCursorX = resume._invResumeCursorX;
      this._invResumeCursorY = resume._invResumeCursorY;
      this._invDialogueActive = true;
      this._invJustTriggered = true;
      this._invSuccessIconPending = resume._invSuccessIcon || false;
      // resume_node 优先，其次 next_node
      this._invResumeNodeAfterDlg = resume._invResumeNode || resume._invNextNodeAfterDlg || resume.next_node || null;

      // 播放 follow_dialogues
      this.dialogueQueue = followDlg;
      this.dialogueIndex = 0;
      this.mode = 'dialogue';
      this.startDialogue();
      return;
    }

    // ── success_icon 配合 resume_node：事件播放完后直接跳转 ──
    if (resume._invSuccessIcon && resume._invResumeNode) {
      this._invDialogueActive = false;
      this._invJustTriggered = false;
      // 进入 resume_node
      this.enterNode(resume._invResumeNode);
      return;
    }

    // ── game_over 事件结束 → 推进到 text 阶段（必须在 mode 赋值之前，否则 mode 被设为 'menu'） ──
    if (resume._gameOverEventEnd) {
      this._gameOverAdvance();
      return;
    }

    this.mode = resume.mode || 'menu';
    this.dialogueQueue = resume.dialogue_queue || [];
    this.dialogueIndex = resume.dialogue_index || 0;

    // ── 事件后恢复质问模式（来自 proof 举证成功） ──
    if (this.mode === 'confrontation') {
      this.confrontationShowButtons = true;
      this.confrontationButtonFocus = _IS_MOBILE ? -1 : 0;
      // 检查是否所有陈述已推进完
      if (this.confrontationIndex >= this.confrontationStatements.length) {
        this.confrontationPendingOutro = true;
        // 支持 outro_override（与 Python advance_to_next_statement 一致）
        let outro = this.confrontationState?.outro;
        const nodeId = this.currentNodeId;
        if (nodeId && this.confrontationPersistedStatements?.[nodeId]?.outro_override) {
          outro = this.confrontationPersistedStatements[nodeId].outro_override;
        }
        if (outro) {
          this.mode = 'dialogue';
          this.enterNode(outro);
          return;
        }
      }
      return;
    }

    if (resume.next_node) {
      console.log(`[DEBUG-MENU] _resumeFromEvent enterNode: ${resume.next_node} mode=${this.mode}`);
      this.enterNode(resume.next_node);
    } else if (this.mode === 'dialogue' && this.dialogueQueue.length > 0) {
      this.startDialogue();
    }
  }

  /** 在 trigger_event follow_dialogues 播放完后，恢复调查或进入 resume_node */
  _resumeAfterEventDialogues() {
    // success_icon + resume_node：直接跳转
    if (this._invSuccessIconPending && this._invResumeNodeAfterDlg) {
      this._invSuccessIconPending = false;
      const resumeNode = this._invResumeNodeAfterDlg;
      this._invResumeNodeAfterDlg = null;
      this._invDialogueActive = false;
      this._invJustTriggered = false;
      this.enterNode(resumeNode);
      return;
    }

    // 有 resume_node 但没有 success_icon：跳转到 resume_node
    if (this._invResumeNodeAfterDlg) {
      const resumeNode = this._invResumeNodeAfterDlg;
      this._invResumeNodeAfterDlg = null;
      this._invDialogueActive = false;
      this._invJustTriggered = false;
      this.enterNode(resumeNode);
      return;
    }

    // 检查调用来源：如果在 investigation 相关上下文中，回到调查模式
    if (this._invResumeCursorX !== undefined) {
      this._resumeInvestigation();
      return;
    }

    // 默认：回到菜单模式
    this._invDialogueActive = false;
    this._invJustTriggered = false;
    this.mode = 'menu';
  }

  // ==================== 场景转场 ====================

  /** 跳过事件动画（与 Python skip_event 一致） */
  skipEvent() {
    console.log(`[DEBUG-SKIP] skipEvent() 被调用, mode=${this.mode}, phase=${this.eventPhase}`);
    if (this.mode !== 'event_trigger' || this.eventPhase === 'fade_out') {
      console.log(`[DEBUG-SKIP] skipEvent 提前返回: mode=${this.mode}, phase=${this.eventPhase}`);
      return;
    }
    try { playSound('sfx_ui_skip'); } catch (_) {}
    // 停止语音（与 Python voice_channel.stop() 一致）
    stopVoice();
    this.eventPhase = 'fade_out';
    this.eventFadeTimer = 0;
    this.eventAlpha = 0;
    console.log(`[DEBUG-SKIP] skipEvent 完成: phase=fade_out, fadeTimer=0`);
  }

  _startFadeTransition(callback) {
    if (this.fadePhase) {
      console.warn(`[Fade] 尝试在已存在的转场中启动新转场（phase=${this.fadePhase}），跳过`);
      return;
    }
    this.fadeAlpha = 0;
    this.fadePhase = 'fade_out';
    this.fadeTimer = 0;
    this.fadeCallback = callback;
    console.log(`[Fade] 开始转场 ${callback ? callback.name || '(anonymous)' : 'no callback'}`);
  }

  _fadeEnterCallback(nodeId) {
    this._inSceneFade = true;
    this.menuOptions = [];
    this.menuStack = [];
    this.enterNode(nodeId);
  }

  // ==================== 开始新游戏 ====================

  startNewGame() {
    this.muted = false; // 新游戏强制不静音（覆盖 localStorage 旧设置）
    this.flags = {};
    this.inventory = [];
    this.unlockedCharacters = new Set();
    this.visitedNodes = new Set();
    this.playedSequences = new Set();
    this.triggeredAutoIds = new Set();
    this.menuStack = [];
    this.blood = 5;
    this.bloodDeductAnimActive = false;
    this.bloodDeductAnimTimer = 0;
    this.bloodDeductAnimScale = 1.0;
    this.bloodDeductAnimAlpha = 255;
    this._chapterRemindersSuppressed = false;
    this.chapterReminderCounters = {};
    this._reminderConditionsMet = {};
    this._forceChapterReminderCheck = false;
    this._pendingSceneTravel = false;
    this.savePromptNextNode = null;
    this.savePromptBtnOffset = -720;
    this.savePromptBtnAnimActive = false;
    this.savePromptButtonFocus = -1;
    this.savePromptText = '';
    this.savePromptTypingIndex = 0;
    this.savePromptTypingComplete = false;
    this._justLoaded = false;

    // 初始物品（与 Python 一致：从 chapters.{current_chapter}.init_items 读取）
    if (scenarioData) {
      const chapter = scenarioData.current_chapter || 'prologue';
      const chData = (scenarioData.chapters && scenarioData.chapters[chapter]) || {};
      const initItemIds = chData.init_items || [];
      for (const itemId of initItemIds) {
        this.gainItem(itemId, false);
      }
      if (initItemIds.length > 0) {
        console.log(`[Init] 初始物品: ${initItemIds.join(', ')}`);
      }
    }

    // 与 Python new_game() 一致：设置初始背景、播放 BGM、启动 intro_event
    const startId = scenarioData.start || 'scene_prologue_01';
    const startNode = scenarioData.nodes[startId] || {};

    this.currentBgName = startNode.background || 'bg_scene00_001.png';
    setBackground(this.currentBgName);

    // 播放 BGM（从 bgm_start 秒开始）
    if (startNode.bgm) {
      this.currentBgm = startNode.bgm;
      try { playBgm(startNode.bgm, startNode.bgm_start || 0); } catch (_) {}
    }

    // 开场 intro_event
    if (startNode.intro_event) {
      this.startIntroEvent(startNode.intro_event, 'scene_prologue_02');
    } else {
      this.enterNode(startId);
    }
  }
}
