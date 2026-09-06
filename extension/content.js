/**
 * Youtube Chatbot - Content Script
 * Listens for video control commands (e.g. seeking timestamps) and injects quick overlay.
 */

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "seekVideo") {
    const video = document.querySelector("video");
    if (video) {
      video.currentTime = message.seconds;
      video.play();
      sendResponse({ status: "success", currentTime: video.currentTime });
    } else {
      sendResponse({ status: "error", error: "No video element found" });
    }
  }
  return true;
});

// Inject Floating Badge on YouTube Video Pages
function injectFloatingCopilotBadge() {
  if (document.getElementById("yt-copilot-badge")) return;

  const badge = document.createElement("div");
  badge.id = "yt-copilot-badge";
  badge.innerHTML = '<svg style="vertical-align: middle; margin-right: 5px; display: inline-block;" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>Chatbot Ready';
  badge.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: white;
    padding: 8px 14px;
    border-radius: 99px;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    z-index: 999999;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    user-select: none;
  `;

  badge.addEventListener("mouseenter", () => {
    badge.style.transform = "scale(1.05)";
    badge.style.boxShadow = "0 6px 22px rgba(99, 102, 241, 0.6)";
  });
  badge.addEventListener("mouseleave", () => {
    badge.style.transform = "scale(1)";
    badge.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.4)";
  });

  badge.addEventListener("click", () => {
    alert("Click the Youtube Chatbot extension icon in your browser toolbar to chat with this video!");
  });

  document.body.appendChild(badge);
}

// Run injection when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectFloatingCopilotBadge);
} else {
  injectFloatingCopilotBadge();
}
