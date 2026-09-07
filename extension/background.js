/**
 * YouTube Chatbot - Background Service Worker (Manifest V3)
 * Handles toolbar icon clicks and toggles the in-page floating window on YouTube.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("YouTube Chatbot Extension installed and active.");
});

// Listen for toolbar extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  try {
    let targetTab = tab;

    // Ensure we have a valid tab with URL populated
    if (!targetTab || !targetTab.url || !targetTab.id) {
      if (tab && tab.id) {
        try {
          targetTab = await chrome.tabs.get(tab.id);
        } catch (_) {}
      }
      if (!targetTab || !targetTab.url) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) targetTab = activeTab;
      }
    }

    if (!targetTab || !targetTab.id) return;

    const url = targetTab.url || targetTab.pendingUrl || "";
    const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

    console.log("YouTube Chatbot toolbar icon clicked on:", url);

    if (isYouTube) {
      try {
        const response = await chrome.tabs.sendMessage(targetTab.id, { action: "toggleWindow" });
        if (!response || response.status !== "success") {
          throw new Error("No response from content script");
        }
      } catch (err) {
        // Tab was loaded before extension update or content script is not yet active;
        // Inject content.js dynamically and open window
        try {
          await chrome.scripting.executeScript({
            target: { tabId: targetTab.id },
            files: ["content.js"],
          });
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(targetTab.id, { action: "openWindow" });
            } catch (retryErr) {
              console.warn("Retry openWindow failed:", retryErr);
            }
          }, 150);
        } catch (injectErr) {
          console.warn("Could not inject content script:", injectErr);
        }
      }
    } else {
      // If user is not currently on YouTube, open YouTube
      chrome.tabs.create({ url: "https://www.youtube.com" });
    }
  } catch (err) {
    console.error("Action onClicked handler error:", err);
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === "openYouTube") {
    chrome.tabs.create({ url: "https://www.youtube.com" });
    sendResponse({ status: "ok" });
  }
  return true;
});
