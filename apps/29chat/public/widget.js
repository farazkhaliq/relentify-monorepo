(function() {
  'use strict';

  // --- Config ---
  var scriptTag = document.currentScript;
  var ENTITY_ID = scriptTag && scriptTag.getAttribute('data-entity-id');
  var BASE_URL = scriptTag && scriptTag.getAttribute('data-base-url') || 'https://chat.relentify.com';
  if (!ENTITY_ID) { console.error('[RelentifyChat] Missing data-entity-id'); return; }

  var STORAGE_KEY = 'relentify_chat_' + ENTITY_ID;
  var HEARTBEAT_MS = 30000;
  var POLL_MS = 3000;

  // --- State ---
  var state = {
    config: null,
    visitor: null,
    session: null,
    messages: [],
    open: false,
    connected: false,
    preChatDone: false,
    language: 'en',
    unread: 0,
    sse: null,
    pollTimer: null,
    heartbeatTimer: null,
  };

  // --- Fingerprint ---
  function generateFingerprint() {
    var stored = localStorage.getItem(STORAGE_KEY + '_fp');
    if (stored) return stored;
    var parts = [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      navigator.hardwareConcurrency || 0,
    ];
    // Simple hash
    var hash = 0;
    var str = parts.join('|');
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    var fp = 'fp_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY + '_fp', fp);
    return fp;
  }

  // --- API helpers ---
  function api(method, path, body) {
    var opts = { method: method, headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(BASE_URL + path, opts).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // --- Restore session ---
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        visitor_id: state.visitor && state.visitor.id,
        session_id: state.session && state.session.id,
        preChatDone: state.preChatDone,
      }));
    } catch(e) {}
  }

  function restoreState() {
    try {
      var s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return s;
    } catch(e) { return {}; }
  }

  // --- SSE ---
  function connectSSE() {
    if (!state.session) return;
    if (state.sse) { state.sse.close(); state.sse = null; }

    try {
      var es = new EventSource(BASE_URL + '/api/widget/session/' + state.session.id + '/stream');
      state.sse = es;
      state.connected = true;

      es.addEventListener('new_message', function(e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.sender_type !== 'visitor') {
            state.messages.push(msg);
            if (!state.open) state.unread++;
            renderMessages();
            renderBadge();
          }
        } catch(err) {}
      });

      es.addEventListener('typing', function(e) {
        try {
          var d = JSON.parse(e.data);
          if (d.sender_type !== 'visitor') showTyping();
        } catch(err) {}
      });

      es.addEventListener('session_updated', function(e) {
        try {
          var s = JSON.parse(e.data);
          state.session = s;
          if (s.status === 'resolved' || s.status === 'closed') showRatingPrompt();
        } catch(err) {}
      });

      es.onerror = function() {
        state.connected = false;
        es.close();
        state.sse = null;
        startPolling();
      };
    } catch(e) {
      startPolling();
    }
  }

  // --- Polling fallback ---
  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(function() {
      if (!state.session) return;
      var since = state.messages.length > 0 ? state.messages[state.messages.length - 1].created_at : '';
      api('GET', '/api/widget/session/' + state.session.id + '/messages' + (since ? '?since=' + encodeURIComponent(since) : ''))
        .then(function(msgs) {
          if (msgs && msgs.length > 0) {
            for (var i = 0; i < msgs.length; i++) {
              var exists = state.messages.some(function(m) { return m.id === msgs[i].id; });
              if (!exists) {
                state.messages.push(msgs[i]);
                if (!state.open && msgs[i].sender_type !== 'visitor') state.unread++;
              }
            }
            renderMessages();
            renderBadge();
          }
        })
        .catch(function() {});
    }, POLL_MS);
  }

  function stopPolling() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
  }

  // --- Heartbeat ---
  function startHeartbeat() {
    if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = setInterval(function() {
      if (!state.visitor) return;
      api('POST', '/api/widget/heartbeat', {
        visitor_id: state.visitor.id,
        page_url: window.location.href,
      }).catch(function() {});
    }, HEARTBEAT_MS);
  }

  // --- Typing ---
  var typingTimeout = null;
  function sendTyping() {
    if (!state.session) return;
    if (typingTimeout) return;
    api('POST', '/api/widget/session/' + state.session.id + '/typing', {}).catch(function() {});
    typingTimeout = setTimeout(function() { typingTimeout = null; }, 2000);
  }

  // --- Create/resume session ---
  function ensureSession(cb) {
    if (state.session && state.visitor) { if (cb) cb(); return; }

    var fp = generateFingerprint();
    api('POST', '/api/widget/session', {
      entity_id: ENTITY_ID,
      fingerprint: fp,
      user_agent: navigator.userAgent,
      page_url: window.location.href,
    }).then(function(res) {
      state.visitor = res.visitor;
      state.session = res.session;
      saveState();
      connectSSE();
      startHeartbeat();
      loadMessages(cb);
    }).catch(function(err) {
      console.error('[RelentifyChat] Session error:', err);
    });
  }

  function loadMessages(cb) {
    if (!state.session) return;
    api('GET', '/api/widget/session/' + state.session.id + '/messages')
      .then(function(msgs) {
        state.messages = msgs || [];
        renderMessages();
        if (cb) cb();
      })
      .catch(function() { if (cb) cb(); });
  }

  // --- Send message ---
  function sendMessage(text) {
    if (!text.trim()) return;
    if (!state.session) {
      ensureSession(function() { sendMessage(text); });
      return;
    }

    var optimistic = {
      id: 'tmp_' + Date.now(),
      session_id: state.session.id,
      entity_id: ENTITY_ID,
      sender_type: 'visitor',
      body: text.trim(),
      created_at: new Date().toISOString(),
    };
    state.messages.push(optimistic);
    renderMessages();

    api('POST', '/api/widget/session/' + state.session.id + '/messages', { body: text.trim() })
      .then(function(msg) {
        var idx = state.messages.findIndex(function(m) { return m.id === optimistic.id; });
        if (idx >= 0) state.messages[idx] = msg;
        renderMessages();
      })
      .catch(function() {});
  }

  // --- Identify ---
  function identify(name, email) {
    if (!state.session) return;
    api('POST', '/api/widget/session/' + state.session.id + '/identify', { name: name, email: email })
      .then(function(v) { state.visitor = v; })
      .catch(function() {});
  }

  // --- Shadow DOM + UI ---
  var host, shadow, root;

  function createWidget() {
    host = document.createElement('div');
    host.id = 'relentify-chat-widget';
    shadow = host.attachShadow({ mode: 'open' });

    var cfg = state.config || {};
    var colour = cfg.widget_colour || '#6366f1';
    var position = cfg.widget_position || 'bottom-right';
    var posRight = position === 'bottom-right';

    shadow.innerHTML = '<style>' + getStyles(colour, posRight) + '</style>' +
      '<div class="rc-root">' +
        '<div class="rc-panel" style="display:none">' +
          '<div class="rc-header">' +
            '<div class="rc-header-title">' + escHtml(cfg.business_name || 'Chat') + '</div>' +
            '<button class="rc-close" aria-label="Close">&times;</button>' +
          '</div>' +
          '<div class="rc-prechat" style="display:none">' +
            '<p class="rc-greeting">' + escHtml(cfg.widget_greeting || 'Hi there! How can we help?') + '</p>' +
            '<form class="rc-prechat-form">' +
              '<input type="text" name="name" placeholder="Your name" class="rc-input" />' +
              '<input type="email" name="email" placeholder="Email" class="rc-input" />' +
              '<button type="submit" class="rc-send-btn">Start Chat</button>' +
            '</form>' +
          '</div>' +
          '<div class="rc-messages"></div>' +
          '<div class="rc-typing" style="display:none"><span></span><span></span><span></span></div>' +
          '<div class="rc-rating" style="display:none">' +
            '<p>How was your experience?</p>' +
            '<div class="rc-stars"></div>' +
          '</div>' +
          '<div class="rc-input-bar">' +
            '<textarea class="rc-textarea" placeholder="Type a message..." rows="1"></textarea>' +
            '<button class="rc-send" aria-label="Send">&#9654;</button>' +
          '</div>' +
          (cfg.widget_show_branding !== false ? '<div class="rc-branding"><a href="https://chat.relentify.com" target="_blank" rel="noopener">Powered by Relentify</a></div>' : '') +
        '</div>' +
        '<button class="rc-fab" aria-label="Open chat">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
          '<span class="rc-badge" style="display:none">0</span>' +
        '</button>' +
      '</div>';

    document.body.appendChild(host);
    root = shadow.querySelector('.rc-root');
    bindEvents();

    // Show pre-chat form if enabled and not yet done
    if (cfg.pre_chat_form_enabled && !state.preChatDone) {
      shadow.querySelector('.rc-prechat').style.display = 'block';
      shadow.querySelector('.rc-messages').style.display = 'none';
      shadow.querySelector('.rc-input-bar').style.display = 'none';
    }

    // Auto-restore session
    var saved = restoreState();
    if (saved.session_id && saved.visitor_id) {
      state.preChatDone = saved.preChatDone || false;
      // Re-create session (will return existing if open)
      var fp = generateFingerprint();
      api('POST', '/api/widget/session', {
        entity_id: ENTITY_ID,
        fingerprint: fp,
        user_agent: navigator.userAgent,
        page_url: window.location.href,
      }).then(function(res) {
        state.visitor = res.visitor;
        state.session = res.session;
        saveState();
        connectSSE();
        startHeartbeat();
        loadMessages();
        if (state.preChatDone) {
          shadow.querySelector('.rc-prechat').style.display = 'none';
          shadow.querySelector('.rc-messages').style.display = '';
          shadow.querySelector('.rc-input-bar').style.display = '';
        }
      }).catch(function() {});
    } else {
      // Just do heartbeat for visitor tracking
      var fp = generateFingerprint();
      api('POST', '/api/widget/session', {
        entity_id: ENTITY_ID,
        fingerprint: fp,
        user_agent: navigator.userAgent,
        page_url: window.location.href,
      }).then(function(res) {
        state.visitor = res.visitor;
        startHeartbeat();
      }).catch(function() {});
    }
  }

  function bindEvents() {
    // Toggle panel
    shadow.querySelector('.rc-fab').addEventListener('click', function() {
      toggleOpen();
    });
    shadow.querySelector('.rc-close').addEventListener('click', function() {
      toggleOpen(false);
    });

    // Send message
    var textarea = shadow.querySelector('.rc-textarea');
    var sendBtn = shadow.querySelector('.rc-send');

    sendBtn.addEventListener('click', function() {
      sendMessage(textarea.value);
      textarea.value = '';
      textarea.style.height = 'auto';
    });

    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(textarea.value);
        textarea.value = '';
        textarea.style.height = 'auto';
      }
    });

    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      sendTyping();
    });

    // Pre-chat form
    var form = shadow.querySelector('.rc-prechat-form');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var name = form.querySelector('[name="name"]').value.trim();
        var email = form.querySelector('[name="email"]').value.trim();
        state.preChatDone = true;
        saveState();

        shadow.querySelector('.rc-prechat').style.display = 'none';
        shadow.querySelector('.rc-messages').style.display = '';
        shadow.querySelector('.rc-input-bar').style.display = '';

        ensureSession(function() {
          if (name || email) identify(name, email);
        });
      });
    }
  }

  function toggleOpen(forceState) {
    state.open = forceState !== undefined ? forceState : !state.open;
    var panel = shadow.querySelector('.rc-panel');
    var fab = shadow.querySelector('.rc-fab');
    panel.style.display = state.open ? 'flex' : 'none';
    fab.style.display = state.open ? 'none' : 'flex';
    if (state.open) {
      state.unread = 0;
      renderBadge();
      var msgs = shadow.querySelector('.rc-messages');
      msgs.scrollTop = msgs.scrollHeight;
      // Create session on open if pre-chat not needed
      if (!state.config?.pre_chat_form_enabled || state.preChatDone) {
        ensureSession();
      }
    }
  }

  function renderMessages() {
    var container = shadow.querySelector('.rc-messages');
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < state.messages.length; i++) {
      var m = state.messages[i];
      var div = document.createElement('div');
      div.className = 'rc-msg rc-msg-' + m.sender_type;
      div.innerHTML = '<div class="rc-msg-body">' + escHtml(m.body) + '</div>' +
        '<div class="rc-msg-time">' + formatTime(m.created_at) + '</div>';
      container.appendChild(div);
    }
    container.scrollTop = container.scrollHeight;
    hideTyping();
  }

  function renderBadge() {
    var badge = shadow.querySelector('.rc-badge');
    if (!badge) return;
    badge.style.display = state.unread > 0 ? 'flex' : 'none';
    badge.textContent = state.unread > 9 ? '9+' : state.unread;
  }

  var typingHideTimer = null;
  function showTyping() {
    var el = shadow.querySelector('.rc-typing');
    if (el) el.style.display = 'flex';
    if (typingHideTimer) clearTimeout(typingHideTimer);
    typingHideTimer = setTimeout(hideTyping, 3000);
  }

  function hideTyping() {
    var el = shadow.querySelector('.rc-typing');
    if (el) el.style.display = 'none';
  }

  function showRatingPrompt() {
    var ratingEl = shadow.querySelector('.rc-rating');
    if (!ratingEl) return;
    ratingEl.style.display = 'block';
    var starsEl = ratingEl.querySelector('.rc-stars');
    starsEl.innerHTML = '';
    for (var i = 1; i <= 5; i++) {
      (function(r) {
        var star = document.createElement('button');
        star.className = 'rc-star';
        star.textContent = '★';
        star.addEventListener('click', function() {
          api('POST', '/api/widget/session/' + state.session.id + '/rate', { rating: r }).catch(function() {});
          ratingEl.innerHTML = '<p>Thanks for your feedback!</p>';
          setTimeout(function() { ratingEl.style.display = 'none'; }, 2000);
        });
        starsEl.appendChild(star);
      })(i);
    }
  }

  // --- Helpers ---
  function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch(e) { return ''; }
  }

  // --- Styles ---
  function getStyles(colour, posRight) {
    return '*{margin:0;padding:0;box-sizing:border-box}' +
    '.rc-root{position:fixed;bottom:20px;' + (posRight ? 'right:20px' : 'left:20px') + ';z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a}' +
    '.rc-fab{width:56px;height:56px;border-radius:50%;background:' + colour + ';color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform 0.2s;position:relative}' +
    '.rc-fab:hover{transform:scale(1.05)}' +
    '.rc-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;min-width:20px;height:20px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 5px}' +
    '.rc-panel{display:none;flex-direction:column;width:380px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 100px);background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.12);overflow:hidden;position:absolute;bottom:0;' + (posRight ? 'right:0' : 'left:0') + '}' +
    '.rc-header{background:' + colour + ';color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}' +
    '.rc-header-title{font-weight:600;font-size:15px}' +
    '.rc-close{background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:0 4px;opacity:0.8}' +
    '.rc-close:hover{opacity:1}' +
    '.rc-prechat{padding:20px;flex:1;overflow-y:auto}' +
    '.rc-greeting{margin-bottom:16px;color:#666;font-size:14px}' +
    '.rc-prechat-form{display:flex;flex-direction:column;gap:10px}' +
    '.rc-input{padding:10px 12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;outline:none;font-family:inherit}' +
    '.rc-input:focus{border-color:' + colour + '}' +
    '.rc-send-btn{padding:10px 16px;background:' + colour + ';color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}' +
    '.rc-send-btn:hover{opacity:0.9}' +
    '.rc-messages{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:6px}' +
    '.rc-msg{max-width:80%;display:flex;flex-direction:column}' +
    '.rc-msg-visitor{align-self:flex-end}' +
    '.rc-msg-visitor .rc-msg-body{background:' + colour + ';color:#fff;border-radius:16px 16px 4px 16px;padding:8px 14px;word-break:break-word}' +
    '.rc-msg-agent .rc-msg-body,.rc-msg-ai .rc-msg-body,.rc-msg-system .rc-msg-body{background:#f3f4f6;color:#1a1a1a;border-radius:16px 16px 16px 4px;padding:8px 14px;word-break:break-word}' +
    '.rc-msg-system .rc-msg-body{background:#fef3c7;color:#92400e;font-size:12px;font-style:italic}' +
    '.rc-msg-time{font-size:10px;color:#999;margin-top:2px;padding:0 4px}' +
    '.rc-msg-visitor .rc-msg-time{text-align:right}' +
    '.rc-typing{padding:8px 16px;display:none;align-items:center;gap:4px;flex-shrink:0}' +
    '.rc-typing span{width:6px;height:6px;background:#999;border-radius:50%;animation:rc-bounce 1.4s infinite ease-in-out both}' +
    '.rc-typing span:nth-child(1){animation-delay:-0.32s}' +
    '.rc-typing span:nth-child(2){animation-delay:-0.16s}' +
    '@keyframes rc-bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}' +
    '.rc-rating{padding:12px 16px;text-align:center;flex-shrink:0}' +
    '.rc-rating p{font-size:13px;color:#666;margin-bottom:8px}' +
    '.rc-stars{display:flex;justify-content:center;gap:8px}' +
    '.rc-star{background:none;border:none;font-size:28px;color:#fbbf24;cursor:pointer;padding:0}' +
    '.rc-star:hover{transform:scale(1.2)}' +
    '.rc-input-bar{display:flex;align-items:flex-end;padding:8px 12px;border-top:1px solid #f0f0f0;gap:8px;flex-shrink:0}' +
    '.rc-textarea{flex:1;border:1px solid #e5e7eb;border-radius:12px;padding:8px 12px;font-size:14px;resize:none;outline:none;max-height:120px;font-family:inherit;line-height:1.4}' +
    '.rc-textarea:focus{border-color:' + colour + '}' +
    '.rc-send{width:36px;height:36px;border-radius:50%;background:' + colour + ';color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px}' +
    '.rc-send:hover{opacity:0.9}' +
    '.rc-branding{text-align:center;padding:6px;font-size:11px;color:#aaa;flex-shrink:0}' +
    '.rc-branding a{color:#aaa;text-decoration:none}' +
    '.rc-branding a:hover{color:#666}' +
    '@media(max-width:440px){.rc-panel{width:100vw;height:100vh;max-height:100vh;border-radius:0;bottom:0;right:0;left:0}.rc-root{bottom:0;right:0;left:0}}';
  }

  // --- Init ---
  function init() {
    api('GET', '/api/widget/config?entity_id=' + encodeURIComponent(ENTITY_ID))
      .then(function(cfg) {
        state.config = cfg;
        createWidget();
      })
      .catch(function(err) {
        console.error('[RelentifyChat] Failed to load config:', err);
      });
  }

  // --- Public API ---
  window.RelentifyChat = {
    open: function() { if (root) toggleOpen(true); },
    close: function() { if (root) toggleOpen(false); },
    toggle: function() { if (root) toggleOpen(); },
    identify: function(name, email) { identify(name, email); },
    destroy: function() {
      if (state.sse) state.sse.close();
      stopPolling();
      if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
      if (host && host.parentNode) host.parentNode.removeChild(host);
      host = shadow = root = null;
    },
    setLanguage: function(lang) { state.language = lang; },
  };

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
