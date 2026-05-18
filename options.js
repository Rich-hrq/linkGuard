"use strict";

const STORAGE_KEY = "visitedHostnames";
const MAX_COUNT_KEY = "maxVisitedCount";
const DEFAULT_MAX = 500;

const maxCountInput = document.getElementById("maxCount");
const saveMaxBtn = document.getElementById("saveMax");
const statusSpan = document.getElementById("status");
const clearAllBtn = document.getElementById("clearAll");
const hostlistEl = document.getElementById("hostlist");
const countBadge = document.getElementById("countBadge");

function flash(msg) {
  statusSpan.textContent = msg;
  statusSpan.classList.add("show");
  setTimeout(() => statusSpan.classList.remove("show"), 1500);
}

function renderList(hostnames) {
  countBadge.textContent = hostnames.length;
  hostlistEl.innerHTML = "";

  // Show newest first
  const reversed = [...hostnames].reverse();
  for (const host of reversed) {
    const row = document.createElement("div");
    row.className = "host-item";

    const span = document.createElement("span");
    span.textContent = host;

    const delBtn = document.createElement("button");
    delBtn.textContent = "删除";
    delBtn.addEventListener("click", () => deleteOne(host));

    row.appendChild(span);
    row.appendChild(delBtn);
    hostlistEl.appendChild(row);
  }
}

function load() {
  chrome.storage.local.get([STORAGE_KEY, MAX_COUNT_KEY], (result) => {
    const visited = result[STORAGE_KEY] || [];
    const maxCount = result[MAX_COUNT_KEY] || DEFAULT_MAX;
    maxCountInput.value = maxCount;
    renderList(visited);
  });
}

function deleteOne(hostname) {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const visited = result[STORAGE_KEY] || [];
    const updated = visited.filter((h) => h !== hostname);
    chrome.storage.local.set({ [STORAGE_KEY]: updated }, () => renderList(updated));
  });
}

saveMaxBtn.addEventListener("click", () => {
  const val = parseInt(maxCountInput.value, 10);
  if (isNaN(val) || val < 1) {
    flash("请输入有效数字");
    return;
  }
  chrome.storage.local.set({ [MAX_COUNT_KEY]: val }, () => {
    flash("已保存");

    // Trim existing list if new max is smaller
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const visited = result[STORAGE_KEY] || [];
      if (visited.length > val) {
        const trimmed = visited.slice(visited.length - val);
        chrome.storage.local.set({ [STORAGE_KEY]: trimmed }, () => renderList(trimmed));
      }
    });
  });
});

clearAllBtn.addEventListener("click", () => {
  if (!confirm("确定要清空所有已记录的域名吗？")) return;
  chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => {
    renderList([]);
    flash("已清空");
  });
});

load();
