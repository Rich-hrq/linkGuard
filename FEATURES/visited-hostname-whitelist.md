# Feature: Visited Hostname Whitelist

## 需求背景

西里尔字母检测功能会对所有非白名单链接弹出 TLD 确认弹窗，用户体验较差。用户每次访问新域名都需要点击确认，频繁弹窗影响浏览流畅度。

本功能通过记录用户已确认过的域名（hostname），后续访问时跳过确认弹窗，直接跳转。

---

## 需求总结

| 项目 | 决策 |
|------|------|
| 存储位置 | `chrome.storage.local` |
| 存储键名 | `visitedHostnames` |
| 默认容量 | 500 条 |
| 最大容量 | 10000 条（用户可配置） |
| 淘汰策略 | FIFO（移除最早记录） |
| 匹配粒度 | hostname（完整域名，非 TLD） |
| 管理界面 | 扩展选项页面（options.html） |

---

## 功能边界

### 做什么

- 用户在 TLD 确认弹窗点击"确定"后，自动记录目标 hostname
- 后续访问已记录的 hostname 时，跳过 confirm 弹窗，直接跳转
- 提供设置页面管理白名单（查看、删除单条、清空全部）
- 支持用户配置白名单容量上限
- 超出容量时自动淘汰最早记录（FIFO）

### 不做什么

- 不自动导入浏览器历史记录
- 不跨设备同步（仅本地存储）
- 不跳过西里尔字母检测（安全策略不可覆盖）
- 不记录 `javascript:`、`mailto:`、`tel:` 等非 HTTP 协议

---

## 核心设计

### 数据结构

```js
// 存储键名
const STORAGE_KEY = "visitedHostnames";
const MAX_COUNT_KEY = "maxVisitedCount";
const DEFAULT_MAX = 500;

// 数据结构：字符串数组
["example.com", "github.com", "google.com"]
```

### 存储结构

使用 `chrome.storage.local`：

| 键名 | 类型 | 说明 |
|------|------|------|
| `visitedHostnames` | `string[]` | 已访问的 hostname 列表，按时间顺序排列 |
| `maxVisitedCount` | `number` | 白名单容量上限，默认 500 |

### 状态流转

```
用户点击链接（非西里尔）
    │
    ▼
preventDefault() 同步阻止默认行为
    │
    ▼
getVisitedData() 异步读取白名单
    │
    ├─ hostname 在白名单中 → 直接跳转（跳过 confirm）
    │
    └─ hostname 不在白名单中
            │
            ▼
        confirm("即将跳转至顶级域名：.com\n\n是否继续？")
            │
            ├─ 确认 → saveVisitedHostname(hostname) → 跳转
            │
            └─ 取消 → return（留在当前页）
```

### API / 消息流

**写入白名单流程**：

```
saveVisitedHostname(hostname)
    │
    ▼
getVisitedData() → { visited, maxCount }
    │
    ▼
filter 去重（移除已有同名条目）
    │
    ▼
push 新 hostname（追加到末尾）
    │
    ▼
while (length > maxCount) shift()  ← FIFO 淘汰
    │
    ▼
chrome.storage.local.set({ visitedHostnames: filtered })
```

**设置页面交互**：

```
options.html 打开
    │
    ▼
load() → chrome.storage.local.get → 渲染列表 + 填充 input
    │
    ├─ 保存容量 → set maxVisitedCount → 若超限则 slice 裁剪
    ├─ 删除单条 → filter 移除 → set 更新
    └─ 清空全部 → confirm 确认 → set []
```

---

## 边界条件

- **异步时序**：`chrome.storage.local.get()` 是异步操作，`preventDefault()` 必须在调用前同步执行
- **去重逻辑**：`saveVisitedHostname()` 先 filter 再 push，确保同一 hostname 只保留最新记录
- **容量裁剪**：保存新容量时，若现有列表超限，从头部 slice 裁剪（保留最新记录）
- **空列表处理**：`renderList()` 使用 `:empty` 伪类显示"暂无记录"占位文本
- **hostname 匹配**：使用完整 hostname 匹配（如 `www.example.com` 和 `example.com` 视为不同）

---

## 实现计划

1. 定义存储键名和默认常量
2. 实现 `getVisitedData()` 封装 Promise 读取
3. 实现 `saveVisitedHostname()` 写入白名单（去重 + FIFO 淘汰）
4. 修改点击事件处理器，添加白名单检查逻辑
5. 创建 `options.html` 设置页面 UI
6. 实现 `options.js` 管理功能（查看、删除、清空、容量配置）
7. 更新 `manifest.json` 声明 `storage` 权限和 `options_page`

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `content.js` | 修改：添加白名单读写逻辑、跳过 confirm 的分支 |
| `options.html` | 新增：设置页面 UI |
| `options.js` | 新增：设置页面逻辑 |
| `manifest.json` | 修改：添加 `storage` 权限、`options_page` 配置 |

---

## 风险与注意事项

- **异步时序风险**：`preventDefault()` 必须同步调用，否则浏览器已开始导航
- **存储容量**：`chrome.storage.local` 约 10MB，500 条 hostname 约 50KB，无风险
- **hostname 粒度**：`www.example.com` 和 `example.com` 视为不同域名，用户可能需要分别确认
- **FIFO 淘汰**：长期未访问的域名可能被淘汰，需要重新确认

---

## 最终确认记录

### 用户确认

用户在第二次提交中确认白名单功能需求。

### 最终决策

- 使用 `chrome.storage.local` 而非 `localStorage`，确保跨页面共享
- 使用 FIFO 而非 LRU 淘汰策略，实现简单且效果足够
- 白名单只跳过 TLD confirm，不跳过西里尔检测（安全优先）
- 默认容量 500，上限 10000，用户可在设置页面调整

### 后续可扩展项

- 支持按 TLD 分组管理
- 导入/导出白名单
- 跨设备同步（chrome.storage.sync）
- 访问频率统计
