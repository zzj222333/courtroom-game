# Web 版迁移路线图

> **用途**: AI（我）在多轮对话中保持上下文，跟踪已完成和待完成的模块。
> **原则**: 每完成一个子任务，立刻标记 `[x]`。每轮对话结束时更新状态。
> **状态**: ⏳ 规划中 | 🔨 进行中 | ✅ 已完成 | ❌ 暂缓

---

## 全局设计原则（所有阶段遵守）

### 三输入模式并行

| 模式 | 设备 | 激活方式 | 优先级 |
|------|------|---------|--------|
| **键鼠** | 桌面浏览器 | 键盘/鼠标事件 | 与触摸互斥判断 |
| **手柄** | 桌面 + XInput | Gamepad API | 任何手柄按键激活 |
| **触摸** | 手机/平板 | touchstart/touchend | 与键鼠互斥判断 |

### 核心规则

1. **所有键盘快捷键必须有可见按钮替代。** 触摸用户看不到键盘，必须能靠屏幕上的按钮完成所有操作。
   - Esc → 屏幕上放"返回/取消"按钮
   - Enter/Space → 点击对话框本身推进
   - ↑↓←→ 在调查模式 → 屏幕上放虚拟十字键（可选，触摸拖拽也可移动光标）
2. **触摸检测优先于键鼠检测。** `touchstart` 事件触发时，标记 `isTouchDevice = true`，后续鼠标事件当作触摸处理。
3. **手柄激活时显示按键图标，触摸模式隐藏。** 触摸模式有自己的视觉提示（按钮高亮、拖拽手柄），不需要 A/B/X/Y 图标。
4. **UI 元素最小点击区域 44×44px。** 满足 iOS HIG 和 Android Material Design 的触摸目标要求。
5. **所有 hover 效果必须有 touch 等价。** 触摸没有 hover，用 `:active` 或 JS touch 高亮替代。
6. **Canvas 全屏适配。** `touch-action: none` 禁止浏览器手势（缩放/滚动），`user-select: none` 禁止文字选择。

---

## 验证与交付规则

**每个子任务完成后，我会：**
1. 写代码
2. 告诉你"交付了什么"（哪些文件、什么功能）
3. 告诉你"怎么验证"（桌面浏览器 + 手机浏览器，按什么、期望看到什么）

**重要的验证规则：**
- 每个子任务的验证**独立可执行**，不依赖后续未完成的任务
- 如果某个验证依赖之前的任务，会明确说明前置条件
- 你只需要浏览器 F5 + 按对应按键即可完成验证（桌面）
- **重要子任务需同时在手机上验证触摸行为**
- 如果验证不通过，直接告诉我"哪一步、预期什么、实际看到什么"

---

## 阶段 0：基础骨架 + Canvas 缩放 + 资源加载

**服务**: `python -m http.server 8080 --directory "z:\PC相关\AI_test_game\test1"` → 浏览器打开 `http://localhost:8080/web/`

### 0.1 Canvas 响应式缩放

- [x] **内容**
  - 16:9 保比例，任意窗口大小自动适配
  - 设计分辨率 1920×1080（内部坐标体系）
  - `resizeCanvas()` + 窗口 resize 监听

**交付**: 更新 `main.js` 中的 `resizeCanvas()`，页面打开后 Canvas 自动填充窗口保持 16:9
**验证**: 打开浏览器 F12 → 开发工具 → 调整窗口大小 → Canvas 始终 16:9，两侧黑边

---

### 0.2 图片预加载系统

- [x] **内容**
  - 202 个 PNG，分批加载 + 进度条
  - 缓存到 `Map<string, HTMLImageElement>`
  - 加载完成前显示 loading 界面（百分比文字）

**交付**: 更新 `engine.js`，页面打开先显示 loading 百分比，加载完后消失
**验证**: 打开页面 → 看到 loading 百分比递增 → 加载完成后百分比消失 → F12 Network 面板确认所有图片状态 200

---

### 0.3 JSON 数据加载

- [x] **内容**
  - `scenario.json`（589KB）→ 异步 fetch 解析
  - `characters.json` → 角色数据库
  - 加载完毕存入全局变量 `scenarioData` / `charactersData`

**交付**: 更新 `main.js` 添加 `loadData()` 函数，加载完毕后 F12 Console 能输入 `scenarioData` 查看内容
**验证**: F12 Console → 输入 `Object.keys(scenarioData)` → 看到节点 ID 列表 → 输入 `charactersData` → 看到角色信息

---

### 0.4 基础渲染验证

- [x] **内容**
  - 加载 `bg_menu_01.png` 并在 Canvas 居中绘制
  - 16:9 黑边自动填充黑色

**交付**: Canvas 上显示一张背景图，铺满 1920×1080 Canvas
**验证**: 打开页面（加载完成后）→ 看到一张完整的背景图 → 缩放窗口不变形

---

## 阶段 1：GameState + 对话系统 + 输入骨架

### 1.1 GameState 核心状态

- [x] **内容**
  - 翻译 Pygame `GameState.__init__` → JS（所有字段，即使暂不用的也声明）
  - `flags`、`inventory`、`menu_stack`、`dialogue_queue`、`dialogue_index` 等

**交付**: `gamestate.js` 中 `GameState` 类字段完整声明，构造函数初始化所有字段
**验证**: F12 Console → 输入 `new GameState()` → 看到对象包含所有预期字段

---

### 1.2 enterNode() 方法

- [x] **内容**
  - `type: "menu"` → 解析 `options` 数组并存到 `state.menuOptions`
  - `type: "sequence"` → 取出 `dialogues`，调用 `startDialogue()`
  - 其他 type → 打印日志占位
  - `background` / `bgm` / `characters` 设置（如果节点有）

**交付**: `enterNode("scene_prologue_01")` 能解析序章第一个节点
**验证**: F12 Console → 创建 GameState → 调用 `gameState.enterNode("scene_prologue_01")` → 看到 dialogueQueue 有对话内容

---

### 1.3 对话播放系统

- [x] **内容**
  - DOM 渲染对话框（底部横条）：**说话人名** + **打字机文本**
  - 打字机速度 22 字/秒
  - 空格 / 鼠标点击对话框推进
  - 对话队列播完后自动调用 `enterNode(next_node_id)`

**交付**: `ui.js` 中 `drawDialogBox()` + `drawDialogueText()` 实现，`gamestate.js` 中 `startDialogue()` / `advanceDialogue()` 实现
**验证**: 打开页面 → 序章对话自动逐句播放 → 说话人名显示 → 打字机逐字出现 → 按空格跳到下一句 → 对话结束后自动进入下一个节点

---

### 1.4 输入抽象层骨架

- [x] **内容**
  - 键盘事件：`keydown`/`keyup` → `keys`/`keysJustPressed`
  - 鼠标事件：`mouse.canvasX/Y`（自动映射到设计坐标）
  - 手柄轮询：`navigator.getGamepads()` → `gamepad.buttons`
  - F12 Console 可打印当前按键状态

**交付**: `input.js` 中事件监听 + 轮询函数完整
**验证**: F12 Console → 按住空格 → 输入 `keys[' ']` → 看到 `true` → 松开 → 看到 `false` → 插手柄按 A → 看到 gamepad 状态变化

---

## 阶段 2：场景菜单 + 设置界面

### 2.1 showMenu() 场景菜单

- [x] **内容**
  - 底部三按钮：物品栏（左下）、调查（右下）、离开此地（正下）
  - options 列表垂直居中，条件判断过滤
  - 键盘↓↑导航 + 鼠标悬停高亮 + 点击跳转
  - 手柄十字键导航

**交付**: `ui.js` `drawSceneMenu()` 完整实现，`gamestate.js` `showMenu()` / `selectMenuOption()` 实现
**验证**: 进入 scene_city_01 → 看到场景菜单选项列表 → ↓↑ 移动高亮 → Enter/点击选中 → 跳转到对应节点

---

### 2.2 离开菜单 (destinations)

- [x] **内容**
  - `openLeaveMenu()` → 从当前节点 `destinations` 生成选项
  - 条件过滤已解锁目的地
  - "返回"按钮回到菜单

**交付**: `gamestate.js` `openLeaveMenu()` 实现，`ui.js` 离开菜单渲染
**验证**: 点击"离开此地" / 手柄 B → 显示目的地列表 → 条件过滤正确 → 点击"返回"回到主菜单

---

### 2.3 设置界面

- [x] **内容**
  - BGM 音量滑块、SFX 音量滑块、静音开关
  - 在游戏内可呼出（Esc 键）
  - localStorage 持久化

**交付**: `ui.js` `drawSettings()` 实现，ESC 键绑定
**验证**: 游戏中按 Esc → 弹出设置界面 → 拖动 BGM 滑块声音变小 → 刷新页面 → 音量保持

---

## 阶段 3：调查系统

### 3.1 startSceneInvestigation() + 数据加载

- [x] **内容**
  - 从 JSON 加载当前节点的 `investigate_points`
  - condition 过滤 + `investigation_resets` 清除旧标记
  - 切换到 `mode: "investigation"`

**交付**: `gamestate.js` `startInvestigation()` + `_refreshInvestigationPoints()` 实现
**验证**: 进入 scene_prologue_02 → 点击"调查" → F12 Console 看到 `state.mode === 'investigation'` → `state.investigationPoints.length > 0`

---

### 3.2 光标系统

- [x] **内容**
  - 鼠标移动驱动光标
  - 键盘↑↓←→移动（400px/s）
  - 手柄十字键 + 左摇杆驱动
  - 手柄模式启用时 `canvas.style.cursor = 'none'` 隐藏系统鼠标

**交付**: `input.js` 中 `updateGamepadMovement()` + `investigation.js` 中光标位置更新逻辑 + `main.js` 键盘持续移动
**验证**: 进入调查模式 → 动鼠标：光标跟随 → 按方向键：光标移动 → 插手柄推摇杆：光标移动

---

### 3.3 调查点交互（放大镜切换）

- [x] **内容**
  - 靠近调查点（≤88px）→ 放大镜图标
  - 远离调查点 → 普通圆光标
  - 手柄模式：放大镜右下角显示 A 键图标
  - 鼠标点击 / Enter / 手柄 A → 触发

**交付**: `investigation.js` `investigationCheck()` + `drawInvestigation()` 光标绘制
**验证**: 调查模式 → 光标远离调查点：普通小圆 → 靠近调查点：变放大镜 + A 键图标 → 点击触发

---

### 3.4 investigationTrigger() + 对话

- [x] **内容**
  - 播放 `sfx_investigate_find`
  - 首次调查 → 播放 `dialogues` → 标记 flag
  - 再次调查 → 播放 `dialogues_after`
  - puzzle 的点 → 占位打印 "Puzzle triggered: xxx"

**交付**: `investigation.js` `investigationTrigger()` 完整实现 + `gamestate.js` `_onDialogueQueueEnd()` 调查恢复逻辑
**验证**: 点击调查点 → 听到查找音效 → 对话播放 → 对话结束回到调查 → 再点同一个点 → 播放不同的 `dialogues_after`

---

### 3.5 已调查标记 + 进度 + 退出

- [x] **内容**
  - 已调查点显示"勾"标记
  - 右下角进度 "3/5"
  - "结束调查"按钮 + 手柄 B 键图标
  - 退出时检查 → `xxx_all_done` flag

**交付**: `investigation.js` `drawInvestigation()` 中的标记和进度绘制 + 退出按钮逻辑 + `gamestate.js` `exitInvestigation()`
**验证**: 点过一个调查点 → 该位置出现勾 → 右下角看到 "1/5" → 点击"结束调查" → 回到场景菜单

---

## 阶段 4：物品栏 + 展示系统

### 4.1 物品卡片轮播

- [x] **内容**
  - 物品卡片水平排列，最多 5 可见，居中高亮
  - ←→箭头 / 键盘 L/R 切换
  - CSS `transition: transform 0.3s` 滑动动画
  - 物品名称 + 描述在下方信息框

**交付**: `gamestate.js` `showInventoryMenu()` + `ui.js` `drawInventory()` 
**验证**: 点击"物品栏" → 看到物品卡片排列 → ←→ 切换 → 卡片滑动 → 名称和描述变化

---

### 4.2 展示物品 → 对话

- [x] **内容**
  - 从 `item_talks[当前speaker][物品ID]` 查配置
  - 有 → 播放定制对话
  - 无 → 播放 `item_thoughts`
  - `effects.set_flag` 在对话结束后应用

**交付**: `gamestate.js` `showItemToCharacter()` 实现
**验证**: 物品栏 → 选中物品 → "展示" → 播放对话 → 物品栏关闭 → 回到场景 → 人物说对应台词

---

### 4.3 人物模式

- [x] **内容**
  - 切换到 `character_list`
  - 展示人物卡片（图片 + 名字）
  - 从 `character_talks[speaker][target]` 查配置
  - 支持 `talk_updates` 动态替换

**交付**: `gamestate.js` `toggleInventoryMode()` + `ui.js` 人物视图渲染
**验证**: 物品栏 → "切换人物" → 看到人物卡片 → 展示人物 → 角色说对应台词

---

### 4.4 物品获得/失去/反馈

- [x] **内容**
  - `gainItem(id)` → 物品添加 + 弹出提示框
  - `removeItem(id)` → 物品移除 + 弹出提示框
  - `description_updates` → 描述更新 + 提示

**交付**: `gamestate.js` `gainItem()` / `removeItem()` / `updateItemDescription()` 
**验证**: 获得物品时 → 看到"获得xxx"提示 → 打开物品栏 → 新物品出现 → 剧情触发失去时 → 看到"失去"提示

---

## 阶段 5：质问系统（分 3 个子阶段）

### 5A.1 质问启动 + 陈述播放

- [x] **内容**
  - 从 `confrontation_statement` 节点加载 `statements`
  - 播放"陈述开始"过场
  - 第一个陈述文本从 `statement_start` 开始
  - 质问专用对话框样式

**交付**: `confrontation.js` `startConfrontation()` 实现
**验证**: 剧情进入质问 → 看到"陈述开始"过场 → 第一个陈述文本出现

---

### 5A.2 陈述导航

- [x] **内容**
  - ←→箭头 / 键盘 L/R 切换陈述
  - 显示 "第 N 句 / 共 M 句"
  - 手柄 L/R 肩键切换

**交付**: `confrontation.js` 陈述切换逻辑
**验证**: 质问中 → 按 → → 陈述文本变化 → 看到 "第2句/共5句" → 按 ← 回到第1句

---

### 5A.3 追问 (executeFollowUp)

- [x] **内容**
  - 读取当前陈述的 `follow_up` → 播放对话
  - `result_type 1` → 推进到下一句
  - `result_type 2` → 更新当前陈述文本
  - `result_type 3` → 插入新陈述 + `append_statements`

**交付**: `confrontation.js` `executeFollowUp()` + `applyFollowUpResult()` 
**验证**: 按"追问" → 播放追问对话 → 对话结束 → 陈述推进（或更新）→ 回到质问界面

---

### 5A.4 质问结束 + 总结

- [x] **内容**
  - 所有陈述完成 → `outro` → 质问总结界面
  - "再问一遍" → 重置索引归零
  - "结束质问" → 返回主流程

**交付**: `confrontation.js` `showConfrontationSummary()` 
**验证**: 追问完最后一句 → outro 对话 → 总结界面 → 点"再问一遍"→ 回到第一句 → 再"结束质问"→ 回到主流程

---

### 5B.1 举证

- [x] **内容**
  - "举证"按钮 → 打开物品栏 proof 模式
  - 选择物品 → 匹配 `statement.evidence`
  - 匹配 → 举证成功对话 → `applyProofEffect()`
  - 不匹配 → 失败对话 → 扣血

**交付**: `confrontation.js` `executeProof()` 
**验证**: 质问中按"举证" → 物品栏打开 → 选正确物品 → 成功动画 → 选错误物品 → 失败对话

---

### 5B.2 举证效果

- [x] **内容**
  - `set_flag` / `trigger_event` / `end_confrontation` / `remove_current_item` / `bg_overrides`

**交付**: `confrontation.js` `applyProofEffect()` 
**验证**: 华安质问选择正确证据 → 成功事件图片出现 → 质问结束回到主流程

---

### 5B.3 人物举证

- [x] **内容**
  - 物品栏切换到人物模式
  - `character_proofs[speaker][targetId]` 查配置
  - 人物举证成功/失败对话 + 扣血

**交付**: `confrontation.js` `checkCharacterProofResult()` 实现
**验证**: 某些质问 → 举证 → 切到人物模式 → 选人 → 成功/失败

---

### 5B.4 成功 BGM 切换

- [x] **内容**
  - `proof_bgm` 配置：指定对话行播放特殊 BGM

**交付**: 在举证成功对话播放时切入 proof_bgm
**验证**: 举证成功 → BGM 变化 → 刺激

---

### 5C.1 生命条

- [x] **内容**
  - 初始生命值（默认 5）
  - 每次举证失败扣血
  - 归零 = 回主菜单
  - UI 绘制在质问界面

**交付**: `confrontation.js` 生命值管理 + `drawConfrontation()` 生命条渲染
**验证**: 举证失败 → 生命条减少 → 连续失败归零 → 回到主菜单

---

### 5C.2 特殊模式

- [x] **内容**
  - `_in_case_trial` 模式下的特殊返回行为
  - confrontation 存档恢复逻辑

**交付**: `confrontation.js` 特殊模式处理
**验证**: 案情审理场景 → 返回行为不同（不影响质问状态）

---

### 5C.3 陈述持久化

- [x] **内容**
  - `confrontationPersistedStatements` 存/读
  - 存档字段集成（save.js serialize/deserialize）

**交付**: `confrontation.js` 持久化 + `save.js` 存档字段扩展
**验证**: 质问中存档 → 读档 → 陈述状态恢复正确

---

## 阶段 6：谜题系统

### 6.1 数字密码谜题

- [x] **内容**
  - 显示底图 + 密码框
  - 数字位 ×3，↑↓ 调整（0-9 循环）
  - 确认检查答案
  - 成功 → 成功 SFX + 设置 flag

**交付**: `puzzle.js` 密码谜题完整实现（与 Python `start_puzzle`/`draw_puzzle`/`_do_puzzle_confirm` 100% 一致）
**验证**: 调查宝箱 → 密码谜题出现 → 调到 5-1-8 → 确认 → 成功抖动+底图切换+胜利图标滑入 → 获得西域舞鞋 → 回到调查

---

### 6.2 选图谜题（类型 B）

- [x] **内容**
  - 显示底图 + 候选子图
  - 点击选中 → 移动到目标位置
  - 多页支持（RB/LB 翻页）
  - 成功 → 抖动特效 + 图标动画

**交付**: `puzzle.js` 选图谜题实现（`puzzleBPages`/`puzzleBSubImages`/`typeb_success_shake`）
**验证**: 进入画选谜题 → 选图 → 拖动/点击到位 → 成功特效
**说明**: 选图谜题(type B)与数字密码锁(type A)共用 `puzzle.js`，两者均已实现

---

### 6.3 谜题返回路径

- [x] **内容**
  - fade 退出 → 返回调查 / 卡片游戏
  - 支持不同调用者的 resume 模式

**交付**: `puzzle.js` `_exitPuzzleToInvestigation()` / `_exitPuzzleToCardGameReturn()`
**验证**: 谜题完成 → fade → 返回调查模式 → 可继续调查

---

## 阶段 7：存档 + 收尾

### 7.1 存档系统

- [x] **内容**
  - 7 槽位（与 Pygame SAVE_PER_SLOT 一致）
  - IndexedDB 持久存储 + 内存缓存双写
  - 存档数据：flags, inventory, visitedNodes, menuStack 等
  - JSON 序列化（Set → Array 转换）

**交付**: `save.js` 存档实现完整（`saveGameToSlot()`/`loadGameFromSlot()`/`serializeGameState()`）
**验证**: F12 Console → 游戏中途 `saveGameToSlot(0, data)` → Application → IndexedDB → 看到存档数据

---

### 7.2 存档/读档 UI

- [x] **内容**
  - 7 槽位竖排按钮 + 内容预览（时间/章节/进度）
  - 保存成功提示（淡出效果）
  - 主菜单"读取游戏"入口

**交付**: `main.js` `drawSaveFileMenu()` + 主菜单集成
**验证**: 主菜单 → "读取游戏" → 选择槽位 → 看到存档列表 → 点读档 → 游戏恢复

---

### 7.3 主菜单完整化

- [x] **内容**
  - 开始游戏 → 序章
  - 读取游戏 → 存档列表
  - 设置 → 音量界面
  - 退出 → 刷新页面

**交付**: `main.js` `drawTitleScreen()` Canvas 绘制四按钮
**验证**: 打开页面 → 看到主菜单 → 四个按钮均可点击 → 每个功能正常

---

### 7.4 全局功能收尾

- [x] **内容**
  - 手柄图标在调查点显示（放大镜+A键），质问界面 X+Y 提示
  - 调试面板 → F1 键切换显示
  - 错误捕获 try/catch 包裹所有渲染和更新函数
  - ⏳ loading 界面美化 → 背景图 + 进度条（目前仅进度条，缺背景图）

**交付**: 调试面板 + 错误处理 + 手柄图标已实现。loading 背景图待补。**验证**: F1 打开调试面板 → 看到当前状态 → 故意报错 → 看到 try-catch 捕获

---

### 7.5 移动端收尾

- [x] **内容**
  - iOS AudioContext 解锁（首次点击 `resume()`）
  - 字体子集化 → woff2（已内联思源黑体）
  - 全面触摸支持内建（按钮高亮、防连击、安全区域适配）
  - ⏳ 虚拟十字键（调查模式可选，待实现）

**交付**: CSS touch 样式 + 音频解锁 + 移动端适配已基本就绪
**验证**: 手机浏览器打开 → 从头到尾可通关 → 所有按钮可点击 → 音频正常

---

## 全局技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 渲染方式 | Canvas 背景/立绘 + DOM UI | Canvas 适合图片合成，DOM 适合文字/按钮 |
| 数据格式 | 直接复用 `scenario.json` | 零改动 |
| 图片引用 | `../xxx.png` 相对路径 | 与 Pygame 共享资源，不复制 |
| 字体 | SourceHanSansSC .woff2 子集 | 1MB/字重，支持所有剧情文字 |
| 音频 | Web Audio API | 更灵活的控制 + 移动端兼容 |
| 存档 | localStorage | 无需服务器，离线可用 |
| 模块化 | ES6 class + 全局变量 | 简单，适合单一游戏不引入打包工具 |
| 测试服务器 | `python -m http.server 8080 --directory "z:\PC相关\AI_test_game\test1"` → `http://localhost:8080/web/` | 零配置，所有平台可用 |
| 触摸设计 | 所有交互必须有可见按钮替代键盘 | 移动端无法用键盘，靠按钮完成所有操作 |

## 依赖顺序

```
阶段 0 ──→ 阶段 1 ──→ 阶段 2 ──→ 阶段 3
                │            │
                │            └──→ 阶段 4
                │
                └──→ 阶段 5A ──→ 5B ──→ 5C
                                    │
阶段 3 ──────────────────────→ 阶段 6
                                    │
                                    └──→ 阶段 7
```

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-07-06 | ✅ 代码审查确认 5B.3/5C.3/6.2/6.3/7.1/7.2/7.3/7.4 核心均已实现，更新为 [x]；7.4/7.5 标记 ⏳ 子项待收尾 |
| 2026-06-24 | 初始版本，8 阶段 30+ 子任务 |
| 2026-06-24 | 每个子任务增加"交付"和"验证"说明 |
| 2026-06-24 | 新增"全局设计原则"——三输入模式（键鼠/手柄/触摸）并行，所有键盘快捷键必须有可见按钮替代，触摸支持全程内建而非最后补 |
| 2026-06-24 | ✅ 阶段0 全部完成：Canvas缩放、Loading进度条、JSON/PNG预加载、背景渲染 |
| 2026-06-24 | ✅ 阶段1 全部完成：GameState全部字段、enterNode(menu/sequence)、打字机对话、输入骨架 |
| 2026-06-24 | ✅ 阶段2 全部完成：场景菜单、离开菜单、设置界面 |
| 2026-06-24 | ✅ 阶段3 全部完成：调查系统（光点/放大镜/标记/进度/退出/条件过滤/resets） |
