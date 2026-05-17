# DEBUG.md — 调试记录

记录开发与使用过程中的问题、原因与修复方案。

---

## 问题 1：内容脚本加载时机导致部分链接未拦截

**现象**：页面动态生成的链接（如 SPA 路由跳转）未被拦截。

**原因**：`run_at` 设为 `document_end` 时，部分动态内容在脚本注入前已渲染。

**修复**：将 `run_at` 改为 `document_start`，确保尽早注入。由于事件委托绑定在 `document` 上，即使 DOM 未完全加载也能捕获后续事件。

---

## 问题 2：点击 `<a>` 标签内的子元素（如 `<span>`）未触发拦截

**现象**：链接文字包裹在 `<span>` 或 `<img>` 中时，点击未被拦截。

**原因**：`e.target` 指向实际点击的子元素，而非 `<a>` 标签。

**修复**：使用 `findAnchor()` 从 `e.target` 向上遍历 `parentElement`，找到最近的 `<a>` 祖先节点。

---

## 问题 3：confirm() 弹窗期间浏览器已开始导航

**现象**：弹窗出现时页面已经开始跳转。

**原因**：未在事件捕获阶段调用 `preventDefault()`。

**修复**：事件监听器使用捕获阶段（第三个参数 `true`），并在异步操作前同步调用 `e.preventDefault()` 阻止默认行为，待用户确认后再手动设置 `window.location.href`。

---

## 问题 4：西里尔字母检测失效

**现象**：包含西里尔字母的域名（如 `аpple.com`）未被拦截，直接跳转。

**原因**：`anchor.href`（JS 属性）会自动将国际化域名（IDN）转换为 punycode 编码。例如 `аpple.com`（а = U+0430）会被转为 `xn--pple-43d.com`，导致正则无法匹配西里尔字符。

**修复**：改用 `anchor.getAttribute("href")` 获取原始属性值，保留 URL 中的 Unicode 字符，再进行西里尔字母检测。

---

## 问题 5：右键菜单"在新标签页中打开链接"不触发拦截

**现象**：右键点击链接 → "Open link in new tab" 时，扩展未弹出确认框。

**原因**：右键菜单由浏览器原生处理，不触发 DOM `click` 事件，内容脚本无法监听。

**修复**：这是浏览器限制，无法在 Manifest V3 内容脚本中解决。`webRequest` API 在 MV3 中不支持 blocking 模式，无法拦截导航事件。用户需使用左键点击才能触发检测。

---

## 问题 6：特殊协议链接（javascript: / mailto: / tel: / 锚点）点击无反应

**现象**：点击 `javascript:alert('hello')`、`mailto:`、`tel:`、`#anchor` 等链接，浏览器无任何响应。

**原因**：`checkUrl()` 对这些链接返回 `null`，而点击处理器对所有 `null` 结果统一调用了 `e.preventDefault()`，阻止了浏览器的默认行为。

**修复**：重构点击处理器，仅拦截 `http:` / `https:` 协议的链接。对其他协议的链接直接 `return`，不调用 `preventDefault()`，让浏览器原生处理。
