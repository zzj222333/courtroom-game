// ==================== 音频系统 ====================
// BGM、音效、语音

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
console.log('[Audio] AudioContext 创建, state=' + audioCtx.state);

/** @type {Map<string, AudioBuffer>} */
const audioCache = new Map();

let bgmSource = null;
let bgmGain = audioCtx.createGain();
bgmGain.gain.value = 0.5; // BGM 默认 50%
bgmGain.connect(audioCtx.destination);

let sfxGain = audioCtx.createGain();
sfxGain.gain.value = 0.7; // SFX 默认 70%
sfxGain.connect(audioCtx.destination);

let currentBgm = null;
let voiceSource = null;  // 当前语音源，用于停止

// ── 加载音频 ──
async function loadAudio(url) {
  if (audioCache.has(url)) return;
  const resp = await fetch(`${BASE_PATH}/${url}?v=${RESOURCE_VERSION}`);
  const arrayBuf = await resp.arrayBuffer();
  const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
  audioCache.set(url, audioBuf);
}

/** 播放一次音效/语音 */
function playSound(name) {
  if (!gameState || gameState.muted) {
    console.log('[Audio] playSound 跳过: name=' + name + ' muted=' + (gameState ? gameState.muted : 'no-gs'));
    return;
  }
  const key = `Sound/${name}.wav`;
  const buf = audioCache.get(key);
  if (!buf) {
    console.warn('[Audio] playSound 缓存未命中: ' + key);
    return;
  }
  console.log('[Audio] playSound: ' + name + ' ctx=' + audioCtx.state);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const gain = audioCtx.createGain();
  gain.gain.value = gameState.sfxVolume;
  src.connect(gain).connect(audioCtx.destination);
  src.start(0);
}

/** 播放语音 */
function playVoice(name) {
  if (!gameState || gameState.muted) {
    console.log('[Audio] playVoice 跳过: name=' + name + ' muted=' + (gameState ? gameState.muted : 'no-gs'));
    return;
  }
  const key = `voices/${name}.wav`;
  const buf = audioCache.get(key);
  if (!buf) {
    console.warn('[Audio] playVoice 缓存未命中: ' + key);
    return;
  }
  // 停止当前语音（避免重叠）
  stopVoice();
  console.log('[Audio] playVoice: ' + name + ' ctx=' + audioCtx.state);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  src.start(0);
  src.onended = () => { if (voiceSource === src) voiceSource = null; };
  voiceSource = src;
}

/** 停止当前语音 */
function stopVoice() {
  if (voiceSource) {
    console.log('[Audio] stopVoice: 停止当前语音');
    try { voiceSource.stop(); } catch (_) {}
    voiceSource = null;
  }
}

/** 播放 BGM（循环） */
function playBgm(name, start = 0) {
  if (!gameState || gameState.muted || currentBgm === name) {
    if (!gameState?.muted) console.log('[Audio] playBgm 跳过: name=' + name + ' current=' + currentBgm + ' muted=' + (gameState ? gameState.muted : 'no-gs'));
    return;
  }
  stopBgm();
  const key = `bgm/${name}`;
  const buf = audioCache.get(key);
  if (!buf) {
    console.warn('[Audio] playBgm 缓存未命中: ' + key);
    return;
  }
  console.log('[Audio] playBgm: ' + name + ' ctx=' + audioCtx.state);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(bgmGain);
  src.start(0, start);
  bgmSource = src;
  currentBgm = name;
}

function stopBgm() {
  if (bgmSource) {
    console.log('[Audio] stopBgm');
    try { bgmSource.stop(); } catch (_) {}
    bgmSource = null;
  }
  currentBgm = null;
}

/** 将 gameState 的音量/静音状态同步到实际音频节点 */
function syncAudioSettings() {
  if (!gameState) return;
  bgmGain.gain.value = gameState.muted ? 0 : gameState.bgmVolume;
}

/** iOS 等平台要求用户交互后才能创建 AudioContext */
function resumeAudio() {
  console.log('[Audio] resumeAudio: state=' + audioCtx.state);
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => {
      console.log('[Audio] AudioContext 已恢复, state=' + audioCtx.state);
    }).catch(e => {
      console.warn('[Audio] resume 失败:', e);
    });
  }
}

/** 预加载所有语音文件（从 scenario.json 中扫描 voice 字段） */
async function loadAllVoices(scenarioData) {
  const voiceSet = new Set();
  const nodes = scenarioData.nodes || {};

  // 扫描所有节点的 intro_event 帧
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.intro_event && node.intro_event.frames) {
      for (const frame of node.intro_event.frames) {
        if (frame.voice) {
          const name = frame.voice.replace(/\.wav$/i, '');
          voiceSet.add(name);
        }
      }
    }
    // 扫描 investigate_points 中的 trigger_event follow_dialogues 语言的 voice
    const pts = node.investigate_points || [];
    for (const pt of pts) {
      if (pt.trigger_event && pt.trigger_event.follow_dialogues) {
        for (const d of pt.trigger_event.follow_dialogues) {
          if (d.voice) {
            const name = d.voice.replace(/\.wav$/i, '');
            voiceSet.add(name);
          }
        }
      }
    }
    // 扫描所有 dialogues 中的 voice
    const scanDlg = (dialogues) => {
      if (!dialogues) return;
      for (const d of dialogues) {
        if (d && typeof d === 'object' && d.voice) {
          const name = d.voice.replace(/\.wav$/i, '');
          voiceSet.add(name);
        }
      }
    };
    scanDlg(node.dialogues);
    // 扫描 confrontation statements 中的 dialogue
    const stmts = node.statements || [];
    for (const stmt of stmts) {
      if (stmt.dialogue) scanDlg([stmt.dialogue]);
      if (stmt.follow_up) {
        const followNode = nodes[stmt.follow_up];
        if (followNode) scanDlg(followNode.dialogues);
      }
    }
  }

  const voiceList = Array.from(voiceSet);
  if (voiceList.length === 0) return;

  console.log(`[Audio] 预加载 ${voiceList.length} 个语音文件...`);
  let loaded = 0, failed = 0;
  await Promise.all(voiceList.map(async (name) => {
    try {
      await loadAudio(`voices/${name}.wav`);
      loaded++;
    } catch (e) {
      failed++;
      console.warn(`[Audio] 语音加载失败: ${name}`, e.message);
    }
  }));
  console.log(`[Audio] 语音预加载完成 (${loaded} 成功, ${failed} 失败)`);
}

/** 从 scenario.json 中提取所有 scene 节点用到的 BGM，批量预加载 */
async function loadAllBgm(scenarioData) {
  const bgmSet = new Set();
  const nodes = scenarioData.nodes || {};
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.bgm) bgmSet.add(node.bgm);
    if (node.confrontation_bgm) bgmSet.add(node.confrontation_bgm);
    // 扫描 evidence 中的 proof_bgm（含 append_statement 和 next_evidence 嵌套）
    const _scanEvidence = (ev) => {
      if (!ev) return;
      for (const entry of Object.values(ev)) {
        if (entry && entry.proof_bgm && entry.proof_bgm.bgm) bgmSet.add(entry.proof_bgm.bgm);
      }
    };
    const _scanStmts = (stmts) => {
      if (!stmts) return;
      for (const stmt of stmts) {
        _scanEvidence(stmt.evidence);
        _scanEvidence(stmt.next_evidence);
        _scanEvidence(stmt.new_evidence);
        if (stmt.append_statement) _scanEvidence(stmt.append_statement.evidence);
      }
    };
    _scanStmts(node.statements);
  }
  // 加上游戏启动时的 BGM（start 节点的 bgm）
  const startId = scenarioData.start;
  if (startId && nodes[startId] && nodes[startId].bgm) {
    bgmSet.add(nodes[startId].bgm);
  }
  // 强制预加载标题画面BGM
  bgmSet.add('云外箫声.mp3');

  const bgmList = Array.from(bgmSet);
  if (bgmList.length === 0) return;

  console.log(`[Audio] 预加载 ${bgmList.length} 首 BGM...`);
  await Promise.all(bgmList.map(async (name) => {
    try {
      await loadAudio(`bgm/${name}`);
      console.log(`[Audio] BGM 已加载: ${name}`);
    } catch (e) {
      console.warn(`[Audio] BGM 加载失败: ${name}`, e.message);
    }
  }));
  console.log(`[Audio] BGM 预加载完成`);
}

/** 预加载全部音效（扫描 scenario.json + 硬编码基础音效清单） */
const _ESSENTIAL_SFX = [
  // 打字音效
  'sfx_dialogue_typing_male', 'sfx_dialogue_typing_female', 'sfx_dialogue_inner_voice',
  // UI 交互
  'sfx_ui_confirm', 'sfx_ui_cancel', 'sfx_ui_cursor_move', 'sfx_ui_exit', 'sfx_ui_skip',
  'sfx_ui_inventory_open',
  // 调查
  'sfx_investigate_find', 'sfx_investigate_hover', 'sfx_investigate_mark',
  // 质问
  'sfx_confront_success', 'sfx_confront_fail', 'sfx_confront_fail2',
  'sfx_confront_present', 'sfx_confront_statement_switch', 'sfx_dialogue_confront_intro',
  // 震动/打击
  'sfx_behit',
  // 物品
  'sfx_item_gain',
  // 谜题
  'sfx_puzzle_success', 'sfx_puzzle_fail',
  // 谜题成功语音（与 Python play_voice("voice_ba_puzzle_success") 一致，glob 匹配 _01 后缀）
  'voice_ba_puzzle_success_01',
  // 举证语音（与 Python play_voice("voice_ba_present") 一致）
  'voice_ba_present_01',
  // 追问语音（与 Python play_voice("voice_ba_wait") 一致）
  'voice_ba_wait_01',
  // 事件
  'sfx_event_trigger',
  // 框体动画
  'sfx_frame_move', 'sfx_frame_down', 'sfx_frame_choice',
  // 其他
  'sfx_key_turn',
  // 环境音
  'bgm_sfx_bird1', 'bgm_sfx_bird2', 'bgm_sfx_bird3',
  // 惊吓音效（v002）
  'sfx_surprise1', 'sfx_surprise2',
];

async function loadAllSfx(scenarioData) {
  const sfxSet = new Set(_ESSENTIAL_SFX);

  // 扫描 scenario.json 中 char_shake.sfx 等字段
  const nodes = scenarioData.nodes || {};
  for (const [nodeId, node] of Object.entries(nodes)) {
    // 扫描 confrontation_statements 中的 char_shake.sfx 和顶层 sfx
    const stmts = node.statements || [];
    for (const stmt of stmts) {
      if (stmt.char_shake && stmt.char_shake.sfx) {
        sfxSet.add(stmt.char_shake.sfx.replace('.wav', ''));
      }
      if (stmt.sfx) {
        sfxSet.add(stmt.sfx.replace('.wav', ''));
      }
    }
    // 扫描 dialogues 中的 char_shake.sfx 和顶层 sfx（递归扫描 append_statements）
    const scanDialogues = (dialogues) => {
      if (!dialogues) return;
      for (const d of dialogues) {
        if (d && typeof d === 'object') {
          if (d.char_shake && d.char_shake.sfx) {
            sfxSet.add(d.char_shake.sfx.replace('.wav', ''));
          }
          if (d.sfx) {
            sfxSet.add(d.sfx.replace('.wav', ''));
          }
          if (d.statements) scanDialogues(d.statements);
          if (d.append_statements) scanDialogues(d.append_statements);
        }
      }
    };
    scanDialogues(node.dialogues);
  }

  const sfxList = Array.from(sfxSet).filter(s => s && s !== 'True');
  if (sfxList.length === 0) return;

  console.log(`[Audio] 预加载 ${sfxList.length} 个音效...`);
  let loaded = 0, failed = 0;
  await Promise.all(sfxList.map(async (name) => {
    try {
      await loadAudio(`Sound/${name}.wav`);
      loaded++;
    } catch (e) {
      failed++;
      console.warn(`[Audio] 音效加载失败: ${name}`, e.message);
    }
  }));
  console.log(`[Audio] 音效预加载完成 (${loaded} 成功, ${failed} 失败)`);
}
