/**
 * YouTube Chatbot 2.0 - Agent Controller (ChatGPT / Gemini Architecture)
 * Full state management, staged hybrid RAG interaction, dynamic UI sync.
 * Multi-chat Session Engine, Collapsible Sidebar, 3-Dots Context Actions (Rename, Share, Pin, Delete),
 * Zero-State Home Landing View, Collapsible Video Drawer, and Timestamp Grounding.
 */

// Application State
let sessions = [];
let activeSessionId = null;
let ytPlayer = null;
let isYtApiReady = false;
let isProcessing = false;
let isWebSearchEnabled = false;
let isVideoDrawerOpen = true;
let isSidebarOpen = false;
let contextMenuSessionId = null;

// DOM Elements - Shell & Sidebar
const agentSidebar = document.getElementById("agentSidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const btnToggleSidebar = document.getElementById("btnToggleSidebar");
const btnCollapseSidebar = document.getElementById("btnCollapseSidebar");
const btnSidebarHamburger = document.getElementById("btnSidebarHamburger");
const btnNewChat = document.getElementById("btnNewChat");
const sessionSearchInput = document.getElementById("sessionSearchInput");
const sessionsList = document.getElementById("sessionsList");
const btnClearAllHistory = document.getElementById("btnClearAllHistory");

const landingHomeView = document.getElementById("landingHomeView");
const activeWorkspaceView = document.getElementById("activeWorkspaceView");
const workspaceSplitLayout = document.getElementById("workspaceSplitLayout");
const workspaceMediaColumn = document.getElementById("workspaceMediaColumn");
const workspaceSplitter = document.getElementById("workspaceSplitter");
const activeSessionHeaderTitle = document.getElementById("activeSessionHeaderTitle");
const btnToggleVideoHub = document.getElementById("btnToggleVideoHub");
const hubStatusDot = document.getElementById("hubStatusDot");
const btnExportChat = document.getElementById("btnExportChat");
const btnClearChat = document.getElementById("btnClearChat");

// DOM Elements - Opening Page (Hero & Features Showcase)
const btnNavHome = document.getElementById("btnNavHome");
const btnHeroStartChat = document.getElementById("btnHeroStartChat");
const btnHeroSample = document.getElementById("btnHeroSample");
const btnHeroIngest = document.getElementById("btnHeroIngest");
const heroUrlInput = document.getElementById("heroUrlInput");
const heroIngestBanner = document.getElementById("heroIngestBanner");
const heroBannerText = document.getElementById("heroBannerText");
const sidebarBrandGroup = document.querySelector(".sidebar-brand-group");

// DOM Elements - Landing View
const landingUrlInput = document.getElementById("landingUrlInput");
const btnLandingClearUrl = document.getElementById("btnLandingClearUrl");
const btnLandingSample = document.getElementById("btnLandingSample");
const btnLandingIngest = document.getElementById("btnLandingIngest");
const landingIngestBanner = document.getElementById("landingIngestBanner");
const landingBannerText = document.getElementById("landingBannerText");

// DOM Elements - Video Drawer
const videoInsightsDrawer = document.getElementById("videoInsightsDrawer");
const btnCloseVideoDrawer = document.getElementById("btnCloseVideoDrawer");
const drawerVideoUrlInput = document.getElementById("drawerVideoUrlInput");
const btnDrawerIngest = document.getElementById("btnDrawerIngest");
const playerPlaceholder = document.getElementById("playerPlaceholder");
const ytPlayerWrap = document.getElementById("ytPlayerWrap");
const videoMetaCard = document.getElementById("videoMetaCard");
const videoTitle = document.getElementById("videoTitle");
const videoAuthor = document.getElementById("videoAuthor");
const videoDuration = document.getElementById("videoDuration");
const videoChunksCount = document.getElementById("videoChunksCount");
const videoWordsCount = document.getElementById("videoWordsCount");
const btnCopyVideoLink = document.getElementById("btnCopyVideoLink");
const tabSegCount = document.getElementById("tabSegCount");
const summaryContent = document.getElementById("summaryContent");
const transcriptSearchInput = document.getElementById("transcriptSearchInput");
const transcriptList = document.getElementById("transcriptList");
const transcriptMatchCount = document.getElementById("transcriptMatchCount");

// DOM Elements - Evaluation HUD
const evalFaithfulness = document.getElementById("evalFaithfulness");
const evalRelevancy = document.getElementById("evalRelevancy");
const evalPrecision = document.getElementById("evalPrecision");
const evalRecall = document.getElementById("evalRecall");
const barFaithfulness = document.getElementById("barFaithfulness");
const barRelevancy = document.getElementById("barRelevancy");
const barPrecision = document.getElementById("barPrecision");
const barRecall = document.getElementById("barRecall");
const badgeFaithfulness = document.getElementById("badgeFaithfulness");
const badgeRelevancy = document.getElementById("badgeRelevancy");
const badgePrecision = document.getElementById("badgePrecision");
const badgeRecall = document.getElementById("badgeRecall");
const evalQualityComposite = document.getElementById("evalQualityComposite");
const evalLatency = document.getElementById("evalLatency");
const btnRunEval = document.getElementById("btnRunEval");

// DOM Elements - Chat Pane
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const btnWebSearchToggle = document.getElementById("btnWebSearchToggle");
const btnSend = document.getElementById("btnSend");
const btnScrollBottom = document.getElementById("btnScrollBottom");
const quickChipsList = document.getElementById("quickChipsList");

// DOM Elements - Context Menu & Toast
const sessionContextMenu = document.getElementById("sessionContextMenu");
const menuItemRename = document.getElementById("menuItemRename");
const menuItemShare = document.getElementById("menuItemShare");
const menuItemPin = document.getElementById("menuItemPin");
const menuPinText = document.getElementById("menuPinText");
const menuItemDelete = document.getElementById("menuItemDelete");
const toastContainer = document.getElementById("toastContainer");

// DOM Elements - In-App Custom Modals
const inAppModalOverlay = document.getElementById("inAppModalOverlay");
const inAppModalCard = document.getElementById("inAppModalCard");
const modalIconBadge = document.getElementById("modalIconBadge");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalInputWrap = document.getElementById("modalInputWrap");
const modalInput = document.getElementById("modalInput");
const btnModalCancel = document.getElementById("btnModalCancel");
const btnModalConfirm = document.getElementById("btnModalConfirm");
const btnModalClose = document.getElementById("btnModalClose");

let activeModalResolver = null;

function showInAppConfirm({
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false,
  icon = "alert-triangle",
}) {
  return new Promise((resolve) => {
    activeModalResolver = resolve;
    if (modalTitle) modalTitle.textContent = title;
    if (modalMessage) {
      modalMessage.textContent = message;
      modalMessage.classList.remove("hidden");
    }
    if (modalInputWrap) modalInputWrap.classList.add("hidden");

    if (btnModalConfirm) {
      btnModalConfirm.textContent = confirmText;
      btnModalConfirm.className = isDanger ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm";
    }
    if (btnModalCancel) {
      btnModalCancel.textContent = cancelText;
      btnModalCancel.classList.remove("hidden");
    }

    if (modalIconBadge) {
      modalIconBadge.className = isDanger ? "modal-icon-badge badge-danger" : "modal-icon-badge badge-primary";
      modalIconBadge.innerHTML = `<i data-lucide="${icon}" class="icon-sm"></i>`;
    }

    if (inAppModalOverlay) inAppModalOverlay.classList.remove("hidden");
    lucide.createIcons();
    if (btnModalConfirm) btnModalConfirm.focus();
  });
}

function showInAppPrompt({
  title = "Rename",
  message = "",
  defaultValue = "",
  placeholder = "Enter new name...",
  confirmText = "Save",
  cancelText = "Cancel",
  icon = "edit-3",
}) {
  return new Promise((resolve) => {
    activeModalResolver = resolve;
    if (modalTitle) modalTitle.textContent = title;
    if (modalMessage) {
      if (message) {
        modalMessage.textContent = message;
        modalMessage.classList.remove("hidden");
      } else {
        modalMessage.classList.add("hidden");
      }
    }

    if (modalInputWrap) modalInputWrap.classList.remove("hidden");
    if (modalInput) {
      modalInput.value = defaultValue;
      modalInput.placeholder = placeholder;
    }

    if (btnModalConfirm) {
      btnModalConfirm.textContent = confirmText;
      btnModalConfirm.className = "btn btn-primary btn-sm";
    }
    if (btnModalCancel) {
      btnModalCancel.textContent = cancelText;
      btnModalCancel.classList.remove("hidden");
    }
    if (modalIconBadge) {
      modalIconBadge.className = "modal-icon-badge badge-primary";
      modalIconBadge.innerHTML = `<i data-lucide="${icon}" class="icon-sm"></i>`;
    }

    if (inAppModalOverlay) inAppModalOverlay.classList.remove("hidden");
    lucide.createIcons();
    setTimeout(() => {
      if (modalInput) {
        modalInput.focus();
        modalInput.select();
      }
    }, 60);
  });
}

function closeInAppModal(result) {
  if (inAppModalOverlay) inAppModalOverlay.classList.add("hidden");
  if (activeModalResolver) {
    const res = activeModalResolver;
    activeModalResolver = null;
    res(result);
  }
}

if (btnModalConfirm) {
  btnModalConfirm.addEventListener("click", () => {
    if (modalInputWrap && !modalInputWrap.classList.contains("hidden")) {
      closeInAppModal(modalInput ? modalInput.value.trim() : "");
    } else {
      closeInAppModal(true);
    }
  });
}

if (btnModalCancel) {
  btnModalCancel.addEventListener("click", () => {
    closeInAppModal(false);
  });
}

if (btnModalClose) {
  btnModalClose.addEventListener("click", () => {
    closeInAppModal(false);
  });
}

if (inAppModalOverlay) {
  inAppModalOverlay.addEventListener("click", (e) => {
    if (e.target === inAppModalOverlay) {
      closeInAppModal(false);
    }
  });
}

if (modalInput) {
  modalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (btnModalConfirm) btnModalConfirm.click();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (btnModalCancel) btnModalCancel.click();
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && inAppModalOverlay && !inAppModalOverlay.classList.contains("hidden")) {
    closeInAppModal(false);
  }
});

// Override window.alert so no native system popups can ever show
window.alert = function (msg) {
  showToast(String(msg || ""), "error");
};

// ==========================================================================
// YouTube IFrame API Ready Callback
// ==========================================================================
window.onYouTubeIframeAPIReady = function () {
  isYtApiReady = true;
  console.log("YouTube IFrame API Ready");
  const activeSession = getActiveSession();
  if (activeSession && activeSession.video_id) {
    loadYouTubePlayer(activeSession.video_id);
  }
};

function loadYouTubePlayer(videoId) {
  if (!videoId) return;
  playerPlaceholder.classList.add("hidden");
  ytPlayerWrap.classList.remove("hidden");

  if (ytPlayer && typeof ytPlayer.loadVideoById === "function") {
    ytPlayer.loadVideoById(videoId);
  } else if (window.YT && window.YT.Player) {
    try {
      ytPlayer = new YT.Player("ytPlayer", {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => console.log("Player ready for video:", videoId),
        },
      });
    } catch (e) {
      console.warn("Error creating YT.Player:", e);
    }
  }
}

function seekVideoToSeconds(seconds) {
  if (ytPlayer && typeof ytPlayer.seekTo === "function") {
    ytPlayer.seekTo(seconds, true);
    ytPlayer.playVideo();

    // If video drawer is collapsed, automatically expand it so user sees the video
    if (!isVideoDrawerOpen) {
      setVideoDrawerState(true);
    }
  }
}

// ==========================================================================
// Session Management Engine (LocalStorage Multi-Chat)
// ==========================================================================
const SESSIONS_STORAGE_KEY = "yt_copilot_agent_sessions_v2";
const ACTIVE_SESSION_KEY = "yt_copilot_active_session_id_v2";
const SETTINGS_STORAGE_KEY = "yt_copilot_agent_settings_v2";

function loadSessionsFromStorage() {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    sessions = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(sessions)) sessions = [];

    const savedActive = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (savedActive && sessions.some((s) => s.id === savedActive)) {
      activeSessionId = savedActive;
    } else if (sessions.length > 0) {
      activeSessionId = sessions[0].id;
    } else {
      activeSessionId = null;
    }
  } catch (e) {
    console.warn("Could not load sessions from localStorage:", e);
    sessions = [];
    activeSessionId = null;
  }
}

function saveSessionsToStorage() {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch (e) {
    console.warn("Could not save sessions to localStorage:", e);
  }
}

function getActiveSession() {
  return sessions.find((s) => s.id === activeSessionId) || null;
}

function createNewChatSession(videoData = null) {
  const sessionId = "chat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const title = videoData && videoData.metadata && videoData.metadata.title 
    ? videoData.metadata.title 
    : "New chat";

  const newSession = {
    id: sessionId,
    title: title,
    video_id: videoData ? videoData.video_id : null,
    url: videoData ? videoData.url : "",
    metadata: videoData ? videoData.metadata : null,
    total_chunks: videoData ? videoData.total_chunks : 0,
    summary: videoData ? videoData.summary : "",
    suggested_questions: videoData ? videoData.suggested_questions : [],
    transcript_segments: [],
    history: [],
    created_at: Date.now(),
    updated_at: Date.now(),
    pinned: false,
  };

  if (videoData) {
    const welcomeMsg = `### Video Successfully Indexed! 🎉\n\n**${videoData.metadata.title}** is ready for QA. Ask any specific question, explore topics, or test understanding.`;
    newSession.history.push({ role: "assistant", content: welcomeMsg });
  }

  sessions.unshift(newSession);
  activeSessionId = sessionId;
  saveSessionsToStorage();
  renderSidebarSessions();
  renderActiveWorkspace();
  setSidebarState(false);
  showToast(videoData ? "New video chat session started!" : "New chat created", "success");
  return newSession;
}

function switchChatSession(sessionId) {
  if (sessionId === activeSessionId) {
    setSidebarState(false);
    return;
  }
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  activeSessionId = sessionId;
  saveSessionsToStorage();
  renderSidebarSessions();
  renderActiveWorkspace();
  setSidebarState(false);
}

function renameChatSession(sessionId, newTitle) {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session || !newTitle || !newTitle.trim()) return;

  session.title = newTitle.trim();
  session.updated_at = Date.now();
  saveSessionsToStorage();
  renderSidebarSessions();
  if (sessionId === activeSessionId) {
    activeSessionHeaderTitle.textContent = session.title;
  }
  showToast("Chat renamed successfully", "success");
}

function deleteChatSession(sessionId) {
  const index = sessions.findIndex((s) => s.id === sessionId);
  if (index === -1) return;

  const deletedSession = sessions[index];
  sessions.splice(index, 1);

  if (activeSessionId === sessionId) {
    if (sessions.length > 0) {
      activeSessionId = sessions[0].id;
    } else {
      saveSessionsToStorage();
      renderSidebarSessions();
      createNewChatSession();
      showToast(`Deleted "${deletedSession.title.substring(0, 24)}..."`, "info");
      return;
    }
  }

  saveSessionsToStorage();
  renderSidebarSessions();
  renderActiveWorkspace();
  showToast(`Deleted "${deletedSession.title.substring(0, 24)}..."`, "info");
}

function togglePinChatSession(sessionId) {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  session.pinned = !session.pinned;
  // Re-sort: pinned first, then by updated_at
  sessions.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updated_at - a.updated_at;
  });

  saveSessionsToStorage();
  renderSidebarSessions();
  showToast(session.pinned ? "Chat pinned to top" : "Chat unpinned", "info");
}

function shareChatSession(sessionId) {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  let md = `# ${session.title}\n`;
  if (session.video_id) {
    md += `**Video:** https://www.youtube.com/watch?v=${session.video_id}\n`;
  }
  md += `**Date:** ${new Date(session.created_at).toLocaleString()}\n\n---\n\n`;

  if (session.history && session.history.length) {
    for (const turn of session.history) {
      const role = turn.role === "user" ? "### 👤 User" : "### 🤖 YouTube Chatbot";
      md += `${role}\n${turn.content}\n\n`;
    }
  } else {
    md += `*No conversation messages recorded.*\n`;
  }

  navigator.clipboard.writeText(md).then(() => {
    showToast("Chat markdown copied to clipboard!", "success");
  }).catch(() => {
    showToast("Could not copy to clipboard", "error");
  });
}

// ==========================================================================
// Sidebar Rendering & Search
// ==========================================================================
function renderSidebarSessions(filterText = "") {
  const query = filterText.toLowerCase().trim();
  const filtered = query
    ? sessions.filter((s) => s.title.toLowerCase().includes(query))
    : sessions;

  if (filtered.length === 0) {
    sessionsList.innerHTML = `
      <div style="padding: 16px 8px; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
        ${query ? "No matching chats found." : "No saved chats yet.<br>Click <strong>+ New Chat</strong> to start!"}
      </div>
    `;
    return;
  }

  sessionsList.innerHTML = filtered
    .map((s) => {
      const isActive = s.id === activeSessionId;
      const isPinned = s.pinned;
      return `
        <div class="session-item ${isActive ? "active" : ""}" data-session-id="${s.id}">
          <div class="session-title-wrap">
            <span class="session-title">
              ${isPinned ? `<i data-lucide="pin" class="session-pinned-icon icon-xs"></i>` : ""}${escapeHtml(s.title)}
            </span>
          </div>
          <button class="btn-session-dots" data-session-id="${s.id}" title="More options">
            <i data-lucide="more-horizontal" class="icon-xs"></i>
          </button>
        </div>
      `;
    })
    .join("");

  // Attach event listeners to session items
  sessionsList.querySelectorAll(".session-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      // Ignore if clicking 3-dots button
      if (e.target.closest(".btn-session-dots")) return;
      const sid = item.getAttribute("data-session-id");
      switchChatSession(sid);
      setSidebarState(false);
    });
  });

  // Attach event listeners to 3-dots buttons
  sessionsList.querySelectorAll(".btn-session-dots").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const sid = btn.getAttribute("data-session-id");
      openSessionContextMenu(sid, btn);
    });
  });

  lucide.createIcons();
}

// 3-Dots Context Menu Portal Handling
function openSessionContextMenu(sessionId, anchorBtn) {
  contextMenuSessionId = sessionId;
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  menuPinText.textContent = session.pinned ? "Unpin from Top" : "Pin to Top";

  const rect = anchorBtn.getBoundingClientRect();
  sessionContextMenu.style.top = `${rect.bottom + 4}px`;
  sessionContextMenu.style.left = `${Math.min(rect.left, window.innerWidth - 180)}px`;
  sessionContextMenu.classList.remove("hidden");
}

function closeSessionContextMenu() {
  sessionContextMenu.classList.add("hidden");
  contextMenuSessionId = null;
}

document.addEventListener("click", (e) => {
  if (!e.target.closest("#sessionContextMenu") && !e.target.closest(".btn-session-dots")) {
    closeSessionContextMenu();
  }
});

// Context Menu Actions
menuItemRename.addEventListener("click", async () => {
  if (!contextMenuSessionId) return;
  const session = sessions.find((s) => s.id === contextMenuSessionId);
  closeSessionContextMenu();
  if (session) {
    const newTitle = await showInAppPrompt({
      title: "Rename Chat",
      defaultValue: session.title,
      placeholder: "Enter new chat title...",
      confirmText: "Save Name",
      cancelText: "Cancel",
      icon: "edit-3",
    });
    if (newTitle && newTitle.trim()) {
      renameChatSession(session.id, newTitle.trim());
    }
  }
});

menuItemShare.addEventListener("click", () => {
  if (!contextMenuSessionId) return;
  shareChatSession(contextMenuSessionId);
  closeSessionContextMenu();
});

menuItemPin.addEventListener("click", () => {
  if (!contextMenuSessionId) return;
  togglePinChatSession(contextMenuSessionId);
  closeSessionContextMenu();
});

menuItemDelete.addEventListener("click", async () => {
  if (!contextMenuSessionId) return;
  const sid = contextMenuSessionId;
  const session = sessions.find((s) => s.id === sid);
  closeSessionContextMenu();
  const sessionTitle = session ? `"${session.title.substring(0, 28)}..."` : "this chat";
  const confirmed = await showInAppConfirm({
    title: "Delete Chat Session",
    message: `Are you sure you want to delete ${sessionTitle}? This cannot be undone.`,
    confirmText: "Delete",
    cancelText: "Cancel",
    isDanger: true,
    icon: "trash-2",
  });
  if (confirmed) {
    deleteChatSession(sid);
  }
});

// ==========================================================================
// Viewport & Workspace Renderer (Classic 2-Column Split Dashboard)
// ==========================================================================
function resetEvaluationHud() {
  if (evalFaithfulness) evalFaithfulness.textContent = "--%";
  if (evalRelevancy) evalRelevancy.textContent = "--%";
  if (evalPrecision) evalPrecision.textContent = "--%";
  if (evalRecall) evalRecall.textContent = "--%";
  if (barFaithfulness) barFaithfulness.style.width = "0%";
  if (barRelevancy) barRelevancy.style.width = "0%";
  if (barPrecision) barPrecision.style.width = "0%";
  if (barRecall) barRecall.style.width = "0%";
  if (evalQualityComposite) evalQualityComposite.textContent = "-- / 100";
  if (evalLatency) evalLatency.textContent = "-- ms";
}

function renderDefaultChips() {
  renderSuggestedChips([
    "What is the core takeaway and executive summary of this video?",
    "Can you explain the main technical topics discussed and cite timestamps?",
    "Generate a 3-question multiple choice quiz on this video with answers.",
    "What was the concluding message or final thoughts from the speaker?"
  ]);
}

function showOpeningPage() {
  activeSessionId = null;
  saveSessionsToStorage();
  if (landingHomeView) landingHomeView.classList.remove("hidden");
  if (activeWorkspaceView) activeWorkspaceView.classList.add("hidden");
  if (btnToggleVideoHub) btnToggleVideoHub.classList.add("hidden");
  if (activeSessionHeaderTitle) activeSessionHeaderTitle.textContent = "YouTube Chatbot";
  if (btnNavHome) btnNavHome.classList.add("active");
  renderSidebarSessions();
  lucide.createIcons();
}

function renderActiveWorkspace() {
  const activeSession = getActiveSession();
  if (!activeSession) {
    showOpeningPage();
    return;
  }

  // Inside a chat: auto-close sidebar so full workspace is visible
  setSidebarState(false);

  // Inside a chat: hide opening page, show 2-column active workspace
  if (landingHomeView) landingHomeView.classList.add("hidden");
  if (activeWorkspaceView) activeWorkspaceView.classList.remove("hidden");
  if (btnToggleVideoHub) btnToggleVideoHub.classList.remove("hidden");
  if (btnNavHome) btnNavHome.classList.remove("active");
  activeSessionHeaderTitle.textContent = activeSession.title || "YouTube Chatbot";

  // Section 1: Ingest URL Input Bar
  if (landingUrlInput) {
    landingUrlInput.value = activeSession.url || (activeSession.video_id ? `https://www.youtube.com/watch?v=${activeSession.video_id}` : "");
    if (btnLandingClearUrl) {
      btnLandingClearUrl.classList.toggle("hidden", !landingUrlInput.value);
    }
  }
  if (landingIngestBanner) {
    landingIngestBanner.classList.add("hidden");
  }

  // Section 2: Video Player & Metadata
  if (activeSession.video_id) {
    playerPlaceholder.classList.add("hidden");
    ytPlayerWrap.classList.remove("hidden");
    loadYouTubePlayer(activeSession.video_id);

    if (activeSession.metadata) {
      videoTitle.textContent = activeSession.metadata.title || "Loaded Video";
      videoAuthor.textContent = activeSession.metadata.author || "Creator";
      videoDuration.textContent = activeSession.metadata.duration_str || "00:00";
      videoChunksCount.textContent = activeSession.total_chunks || 0;
      videoWordsCount.textContent = (activeSession.metadata.total_words || 0).toLocaleString();
      tabSegCount.textContent = (activeSession.metadata.total_segments || 0).toLocaleString();
      videoMetaCard.classList.remove("hidden");
    } else {
      videoMetaCard.classList.add("hidden");
    }

    // Section 3: Tabs (Summary, Transcript, Benchmarks)
    if (activeSession.summary) {
      summaryContent.innerHTML = formatMarkdownWithCitations(activeSession.summary);
      attachTimestampSeekers(summaryContent);
    } else {
      summaryContent.innerHTML = `
        <div class="empty-hint">
          <i data-lucide="file-text" class="hint-icon"></i>
          <p>Executive summary and key takeaways will render here once processed.</p>
        </div>
      `;
    }

    if (activeSession.suggested_questions && activeSession.suggested_questions.length) {
      renderSuggestedChips(activeSession.suggested_questions);
    } else {
      renderDefaultChips();
    }

    fetchAndRenderTranscript(activeSession.video_id);
  } else {
    // Fresh / new chat session with no video loaded yet
    playerPlaceholder.classList.remove("hidden");
    ytPlayerWrap.classList.add("hidden");
    videoMetaCard.classList.add("hidden");

    if (ytPlayer && typeof ytPlayer.stopVideo === "function") {
      try { ytPlayer.stopVideo(); } catch (e) {}
    }

    summaryContent.innerHTML = `
      <div class="empty-hint">
        <i data-lucide="file-text" class="hint-icon"></i>
        <p>Executive summary and key takeaways will render here once a video is loaded.</p>
      </div>
    `;

    transcriptList.innerHTML = `
      <div class="empty-hint">
        <i data-lucide="align-left" class="hint-icon"></i>
        <p>Timestamped transcript will appear once a video is loaded.</p>
      </div>
    `;
    tabSegCount.textContent = "0";
    transcriptMatchCount.textContent = "0 segments";
    resetEvaluationHud();
    renderDefaultChips();
  }

  // Right Column: Interactive Chat Messages
  chatMessages.innerHTML = "";
  if (activeSession.history && activeSession.history.length) {
    let lastMetrics = null;
    let lastLatency = null;

    for (const item of activeSession.history) {
      if (item.role === "user") {
        renderUserMessage(item.content);
      } else if (item.role === "assistant") {
        renderAssistantMessage(item);
        if (item.evaluation_metrics) {
          lastMetrics = item.evaluation_metrics;
          lastLatency = item.latency_ms;
        }
      }
    }

    if (lastMetrics) {
      updateEvaluationMetrics(lastMetrics, lastLatency);
    }
  } else {
    chatMessages.innerHTML = `
      <div class="message assistant">
        <div class="msg-avatar-wrap">
          <div class="msg-avatar assistant-avatar">
            <i data-lucide="bot" class="icon-sm"></i>
          </div>
        </div>
        <div class="msg-content-bubble">
          <p>Ready to assist! Paste a YouTube URL or click <strong>Sample Video</strong> on the left to ground this chat, or ask any question to get started.</p>
        </div>
      </div>
    `;
  }

  lucide.createIcons();
  scrollChatToBottom();
}

// ==========================================================================
// Ingestion Pipeline Handler
// ==========================================================================
async function executeIngestUrl(url, isLanding = true, isHero = false) {
  if (!url || !url.trim()) {
    showToast("Please enter a valid YouTube URL or Video ID.", "error");
    return;
  }

  const cleanUrl = url.trim();
  isProcessing = true;

  if (isLanding && landingIngestBanner) {
    landingIngestBanner.classList.remove("hidden");
    landingBannerText.textContent = "Extracting transcript segments, chunking timestamps & building FAISS index...";
  }

  if (isHero && heroIngestBanner) {
    heroIngestBanner.classList.remove("hidden");
    heroBannerText.textContent = "Extracting transcript segments, chunking timestamps & building FAISS index...";
  }

  try {
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: cleanUrl, force_reindex: false }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to ingest video.");
    }

    const data = await res.json();

    // Check if current active session is an empty/new chat
    const activeSession = getActiveSession();
    if (activeSession && (!activeSession.video_id && (!activeSession.history || activeSession.history.length <= 1))) {
      // Update this active session in-place
      activeSession.video_id = data.video_id;
      activeSession.url = cleanUrl;
      activeSession.title = data.metadata.title;
      activeSession.metadata = data.metadata;
      activeSession.total_chunks = data.total_chunks;
      activeSession.summary = data.summary;
      activeSession.suggested_questions = data.suggested_questions;
      activeSession.updated_at = Date.now();
      const welcomeMsg = `### Video Successfully Indexed! 🎉\n\n**${data.metadata.title}** is ready for QA. Ask any specific question, explore topics, or test understanding.`;
      activeSession.history = [{ role: "assistant", content: welcomeMsg }];
      saveSessionsToStorage();
      renderSidebarSessions();
      renderActiveWorkspace();
      showToast("Video loaded and indexed successfully!", "success");
    } else {
      // Create a brand new session and enter chat
      createNewChatSession({
        video_id: data.video_id,
        url: cleanUrl,
        metadata: data.metadata,
        total_chunks: data.total_chunks,
        summary: data.summary,
        suggested_questions: data.suggested_questions,
      });
    }

    if (isLanding && landingIngestBanner) {
      landingIngestBanner.classList.add("hidden");
    }
    if (isHero && heroIngestBanner) {
      heroIngestBanner.classList.add("hidden");
    }
  } catch (error) {
    console.error("Ingestion error:", error);
    showToast(`Error: ${error.message}`, "error");
    if (isLanding && landingBannerText) {
      landingBannerText.textContent = `Error: ${error.message}`;
    }
    if (isHero && heroBannerText) {
      heroBannerText.textContent = `Error: ${error.message}`;
    }
  } finally {
    isProcessing = false;
    lucide.createIcons();
  }
}

// Opening Page Hero Actions
if (btnHeroStartChat) {
  btnHeroStartChat.addEventListener("click", () => {
    createNewChatSession();
  });
}

if (btnHeroSample) {
  btnHeroSample.addEventListener("click", () => {
    executeIngestUrl("https://www.youtube.com/watch?v=Gfr50f6ZBvo", false, true);
  });
}

if (btnHeroIngest && heroUrlInput) {
  btnHeroIngest.addEventListener("click", () => {
    if (!heroUrlInput.value || !heroUrlInput.value.trim()) {
      showToast("Please enter a valid YouTube URL or Video ID.", "error");
      heroUrlInput.focus();
      return;
    }
    executeIngestUrl(heroUrlInput.value, false, true);
  });

  heroUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnHeroIngest.click();
    }
  });
}

if (btnNavHome) {
  btnNavHome.addEventListener("click", () => {
    showOpeningPage();
  });
}

if (sidebarBrandGroup) {
  sidebarBrandGroup.addEventListener("click", (e) => {
    if (e.target.closest("#btnSidebarHamburger")) return;
    showOpeningPage();
  });
}

// In-Chat Link Input Handlers
if (btnLandingIngest && landingUrlInput) {
  btnLandingIngest.addEventListener("click", () => {
    executeIngestUrl(landingUrlInput.value, true);
  });
}

if (btnLandingSample && landingUrlInput) {
  btnLandingSample.addEventListener("click", () => {
    landingUrlInput.value = "https://www.youtube.com/watch?v=Gfr50f6ZBvo";
    if (btnLandingClearUrl) btnLandingClearUrl.classList.remove("hidden");
    executeIngestUrl(landingUrlInput.value, true);
  });
}

if (landingUrlInput) {
  landingUrlInput.addEventListener("input", () => {
    if (btnLandingClearUrl) btnLandingClearUrl.classList.toggle("hidden", !landingUrlInput.value);
  });

  landingUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeIngestUrl(landingUrlInput.value, true);
    }
  });
}

if (btnLandingClearUrl) {
  btnLandingClearUrl.addEventListener("click", () => {
    landingUrlInput.value = "";
    btnLandingClearUrl.classList.add("hidden");
  });
}

// Drawer Quick Ingest
if (btnDrawerIngest && drawerVideoUrlInput) {
  btnDrawerIngest.addEventListener("click", () => {
    executeIngestUrl(drawerVideoUrlInput.value, false);
  });
}

if (drawerVideoUrlInput) {
  drawerVideoUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeIngestUrl(drawerVideoUrlInput.value, false);
    }
  });
}

// Landing Suggestion Cards Click
document.querySelectorAll(".suggestion-card").forEach((card) => {
  card.addEventListener("click", () => {
    const promptText = card.getAttribute("data-prompt");
    // If no video, auto-load sample video
    if (!landingUrlInput.value) {
      landingUrlInput.value = "https://www.youtube.com/watch?v=Gfr50f6ZBvo";
    }
    executeIngestUrl(landingUrlInput.value, true).then(() => {
      chatInput.value = promptText;
      handleSendMessage();
    });
  });
});

// ==========================================================================
// Chat Q&A Flow
// ==========================================================================
async function handleSendMessage(e) {
  if (e) e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || isProcessing) return;

  const activeSession = getActiveSession();
  if (!activeSession || !activeSession.video_id) {
    showToast("Please load a YouTube video first.", "error");
    return;
  }

  // Append user message to UI and session history
  appendUserMessage(text);
  activeSession.history.push({ role: "user", content: text });
  activeSession.updated_at = Date.now();
  saveSessionsToStorage();

  chatInput.value = "";
  chatInput.style.height = "auto";

  // Create empty assistant placeholder message
  const assistantMsgEl = createAssistantMessageElement();
  chatMessages.appendChild(assistantMsgEl);
  scrollChatToBottom();

  const bubbleEl = assistantMsgEl.querySelector(".msg-content-bubble");
  bubbleEl.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted);">
      <div class="banner-spinner"></div>
      <span>Reasoning with Gemini & Staged Hybrid RAG...</span>
    </div>
  `;

  isProcessing = true;
  const startTime = Date.now();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: activeSession.video_id,
        question: text,
        conversation_history: activeSession.history,
        top_k: 4,
        enable_web_search: isWebSearchEnabled,
        force_web_search: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Query failed");
    }

    const data = await res.json();
    const elapsed = Date.now() - startTime;

    // Render formatted markdown answer with clickable timestamp tags
    let bubbleHtml = "";
    if (data.web_search_used) {
      bubbleHtml += `
        <div class="web-search-badge">
          <i data-lucide="globe" class="icon-xs"></i>
          <span>DuckDuckGo Web Search Verified</span>
        </div>
      `;
    }
    bubbleHtml += formatMarkdownWithCitations(data.answer);
    bubbleEl.innerHTML = bubbleHtml;

    // Action Toolbar
    const toolbarHtml = createMessageToolbarHtml(data.answer);
    bubbleEl.insertAdjacentHTML("beforeend", toolbarHtml);
    attachMessageToolbarActions(bubbleEl, data.answer);

    // Evidence Drawer
    if (data.retrieved_chunks && data.retrieved_chunks.length) {
      const evidenceHtml = createEvidenceDrawerHtml(data.retrieved_chunks);
      bubbleEl.insertAdjacentHTML("beforeend", evidenceHtml);
      attachEvidenceToggle(bubbleEl);
    }

    // Attach timestamp click handlers and web search triggers
    attachTimestampSeekers(bubbleEl);
    attachWebSearchTrigger(bubbleEl);

    // Update session history & storage
    activeSession.history.push({
      role: "assistant",
      content: data.answer,
      web_search_used: data.web_search_used,
      retrieved_chunks: data.retrieved_chunks,
      latency_ms: data.latency_ms || elapsed,
      evaluation_metrics: data.evaluation_metrics,
    });
    activeSession.updated_at = Date.now();
    saveSessionsToStorage();

    // Update evaluation HUD
    updateEvaluationMetrics(data.evaluation_metrics, data.latency_ms || elapsed);
  } catch (error) {
    console.error("Chat query error:", error);
    bubbleEl.innerHTML = `<span style="color: var(--accent-rose);">⚠️ Error: ${error.message}</span>`;
  } finally {
    isProcessing = false;
    scrollChatToBottom();
    lucide.createIcons();
  }
}

// Helpers for Chat UI
function renderUserMessage(text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "message user";
  msgDiv.innerHTML = `
    <div class="msg-avatar-wrap">
      <div class="msg-avatar user-avatar">
        <i data-lucide="user" class="icon-sm"></i>
      </div>
    </div>
    <div class="msg-content-bubble">
      <p>${escapeHtml(text)}</p>
    </div>
  `;
  chatMessages.appendChild(msgDiv);
}

function appendUserMessage(text) {
  renderUserMessage(text);
  scrollChatToBottom();
  lucide.createIcons();
}

function createAssistantMessageElement() {
  const msgDiv = document.createElement("div");
  msgDiv.className = "message assistant";
  msgDiv.innerHTML = `
    <div class="msg-avatar-wrap">
      <div class="msg-avatar assistant-avatar">
        <i data-lucide="bot" class="icon-sm"></i>
      </div>
    </div>
    <div class="msg-content-bubble"></div>
  `;
  return msgDiv;
}

function renderAssistantMessage(item) {
  const msgDiv = createAssistantMessageElement();
  const bubbleEl = msgDiv.querySelector(".msg-content-bubble");

  let bubbleHtml = "";
  if (item.web_search_used) {
    bubbleHtml += `
      <div class="web-search-badge">
        <i data-lucide="globe" class="icon-xs"></i>
        <span>DuckDuckGo Web Search Verified</span>
      </div>
    `;
  }
  bubbleHtml += formatMarkdownWithCitations(item.content);
  bubbleEl.innerHTML = bubbleHtml;

  // Add Action Toolbar
  const toolbarHtml = createMessageToolbarHtml(item.content);
  bubbleEl.insertAdjacentHTML("beforeend", toolbarHtml);
  attachMessageToolbarActions(bubbleEl, item.content);

  // Add Evidence Drawer
  if (item.retrieved_chunks && item.retrieved_chunks.length) {
    const evidenceHtml = createEvidenceDrawerHtml(item.retrieved_chunks);
    bubbleEl.insertAdjacentHTML("beforeend", evidenceHtml);
    attachEvidenceToggle(bubbleEl);
  }

  // Attach handlers
  attachTimestampSeekers(bubbleEl);
  attachWebSearchTrigger(bubbleEl);

  chatMessages.appendChild(msgDiv);
}

function formatMarkdownWithCitations(markdownText) {
  if (!markdownText) return "";

  let html = marked.parse(markdownText);

  // Replace timestamp patterns [MM:SS] or [HH:MM:SS] with clickable badge buttons
  const tsPattern = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
  html = html.replace(tsPattern, (match, ts) => {
    const seconds = parseTsToSeconds(ts);
    return `<button class="ts-pill clickable-ts" data-time="${seconds}" title="Seek video to ${ts}"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> [${ts}]</button>`;
  });

  // Replace [SEARCH_WEB_OPTION:...] with interactive Web Search action card
  const webSearchOptPattern = /\[SEARCH_WEB_OPTION:(.*?)\]/g;
  html = html.replace(webSearchOptPattern, (match, queryText) => {
    const rawQ = queryText.trim();
    return `
      <div class="web-search-offer-card">
        <div class="web-search-offer-header">
          <i data-lucide="globe" class="icon-xs text-red"></i>
          <span>Need external web grounding? You can search live DuckDuckGo for this topic.</span>
        </div>
        <button class="btn-trigger-websearch" data-query="${escapeHtml(rawQ)}">
          <i data-lucide="search" class="icon-xs"></i>
          <span>Search the Web with DuckDuckGo</span>
        </button>
      </div>
    `;
  });

  return html;
}

function attachWebSearchTrigger(parentElement) {
  parentElement.querySelectorAll(".btn-trigger-websearch").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const query = btn.getAttribute("data-query");
      if (!query) return;

      if (!isWebSearchEnabled) {
        showToast("Please turn ON Web Search (toggle next to send button)", "info");
        return;
      }

      await executeWebSearchQuery(query);
    });
  });
}

async function executeWebSearchQuery(query) {
  if (isProcessing) return;
  const activeSession = getActiveSession();
  if (!activeSession) return;

  // Append user message
  appendUserMessage(`🔍 Search Web for: "${query}"`);
  activeSession.history.push({ role: "user", content: `🔍 Search Web for: "${query}"` });
  activeSession.updated_at = Date.now();
  saveSessionsToStorage();

  const assistantMsgEl = createAssistantMessageElement();
  chatMessages.appendChild(assistantMsgEl);
  scrollChatToBottom();

  const bubbleEl = assistantMsgEl.querySelector(".msg-content-bubble");
  bubbleEl.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted);">
      <div class="banner-spinner"></div>
      <span>Searching DuckDuckGo & synthesizing answer with Gemini...</span>
    </div>
  `;

  isProcessing = true;
  const startTime = Date.now();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: activeSession.video_id || "Gfr50f6ZBvo",
        question: query,
        conversation_history: activeSession.history,
        top_k: 4,
        enable_web_search: true,
        force_web_search: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Web search query failed");
    }

    const data = await res.json();
    const elapsed = Date.now() - startTime;

    let bubbleHtml = `
      <div class="web-search-badge">
        <i data-lucide="globe" class="icon-xs"></i>
        <span>DuckDuckGo Web Search Verified</span>
      </div>
    `;
    bubbleHtml += formatMarkdownWithCitations(data.answer);
    bubbleEl.innerHTML = bubbleHtml;

    const toolbarHtml = createMessageToolbarHtml(data.answer);
    bubbleEl.insertAdjacentHTML("beforeend", toolbarHtml);
    attachMessageToolbarActions(bubbleEl, data.answer);

    attachTimestampSeekers(bubbleEl);
    attachWebSearchTrigger(bubbleEl);

    activeSession.history.push({
      role: "assistant",
      content: data.answer,
      web_search_used: true,
      latency_ms: data.latency_ms || elapsed,
      evaluation_metrics: data.evaluation_metrics,
    });
    activeSession.updated_at = Date.now();
    saveSessionsToStorage();

    updateEvaluationMetrics(data.evaluation_metrics, data.latency_ms || elapsed);
  } catch (error) {
    console.error("Web search query error:", error);
    bubbleEl.innerHTML = `<span style="color: var(--accent-rose);">⚠️ Error: ${error.message}</span>`;
  } finally {
    isProcessing = false;
    scrollChatToBottom();
    lucide.createIcons();
  }
}

function attachTimestampSeekers(parentElement) {
  parentElement.querySelectorAll(".clickable-ts").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const seconds = parseFloat(btn.getAttribute("data-time"));
      if (!isNaN(seconds)) {
        seekVideoToSeconds(seconds);
        btn.style.transform = "scale(1.18)";
        btn.style.boxShadow = "0 0 16px rgba(255, 0, 51, 0.9)";
        setTimeout(() => {
          btn.style.transform = "";
          btn.style.boxShadow = "";
        }, 250);
      }
    });
  });
}

function createMessageToolbarHtml(text) {
  return `
    <div class="msg-action-toolbar">
      <button class="btn-msg-action btn-copy-msg" title="Copy answer">
        <i data-lucide="copy" class="icon-xs"></i> <span>Copy</span>
      </button>
      <button class="btn-msg-action btn-tts-msg" title="Read aloud">
        <i data-lucide="volume-2" class="icon-xs"></i> <span>Listen</span>
      </button>
      <button class="btn-msg-action" title="Good response">
        <i data-lucide="thumbs-up" class="icon-xs"></i>
      </button>
    </div>
  `;
}

function attachMessageToolbarActions(bubbleEl, answerText) {
  const copyBtn = bubbleEl.querySelector(".btn-copy-msg");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(answerText);
      copyBtn.innerHTML = `<i data-lucide="check" class="icon-xs"></i> <span>Copied!</span>`;
      copyBtn.classList.add("copied");
      lucide.createIcons();
      setTimeout(() => {
        copyBtn.innerHTML = `<i data-lucide="copy" class="icon-xs"></i> <span>Copy</span>`;
        copyBtn.classList.remove("copied");
        lucide.createIcons();
      }, 2000);
    });
  }

  const ttsBtn = bubbleEl.querySelector(".btn-tts-msg");
  if (ttsBtn && window.speechSynthesis) {
    ttsBtn.addEventListener("click", () => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        ttsBtn.innerHTML = `<i data-lucide="volume-2" class="icon-xs"></i> <span>Listen</span>`;
      } else {
        const cleanText = answerText.replace(/\[\d{1,2}:\d{2}\]/g, "");
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.05;
        utterance.onend = () => {
          ttsBtn.innerHTML = `<i data-lucide="volume-2" class="icon-xs"></i> <span>Listen</span>`;
          lucide.createIcons();
        };
        window.speechSynthesis.speak(utterance);
        ttsBtn.innerHTML = `<i data-lucide="square" class="icon-xs"></i> <span>Stop</span>`;
      }
      lucide.createIcons();
    });
  }
}

function createEvidenceDrawerHtml(chunks) {
  const chunksHtml = chunks
    .map((c, i) => {
      return `
      <div class="evidence-chunk-item">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <strong class="text-cyan">Segment ${i + 1} (${c.timestamp_str})</strong>
          <button class="ts-pill clickable-ts" data-time="${c.start_seconds}" style="padding: 1px 6px; font-size: 0.72rem;">
            Jump ▶
          </button>
        </div>
        <p style="margin: 0; color: #94a3b8; font-size: 0.82em; line-height: 1.45;">${escapeHtml(c.content)}</p>
      </div>`;
    })
    .join("");

  return `
    <div class="evidence-drawer">
      <button class="evidence-header-btn">
        <span><i data-lucide="layers" class="icon-xs text-indigo"></i> Retrieved Evidence Chunks (${chunks.length} Chunks)</span>
        <i data-lucide="chevron-down" class="icon-xs"></i>
      </button>
      <div class="evidence-content-body">
        ${chunksHtml}
      </div>
    </div>
  `;
}

function attachEvidenceToggle(bubbleEl) {
  const toggleBtn = bubbleEl.querySelector(".evidence-header-btn");
  const body = bubbleEl.querySelector(".evidence-content-body");
  if (toggleBtn && body) {
    toggleBtn.addEventListener("click", () => {
      body.classList.toggle("open");
      const icon = toggleBtn.querySelector("[data-lucide='chevron-down'], [data-lucide='chevron-up']");
      if (icon) {
        icon.setAttribute("data-lucide", body.classList.contains("open") ? "chevron-up" : "chevron-down");
        lucide.createIcons();
      }
    });
  }
}

function updateEvaluationMetrics(metrics, latencyMs) {
  if (!metrics) return;

  const fVal = Math.round((metrics.faithfulness || 0) * 100);
  const rVal = Math.round((metrics.answer_relevancy || 0) * 100);
  const pVal = Math.round((metrics.context_precision || 0) * 100);
  const rcVal = Math.round((metrics.context_recall || 0) * 100);
  const qVal = ((metrics.rag_quality_score || 0) * 100).toFixed(1);

  evalFaithfulness.textContent = `${fVal}%`;
  evalRelevancy.textContent = `${rVal}%`;
  evalPrecision.textContent = `${pVal}%`;
  evalRecall.textContent = `${rcVal}%`;
  evalQualityComposite.textContent = `${qVal} / 100`;
  evalLatency.textContent = `${latencyMs || metrics.latency_ms || 0} ms`;

  barFaithfulness.style.width = `${fVal}%`;
  barRelevancy.style.width = `${rVal}%`;
  barPrecision.style.width = `${pVal}%`;
  barRecall.style.width = `${rcVal}%`;

  badgeFaithfulness.textContent = fVal >= 80 ? "Optimal" : fVal >= 50 ? "Good" : "Fair";
  badgeRelevancy.textContent = rVal >= 80 ? "Optimal" : rVal >= 50 ? "Good" : "Fair";
  badgePrecision.textContent = pVal >= 80 ? "Optimal" : pVal >= 50 ? "Good" : "Fair";
  badgeRecall.textContent = rcVal >= 80 ? "Optimal" : rcVal >= 50 ? "Good" : "Fair";
}

function renderSuggestedChips(questions) {
  quickChipsList.innerHTML = questions
    .map(
      (q) => `
    <button class="chip-item" data-query="${escapeHtml(q)}">
      ${escapeHtml(q.length > 40 ? q.substring(0, 38) + "..." : q)}
    </button>
  `
    )
    .join("");

  attachChipListeners();
}

function attachChipListeners() {
  quickChipsList.querySelectorAll(".chip-item").forEach((chip) => {
    chip.addEventListener("click", () => {
      const q = chip.getAttribute("data-query");
      chatInput.value = q;
      handleSendMessage();
    });
  });
}

// Fetch Full Transcript
async function fetchAndRenderTranscript(videoId) {
  try {
    const res = await fetch(`/api/transcript/${videoId}`);
    if (res.ok) {
      const data = await res.json();
      const segments = data.segments || [];
      tabSegCount.textContent = segments.length;
      renderTranscriptList(segments);
    }
  } catch (err) {
    console.warn("Could not load transcript segments:", err);
  }
}

function renderTranscriptList(segments, filterText = "") {
  if (!segments || segments.length === 0) {
    transcriptList.innerHTML = `<div class="empty-hint"><p>No transcript segments available.</p></div>`;
    return;
  }

  const query = filterText.toLowerCase().trim();
  let matchCount = 0;

  const html = segments
    .map((seg) => {
      const text = seg.text || "";
      const isMatch = query && text.toLowerCase().includes(query);
      if (isMatch) matchCount++;

      let displayText = escapeHtml(text);
      if (query && isMatch) {
        const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
        displayText = displayText.replace(regex, `<span class="highlight-match">$1</span>`);
      }

      const startSec = seg.start || 0;
      const tsStr = formatSecondsToTs(startSec);

      return `
        <div class="transcript-row-item" data-time="${startSec}">
          <span class="transcript-row-ts">${tsStr}</span>
          <span class="transcript-row-content">${displayText}</span>
        </div>
      `;
    })
    .join("");

  transcriptList.innerHTML = html;
  transcriptMatchCount.textContent = query ? `${matchCount} matches` : `${segments.length} segments`;

  transcriptList.querySelectorAll(".transcript-row-item").forEach((row) => {
    row.addEventListener("click", () => {
      const seconds = parseFloat(row.getAttribute("data-time"));
      seekVideoToSeconds(seconds);
    });
  });
}

function scrollChatToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
  btnScrollBottom.classList.add("hidden");
}

chatMessages.addEventListener("scroll", () => {
  const distFromBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
  if (distFromBottom > 150) {
    btnScrollBottom.classList.remove("hidden");
  } else {
    btnScrollBottom.classList.add("hidden");
  }
});

btnScrollBottom.addEventListener("click", scrollChatToBottom);

// ==========================================================================
// Sidebar & Drawer Toggle Handlers
// ==========================================================================
function setSidebarState(open) {
  isSidebarOpen = open;
  agentSidebar.classList.toggle("collapsed", !isSidebarOpen);
  if (sidebarBackdrop) {
    sidebarBackdrop.classList.toggle("hidden", !isSidebarOpen);
  }
  try {
    localStorage.setItem("yt_copilot_sidebar_open", isSidebarOpen ? "true" : "false");
  } catch (e) {}
}

btnToggleSidebar.addEventListener("click", (e) => {
  e.stopPropagation();
  setSidebarState(!isSidebarOpen);
});
if (btnCollapseSidebar) {
  btnCollapseSidebar.addEventListener("click", (e) => {
    e.stopPropagation();
    setSidebarState(false);
  });
}
if (btnSidebarHamburger) {
  btnSidebarHamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    setSidebarState(false);
  });
}

// Close sidebar automatically when clicking anywhere except inside the sidebar
document.addEventListener("click", (e) => {
  if (!isSidebarOpen) return;
  // If clicking inside the sidebar, don't close here
  if (e.target.closest("#agentSidebar")) return;
  // If clicking the topbar toggle button, let its own click listener handle it
  if (e.target.closest("#btnToggleSidebar")) return;
  // If clicking inside context menu, don't close here
  if (e.target.closest("#sessionContextMenu")) return;

  setSidebarState(false);
});

// Direct backdrop click listener
if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener("click", () => {
    setSidebarState(false);
  });
}

function setVideoDrawerState(open) {
  isVideoDrawerOpen = open;
  if (workspaceMediaColumn) {
    workspaceMediaColumn.classList.toggle("collapsed", !isVideoDrawerOpen);
  }
  if (workspaceSplitter) {
    workspaceSplitter.classList.toggle("hidden", !isVideoDrawerOpen);
  }
  if (videoInsightsDrawer) {
    videoInsightsDrawer.classList.toggle("hidden", !isVideoDrawerOpen);
  }
  if (btnToggleVideoHub) {
    btnToggleVideoHub.classList.toggle("active", isVideoDrawerOpen);
  }
  if (hubStatusDot) {
    hubStatusDot.classList.toggle("active", isVideoDrawerOpen);
  }
  try {
    localStorage.setItem("yt_copilot_drawer_open", isVideoDrawerOpen ? "true" : "false");
  } catch (e) {}
}

if (btnToggleVideoHub) {
  btnToggleVideoHub.addEventListener("click", () => setVideoDrawerState(!isVideoDrawerOpen));
}
if (btnCloseVideoDrawer) {
  btnCloseVideoDrawer.addEventListener("click", () => setVideoDrawerState(false));
}

// ==========================================================================
// Draggable Workspace Splitter (Gutter Resizer)
// ==========================================================================
let isResizingSplitter = false;

function initWorkspaceSplitter() {
  if (!workspaceSplitter || !workspaceMediaColumn || !workspaceSplitLayout) return;

  // Restore user's saved panel width preference
  try {
    const savedWidth = localStorage.getItem("yt_copilot_media_width");
    if (savedWidth) {
      const parsed = parseFloat(savedWidth);
      if (!isNaN(parsed) && parsed >= 300) {
        workspaceMediaColumn.style.flex = `0 0 ${parsed}px`;
      }
    }
  } catch (e) {}

  workspaceSplitter.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    isResizingSplitter = true;
    workspaceSplitter.setPointerCapture(e.pointerId);
    document.body.classList.add("resizing-horizontal");
    workspaceMediaColumn.style.transition = "none";
  });

  workspaceSplitter.addEventListener("pointermove", (e) => {
    if (!isResizingSplitter) return;
    const layoutRect = workspaceSplitLayout.getBoundingClientRect();
    const newWidth = e.clientX - layoutRect.left;

    const minWidth = 320;
    const maxWidth = Math.max(minWidth, layoutRect.width - 360);
    const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);

    workspaceMediaColumn.style.flex = `0 0 ${clampedWidth}px`;
  });

  const stopSplitterResize = (e) => {
    if (!isResizingSplitter) return;
    isResizingSplitter = false;
    try {
      workspaceSplitter.releasePointerCapture(e.pointerId);
    } catch (err) {}
    document.body.classList.remove("resizing-horizontal");
    workspaceMediaColumn.style.transition = "";

    const finalWidth = workspaceMediaColumn.getBoundingClientRect().width;
    try {
      localStorage.setItem("yt_copilot_media_width", finalWidth.toString());
    } catch (err) {}
  };

  workspaceSplitter.addEventListener("pointerup", stopSplitterResize);
  workspaceSplitter.addEventListener("pointercancel", stopSplitterResize);

  // Double-click to reset back to 50 / 50 split
  workspaceSplitter.addEventListener("dblclick", () => {
    workspaceMediaColumn.style.flex = "0 0 50%";
    try {
      localStorage.removeItem("yt_copilot_media_width");
    } catch (e) {}
    showToast("Layout reset to 50 / 50", "info");
  });
}

// Gemini Sidebar Segmented Switcher & Nav Handlers
const segTabChat = document.getElementById("segTabChat");
const segTabVideoHub = document.getElementById("segTabVideoHub");
const btnOpenSearch = document.getElementById("btnOpenSearch");
const btnCloseSearch = document.getElementById("btnCloseSearch");
const sidebarSearchWrap = document.getElementById("sidebarSearchWrap");
const btnNavVideos = document.getElementById("btnNavVideos");
const btnNavBenchmarks = document.getElementById("btnNavBenchmarks");

if (segTabChat) {
  segTabChat.addEventListener("click", () => {
    segTabChat.classList.add("active");
    if (segTabVideoHub) segTabVideoHub.classList.remove("active");
    // Switch to active chat view or focus
    if (!activeSessionId && sessions.length > 0) {
      switchChatSession(sessions[0].id);
    }
  });
}

if (segTabVideoHub) {
  segTabVideoHub.addEventListener("click", () => {
    segTabVideoHub.classList.add("active");
    if (segTabChat) segTabChat.classList.remove("active");
    // Open Video & Insights Drawer and activate Summary tab
    setVideoDrawerState(true);
    const summaryBtn = document.querySelector(".hub-tab-btn[data-tab='summaryTab']");
    if (summaryBtn) summaryBtn.click();
  });
}

if (btnOpenSearch) {
  btnOpenSearch.addEventListener("click", () => {
    sidebarSearchWrap.classList.remove("hidden");
    sessionSearchInput.focus();
  });
}

if (btnCloseSearch) {
  btnCloseSearch.addEventListener("click", () => {
    sessionSearchInput.value = "";
    sidebarSearchWrap.classList.add("hidden");
    renderSidebarSessions("");
  });
}

if (btnNavVideos) {
  btnNavVideos.addEventListener("click", () => {
    const activeSession = getActiveSession();
    if (activeSession && activeSession.video_id) {
      setVideoDrawerState(true);
      const transcriptBtn = document.querySelector(".hub-tab-btn[data-tab='transcriptTab']");
      if (transcriptBtn) transcriptBtn.click();
      showToast("Opened Video & Transcript Hub", "info");
    } else {
      btnNewChat.click();
      showToast("Paste a YouTube link to load a video", "info");
    }
  });
}

if (btnNavBenchmarks) {
  btnNavBenchmarks.addEventListener("click", () => {
    setVideoDrawerState(true);
    const evalBtn = document.querySelector(".hub-tab-btn[data-tab='evalTab']");
    if (evalBtn) evalBtn.click();
    showToast("Opened RAG Benchmarks HUD", "info");
  });
}

// New Chat Button Handler
btnNewChat.addEventListener("click", () => {
  createNewChatSession();
  setSidebarState(false);
  landingUrlInput.value = "";
  btnLandingClearUrl.classList.add("hidden");
  landingUrlInput.focus();
  if (segTabChat) segTabChat.classList.add("active");
  if (segTabVideoHub) segTabVideoHub.classList.remove("active");
});

// Search Sessions
sessionSearchInput.addEventListener("input", (e) => {
  renderSidebarSessions(e.target.value);
});

// Clear All History
btnClearAllHistory.addEventListener("click", async () => {
  const confirmed = await showInAppConfirm({
    title: "Clear All History",
    message: "Are you sure you want to clear ALL chat history? This cannot be undone.",
    confirmText: "Clear All",
    cancelText: "Cancel",
    isDanger: true,
    icon: "trash-2",
  });
  if (confirmed) {
    sessions = [];
    activeSessionId = null;
    saveSessionsToStorage();
    createNewChatSession();
    showToast("All chat history cleared", "info");
  }
});

// Clear Current Chat
btnClearChat.addEventListener("click", async () => {
  const activeSession = getActiveSession();
  if (!activeSession) return;
  const confirmed = await showInAppConfirm({
    title: "Clear Current Chat",
    message: "Are you sure you want to clear all messages in this conversation?",
    confirmText: "Clear Messages",
    cancelText: "Cancel",
    isDanger: true,
    icon: "trash-2",
  });
  if (confirmed) {
    activeSession.history = [];
    activeSession.updated_at = Date.now();
    saveSessionsToStorage();
    renderActiveWorkspace();
    showToast("Current chat messages cleared", "info");
  }
});

// Export Chat
btnExportChat.addEventListener("click", () => {
  if (activeSessionId) {
    shareChatSession(activeSessionId);
  } else {
    showToast("No active chat to export.", "info");
  }
});

// Copy Video Link
btnCopyVideoLink.addEventListener("click", () => {
  const activeSession = getActiveSession();
  if (activeSession && activeSession.video_id) {
    navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${activeSession.video_id}`);
    showToast("Copied video link to clipboard!", "success");
  }
});

// Toast Helper (Snappy duration for toggles and status messages)
let toastTimer = null;
function showToast(message, type = "info", duration = null) {
  // Snappy display: 1100ms for toggles/info, 2000ms for errors
  if (duration === null) {
    duration = type === "error" ? 2000 : 1100;
  }

  // Clear existing toasts so multiple toggles don't stack or linger
  if (toastContainer) {
    while (toastContainer.firstChild) {
      toastContainer.removeChild(toastContainer.firstChild);
    }
  }

  const toast = document.createElement("div");
  toast.className = `toast-item ${type}`;
  let icon = "info";
  if (type === "success") icon = "check-circle";
  if (type === "error") icon = "alert-triangle";
  if (type === "toggle-active" || type === "toggle-inactive") icon = "globe";

  toast.innerHTML = `<i data-lucide="${icon}" class="icon-xs"></i> <span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);
  lucide.createIcons();

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "all 0.2s ease";
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 200);
  }, duration);
}

// Global Keyboard Shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl+K for New Chat
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    btnNewChat.click();
  }
  // Ctrl+Shift+S for Toggle Sidebar
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    btnToggleSidebar.click();
  }
});

// Input handling
chatForm.addEventListener("submit", handleSendMessage);

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});

chatInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 140) + "px";
});

// Web search toggle
if (btnWebSearchToggle) {
  btnWebSearchToggle.addEventListener("click", () => {
    isWebSearchEnabled = !isWebSearchEnabled;
    btnWebSearchToggle.classList.toggle("active", isWebSearchEnabled);
    btnWebSearchToggle.setAttribute(
      "title",
      isWebSearchEnabled
        ? "Web Search Mode is ON (will search DuckDuckGo if requested)"
        : "Web Search Mode is OFF (click to enable)"
    );
    showToast(
      `Web Search mode: ${isWebSearchEnabled ? "ON" : "OFF"}`,
      isWebSearchEnabled ? "toggle-active" : "toggle-inactive",
      1100
    );
  });
}

// Hub Tab Switching
document.querySelectorAll(".hub-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".hub-tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".hub-pane").forEach((p) => p.classList.remove("active"));

    btn.classList.add("active");
    const targetTabId = btn.getAttribute("data-tab");
    document.getElementById(targetTabId).classList.add("active");
  });
});

transcriptSearchInput.addEventListener("input", (e) => {
  const activeSession = getActiveSession();
  if (activeSession && activeSession.video_id) {
    // If transcript segments already cached
    fetchAndRenderTranscript(activeSession.video_id);
  }
});

btnRunEval.addEventListener("click", async () => {
  const activeSession = getActiveSession();
  if (!activeSession || !activeSession.video_id) {
    showToast("Please load a video first to run benchmarks.", "info");
    return;
  }
  btnRunEval.disabled = true;
  btnRunEval.innerHTML = `<div class="banner-spinner"></div> Running...`;
  try {
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: activeSession.video_id }),
    });
    if (res.ok) {
      const data = await res.json();
      updateEvaluationMetrics(data.summary_metrics, data.summary_metrics.avg_latency_ms);
      showToast(`Benchmark Completed! Overall RAG Quality: ${(data.summary_metrics.composite_rag_quality * 100).toFixed(1)}%`, "success");
    }
  } catch (err) {
    showToast(`Benchmark Error: ${err.message}`, "error");
  } finally {
    btnRunEval.disabled = false;
    btnRunEval.innerHTML = `<i data-lucide="play" class="icon-xs"></i> Run Suite`;
    lucide.createIcons();
  }
});

// Utility String Helpers
function formatSecondsToTs(seconds) {
  const totalSec = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function parseTsToSeconds(tsStr) {
  const parts = tsStr.split(":").map((p) => parseFloat(p));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ==========================================================================
// In-Website Theme-Matched Tooltip System (Replaces Native OS Tooltips)
// ==========================================================================
let tooltipHoverTimer = null;
let currentTooltipTarget = null;

function initGlobalTooltips() {
  const globalTooltip = document.getElementById("appGlobalTooltip");
  if (!globalTooltip) return;

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

  // Intercept dynamically added elements & attribute changes
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            convertTitles(node);
          }
        });
      } else if (m.type === "attributes" && m.attributeName === "title") {
        const target = m.target;
        if (target && target.getAttribute) {
          const text = target.getAttribute("title");
          if (text && text.trim()) {
            target.setAttribute("data-tooltip", text.trim());
            target.removeAttribute("title");
          }
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

  // Event delegation on mouseover and focusin
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
    }, 150); // Fast, snappy 150ms delay
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

  // Instantly hide on interaction
  window.addEventListener("scroll", hideCustomTooltip, { passive: true });
  document.addEventListener("pointerdown", hideCustomTooltip);
}

function showCustomTooltip(target, text) {
  const globalTooltip = document.getElementById("appGlobalTooltip");
  if (!globalTooltip || !document.contains(target)) return;

  // Format any keyboard shortcuts like (Ctrl+K)
  const kbdMatch = text.match(/\((Ctrl\+[A-Za-z0-9+]+|Shift\+[A-Za-z0-9+]+)\)/);
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

  const gap = 8;
  const padding = 12;

  // Default: place below
  let top = rect.bottom + gap;
  let left = rect.left + (rect.width - tipRect.width) / 2;

  // If too close to bottom edge of viewport, place above
  if (top + tipRect.height > window.innerHeight - padding) {
    top = rect.top - tipRect.height - gap;
  }

  // Keep within left/right edges
  if (left < padding) left = padding;
  if (left + tipRect.width > window.innerWidth - padding) {
    left = window.innerWidth - tipRect.width - padding;
  }

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

// ==========================================================================
// App Initialization
// ==========================================================================
let isAppInitialized = false;

function initApp() {
  if (isAppInitialized) return;
  isAppInitialized = true;

  console.log("Initializing YouTube Chatbot Agent...");
  loadSessionsFromStorage();

  // Load saved sidebar & drawer preferences
  try {
    const savedDrawer = localStorage.getItem("yt_copilot_drawer_open");
    if (savedDrawer === "false") {
      setVideoDrawerState(false);
    }
  } catch (e) {}

  // Default sidebar state to closed so the opening page or chat workspace has full view
  setSidebarState(false);

  // Initialize draggable pane resizer
  initWorkspaceSplitter();

  // Initialize in-website theme tooltips (replaces native OS system tooltips)
  initGlobalTooltips();

  renderSidebarSessions();
  showOpeningPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
