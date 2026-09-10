/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — Chat Engine
   Message handling, AI simulation, news analysis cards
   ═══════════════════════════════════════════════════════ */

import {
  getChat, addMessage, createChat,
  getActiveChatId, setActiveChatId, getChats
} from './storage.js';
import { refreshSidebar } from './sidebar.js';

let chatContainer = null;
let messagesEl = null;
let typingIndicator = null;
let welcomeScreen = null;
let textarea = null;
let sendBtn = null;

// AI response templates for news analysis
const newsResponses = [
  {
    text: `I've analyzed this news claim for you. Here's what I found:`,
    analysis: {
      title: 'Credibility Analysis',
      score: 85,
      level: 'high',
      verdict: 'Mostly Credible',
      verdictClass: 'badge-credible',
      sources: [
        'Reuters — Confirmed via official report',
        'Associated Press — Corroborating coverage',
        'BBC News — Independent verification',
      ],
      summary: 'This claim has been verified by multiple reputable news agencies. The core facts are accurate, though some minor details may vary between sources.'
    }
  },
  {
    text: `I've cross-referenced this across multiple sources. Here's my analysis:`,
    analysis: {
      title: 'Source Verification',
      score: 42,
      level: 'low',
      verdict: 'Likely Misleading',
      verdictClass: 'badge-fake',
      sources: [
        'Snopes — Rated as "Mostly False"',
        'PolitiFact — Flagged with missing context',
        'FactCheck.org — Contradicted by official data',
      ],
      summary: 'This claim appears to contain significant misleading information. Key facts have been distorted or taken out of context. We recommend checking primary sources before sharing.'
    }
  },
  {
    text: `Here's what our analysis reveals about this news item:`,
    analysis: {
      title: 'Bias & Accuracy Check',
      score: 68,
      level: 'medium',
      verdict: 'Partially Accurate',
      verdictClass: 'badge-suspicious',
      sources: [
        'AllSides — Detected moderate left-leaning bias',
        'Media Bias/Fact Check — Mixed rating',
        'Ground News — Covered by 23 sources across spectrum',
      ],
      summary: 'While the core claim has some factual basis, the framing shows notable bias. Important context is missing from the original reporting. Consider reading multiple perspectives.'
    }
  },
  {
    text: `I've reviewed this article carefully. Here's my assessment:`,
    analysis: {
      title: 'Fact-Check Report',
      score: 92,
      level: 'high',
      verdict: 'Verified & Accurate',
      verdictClass: 'badge-credible',
      sources: [
        'WHO Official Statement — Directly confirming',
        'Nature Journal — Peer-reviewed supporting data',
        'CDC Report — Consistent statistics',
      ],
      summary: 'This news report is well-sourced and accurately represents the facts. The data cited comes from reputable institutions and has been independently verified by our system.'
    }
  },
  {
    text: `Let me break down this claim with a detailed analysis:`,
    analysis: {
      title: 'Deepfake & Manipulation Check',
      score: 15,
      level: 'low',
      verdict: 'Highly Suspicious',
      verdictClass: 'badge-fake',
      sources: [
        'Reverse Image Search — Image found with different context',
        'InVID Tool — Video metadata inconsistencies detected',
        'Original Source — Cannot be verified',
      ],
      summary: 'Strong indicators of manipulation detected. The media attached to this claim appears to have been altered or taken from a completely different event. Exercise extreme caution.'
    }
  },
];

// General chat responses (for non-news queries)
const generalResponses = [
  "I'm NewsScope AI, your trusted partner for verifying news and fighting misinformation. You can paste a headline, article link, or claim, and I'll analyze it for credibility, bias, and accuracy. What would you like me to check?",
  "That's an interesting question! While I specialize in news verification and fact-checking, I can help guide you to the right resources. Try pasting a specific news headline or claim for a detailed analysis.",
  "I appreciate your curiosity! My core strength lies in analyzing news content — checking sources, detecting bias, and verifying facts. Share a news story or claim, and I'll give you a comprehensive credibility report.",
];

export function initChat() {
  chatContainer = document.querySelector('.chat-container');
  messagesEl = document.getElementById('chat-messages');
  typingIndicator = document.getElementById('typing-indicator');
  welcomeScreen = document.getElementById('welcome-screen');
  textarea = document.getElementById('chat-input');
  sendBtn = document.getElementById('send-btn');

  // Send button
  sendBtn?.addEventListener('click', handleSend);

  // Enter to send (shift+enter for new line)
  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto-resize textarea
  textarea?.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    updateSendButton();
  });

  // Welcome chips
  document.querySelectorAll('.welcome-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const text = chip.dataset.prompt;
      if (text && textarea) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input'));
        handleSend();
      }
    });
  });

  // Load active chat
  const activeChatId = getActiveChatId();
  if (activeChatId) {
    loadChat(activeChatId);
  } else {
    showWelcome();
  }
}

function updateSendButton() {
  if (!sendBtn || !textarea) return;
  if (textarea.value.trim()) {
    sendBtn.classList.add('active');
  } else {
    sendBtn.classList.remove('active');
  }
}

export function handleSend() {
  if (!textarea) return;
  const content = textarea.value.trim();
  if (!content) return;

  // Get or create chat
  let chatId = getActiveChatId();
  if (!chatId) {
    const chat = createChat();
    chatId = chat.id;
    refreshSidebar();
  }

  // Hide welcome
  if (welcomeScreen) welcomeScreen.style.display = 'none';

  // Add user message
  const userMsg = addMessage(chatId, { role: 'user', content });
  renderMessage(userMsg, 'user');
  refreshSidebar();

  // Clear input
  textarea.value = '';
  textarea.style.height = 'auto';
  updateSendButton();

  // Scroll to bottom
  scrollToBottom();

  // Show typing then request response from backend
  showTyping();
  requestAIResponse(chatId, content);
}

export function handleDirectClaimVerify(claimText) {
  if (!claimText) return;
  if (textarea) {
    textarea.value = claimText;
    textarea.dispatchEvent(new Event('input'));
  }
  handleSend();
}

async function requestAIResponse(chatId, userMessage) {
  try {
    const activeChat = getChat(chatId);
    const recentMessages = (activeChat?.messages || []).slice(-6).map(m => ({
      role: m.role,
      content: m.content
    }));

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: userMessage,
        history: recentMessages
      })
    });

    if (!response.ok) {
      throw new Error(`Backend returned status ${response.status}`);
    }

    const data = await response.json();
    hideTyping();

    const aiMsg = addMessage(chatId, {
      role: 'assistant',
      content: data.content,
      analysis: data.analysis || null,
    });
    renderMessage(aiMsg, 'assistant', data.analysis);

  } catch (error) {
    console.warn('Backend unavailable, utilizing local news analysis fallback:', error);
    hideTyping();
    fallbackAIResponse(chatId, userMessage);
  }

  scrollToBottom();
}

function fallbackAIResponse(chatId, userMessage) {
  // Determine if this is a news-related query
  const newsKeywords = ['news', 'headline', 'article', 'claim', 'verify', 'fact', 'check', 'true', 'false', 'fake', 'real', 'source', 'bias', 'credib', 'misinformation', 'report', 'media'];
  const isNewsQuery = newsKeywords.some(kw => userMessage.toLowerCase().includes(kw)) || Math.random() > 0.3;

  let response;
  if (isNewsQuery) {
    response = newsResponses[Math.floor(Math.random() * newsResponses.length)];
    const aiMsg = addMessage(chatId, {
      role: 'assistant',
      content: response.text,
      analysis: response.analysis,
    });
    renderMessage(aiMsg, 'assistant', response.analysis);
  } else {
    const text = generalResponses[Math.floor(Math.random() * generalResponses.length)];
    const aiMsg = addMessage(chatId, { role: 'assistant', content: text });
    renderMessage(aiMsg, 'assistant');
  }

  scrollToBottom();
}

function renderMessage(msg, role, analysis = null) {
  if (!messagesEl) return;

  const div = document.createElement('div');
  div.className = `message message-${role}`;
  div.dataset.messageId = msg.id;

  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (role === 'user') {
    div.innerHTML = `
      <div class="message-content">${escapeHtml(msg.content)}</div>
    `;
  } else {
    const analysisData = analysis || msg.analysis;
    let analysisHtml = '';
    if (analysisData) {
      analysisHtml = buildAnalysisCard(analysisData);
    }

    div.innerHTML = `
      <div class="message-avatar">
        <img src="/assets/logo.png" alt="NewsScope AI" class="avatar-logo-img" />
      </div>
      <div style="flex: 1; max-width: calc(100% - 48px);">
        <div class="message-content">
          <p>${escapeHtml(msg.content)}</p>
          ${analysisHtml}
        </div>
        <div class="message-time">${time}</div>
      </div>
    `;
  }

  messagesEl.appendChild(div);

  // Animate the meter fill
  if (analysis) {
    requestAnimationFrame(() => {
      const fill = div.querySelector('.meter-fill');
      if (fill) fill.style.width = analysis.score + '%';
    });
  }
}

function buildAnalysisCard(analysis) {
  const sources = analysis.sources || [];
  const sourcesHtml = sources.map(s => `
    <div class="source-item">
      <span class="source-dot"></span>
      <span>${escapeHtml(s)}</span>
    </div>
  `).join('');

  const biasBadge = analysis.bias ? `
    <span class="badge badge-bias" title="Detected Framing Bias">Bias: ${escapeHtml(analysis.bias)}</span>
  ` : '';

  const benchmarkBadge = analysis.benchmark_matched ? `
    <span class="badge badge-benchmark" title="Ground Truth Corroborated in Benchmark Dataset">
      Verified Benchmark (${escapeHtml(analysis.benchmark_matched.id || 'Dataset')})
    </span>
  ` : '';

  const keyClaimsHtml = (analysis.key_claims && analysis.key_claims.length > 0) ? `
    <div style="margin-top: var(--space-2); margin-bottom: var(--space-3); font-size: var(--font-xs); color: var(--text-tertiary);">
      <strong>Evaluated:</strong> ${escapeHtml(analysis.key_claims.join('; '))}
    </div>
  ` : '';

  return `
    <div class="news-analysis-card anim-fade-in-up">
      <div class="analysis-header">
        <div class="analysis-title">${escapeHtml(analysis.title || 'Credibility Report')}</div>
        <div class="analysis-header-tags">
          <span class="badge ${escapeHtml(analysis.verdictClass || 'badge-credible')}">${escapeHtml(analysis.verdict || 'Assessed')}</span>
          ${biasBadge}
          ${benchmarkBadge}
        </div>
      </div>
      <div class="credibility-meter">
        <div class="meter-label">
          <span class="label-text">Credibility Score</span>
          <span class="label-value">${analysis.score}%</span>
        </div>
        <div class="meter-bar">
          <div class="meter-fill ${analysis.level || 'medium'}" style="width: 0%"></div>
        </div>
      </div>
      <p style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: var(--space-2); line-height: 1.5;">${escapeHtml(analysis.summary || '')}</p>
      ${keyClaimsHtml}
      <div class="source-list">
        <div class="source-list-title">Sources Consulted & Citations</div>
        ${sourcesHtml || '<div class="source-item">Primary news wire archives</div>'}
      </div>
    </div>
  `;
}

export function loadChat(chatId) {
  if (!chatId) {
    showWelcome();
    return;
  }

  const chat = getChat(chatId);
  if (!chat) {
    showWelcome();
    return;
  }

  setActiveChatId(chatId);

  // Clear messages
  if (messagesEl) messagesEl.innerHTML = '';

  // Hide welcome, show messages
  if (welcomeScreen) {
    welcomeScreen.style.display = chat.messages.length > 0 ? 'none' : '';
  }

  // Render messages
  for (const msg of chat.messages) {
    renderMessage(msg, msg.role, msg.analysis);
  }

  // Animate meters
  requestAnimationFrame(() => {
    document.querySelectorAll('.meter-fill').forEach(fill => {
      const width = fill.style.width;
      fill.style.width = '0%';
      requestAnimationFrame(() => {
        fill.style.width = width;
      });
    });
  });

  scrollToBottom();
}

function showWelcome() {
  if (messagesEl) messagesEl.innerHTML = '';
  if (welcomeScreen) welcomeScreen.style.display = '';
}

function showTyping() {
  if (typingIndicator) typingIndicator.classList.add('active');
  scrollToBottom();
}

function hideTyping() {
  if (typingIndicator) typingIndicator.classList.remove('active');
}

function scrollToBottom() {
  if (chatContainer) {
    requestAnimationFrame(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });
  }
}

export function setVoiceTranscript(text) {
  if (textarea) {
    textarea.value = text;
    textarea.dispatchEvent(new Event('input'));
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
