# 浏览器扩展开发入门教程

本教程面向零基础读者，讲解如何从零开始编写、调试一个基于 Manifest V3 的浏览器扩展。

---

## 1. 什么是浏览器扩展

浏览器扩展（Extension）是一组运行在浏览器中的程序，可以：

- 修改网页内容（注入 CSS/JS）
- 拦截网络请求
- 添加右键菜单、弹窗面板
- 与浏览器 API 交互（标签页、书签、历史记录等）

扩展由 HTML、CSS、JavaScript 编写，通过 `manifest.json` 声明配置。

---

## 2. 最小结构

一个最简单的扩展只需要一个文件：

```
my-extension/
└── manifest.json
```

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "description": "我的第一个扩展"
}
```

- `manifest_version`：固定为 `3`（Manifest V3，当前标准）
- `name`：扩展名称
- `version`：版本号

加载这个空扩展不会报错，但也没有任何功能。

---

## 3. 核心概念

### 3.1 内容脚本（Content Script）

运行在**网页上下文**中的 JavaScript，可以读取和修改页面 DOM。

```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_start"
  }
]
```

- `matches`：匹配哪些页面（`<all_urls>` 表示所有页面）
- `js`：要注入的脚本文件
- `run_at`：注入时机
  - `document_start`：DOM 构建前
  - `document_end`：DOM 构建完成
  - `document_idle`：DOM 完成且空闲时

**限制**：内容脚本运行在独立的沙箱中，不能直接访问页面的 JavaScript 变量，但可以操作 DOM。

### 3.2 后台脚本（Background Script / Service Worker）

运行在**扩展上下文**中，生命周期由浏览器管理。

```json
"background": {
  "service_worker": "background.js"
}
```

- 可以调用所有 `chrome.*` API
- 不能直接访问页面 DOM
- Manifest V3 使用 Service Worker（非持久化，空闲时会被终止）

### 3.3 弹窗页面（Popup）

点击扩展图标时弹出的 HTML 页面。

```json
"action": {
  "default_popup": "popup.html"
}
```

### 3.4 权限（Permissions）

使用浏览器 API 需要声明权限：

```json
"permissions": ["tabs", "storage", "activeTab"]
"host_permissions": ["<all_urls>"]
```

- `permissions`：浏览器功能权限
- `host_permissions`：对哪些网址有访问权限

---

## 4. 常用 API

### 4.1 chrome.tabs

操作浏览器标签页。

```javascript
// 获取当前标签页
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  console.log(tabs[0].url);
});

// 创建新标签页
chrome.tabs.create({ url: "https://example.com" });
```

### 4.2 chrome.storage

持久化存储数据。

```javascript
// 保存
chrome.storage.local.set({ key: "value" });

// 读取
chrome.storage.local.get("key", function(result) {
  console.log(result.key);
});
```

### 4.3 chrome.runtime.sendMessage

内容脚本与后台脚本通信。

**内容脚本发送**：
```javascript
chrome.runtime.sendMessage({ action: "doSomething", data: "hello" });
```

**后台脚本接收**：
```javascript
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === "doSomething") {
    console.log(message.data);
    sendResponse({ status: "ok" });
  }
  return true; // 保持消息通道开启（异步响应时必须）
});
```

---

## 5. 开发流程

### 5.1 创建项目目录

```bash
mkdir my-extension && cd my-extension
```

### 5.2 编写 manifest.json

声明扩展的基本信息和功能配置。

### 5.3 编写功能代码

根据需求编写内容脚本、后台脚本等。

### 5.4 加载扩展

1. 打开 `brave://extensions/`（Chrome 则是 `chrome://extensions/`）
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目目录

### 5.5 调试

- **内容脚本**：在网页中按 F12 打开开发者工具，Console 面板可查看 `content.js` 的日志
- **后台脚本**：在扩展管理页面点击 **背景页**（或 Service Worker 链接）打开独立的开发者工具
- **弹窗页面**：右键扩展图标 → 检查弹出内容

### 5.6 修改后刷新

修改代码后，在扩展管理页面点击刷新按钮（圆形箭头图标），刷新当前打开的网页使内容脚本重新注入。

---

## 6. 调试技巧

### 6.1 console.log

最基本的调试手段。内容脚本的日志出现在网页的开发者工具中。

```javascript
console.log("Content script loaded!");
```

### 6.2 chrome.runtime.sendMessage 调试

在开发者工具 Network 面板中看不到消息，需要在发送端和接收端都加日志。

### 6.3 断点调试

在 Sources 面板中找到对应的 JS 文件，直接打断点。

### 6.4 查看注入的内容脚本

打开开发者工具 → Sources → Content scripts，可以看到所有注入的脚本。

---

## 7. 打包发布

### 7.1 打包

在扩展管理页面点击 **打包扩展程序**，生成 `.crx` 文件和 `.pem` 私钥。

### 7.2 发布到 Chrome Web Store / Brave

1. 注册开发者账号（Chrome Web Store 需一次性 $5 注册费）
2. 上传 `.zip` 包
3. 填写商品信息，提交审核

---

## 8. 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 内容脚本不生效 | `matches` 未匹配目标页面 | 检查 URL 模式 |
| API 调用报错 | 未声明权限 | 在 `permissions` 中添加 |
| 后台脚本被终止 | Service Worker 空闲超时 | 使用 alarms 或事件驱动 |
| 修改代码后无变化 | 未刷新扩展 | 在扩展管理页刷新并重新加载网页 |
| CORS 错误 | 内容脚本跨域请求 | 通过后台脚本发起请求 |
