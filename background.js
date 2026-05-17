"use strict";

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "openTab") {
    chrome.tabs.create({ url: message.url });
  }
  return true;
});
