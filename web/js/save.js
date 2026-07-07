// ==================== 存档系统 ====================
// IndexedDB 持久存储，内存缓存 + 异步写入
// navigator.storage.persist() 防止系统清理

const SAVE_COUNT = 7;  // 7个存档位（与 Python SAVE_PER_SLOT 一致）
const DB_NAME = 'thegame_save';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const SETTINGS_KEY = '_settings'; // 非存档位的设置键

// ==================== 内存缓存 ====================
// 所有读操作从此缓存同步读取，写操作同时更新缓存+异步写入 IndexedDB
const _saveCache = new Map(); // slotIndex → serialized data (or null)
let _dbReady = false;
let _dbInstance = null;

// ==================== IndexedDB 初始化 ====================

function _openDB() {
  return new Promise((resolve, reject) => {
    if (_dbInstance) { resolve(_dbInstance); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => {
      _dbInstance = e.target.result;
      resolve(_dbInstance);
    };
    req.onerror = (e) => {
      console.error('[Save] IndexedDB open failed:', e.target.error);
      reject(e.target.error);
    };
  });
}

/** 初始化：打开 DB，将所有存档读入内存缓存。返回 Promise。 */
async function initSaveSystem() {
  try {
    await _openDB();
    _dbReady = true;
    console.log('[Save] IndexedDB ready');

    // 申请持久存储（防止系统清理）
    if (navigator.storage && navigator.storage.persist) {
      try {
        const persisted = await navigator.storage.persist();
        console.log('[Save] navigator.storage.persist():', persisted ? 'granted' : 'denied');
      } catch (e) {
        console.warn('[Save] persist() failed:', e);
      }
    }

    // 预加载所有存档到内存缓存
    for (let i = 0; i < SAVE_COUNT; i++) {
      const data = await _idbGet(i);
      _saveCache.set(i, data);
    }
    console.log('[Save] All saves loaded into cache');

    // 也加载设置
    const settings = await _idbGet(SETTINGS_KEY);
    if (settings) _saveCache.set(SETTINGS_KEY, settings);

  } catch (e) {
    console.error('[Save] initSaveSystem failed:', e);
    // Fallback: 所有存档为空
    for (let i = 0; i < SAVE_COUNT; i++) _saveCache.set(i, null);
    _dbReady = false;
  }
}

// ==================== IndexedDB 低级操作 ====================

function _idbGet(key) {
  return new Promise((resolve, reject) => {
    if (!_dbInstance) { resolve(null); return; }
    const tx = _dbInstance.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

function _idbPut(key, value) {
  return new Promise((resolve, reject) => {
    if (!_dbInstance) { resolve(); return; }
    const tx = _dbInstance.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => {
      console.error('[Save] IDB put failed:', req.error);
      resolve(); // 不阻塞
    };
  });
}

function _idbDelete(key) {
  return new Promise((resolve, reject) => {
    if (!_dbInstance) { resolve(); return; }
    const tx = _dbInstance.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
}

// ==================== 章节显示名（与 Python CHAPTER_NAME_MAP 一致） ====================
const CHAPTER_NAME_MAP = {
  'start': '序章', 'chapter1': '第一章', 'chapter2': '第二章', 'chapter3': '第三章',
  'scene_01': '第一章', 'scene_02': '第二章', 'scene_03': '第三章',
};

function getChapterDisplayName(nodeId) {
  if (!nodeId) return '测试章';
  if (CHAPTER_NAME_MAP[nodeId]) return CHAPTER_NAME_MAP[nodeId];
  if (nodeId.startsWith('scene_')) return '第一章';
  if (nodeId.startsWith('ch')) return '后续章节';
  return '测试章';
}

// ==================== 序列化 gameState → JSON ====================
function serializeGameState(gs) {
  const now = new Date();
  return {
    version: '1.0',
    timestamp: Math.floor(now.getTime() / 1000),
    save_time: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`,
    play_time: gs._totalPlayTime || 0,
    chapter: gs.currentNodeId || '测试章',
    node_id: gs.currentNodeId || '',
    menu_stack: (gs.menuStack || []).map(m => (typeof m === 'string') ? m : (m && m.node_id) || ''),
    dialogue_index: gs.dialogueIndex || 0,
    flags: Object.assign({}, gs.flags || {}),
    inventory: (gs.inventory || []).map(item => Object.assign({}, item)),
    current_bg: gs.currentBgName || '',
    current_bgm: gs.currentBgm || null,
    triggered_auto_ids: Array.from(gs.triggeredAutoIds || new Set()),
    played_sequences: Array.from(gs.playedSequences || new Set()),
    visited_nodes: Array.from(gs.visitedNodes || new Set()),
    revealed_destinations: Array.from(gs.revealedDestinations || new Set()),
    applied_description_updates: Array.from(gs._appliedDescriptionUpdates || new Set()),
    applied_talk_updates: Array.from(gs._appliedTalkUpdates || new Set()),
    unlocked_characters: Array.from(gs.unlockedCharacters || new Set()),
    menu_snapshots: _serializeMenuSnapshots(gs.menuSnapshots),
    bg_overrides: Object.assign({}, gs.bgOverrides || {}),
    confrontation_persisted_statements: Object.assign({}, gs.confrontationPersistedStatements || {}),
    card_games_completed: Array.from(gs.cardGamesCompleted || new Set()),
    blood_count: gs.blood || 5,
    mode: gs.mode || 'menu',
    confrontation_summary_config: gs.confrontationSummaryConfig || null,
    confrontation_intro_id: gs.confrontationIntroId || null,
    confrontation_prev_menu: gs.confrontationPrevMenu || null,
    _in_case_trial: gs._inCaseTrial || false,
    _active_case_trial_menu: gs._activeCaseTrialMenu || null,
    _chapter_reminders_suppressed: gs._chapterRemindersSuppressed || false,
    confrontation_state: gs.confrontationState || null,
    test_mode: gs.testMode || false,
    settings: {
      bgm_volume: gs.bgmVolume || 0.5,
      sfx_volume: gs.sfxVolume || 0.7,
    }
  };
}

// menuSnapshots: { [nodeId]: Set<string> } → { [nodeId]: string[] }
function _serializeMenuSnapshots(snapshots) {
  if (!snapshots) return {};
  const result = {};
  for (const [key, val] of Object.entries(snapshots)) {
    if (val instanceof Set) {
      result[key] = Array.from(val);
    } else if (Array.isArray(val)) {
      result[key] = val;
    }
  }
  return result;
}

// string[] → Set<string>
function _deserializeMenuSnapshots(snapshots) {
  if (!snapshots) return {};
  const result = {};
  for (const [key, val] of Object.entries(snapshots)) {
    result[key] = new Set(Array.isArray(val) ? val : []);
  }
  return result;
}

// ==================== 写入存档（内存缓存 + 异步 IndexedDB） ====================
function saveGameToSlot(saveIndex, data) {
  // 同步更新内存缓存
  _saveCache.set(saveIndex, data);
  // 异步写入 IndexedDB
  if (_dbReady) {
    _idbPut(saveIndex, data).catch(e => console.error('[Save] IDB write error:', e));
  }
  return true;
}

// ==================== 读取存档元数据（从内存缓存同步读取） ====================
function getSaveInfo(saveIndex) {
  const data = _saveCache.get(saveIndex);
  if (!data) return { exists: false };
  try {
    // 计算游戏时长字符串
    const playTime = data.play_time || 0;
    const hours = Math.floor(playTime / 3600);
    const minutes = Math.floor((playTime % 3600) / 60);
    // 解析保存时间
    let year = '', date = '', realTime = '', saveTimeStr = data.save_time || '';
    if (saveTimeStr) {
      const parts = saveTimeStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (parts) {
        year = parts[1];
        date = `${parts[2]}/${parts[3]}`;
        realTime = `${parts[4]}:${parts[5]}`;
      }
    }
    return {
      exists: true,
      chapter: data.chapter || '未知',
      play_time: playTime,
      time_str: `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`,
      save_time: saveTimeStr,
      timestamp: data.timestamp || 0,
      node_id: data.node_id || '',
      year, date, real_time: realTime,
      chapter_display: getChapterDisplayName(data.chapter),
      flags_count: Object.keys(data.flags || {}).length,
      inventory_count: (data.inventory || []).length,
    };
  } catch (_) {
    return { exists: false };
  }
}

// ==================== 读取完整存档 ====================
function loadGameFromSlot(saveIndex) {
  const data = _saveCache.get(saveIndex);
  if (!data) return null;
  try {
    // 返回深拷贝，防止游戏修改缓存数据
    return JSON.parse(JSON.stringify(data));
  } catch (_) {
    return null;
  }
}

// ==================== 删除存档 ====================
function deleteSaveSlot(saveIndex) {
  _saveCache.set(saveIndex, null);
  if (_dbReady) {
    _idbDelete(saveIndex).catch(e => console.error('[Save] IDB delete error:', e));
  }
  return true;
}

// ==================== 列出所有存档 ====================
function listAllSaves() {
  const saves = [];
  for (let i = 0; i < SAVE_COUNT; i++) {
    saves.push(getSaveInfo(i));
  }
  return saves;
}

// ==================== 设置持久化（IndexedDB） ====================
function loadSettings() {
  const data = _saveCache.get(SETTINGS_KEY);
  if (!data || !gameState) return;
  if (data.bgm_volume !== undefined) gameState.bgmVolume = data.bgm_volume;
  if (data.sfx_volume !== undefined) gameState.sfxVolume = data.sfx_volume;
  if (data.muted !== undefined) gameState.muted = data.muted;
  if (typeof syncAudioSettings === 'function') syncAudioSettings();
}

function saveSettings() {
  if (!gameState) return;
  const data = {
    bgm_volume: gameState.bgmVolume || 0.5,
    sfx_volume: gameState.sfxVolume || 0.7,
    muted: gameState.muted || false,
  };
  _saveCache.set(SETTINGS_KEY, data);
  if (_dbReady) {
    _idbPut(SETTINGS_KEY, data).catch(e => console.error('[Save] IDB settings write error:', e));
  }
  if (typeof syncAudioSettings === 'function') syncAudioSettings();
}

// ==================== 反序列化 JSON → gameState ====================
function deserializeGameState(data, gs) {
  if (!data || !gs) return false;

  // 恢复 flags
  gs.flags = data.flags || {};

  // 恢复 inventory（用 scenarioData 刷新描述，与 Python load_from_slot 一致）
  gs.inventory = data.inventory || [];
  if (gs.inventory.length > 0 && scenarioData) {
    const canonicalItems = (scenarioData.items || {});
    // 也查 chapters 下的 items
    const chapter = scenarioData.current_chapter || 'prologue';
    const chItems = (scenarioData.chapters && scenarioData.chapters[chapter] && scenarioData.chapters[chapter].items) || {};
    for (const item of gs.inventory) {
      const c = canonicalItems[item.id] || chItems[item.id];
      if (c && c.description) item.description = c.description;
    }
  }

  // 恢复基本状态
  gs.currentBgName = data.current_bg || '';
  gs.currentBgm = data.current_bgm || null;
  gs.blood = data.blood_count || 5;

  // 恢复 BGM 播放（与 Python play_bgm(force=True) 一致）
  if (gs.currentBgm) {
    try { playBgm(gs.currentBgm); } catch (_) {}
  }

  // 恢复 Set 类型字段
  gs.visitedNodes = new Set(data.visited_nodes || []);
  gs.playedSequences = new Set(data.played_sequences || []);
  gs.triggeredAutoIds = new Set(data.triggered_auto_ids || []);
  gs.unlockedCharacters = new Set(data.unlocked_characters || []);
  gs.revealedDestinations = new Set(data.revealed_destinations || []);
  gs._appliedDescriptionUpdates = new Set(data.applied_description_updates || []);
  // 重新应用描述更新到内存中的物品/人物数据（与 Python load_from_slot 一致）
  if (gs._appliedDescriptionUpdates.size > 0 && scenarioData) {
    const ch = scenarioData.chapters && scenarioData.chapters[scenarioData.current_chapter || 'prologue'];
    const descUpdates = ch && ch.description_updates;
    if (descUpdates) {
      for (const flagKey of gs._appliedDescriptionUpdates) {
        const itemUp = descUpdates.items && descUpdates.items[flagKey];
        if (itemUp) {
          const item = gs.inventory.find(inv => inv.id === itemUp.target_id);
          if (item) {
            item.description = itemUp.update_type === 'replace' ? itemUp.text : (item.description || '') + itemUp.text;
          }
        }
        const charUp = descUpdates.characters && descUpdates.characters[flagKey];
        if (charUp) {
          if (!gs._characterDescriptions) gs._characterDescriptions = {};
          gs._characterDescriptions[charUp.target_id] = charUp.update_type === 'replace' ? charUp.text : (gs._characterDescriptions[charUp.target_id] || '') + charUp.text;
        }
      }
      console.log(`[Save] 重新应用 ${gs._appliedDescriptionUpdates.size} 条描述更新`);
    }
  }
  gs._appliedTalkUpdates = new Set(data.applied_talk_updates || []);
  gs.cardGamesCompleted = new Set(data.card_games_completed || []);

  // 恢复 menuSnapshots（Set 转换）
  gs.menuSnapshots = _deserializeMenuSnapshots(data.menu_snapshots);

  // 恢复 bgOverrides
  gs.bgOverrides = data.bg_overrides || {};

  // 恢复质问系统
  gs.confrontationPersistedStatements = data.confrontation_persisted_statements || {};
  gs.confrontationState = data.confrontation_state || null;
  gs.confrontationSummaryConfig = data.confrontation_summary_config || null;
  gs.confrontationIntroId = data.confrontation_intro_id || null;
  gs.confrontationPrevMenu = data.confrontation_prev_menu || null;

  // 恢复菜单栈
  const menuStackIds = data.menu_stack || [];
  gs.menuStack = menuStackIds.map(nid => ({ node_id: nid }));

  // 恢复对话
  gs.dialogueIndex = data.dialogue_index || 0;

  // 恢复设置
  const settings = data.settings || {};
  if (settings.bgm_volume !== undefined) gs.bgmVolume = settings.bgm_volume;
  if (settings.sfx_volume !== undefined) gs.sfxVolume = settings.sfx_volume;

  // 测试模式不从存档恢复 — 由标题画面开关控制，独立于存档

  // 恢复 case trial
  gs._inCaseTrial = data._in_case_trial || false;
  gs._activeCaseTrialMenu = data._active_case_trial_menu || null;
  gs._chapterRemindersSuppressed = data._chapter_reminders_suppressed || false;
  gs.blood = data.blood_count || 5;

  // 读档后重置章节提醒计数器并强制触发一次（与 Python load_from_slot 一致）
  gs._forceChapterReminderCheck = true;
  gs.chapterReminderCounters = {};
  gs._reminderConditionsMet = {};
  gs._pendingSceneTravel = false;

  // 读档标记：save_prompt 时跳过（与 Python _just_loaded 一致）
  gs._justLoaded = true;

  // 恢复 play_time
  gs._totalPlayTime = data.play_time || 0;

  // 读档后立即评估所有 required_menus 的 talks_*_all_done flag（与 Python load_from_slot 一致）
  if (typeof scenarioData !== 'undefined' && scenarioData) {
    const reminders = scenarioData.chapter_reminders || {};
    for (const cfg of Object.values(reminders)) {
      const menus = cfg.required_menus || [];
      for (const menuId of menus) {
        const flagName = 'talks_' + menuId + '_all_done';
        gs.flags[flagName] = gs._checkMenuTalksDone(menuId);
      }
    }
  }

  // 进入节点（恢复场景）
  const nodeId = data.node_id || 'scene_prologue_01';
  gs.currentNodeId = nodeId;

  return true;
}

// ==================== 章节显示名 ====================
function getChDisplayName(nodeId) {
  return getChapterDisplayName(nodeId);
}
