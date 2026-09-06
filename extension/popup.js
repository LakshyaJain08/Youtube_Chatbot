/**
 * Youtube Chatbot - Chrome Extension Popup Logic
 */

const API_BASE = "http://127.0.0.1:8000";

let currentTabId = null;
let currentVideoId = null;
let conversationHistory = [];

const videoStatus = document.getElementById("videoStatus");
const extVideoTitle = document.getElementById("extVideoTitle");
const btnExtIngest = document.getElementById("btnExtIngest");
const extChatContainer = document.getElementById("extChatContainer");
const extChatForm = document.getElementById("extChatForm");
const extChatInput = document.getElementById("extChatInput");
const btnExtSend = document.getElementById("btnExtSend");
const extQuickChips = document.getElementById("extQuickChips");

// Initialize on popup load
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      videoStatus.textContent = "No active tab detected.";
      return;
    }

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
      extVideoTitle.textContent = tab.title.replace(" - YouTube", "") || `Video (${currentVideoId})`;
      btnExtIngest.disabled = false;
    } else {
      videoStatus.textContent = "Please navigate to a YouTube video.";
      extVideoTitle.textContent = "Not on a YouTube video page";
    }
  } catch (err) {
    console.error("Popup init error:", err);
    videoStatus.textContent = "Error reading active tab.";
  }
});

// Ingest button handler
btnExtIngest.addEventListener("click", async () => {
  if (!currentVideoId) return;

  btnExtIngest.disabled = true;
  btnExtIngest.textContent = "Analyzing Subtitles & Building Index...";

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
    btnExtIngest.textContent = "Indexed & Ready";
    extChatInput.disabled = false;
    btnExtSend.disabled = false;

    // Append summary message
    appendAssistantMessage(`**${data.metadata.title}** is ready!\n\n${data.summary}`);
  } catch (err) {
    alert(`Error: ${err.message}. Make sure the backend server is running on http://127.0.0.1:8000`);
    btnExtIngest.disabled = false;
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
  assistantDiv.textContent = "Thinking...";
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
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Query failed");
    }

    const data = await res.json();
    assistantDiv.innerHTML = formatCitations(data.answer);
    attachTimestampClicks(assistantDiv);

    conversationHistory.push({ role: "user", content: q });
    conversationHistory.push({ role: "assistant", content: data.answer });
  } catch (err) {
    assistantDiv.textContent = `Error: ${err.message}`;
  } finally {
    extChatContainer.scrollTop = extChatContainer.scrollHeight;
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
}

function appendAssistantMessage(text) {
  const div = document.createElement("div");
  div.className = "message assistant";
  div.innerHTML = formatCitations(text);
  attachTimestampClicks(div);
  extChatContainer.appendChild(div);
  extChatContainer.scrollTop = extChatContainer.scrollHeight;
}

function formatCitations(text) {
  return text.replace(/\[(\d{1,2}:\d{2})\]/g, (match, ts) => {
    const sec = parseTs(ts);
    return `<button class="ts-tag" data-sec="${sec}">[${ts}]</button>`;
  });
}

function attachTimestampClicks(parent) {
  parent.querySelectorAll(".ts-tag").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const seconds = parseFloat(btn.getAttribute("data-sec"));
      if (!isNaN(seconds) && currentTabId) {
        await chrome.tabs.sendMessage(currentTabId, { action: "seekVideo", seconds: seconds });
      }
    });
  });
}

function parseTs(ts) {
  const p = ts.split(":");
  return parseInt(p[0]) * 60 + parseInt(p[1]);
}
