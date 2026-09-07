/**
 * YouTube Chatbot - Chrome Extension Popup Logic
 * Staged Hybrid RAG, Precision Timestamp Citations, Session Storage Persistence & Close Actions.
 */

const API_BASE = "http://127.0.0.1:8000";

let currentTabId = null;
let currentVideoId = null;
let conversationHistory = [];
let renderedMessages = []; // Array of { role: "user" | "assistant", html: string }
let isWebSearchEnabled = false;

const videoStatus = document.getElementById("videoStatus");
const extVideoTitle = document.getElementById("extVideoTitle");
const btnExtIngest = document.getElementById("btnExtIngest");
const extChatContainer = document.getElementById("extChatContainer");
const extChatForm = document.getElementById("extChatForm");
const extChatInput = document.getElementById("extChatInput");
const btnExtSend = document.getElementById("btnExtSend");
const extQuickChips = document.getElementById("extQuickChips");
const btnExtClose = document.getElementById("btnExtClose");
const btnExtDock = document.getElementById("btnExtDock");
const btnExtWebSearchToggle = document.getElementById("btnExtWebSearchToggle");

// Initialize on popup load
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize in-extension theme tooltips (replaces native OS system tooltips)
  initGlobalTooltips();

  // Load saved web search mode preference
  try {
    const saved = await chrome.storage.local.get(["yt_ext_web_search_enabled"]);
    if (saved && saved.yt_ext_web_search_enabled) {
      isWebSearchEnabled = true;
      if (btnExtWebSearchToggle) {
        btnExtWebSearchToggle.classList.add("active");
        btnExtWebSearchToggle.setAttribute("data-tooltip", "Web Search Mode is ON (will search DuckDuckGo if query is not in video)");
        btnExtWebSearchToggle.removeAttribute("title");
      }
    }
  } catch (_) {}

  // Web Search Toggle Click Handler
  if (btnExtWebSearchToggle) {
    btnExtWebSearchToggle.addEventListener("click", async () => {
      isWebSearchEnabled = !isWebSearchEnabled;
      btnExtWebSearchToggle.classList.toggle("active", isWebSearchEnabled);
      btnExtWebSearchToggle.setAttribute(
        "data-tooltip",
        isWebSearchEnabled
          ? "Web Search Mode is ON (will search DuckDuckGo if query is not in video)"
          : "Web Search Mode is OFF (click to enable)"
      );
      btnExtWebSearchToggle.removeAttribute("title");
      try {
        await chrome.storage.local.set({ yt_ext_web_search_enabled: isWebSearchEnabled });
      } catch (_) {}
    });
  }

  if (btnExtDock) {
    if (window.parent && window.parent !== window) {
      btnExtDock.style.display = "none";
    } else {
      btnExtDock.addEventListener("click", async () => {
        if (currentTabId) {
          try {
            await chrome.tabs.sendMessage(currentTabId, { action: "toggleWindow" });
            window.close();
          } catch (err) {
            console.warn("Could not toggle window via message:", err);
            try {
              if (typeof chrome !== "undefined" && chrome.scripting) {
                await chrome.scripting.executeScript({
                  target: { tabId: currentTabId },
                  files: ["content.js"],
                });
                setTimeout(async () => {
                  try {
                    await chrome.tabs.sendMessage(currentTabId, { action: "toggleWindow" });
                  } catch (_) {}
                  window.close();
                }, 200);
              }
            } catch (injectErr) {
              alert("Please refresh the YouTube tab to enable the floating window.");
            }
          }
        } else if (typeof chrome !== "undefined" && chrome.tabs) {
          chrome.tabs.create({ url: "https://www.youtube.com" });
          window.close();
        }
      });
    }
  }

  // 1. Check URL query parameters (passed when running inside in-page floating window)
  const urlParams = new URLSearchParams(window.location.search);
  const paramVideoId = urlParams.get("v");
  const paramTitle = urlParams.get("title");
  const isInPage = urlParams.get("in_page") === "1" || (window.parent && window.parent !== window);

  if (isInPage && btnExtDock) {
    btnExtDock.style.display = "none";
  }

  if (paramVideoId) {
    currentVideoId = paramVideoId;
    videoStatus.textContent = `YouTube Video: ${currentVideoId}`;
    extVideoTitle.textContent = paramTitle || `Video (${currentVideoId})`;
    btnExtIngest.disabled = false;
    await restoreSessionFromStorage();
  } else if (typeof chrome !== "undefined" && chrome.tabs && typeof chrome.tabs.query === "function") {
    // 2. Fallback: Query active tab via chrome.tabs (when opened as Chrome toolbar popup)
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs && tabs[0];
      if (tab && tab.url) {
        currentTabId = tab.id;
        const url = new URL(tab.url);

        if (url.hostname.includes("youtube.com") && url.pathname === "/watch") {
          currentVideoId = url.searchParams.get("v");
        } else if (url.hostname.includes("youtube.com") && url.pathname.startsWith("/shorts/")) {
          currentVideoId = url.pathname.split("/")[2];
        } else if (url.hostname.includes("youtu.be")) {
          currentVideoId = url.pathname.substring(1);
        }

        if (currentVideoId) {
          videoStatus.textContent = `YouTube Video: ${currentVideoId}`;
          extVideoTitle.textContent = tab.title ? tab.title.replace(" - YouTube", "") : `Video (${currentVideoId})`;
          btnExtIngest.disabled = false;
          await restoreSessionFromStorage();
        } else {
          videoStatus.textContent = "Please navigate to a YouTube video.";
          extVideoTitle.textContent = "Not on a YouTube video page";
          btnExtIngest.disabled = true;
        }
      } else {
        videoStatus.textContent = "No active tab detected.";
      }
    } catch (tabErr) {
      console.warn("Could not query active tab:", tabErr);
      videoStatus.textContent = "Please navigate to a YouTube video.";
    }
  } else {
    videoStatus.textContent = "Please navigate to a YouTube video.";
  }
});

// Restore saved session from local extension storage
async function restoreSessionFromStorage() {
  if (!currentVideoId) return;
  const storageKey = `yt_session_${currentVideoId}`;
  try {
    const result = await chrome.storage.local.get([storageKey]);
    const session = result[storageKey];
    if (session && session.is_indexed) {
      // Mark as already indexed
      btnExtIngest.classList.add("indexed-ready");
      btnExtIngest.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg>Indexed & Ready';
      btnExtIngest.disabled = true;

      extChatInput.disabled = false;
      btnExtSend.disabled = false;

      // Restore chat history
      conversationHistory = session.history || [];
      renderedMessages = session.messages || [];

      if (renderedMessages.length > 0) {
        extChatContainer.innerHTML = "";
        renderedMessages.forEach((msg) => {
          const div = document.createElement("div");
          div.className = `message ${msg.role}`;
          div.innerHTML = msg.html;
          attachTimestampClicks(div);
          attachWebSearchClicks(div);
          extChatContainer.appendChild(div);
        });
        extChatContainer.scrollTop = extChatContainer.scrollHeight;
      }
    }
  } catch (err) {
    console.warn("Could not restore session from storage:", err);
  }
}

// Save current session to local extension storage
async function saveSessionToStorage() {
  if (!currentVideoId) return;
  const storageKey = `yt_session_${currentVideoId}`;
  try {
    await chrome.storage.local.set({
      [storageKey]: {
        video_id: currentVideoId,
        title: extVideoTitle.textContent,
        is_indexed: btnExtIngest.classList.contains("indexed-ready"),
        history: conversationHistory,
        messages: renderedMessages,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    console.warn("Could not save session to storage:", err);
  }
}

// Ingest button handler
btnExtIngest.addEventListener("click", async () => {
  if (!currentVideoId) return;

  btnExtIngest.disabled = true;
  btnExtIngest.innerHTML = '<span class="btn-spinner"></span>Analyzing Subtitles & Building Index...';

  try {
    const res = await fetch(`${API_BASE}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentVideoId }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Ingestion failed.");
    }

    const data = await res.json();
    btnExtIngest.classList.add("indexed-ready");
    btnExtIngest.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg>Indexed & Ready';
    
    extChatInput.disabled = false;
    btnExtSend.disabled = false;
    extChatInput.focus();

    // Clear initial placeholder and append summary message
    extChatContainer.innerHTML = "";
    appendAssistantMessage(`**${data.metadata.title}** is indexed and ready.\n\n${data.summary}`);

    // Persist to storage
    await saveSessionToStorage();
  } catch (err) {
    alert(`Error: ${err.message}. Make sure the backend server is running on http://127.0.0.1:8000`);
    btnExtIngest.disabled = false;
    btnExtIngest.classList.remove("indexed-ready");
    btnExtIngest.textContent = "Ingest & Analyze Video";
  }
});

// Chat form handler
extChatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = extChatInput.value.trim();
  if (!q || !currentVideoId) return;

  appendUserMessage(q);
  extChatInput.value = "";

  const assistantDiv = document.createElement("div");
  assistantDiv.className = "message assistant";
  assistantDiv.innerHTML = '<div class="thinking-state"><span class="btn-spinner"></span>Reasoning with Staged Hybrid RAG...</div>';
  extChatContainer.appendChild(assistantDiv);
  extChatContainer.scrollTop = extChatContainer.scrollHeight;

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: currentVideoId,
        question: q,
        conversation_history: conversationHistory,
        enable_web_search: isWebSearchEnabled,
        force_web_search: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Query failed");
    }

    const data = await res.json();
    let formattedHtml = "";
    if (data.web_search_used) {
      formattedHtml += `
        <div class="web-search-badge">
          <svg class="icon-globe" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          <span>DuckDuckGo Web Search Verified</span>
        </div>
      `;
    }
    formattedHtml += formatMarkdownAndCitations(data.answer);
    assistantDiv.innerHTML = formattedHtml;
    attachTimestampClicks(assistantDiv);
    attachWebSearchClicks(assistantDiv);

    conversationHistory.push({ role: "user", content: q });
    conversationHistory.push({ role: "assistant", content: data.answer });

    renderedMessages.push({ role: "assistant", html: formattedHtml });
    await saveSessionToStorage();
  } catch (err) {
    const errHtml = `<span style="color: #ff4d6d;">Error: ${escapeHtml(err.message)}</span>`;
    assistantDiv.innerHTML = errHtml;
    renderedMessages.push({ role: "assistant", html: errHtml });
    await saveSessionToStorage();
  } finally {
    extChatContainer.scrollTop = extChatContainer.scrollHeight;
  }
});

// Close button: Wipes current video history and closes popup / in-page floating window
async function executeCloseAndWipe() {
  if (currentVideoId) {
    const storageKey = `yt_session_${currentVideoId}`;
    try {
      await chrome.storage.local.remove([storageKey]);
    } catch (err) {
      console.warn("Error removing session from storage:", err);
    }
  }

  conversationHistory = [];
  renderedMessages = [];
  extChatContainer.innerHTML = '<div class="message assistant default-welcome"><p>Session closed. History has been wiped.</p></div>';
  btnExtIngest.classList.remove("indexed-ready");
  btnExtIngest.textContent = "Ingest & Analyze Video";
  btnExtIngest.disabled = !currentVideoId;
  extChatInput.disabled = true;
  btnExtSend.disabled = true;

  // Signal parent window to close window if in iframe
  try {
    window.parent.postMessage({ type: "YT_CHATBOT_CLOSE_WINDOW" }, "*");
  } catch (_) {}

  // Close window if opened as a standalone popup
  window.close();
}

if (btnExtClose) {
  btnExtClose.addEventListener("click", executeCloseAndWipe);
}

// Listen for messages from parent window (e.g., outer drag bar close button, SPA navigation)
window.addEventListener("message", async (event) => {
  if (!event.data) return;
  if (event.data.type === "YT_TRIGGER_CLOSE") {
    executeCloseAndWipe();
  } else if (event.data.type === "YT_VIDEO_CHANGED" && event.data.videoId) {
    if (currentVideoId !== event.data.videoId) {
      currentVideoId = event.data.videoId;
      videoStatus.textContent = `YouTube Video: ${currentVideoId}`;
      extVideoTitle.textContent = event.data.title || `Video (${currentVideoId})`;
      btnExtIngest.disabled = false;

      // Reset UI state for newly navigated video
      conversationHistory = [];
      renderedMessages = [];
      extChatContainer.innerHTML = '<div class="message assistant default-welcome"><p>Detected new video. Click <strong>Ingest &amp; Analyze</strong> or ask a question if already indexed.</p></div>';
      btnExtIngest.classList.remove("indexed-ready");
      btnExtIngest.textContent = "Ingest & Analyze Video";
      extChatInput.disabled = true;
      btnExtSend.disabled = true;

      await restoreSessionFromStorage();
    }
  }
});


// Quick chips click
extQuickChips.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    if (!extChatInput.disabled) {
      extChatInput.value = chip.getAttribute("data-q");
      extChatForm.dispatchEvent(new Event("submit"));
    }
  });
});

function appendUserMessage(text) {
  const div = document.createElement("div");
  div.className = "message user";
  div.textContent = text;
  extChatContainer.appendChild(div);
  extChatContainer.scrollTop = extChatContainer.scrollHeight;

  renderedMessages.push({ role: "user", html: escapeHtml(text) });
}

function appendAssistantMessage(text) {
  const div = document.createElement("div");
  div.className = "message assistant";
  const html = formatMarkdownAndCitations(text);
  div.innerHTML = html;
  attachTimestampClicks(div);
  attachWebSearchClicks(div);
  extChatContainer.appendChild(div);
  extChatContainer.scrollTop = extChatContainer.scrollHeight;

  renderedMessages.push({ role: "assistant", html: html });
}

function stripEmojis(str) {
  if (!str) return "";
  return str.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}-\u{2B55}\u{FE00}-\u{FE0F}]/gu, "");
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMarkdownAndCitations(rawText) {
  if (!rawText) return "";

  let text = stripEmojis(rawText);

  // Strip backticks wrapping timestamps e.g. `[00:00]` or `[07:28 - 08:30]` -> [07:28 - 08:30]
  text = text.replace(/`\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?)\]`/g, "[$1]");

  // Replace timestamps with interactive badges (supports MM:SS, HH:MM:SS, and range MM:SS - MM:SS)
  text = text.replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?))?\]/g, (match, startTs, endTs) => {
    const sec = parseTs(startTs);
    const label = endTs ? `${startTs} - ${endTs}` : startTs;
    return `<button class="ts-tag" data-sec="${sec}" data-tooltip="Seek to ${startTs}"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> [${label}]</button>`;
  });

  // Replace [SEARCH_WEB_OPTION:...] with interactive Web Search action card
  text = text.replace(/\[SEARCH_WEB_OPTION:(.*?)\]/g, (match, queryText) => {
    const rawQ = queryText.trim();
    return `
      <div class="web-search-offer-card">
        <div class="web-search-offer-header">
          <svg class="icon-globe" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff4d6d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          <span>Need external web grounding? You can search live DuckDuckGo for this topic.</span>
        </div>
        <button type="button" class="btn-trigger-websearch" data-query="${escapeHtml(rawQ)}" data-tooltip="Search DuckDuckGo web results">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span>Search the Web with DuckDuckGo</span>
        </button>
      </div>
    `;
  });

  // Markdown parsing
  // Bold
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic
  text = text.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, "$1<em>$2</em>$3");
  // Inline code
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Split into paragraphs / lines
  const lines = text.split("\n");
  let inList = false;
  let htmlResult = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (inList) {
        htmlResult += "</ul>";
        inList = false;
      }
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        htmlResult += "<ul>";
        inList = true;
      }
      htmlResult += `<li>${line.substring(2)}</li>`;
    } else {
      if (inList) {
        htmlResult += "</ul>";
        inList = false;
      }
      htmlResult += `<p>${line}</p>`;
    }
  }

  if (inList) {
    htmlResult += "</ul>";
  }

  return htmlResult;
}

function attachTimestampClicks(parent) {
  parent.querySelectorAll(".ts-tag").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const seconds = parseFloat(btn.getAttribute("data-sec"));
      if (!isNaN(seconds)) {
        // If in iframe, message parent directly or use chrome.tabs if available
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "YT_CHATBOT_SEEK", seconds: seconds }, "*");
        } else if (currentTabId) {
          try {
            await chrome.tabs.sendMessage(currentTabId, { action: "seekVideo", seconds: seconds });
          } catch (err) {
            console.warn("Could not send seekVideo message to active tab:", err);
          }
        }
      }
    });
  });
}

function attachWebSearchClicks(parent) {
  parent.querySelectorAll(".btn-trigger-websearch").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const query = btn.getAttribute("data-query");
      if (!query || !currentVideoId) return;

      // Automatically enable Web Search toggle if it was off
      if (!isWebSearchEnabled) {
        isWebSearchEnabled = true;
        if (btnExtWebSearchToggle) {
          btnExtWebSearchToggle.classList.add("active");
          btnExtWebSearchToggle.setAttribute("data-tooltip", "Web Search Mode is ON (will search DuckDuckGo if query is not in video)");
          btnExtWebSearchToggle.removeAttribute("title");
        }
        try {
          await chrome.storage.local.set({ yt_ext_web_search_enabled: true });
        } catch (_) {}
      }

      await executeWebSearch(query);
    });
  });
}

async function executeWebSearch(query) {
  appendUserMessage(`Search Web for: "${query}"`);

  const assistantDiv = document.createElement("div");
  assistantDiv.className = "message assistant";
  assistantDiv.innerHTML = '<div class="thinking-state"><span class="btn-spinner"></span>Searching DuckDuckGo & synthesizing answer with Gemini...</div>';
  extChatContainer.appendChild(assistantDiv);
  extChatContainer.scrollTop = extChatContainer.scrollHeight;

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: currentVideoId,
        question: query,
        conversation_history: conversationHistory,
        enable_web_search: true,
        force_web_search: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Web search failed");
    }

    const data = await res.json();
    let formattedHtml = `
      <div class="web-search-badge">
        <svg class="icon-globe" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span>DuckDuckGo Web Search Verified</span>
      </div>
    `;
    formattedHtml += formatMarkdownAndCitations(data.answer);
    assistantDiv.innerHTML = formattedHtml;
    attachTimestampClicks(assistantDiv);
    attachWebSearchClicks(assistantDiv);

    conversationHistory.push({ role: "user", content: `Search Web for: "${query}"` });
    conversationHistory.push({ role: "assistant", content: data.answer });

    renderedMessages.push({ role: "assistant", html: formattedHtml });
    await saveSessionToStorage();
  } catch (err) {
    const errHtml = `<span style="color: #ff4d6d;">Error: ${escapeHtml(err.message)}</span>`;
    assistantDiv.innerHTML = errHtml;
    renderedMessages.push({ role: "assistant", html: errHtml });
    await saveSessionToStorage();
  } finally {
    extChatContainer.scrollTop = extChatContainer.scrollHeight;
  }
}

function parseTs(ts) {
  const p = ts.split(":").map((v) => parseInt(v, 10));
  if (p.length === 3) {
    return p[0] * 3600 + p[1] * 60 + p[2];
  } else if (p.length === 2) {
    return p[0] * 60 + p[1];
  }
  return 0;
}

// ==========================================================================
// Custom Theme Tooltip Engine (Matching Web App Design System)
// ==========================================================================
let currentTooltipTarget = null;
let tooltipHoverTimer = null;

function initGlobalTooltips() {
  let globalTooltip = document.getElementById("appGlobalTooltip");
  if (!globalTooltip) {
    globalTooltip = document.createElement("div");
    globalTooltip.id = "appGlobalTooltip";
    globalTooltip.className = "app-tooltip";
    globalTooltip.setAttribute("role", "tooltip");
    globalTooltip.setAttribute("aria-hidden", "true");
    document.body.appendChild(globalTooltip);
  }

  function convertTitles(root) {
    if (!root) return;
    if (root.querySelectorAll) {
      root.querySelectorAll("[title]").forEach((el) => {
        const text = el.getAttribute("title");
        if (text && text.trim()) {
          el.setAttribute("data-tooltip", text.trim());
        }
        el.removeAttribute("title");
      });
    }
    if (root.hasAttribute && root.hasAttribute("title")) {
      const text = root.getAttribute("title");
      if (text && text.trim()) {
        root.setAttribute("data-tooltip", text.trim());
      }
      root.removeAttribute("title");
    }
  }

  // Initial conversion of all title attributes
  convertTitles(document);

  // MutationObserver to convert dynamically added elements (like chat messages, timestamp chips)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          convertTitles(node);
        }
      }
      if (mutation.type === "attributes" && mutation.attributeName === "title") {
        const target = mutation.target;
        if (target && target.hasAttribute && target.hasAttribute("title")) {
          const text = target.getAttribute("title");
          if (text && text.trim()) {
            target.setAttribute("data-tooltip", text.trim());
          }
          target.removeAttribute("title");
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["title"],
  });

  function handleTooltipTrigger(e) {
    const target = e.target.closest("[data-tooltip], [title]");
    if (!target) return;

    if (target.hasAttribute("title")) {
      const text = target.getAttribute("title");
      if (text && text.trim()) {
        target.setAttribute("data-tooltip", text.trim());
      }
      target.removeAttribute("title");
    }

    const tipText = target.getAttribute("data-tooltip");
    if (!tipText || !tipText.trim()) return;

    if (currentTooltipTarget === target) return;
    currentTooltipTarget = target;

    if (tooltipHoverTimer) clearTimeout(tooltipHoverTimer);
    tooltipHoverTimer = setTimeout(() => {
      showCustomTooltip(target, tipText);
    }, 120);
  }

  document.addEventListener("mouseover", handleTooltipTrigger);
  document.addEventListener("focusin", handleTooltipTrigger);

  document.addEventListener("mouseout", (e) => {
    const target = e.target.closest("[data-tooltip]");
    if (target && target === currentTooltipTarget) {
      hideCustomTooltip();
    }
  });
  document.addEventListener("focusout", hideCustomTooltip);

  window.addEventListener("scroll", hideCustomTooltip, { passive: true });
  document.addEventListener("pointerdown", hideCustomTooltip);
}

function showCustomTooltip(target, text) {
  const globalTooltip = document.getElementById("appGlobalTooltip");
  if (!globalTooltip || !document.contains(target)) return;

  const kbdMatch = text.match(/\((Ctrl\+[A-Za-z0-9+]+|Shift\+[A-Za-z0-9+]+|Enter)\)/);
  if (kbdMatch) {
    const baseText = text.replace(kbdMatch[0], "").trim();
    const shortcut = kbdMatch[1];
    globalTooltip.innerHTML = `${escapeHtml(baseText)}<span class="tooltip-kbd">${escapeHtml(shortcut)}</span>`;
  } else {
    globalTooltip.textContent = text;
  }

  globalTooltip.style.display = "block";
  globalTooltip.classList.remove("visible");

  const rect = target.getBoundingClientRect();
  const tipRect = globalTooltip.getBoundingClientRect();

  const gap = 6;
  const padding = 8;

  let top = rect.bottom + gap;
  let left = rect.left + (rect.width - tipRect.width) / 2;

  // If clipping bottom, place above
  if (top + tipRect.height > window.innerHeight - padding) {
    top = rect.top - tipRect.height - gap;
  }

  // Horizontal viewport clamp
  if (left < padding) left = padding;
  if (left + tipRect.width > window.innerWidth - padding) {
    left = window.innerWidth - tipRect.width - padding;
  }

  // Vertical viewport clamp
  if (top < padding) top = padding;

  globalTooltip.style.top = `${Math.round(top)}px`;
  globalTooltip.style.left = `${Math.round(left)}px`;

  requestAnimationFrame(() => {
    globalTooltip.classList.add("visible");
  });
}

function hideCustomTooltip() {
  if (tooltipHoverTimer) {
    clearTimeout(tooltipHoverTimer);
    tooltipHoverTimer = null;
  }
  currentTooltipTarget = null;
  const globalTooltip = document.getElementById("appGlobalTooltip");
  if (globalTooltip) {
    globalTooltip.classList.remove("visible");
  }
}

