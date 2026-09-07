/**
 * YouTube Chatbot - Content Script
 * Injects persistent, freely draggable, floating window with curvy edges.
 * Handles synchronized video seeking, window lifecycle, and position persistence.
 */

// Clean up any stale window element or badge from prior extension reloads
try {
  const staleWin = document.getElementById("yt-chatbot-window");
  if (staleWin) staleWin.remove();
  const staleBadge = document.getElementById("yt-chatbot-badge");
  if (staleBadge) staleBadge.remove();
} catch (_) {}

let isWindowOpen = false;
let windowElement = null;
let dragOverlay = null;

const DEFAULT_WIDTH = 410;
const DEFAULT_HEIGHT = 630;
const MIN_WIDTH = 340;
const MIN_HEIGHT = 450;

function getCurrentVideoInfo() {
  try {
    const url = new URL(window.location.href);
    let videoId = null;
    if (url.hostname.includes("youtube.com") && url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else if (url.hostname.includes("youtube.com") && url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.split("/")[2];
    } else if (url.hostname.includes("youtu.be")) {
      videoId = url.pathname.substring(1);
    }

    let title = "";
    const titleEl = document.querySelector(
      "h1.ytd-watch-metadata yt-formatted-string, #title h1 yt-formatted-string, ytd-watch-metadata #title, h1.title.style-scope.ytd-video-primary-info-renderer"
    );
    if (titleEl && titleEl.textContent && titleEl.textContent.trim()) {
      title = titleEl.textContent.trim();
    } else {
      title = document.title ? document.title.replace(" - YouTube", "").trim() : "";
    }

    return { videoId, title, url: window.location.href };
  } catch (_) {
    return { videoId: null, title: "", url: "" };
  }
}

// Listen for messages from popup or background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;
  if (message.action === "seekVideo") {
    seekPlayer(message.seconds);
    sendResponse({ status: "success" });
  } else if (message.action === "toggleSidebar" || message.action === "toggleWindow" || message.action === "openWindow") {
    if (message.action === "openWindow") {
      openWindow();
    } else {
      toggleWindow();
    }
    sendResponse({ status: "success", isOpen: isWindowOpen });
  }
  return true;
});

// Listen for messages from the embedded iframe (popup.html)
window.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "YT_CHATBOT_SEEK") {
    seekPlayer(event.data.seconds);
  } else if (event.data.type === "YT_CHATBOT_CLOSE_SIDEBAR" || event.data.type === "YT_CHATBOT_CLOSE_WINDOW") {
    closeWindow();
  }
});

function seekPlayer(seconds) {
  const video = document.querySelector("video");
  if (video && !isNaN(seconds)) {
    video.currentTime = seconds;
    video.play();
  }
}

// Get saved bounds from localStorage or calculate default
function getInitialBounds() {
  const maxW = Math.max(MIN_WIDTH, window.innerWidth - 24);
  const maxH = Math.max(MIN_HEIGHT, window.innerHeight - 24);

  let width = DEFAULT_WIDTH;
  let height = DEFAULT_HEIGHT;
  let left = Math.max(16, window.innerWidth - DEFAULT_WIDTH - 28);
  let top = 64;

  try {
    const saved = localStorage.getItem("yt_chatbot_win_bounds") || localStorage.getItem("yt_chatbot_win_pos");
    if (saved) {
      const pos = JSON.parse(saved);
      if (typeof pos.width === "number" && !isNaN(pos.width)) {
        width = Math.min(Math.max(MIN_WIDTH, Math.round(pos.width)), maxW);
      }
      if (typeof pos.height === "number" && !isNaN(pos.height)) {
        height = Math.min(Math.max(MIN_HEIGHT, Math.round(pos.height)), maxH);
      }
      const maxLeft = Math.max(10, window.innerWidth - width - 10);
      const maxTop = Math.max(10, window.innerHeight - height - 10);
      if (typeof pos.left === "number" && !isNaN(pos.left)) {
        left = Math.min(Math.max(10, Math.round(pos.left)), maxLeft);
      } else {
        left = Math.max(16, window.innerWidth - width - 28);
      }
      if (typeof pos.top === "number" && !isNaN(pos.top)) {
        top = Math.min(Math.max(10, Math.round(pos.top)), maxTop);
      }
    }
  } catch (_) {}

  return { left, top, width, height };
}

// Injects stylesheet for 8-directional resize handles and hover visual indicators
function injectResizeStyles() {
  if (document.getElementById("yt-chatbot-resize-styles")) return;
  const style = document.createElement("style");
  style.id = "yt-chatbot-resize-styles";
  style.textContent = `
    .yt-chatbot-resize-handle {
      position: absolute;
      user-select: none;
      touch-action: none;
      box-sizing: border-box;
      z-index: 100;
    }
    .yt-chatbot-resize-n {
      top: 0;
      left: 14px;
      right: 14px;
      height: 7px;
      cursor: ns-resize;
    }
    .yt-chatbot-resize-s {
      bottom: 0;
      left: 14px;
      right: 14px;
      height: 8px;
      cursor: ns-resize;
    }
    .yt-chatbot-resize-w {
      left: 0;
      top: 14px;
      bottom: 14px;
      width: 8px;
      cursor: ew-resize;
    }
    .yt-chatbot-resize-e {
      right: 0;
      top: 14px;
      bottom: 14px;
      width: 8px;
      cursor: ew-resize;
    }
    .yt-chatbot-resize-nw {
      top: 0;
      left: 0;
      width: 14px;
      height: 14px;
      cursor: nwse-resize;
      z-index: 105;
    }
    .yt-chatbot-resize-ne {
      top: 0;
      right: 0;
      width: 14px;
      height: 14px;
      cursor: nesw-resize;
      z-index: 105;
    }
    .yt-chatbot-resize-sw {
      bottom: 0;
      left: 0;
      width: 16px;
      height: 16px;
      cursor: nesw-resize;
      z-index: 105;
    }
    .yt-chatbot-resize-se {
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      z-index: 105;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 3px;
    }
    .yt-chatbot-resize-handle:hover::after {
      content: "";
      position: absolute;
      background: rgba(255, 0, 51, 0.45);
      border-radius: 99px;
      pointer-events: none;
    }
    .yt-chatbot-resize-n:hover::after, .yt-chatbot-resize-s:hover::after {
      left: 25%;
      right: 25%;
      height: 2px;
      top: 50%;
      transform: translateY(-50%);
    }
    .yt-chatbot-resize-w:hover::after, .yt-chatbot-resize-e:hover::after {
      top: 25%;
      bottom: 25%;
      width: 2px;
      left: 50%;
      transform: translateX(-50%);
    }
    .yt-chatbot-tooltip {
      position: fixed;
      z-index: 2147483647;
      pointer-events: none;
      background: rgba(18, 18, 22, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.14);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      color: #f1f2f4;
      padding: 5px 9px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.25;
      letter-spacing: -0.1px;
      white-space: nowrap;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8), 0 0 10px rgba(255, 0, 51, 0.18);
      opacity: 0;
      transform: scale(0.95);
      transition: opacity 0.14s ease, transform 0.14s cubic-bezier(0.4, 0, 0.2, 1);
      display: none;
    }
    .yt-chatbot-tooltip.visible {
      opacity: 1;
      transform: scale(1);
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

// Injects the Curvy, Freely Draggable & 8-Directional Resizable Floating Window
function initFloatingWindow() {
  const existing = document.getElementById("yt-chatbot-window");
  if (existing) {
    windowElement = existing;
    dragOverlay = existing.querySelector("#yt-chatbot-drag-overlay");
    return windowElement;
  }

  if (!document.body) return null;

  const bounds = getInitialBounds();

  windowElement = document.createElement("div");
  windowElement.id = "yt-chatbot-window";
  windowElement.style.cssText = `
    position: fixed;
    top: ${bounds.top}px;
    left: ${bounds.left}px;
    width: ${bounds.width}px;
    height: ${bounds.height}px;
    min-width: ${MIN_WIDTH}px;
    min-height: ${MIN_HEIGHT}px;
    max-height: calc(100vh - 20px);
    max-width: calc(100vw - 20px);
    background: #0f0f0f;
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 0, 51, 0.28);
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    transform: scale(0.96) translateY(10px);
    transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  // Top Drag Handle Bar
  const dragBar = document.createElement("div");
  dragBar.id = "yt-chatbot-drag-bar";
  dragBar.style.cssText = `
    height: 38px;
    min-height: 38px;
    background: linear-gradient(180deg, #18181b 0%, #121214 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    cursor: grab;
    user-select: none;
    border-top-left-radius: 22px;
    border-top-right-radius: 22px;
  `;

  dragBar.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; color: #aaaaaa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11.5px; font-weight: 600;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff0033"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <span style="color: #ffffff; letter-spacing: -0.2px;">YouTube Chatbot</span>
    </div>
    <div class="yt-drag-pill-indicator" data-tooltip="Drag anywhere on this bar to freely move window" style="width: 44px; height: 4px; background: rgba(255, 255, 255, 0.28); border-radius: 99px; cursor: grab; transition: background 0.2s, width 0.2s;"></div>
    <div style="display: flex; align-items: center; gap: 6px;">
      <button id="btnYtChatbotResetPos" data-tooltip="Reset window size and position (or double-click bar)" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); color: #888888; cursor: pointer; padding: 4px 6px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s, border-color 0.15s;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      </button>
      <button id="btnYtChatbotCloseWin" data-tooltip="Close Window & Wipe History" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); color: #aaaaaa; cursor: pointer; padding: 4px 6px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; transition: color 0.15s, background 0.15s, border-color 0.15s;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `;

  // Transparent overlay during dragging/resizing to prevent iframe from swallowing pointer events
  dragOverlay = document.createElement("div");
  dragOverlay.id = "yt-chatbot-drag-overlay";
  dragOverlay.style.cssText = `
    position: absolute;
    inset: 0;
    z-index: 50;
    display: none;
    background: transparent;
  `;

  // Embedded popup iframe with video query params
  const vInfo = getCurrentVideoInfo();
  const qParams = new URLSearchParams();
  if (vInfo.videoId) qParams.set("v", vInfo.videoId);
  if (vInfo.title) qParams.set("title", vInfo.title);
  qParams.set("in_page", "1");

  const iframe = document.createElement("iframe");
  iframe.id = "yt-chatbot-iframe";
  iframe.src = chrome.runtime.getURL(`popup.html?${qParams.toString()}`);
  iframe.style.cssText = `
    width: 100%;
    height: calc(100% - 38px);
    border: none;
    background: #0f0f0f;
    border-bottom-left-radius: 22px;
    border-bottom-right-radius: 22px;
  `;

  windowElement.appendChild(dragBar);
  windowElement.appendChild(dragOverlay);
  windowElement.appendChild(iframe);
  document.body.appendChild(windowElement);

  // Setup Drag Interactions
  setupDraggable(dragBar, windowElement);

  // Setup 8-Directional Resizing
  setupResizable(windowElement);

  // Setup In-Window Custom Theme Tooltips (replaces native OS system tooltips)
  setupWindowTooltips(windowElement);

  // Drag pill hover micro-interaction
  dragBar.addEventListener("mouseenter", () => {
    const pill = dragBar.querySelector(".yt-drag-pill-indicator");
    if (pill) {
      pill.style.background = "rgba(255, 255, 255, 0.6)";
      pill.style.width = "54px";
    }
  });
  dragBar.addEventListener("mouseleave", () => {
    const pill = dragBar.querySelector(".yt-drag-pill-indicator");
    if (pill) {
      pill.style.background = "rgba(255, 255, 255, 0.28)";
      pill.style.width = "44px";
    }
  });

  // Header button events
  const btnReset = dragBar.querySelector("#btnYtChatbotResetPos");
  if (btnReset) {
    btnReset.addEventListener("click", (e) => {
      e.stopPropagation();
      resetWindowPosition();
    });
    btnReset.addEventListener("mouseenter", () => {
      btnReset.style.color = "#ffffff";
      btnReset.style.background = "rgba(255, 255, 255, 0.12)";
      btnReset.style.borderColor = "rgba(255, 255, 255, 0.25)";
    });
    btnReset.addEventListener("mouseleave", () => {
      btnReset.style.color = "#888888";
      btnReset.style.background = "rgba(255, 255, 255, 0.05)";
      btnReset.style.borderColor = "rgba(255, 255, 255, 0.08)";
    });
  }

  const btnClose = dragBar.querySelector("#btnYtChatbotCloseWin");
  if (btnClose) {
    btnClose.addEventListener("click", (e) => {
      e.stopPropagation();
      // Inform iframe to clear history and close
      try {
        iframe.contentWindow.postMessage({ type: "YT_TRIGGER_CLOSE" }, "*");
      } catch (_) {}
      closeWindow();
    });
    btnClose.addEventListener("mouseenter", () => {
      btnClose.style.color = "#ff0033";
      btnClose.style.background = "rgba(255, 0, 51, 0.2)";
      btnClose.style.borderColor = "rgba(255, 0, 51, 0.4)";
    });
    btnClose.addEventListener("mouseleave", () => {
      btnClose.style.color = "#aaaaaa";
      btnClose.style.background = "rgba(255, 255, 255, 0.05)";
      btnClose.style.borderColor = "rgba(255, 255, 255, 0.08)";
    });
  }

  // Double click drag bar to reset position & size
  dragBar.addEventListener("dblclick", () => {
    resetWindowPosition();
  });

  return windowElement;
}

// 8-Directional Resizable functionality (N, S, E, W, NW, NE, SW, SE)
function setupResizable(targetElement) {
  injectResizeStyles();

  const directions = [
    { dir: "n", cursor: "ns-resize" },
    { dir: "s", cursor: "ns-resize" },
    { dir: "w", cursor: "ew-resize" },
    { dir: "e", cursor: "ew-resize" },
    { dir: "nw", cursor: "nwse-resize" },
    { dir: "ne", cursor: "nesw-resize" },
    { dir: "sw", cursor: "nesw-resize" },
    {
      dir: "se",
      cursor: "nwse-resize",
      html: '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="pointer-events: none; opacity: 0.45; transition: opacity 0.15s;"><path d="M8 2L2 8M8 5L5 8M8 8L7 8" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/></svg>',
    },
  ];

  directions.forEach(({ dir, cursor, html }) => {
    const handle = document.createElement("div");
    handle.className = `yt-chatbot-resize-handle yt-chatbot-resize-${dir}`;
    handle.setAttribute("data-tooltip", `Resize window (${dir.toUpperCase()})`);
    if (html) handle.innerHTML = html;

    if (dir === "se") {
      handle.addEventListener("mouseenter", () => {
        const svg = handle.querySelector("svg");
        if (svg) svg.style.opacity = "0.9";
      });
      handle.addEventListener("mouseleave", () => {
        const svg = handle.querySelector("svg");
        if (svg) svg.style.opacity = "0.45";
      });
    }

    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideFloatingTooltip();

      try {
        handle.setPointerCapture(e.pointerId);
      } catch (_) {}

      const rect = targetElement.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = rect.left;
      const startTop = rect.top;
      const startWidth = rect.width;
      const startHeight = rect.height;
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;

      if (dragOverlay) dragOverlay.style.display = "block";
      targetElement.style.transition = "none";
      document.body.style.userSelect = "none";

      function onPointerMove(ev) {
        const deltaX = ev.clientX - startX;
        const deltaY = ev.clientY - startY;

        let newW = startWidth;
        let newH = startHeight;
        let newL = startLeft;
        let newT = startTop;

        // Horizontal resizing
        if (dir.includes("e")) {
          const maxEastW = Math.max(MIN_WIDTH, vpW - startLeft - 10);
          newW = Math.max(MIN_WIDTH, Math.min(startWidth + deltaX, maxEastW));
        } else if (dir.includes("w")) {
          const maxWestW = Math.max(MIN_WIDTH, startLeft + startWidth - 10);
          newW = Math.max(MIN_WIDTH, Math.min(startWidth - deltaX, maxWestW));
          newL = startLeft + (startWidth - newW);
        }

        // Vertical resizing
        if (dir.includes("s")) {
          const maxSouthH = Math.max(MIN_HEIGHT, vpH - startTop - 10);
          newH = Math.max(MIN_HEIGHT, Math.min(startHeight + deltaY, maxSouthH));
        } else if (dir.includes("n")) {
          const maxNorthH = Math.max(MIN_HEIGHT, startTop + startHeight - 10);
          newH = Math.max(MIN_HEIGHT, Math.min(startHeight - deltaY, maxNorthH));
          newT = startTop + (startHeight - newH);
        }

        targetElement.style.width = `${Math.round(newW)}px`;
        targetElement.style.height = `${Math.round(newH)}px`;
        targetElement.style.left = `${Math.round(newL)}px`;
        targetElement.style.top = `${Math.round(newT)}px`;
        targetElement.style.right = "auto";
        targetElement.style.bottom = "auto";
      }

      function onPointerUp(ev) {
        try {
          handle.releasePointerCapture(ev.pointerId || e.pointerId);
        } catch (_) {}

        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);

        if (dragOverlay) dragOverlay.style.display = "none";
        document.body.style.userSelect = "";
        targetElement.style.transition = "opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)";

        const finalRect = targetElement.getBoundingClientRect();
        const bounds = {
          left: Math.round(finalRect.left),
          top: Math.round(finalRect.top),
          width: Math.round(finalRect.width),
          height: Math.round(finalRect.height),
        };
        try {
          localStorage.setItem("yt_chatbot_win_bounds", JSON.stringify(bounds));
          localStorage.setItem("yt_chatbot_win_pos", JSON.stringify(bounds));
        } catch (_) {}
      }

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    });

    targetElement.appendChild(handle);
  });
}

// Draggable functionality
function setupDraggable(dragHandle, targetElement) {
  dragHandle.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button") || e.target.closest(".yt-chatbot-resize-handle")) return;
    e.preventDefault();
    hideFloatingTooltip();

    try {
      dragHandle.setPointerCapture(e.pointerId);
    } catch (_) {}

    const rect = targetElement.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = rect.left;
    const startTop = rect.top;

    dragHandle.style.cursor = "grabbing";
    if (dragOverlay) dragOverlay.style.display = "block";
    targetElement.style.transition = "none";

    function onPointerMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const maxLeft = Math.max(10, window.innerWidth - rect.width - 10);
      const maxTop = Math.max(10, window.innerHeight - rect.height - 10);

      const newLeft = Math.min(Math.max(10, startLeft + deltaX), maxLeft);
      const newTop = Math.min(Math.max(10, startTop + deltaY), maxTop);

      targetElement.style.left = `${Math.round(newLeft)}px`;
      targetElement.style.top = `${Math.round(newTop)}px`;
      targetElement.style.right = "auto";
      targetElement.style.bottom = "auto";
    }

    function onPointerUp(upEvent) {
      try {
        dragHandle.releasePointerCapture(upEvent.pointerId || e.pointerId);
      } catch (_) {}

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      dragHandle.style.cursor = "grab";
      if (dragOverlay) dragOverlay.style.display = "none";
      targetElement.style.transition = "opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)";

      const finalRect = targetElement.getBoundingClientRect();
      const bounds = {
        left: Math.round(finalRect.left),
        top: Math.round(finalRect.top),
        width: Math.round(finalRect.width),
        height: Math.round(finalRect.height),
      };
      try {
        localStorage.setItem("yt_chatbot_win_bounds", JSON.stringify(bounds));
        localStorage.setItem("yt_chatbot_win_pos", JSON.stringify(bounds));
      } catch (_) {}
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  });
}

function resetWindowPosition() {
  if (!windowElement) return;
  const defaultLeft = Math.max(16, window.innerWidth - DEFAULT_WIDTH - 28);
  const defaultTop = 64;

  windowElement.style.width = `${DEFAULT_WIDTH}px`;
  windowElement.style.height = `${DEFAULT_HEIGHT}px`;
  windowElement.style.left = `${defaultLeft}px`;
  windowElement.style.top = `${defaultTop}px`;
  try {
    localStorage.removeItem("yt_chatbot_win_bounds");
    localStorage.removeItem("yt_chatbot_win_pos");
  } catch (_) {}
}

function notifyIframeOfVideoChange() {
  const vInfo = getCurrentVideoInfo();
  const iframe = document.getElementById("yt-chatbot-iframe");
  if (iframe && iframe.contentWindow && vInfo.videoId) {
    try {
      iframe.contentWindow.postMessage({
        type: "YT_VIDEO_CHANGED",
        videoId: vInfo.videoId,
        title: vInfo.title,
        url: vInfo.url,
      }, "*");
    } catch (_) {}
  }
}

// Listen for YouTube SPA navigation changes
window.addEventListener("yt-navigate-finish", () => {
  notifyIframeOfVideoChange();
});
window.addEventListener("popstate", () => {
  notifyIframeOfVideoChange();
});

// Toggle Floating Window Open / Closed
function toggleWindow() {
  initFloatingWindow();
  if (!windowElement) {
    openWindow();
    return;
  }

  const isVisible = windowElement.style.opacity === "1" && windowElement.style.pointerEvents !== "none";
  if (isVisible) {
    closeWindow();
  } else {
    openWindow();
  }
}

function openWindow() {
  initFloatingWindow();
  if (!windowElement) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => openWindow(), { once: true });
    }
    return;
  }

  notifyIframeOfVideoChange();

  // Viewport safety check: ensure window is inside visible bounds
  const rect = windowElement.getBoundingClientRect();
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  if (rect.left < 0 || rect.left > vpW - 80 || rect.top < 0 || rect.top > vpH - 60 || rect.width < MIN_WIDTH || rect.height < MIN_HEIGHT) {
    const defaultBounds = getInitialBounds();
    windowElement.style.width = `${defaultBounds.width}px`;
    windowElement.style.height = `${defaultBounds.height}px`;
    windowElement.style.left = `${defaultBounds.left}px`;
    windowElement.style.top = `${defaultBounds.top}px`;
  }

  windowElement.style.display = "flex";
  windowElement.style.opacity = "1";
  windowElement.style.pointerEvents = "auto";
  windowElement.style.transform = "scale(1) translateY(0)";
  isWindowOpen = true;
}

function closeWindow() {
  if (!windowElement) return;

  hideFloatingTooltip();
  windowElement.style.opacity = "0";
  windowElement.style.pointerEvents = "none";
  windowElement.style.transform = "scale(0.96) translateY(10px)";
  isWindowOpen = false;
}

// ==========================================================================
// Custom Theme Tooltip Controller for In-Page Floating Window
// ==========================================================================
let currentFloatingTooltipTarget = null;
let floatingTooltipHoverTimer = null;
let floatingTooltipEl = null;

function hideFloatingTooltip() {
  if (floatingTooltipHoverTimer) {
    clearTimeout(floatingTooltipHoverTimer);
    floatingTooltipHoverTimer = null;
  }
  currentFloatingTooltipTarget = null;
  if (floatingTooltipEl) {
    floatingTooltipEl.classList.remove("visible");
    floatingTooltipEl.style.display = "none";
  }
}

function showFloatingTooltip(target, text) {
  if (!floatingTooltipEl) {
    floatingTooltipEl = document.getElementById("yt-chatbot-tooltip");
    if (!floatingTooltipEl) {
      floatingTooltipEl = document.createElement("div");
      floatingTooltipEl.id = "yt-chatbot-tooltip";
      floatingTooltipEl.className = "yt-chatbot-tooltip";
      floatingTooltipEl.setAttribute("role", "tooltip");
      document.body.appendChild(floatingTooltipEl);
    }
  }

  floatingTooltipEl.textContent = text;
  floatingTooltipEl.style.display = "block";
  floatingTooltipEl.classList.remove("visible");

  const rect = target.getBoundingClientRect();
  const tipRect = floatingTooltipEl.getBoundingClientRect();

  const gap = 6;
  const padding = 10;

  // Place above or below target depending on available space
  let top = rect.bottom + gap;
  let left = rect.left + (rect.width - tipRect.width) / 2;

  if (top + tipRect.height > window.innerHeight - padding) {
    top = rect.top - tipRect.height - gap;
  }
  if (top < padding) {
    top = rect.bottom + gap;
  }

  // Horizontal viewport clamp
  if (left < padding) left = padding;
  if (left + tipRect.width > window.innerWidth - padding) {
    left = window.innerWidth - tipRect.width - padding;
  }

  floatingTooltipEl.style.top = `${Math.round(top)}px`;
  floatingTooltipEl.style.left = `${Math.round(left)}px`;

  requestAnimationFrame(() => {
    floatingTooltipEl.classList.add("visible");
  });
}

function setupWindowTooltips(container) {
  if (!container) return;

  if (!floatingTooltipEl) {
    floatingTooltipEl = document.getElementById("yt-chatbot-tooltip");
    if (!floatingTooltipEl) {
      floatingTooltipEl = document.createElement("div");
      floatingTooltipEl.id = "yt-chatbot-tooltip";
      floatingTooltipEl.className = "yt-chatbot-tooltip";
      floatingTooltipEl.setAttribute("role", "tooltip");
      document.body.appendChild(floatingTooltipEl);
    }
  }

  // Convert existing titles to data-tooltip to suppress native OS tooltips
  container.querySelectorAll("[title]").forEach((el) => {
    const text = el.getAttribute("title");
    if (text && text.trim()) {
      el.setAttribute("data-tooltip", text.trim());
    }
    el.removeAttribute("title");
  });

  container.addEventListener("mouseover", (e) => {
    const target = e.target.closest("[data-tooltip]");
    if (!target || !container.contains(target)) return;

    const text = target.getAttribute("data-tooltip");
    if (!text || !text.trim()) return;

    if (currentFloatingTooltipTarget === target) return;
    currentFloatingTooltipTarget = target;

    if (floatingTooltipHoverTimer) clearTimeout(floatingTooltipHoverTimer);
    floatingTooltipHoverTimer = setTimeout(() => {
      showFloatingTooltip(target, text.trim());
    }, 120);
  });

  container.addEventListener("mouseout", (e) => {
    const target = e.target.closest("[data-tooltip]");
    if (target && target === currentFloatingTooltipTarget) {
      hideFloatingTooltip();
    }
  });

  container.addEventListener("pointerdown", hideFloatingTooltip);
}

// Clamp floating window if browser viewport shrinks
window.addEventListener("resize", () => {
  if (!windowElement || !isWindowOpen) return;
  const rect = windowElement.getBoundingClientRect();
  const maxW = Math.max(MIN_WIDTH, window.innerWidth - 20);
  const maxH = Math.max(MIN_HEIGHT, window.innerHeight - 20);

  let newW = Math.min(rect.width, maxW);
  let newH = Math.min(rect.height, maxH);
  let newL = Math.min(rect.left, window.innerWidth - newW - 10);
  let newT = Math.min(rect.top, window.innerHeight - newH - 10);

  if (newL < 10) newL = 10;
  if (newT < 10) newT = 10;

  windowElement.style.width = `${Math.round(newW)}px`;
  windowElement.style.height = `${Math.round(newH)}px`;
  windowElement.style.left = `${Math.round(newL)}px`;
  windowElement.style.top = `${Math.round(newT)}px`;
});

// Run setup when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initFloatingWindow();
  });
} else {
  initFloatingWindow();
}
