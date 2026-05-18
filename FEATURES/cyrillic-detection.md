# Feature: Link Click Interception

## 需求背景

浏览器扩展的核心安全功能，包含两层防护：

1. **西里尔字母检测**：随着国际化域名（IDN）的普及，攻击者利用西里尔字母与拉丁字母外观相同的特点，注册形如 `аpple.com` 的钓鱼域名。用户在地址栏、页面链接中肉眼无法区分，导致钓鱼攻击成功率极高。

2. **TLD 确认弹窗**：对于不含西里尔字母的普通链接，弹窗显示目标顶级域名（TLD），让用户确认后再跳转。这提供了额外的安全层，防止用户误点恶意链接。

---

## 需求总结

| 项目 | 决策 |
|------|------|
| 检测范围 | 整个 URL（域名 + 路径 + 查询参数） |
| 检测字符 | 西里尔字母 U+0400–U+052F，扩展区 U+2DE0–U+2DFF、U+A640–U+A69F |
| 西里尔拦截方式 | `alert()` 弹窗警告，阻止跳转 |
| 普通链接拦截方式 | `confirm()` 弹窗显示 TLD，用户确认后跳转 |
| 检测时机 | 用户左键点击链接时（事件捕获阶段） |
| 是否可配置 | 不可配置，安全策略强制执行 |

---

## 功能边界

### 做什么

- 检测 URL 中的西里尔字母（Cyrillic、Cyrillic Supplement、Cyrillic Extended-A/B）
- 拦截含西里尔字母的链接，`alert()` 警告并阻止跳转
- 对不含西里尔字母的链接，`confirm()` 显示顶级域名（TLD），用户确认后跳转
- 同时检测域名、路径和查询参数
- 使用 `getAttribute("href")` 获取原始 Unicode 值，防止浏览器 punycode 编码绕过

### 不做什么

- 不检测其他可混淆字符（希腊字母、亚美尼亚字母等）
- 不拦截右键菜单"在新标签页打开"（浏览器限制）
- 不拦截 Ctrl/Cmd/Shift + 点击（交给浏览器处理新标签/窗口）
- 不拦截 `javascript:`、`mailto:`、`tel:` 等非 HTTP 协议

---

## 核心设计

### 数据结构

```js
// 正则表达式：匹配西里尔字母 Unicode 范围
const CYRILLIC_RE = /[Ѐ-ӿԀ-ԯⷠ-ⷿꙀ-ꚟ]/;
```

| 范围 | Unicode 区块 | 码点范围 |
|------|-------------|---------|
| `Ѐ-ӿ` | Cyrillic | U+0400–U+04FF |
| `Ԁ-ԯ` | Cyrillic Supplement | U+0500–U+052F |
| `ⷠ-ⷿ` | Cyrillic Extended-A | U+2DE0–U+2DFF |
| `Ꙁ-ꚟ` | Cyrillic Extended-B | U+A640–U+A69F |

### 存储结构

无存储需求，纯实时检测。

### 状态流转

```
用户点击链接
    │
    ▼
前置过滤（左键？有 <a> 标签？HTTP 协议？）
    │
    ▼
preventDefault() 同步阻止默认行为
    │
    ▼
getAttribute("href") 获取原始 URL
    │
    ▼
CYRILLIC_RE.test(rawHref)
    │
    ├─ 命中西里尔字母
    │       │
    │       ▼
    │   alert("⚠️ URL 中包含西里尔字母，已阻止跳转。\n\n" + url)
    │       │
    │       ▼
    │   return（留在当前页）
    │
    └─ 未命中（普通链接）
            │
            ▼
        读取白名单 chrome.storage.local
            │
            ├─ hostname 在白名单中 → 直接跳转
            │
            └─ hostname 不在白名单中
                    │
                    ▼
                提取顶级域名 TLD
                    │
                    ▼
                confirm("即将跳转至顶级域名：" + tld + "\n\n是否继续？")
                    │
                    ├─ 确认 → saveVisitedHostname(hostname) → 跳转
                    │
                    └─ 取消 → return（留在当前页）
```

### API / 消息流

无外部 API 调用，纯前端 DOM 事件处理。

---

## 边界条件

- **punycode 绕过**：浏览器的 `element.href` 属性会自动将 IDN 转为 punycode，必须使用 `getAttribute("href")` 获取原始值
- **子元素点击**：`e.target` 可能指向 `<a>` 内部的 `<span>` 或 `<img>`，需向上遍历找到 `<a>` 祖先
- **相对 URL**：使用 `new URL(rawHref, document.baseURI)` 解析相对路径
- **事件时序**：`preventDefault()` 必须在异步操作前同步调用，否则浏览器已开始导航
- **动态内容**：使用事件委托（`document` 上监听），自动覆盖 SPA 动态生成的链接
- **TLD 提取**：从 hostname 中提取最后一段作为顶级域名（如 `www.example.com` → `.com`）
- **白名单交互**：TLD 确认流程依赖白名单功能，已记录的 hostname 跳过 confirm 弹窗

---

## 实现计划

1. 定义西里尔字母正则 `CYRILLIC_RE`
2. 实现 `findAnchor()` 向上遍历查找 `<a>` 标签
3. 在 `document` 上以捕获阶段监听 `click` 事件
4. 前置过滤：左键、无修饰键、有 `<a>` 标签、HTTP 协议
5. 同步调用 `preventDefault()` 阻止默认行为
6. 使用 `getAttribute("href")` 获取原始 URL
7. 正则检测西里尔字母，命中则 `alert()` 警告并 return
8. 未命中则读取白名单，检查 hostname 是否已记录
9. 已记录则直接跳转，未记录则 `confirm()` 显示 TLD 让用户确认
10. 用户确认后记录 hostname 到白名单，然后跳转

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `content.js` | 新增：西里尔字母检测逻辑、点击事件拦截 |
| `manifest.json` | 新增：content_scripts 配置、权限声明 |

---

## 风险与注意事项

- **浏览器 punycode 转换**：必须用 `getAttribute("href")` 而非 `element.href`
- **事件捕获阶段**：必须在捕获阶段（`true`）监听，确保在网页 handler 之前拦截
- **右键菜单无法拦截**：浏览器安全模型限制，MV3 不支持 blocking webRequest
- **仅覆盖西里尔字母**：希腊字母等其他可混淆字符未检测，后续可扩展

---

## 最终确认记录

### 用户确认

初始功能，无需额外确认。

### 最终决策

- 使用 `getAttribute("href")` 获取原始值，防止 punycode 绕过
- 使用事件委托 + 捕获阶段，覆盖动态内容
- 西里尔检测不可被用户配置覆盖，安全优先

### 后续可扩展项

- 扩展检测范围：希腊字母、亚美尼亚字母
- 自定义检测字符集（用户配置）
- 检测历史记录统计
