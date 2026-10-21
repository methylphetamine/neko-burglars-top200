(() => {
  'use strict';

  const USERS = Array.isArray(window.CHAT_USERS) ? window.CHAT_USERS : [];
  const META = window.CHAT_META || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const numberFmt = new Intl.NumberFormat('en-US');
  const fmt = (value) => numberFmt.format(Number(value) || 0);
  const pct = (value) => `${(Number(value) || 0).toFixed(1)}%`;
  const dec = (value, digits = 1) => (Number(value) || 0).toFixed(digits);
  const pad2 = (value) => String(value).padStart(2, '0');

  const userById = new Map(USERS.map((user) => [String(user.id), user]));
  const state = { query: '', sort: 'rank', filter: 'all' };

  const FILTERS = [
    { id: 'all', label: 'All 200', test: () => true },
    { id: 'oneliner', label: 'One-liners', test: (u) => u.one_liner_pct >= 85 },
    { id: 'emoji', label: 'Emoji-heavy', test: (u) => u.emoji_per >= 0.4 },
    { id: 'caps', label: 'Caps-heavy', test: (u) => u.caps_pct >= 10 },
    { id: 'questions', label: 'Question-heavy', test: (u) => u.quest_pct >= 12 },
    { id: 'links', label: 'Links & media', test: (u) => u.share_rate >= 0.05 || u.media_rate >= 0.05 },
    { id: 'laughs', label: 'Laugh tracks', test: (u) => u.laugh_per_100 >= 20 },
    { id: 'reactions', label: 'Reaction magnets', test: (u) => u.react_recv_rate >= 0.3 },
  ];

  const SORT_LABELS = {
    rank: 'rank',
    messages: 'messages',
    reactions: 'reactions received',
    avg_asc: 'shortest messages',
    avg_desc: 'longest messages',
    emoji: 'emoji rate',
    active: 'active days',
    oneliner: 'one-liner rate',
    text: 'conversational lines',
  };

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);

  function hashString(text) {
    let hash = 0;
    const value = String(text || '');
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function hueFor(text) {
    return hashString(text) % 360;
  }

  function initialFor(name) {
    const trimmed = String(name || '').trim();
    return trimmed ? Array.from(trimmed)[0] : '?';
  }

  function displayName(user) {
    return user.display_name || user.name;
  }

  function getFiltered() {
    const query = state.query.trim().toLowerCase();
    const filter = FILTERS.find((entry) => entry.id === state.filter) || FILTERS[0];
    const list = USERS.filter((user) => {
      if (!filter.test(user)) return false;
      if (!query) return true;
      const haystack = [
        user.name,
        user.display_name,
        user.character,
        user.tagline,
        ...(user.tags || []),
        ...(user.signature_words || []),
        ...(user.signature_phrases || []),
        ...(user.top_emojis || []).map((entry) => entry.e),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });

    const nameScore = (user) => {
      if (!query) return 0;
      const name = displayName(user).toLowerCase().replace(/^[^a-z0-9]+/, '');
      if (name === query) return 0;
      if (name.startsWith(query)) return 1;
      if (name.includes(query)) return 2;
      return 3;
    };

    const compareByState = (a, b) => {
      switch (state.sort) {
        case 'messages': return b.messages - a.messages || a.rank - b.rank;
        case 'reactions': return b.reactions_received - a.reactions_received || a.rank - b.rank;
        case 'avg_asc': return a.avg_words - b.avg_words || a.rank - b.rank;
        case 'avg_desc': return b.avg_words - a.avg_words || a.rank - b.rank;
        case 'emoji': return b.emoji_per - a.emoji_per || a.rank - b.rank;
        case 'active': return b.active_days - a.active_days || a.rank - b.rank;
        case 'oneliner': return b.one_liner_pct - a.one_liner_pct || a.rank - b.rank;
        case 'text': return b.text_lines - a.text_lines || a.rank - b.rank;
        default: return a.rank - b.rank;
      }
    };

    list.sort((a, b) => nameScore(a) - nameScore(b) || compareByState(a, b));
    return list;
  }

  function renderMeta() {
    const topMessages = USERS.reduce((sum, user) => sum + user.messages, 0);
    const totalMessages = META.totalMessages || topMessages;
    const share = totalMessages ? ((topMessages / totalMessages) * 100).toFixed(1) : '—';
    $('#meta-messages').textContent = fmt(totalMessages);
    $('#meta-voices').textContent = fmt(USERS.length);
    $('#meta-lines').textContent = fmt(META.topTextMessages || USERS.reduce((sum, user) => sum + user.text_lines, 0));
    $('#meta-days').textContent = fmt(META.days || 56);
    $('#hero-note').textContent = `Top ${USERS.length} = ${share}% of all messages · ${META.range || '26 Aug – 20 Oct 2026'} · all times UTC · descriptive, not diagnostic.`;
  }

  function podiumCard(user, index) {
    const phrase = user.signature_phrases?.[0];
    const word = user.signature_words?.[0];
    const emoji = user.top_emojis?.[0];
    let line = 'Not enough text for a stable signature.';
    if (phrase) line = `<span>Signature phrase</span> “${esc(phrase)}”`;
    else if (word) line = `<span>Signature word</span> “${esc(word)}”`;
    else if (emoji) line = `<span>Most-used emoji</span> ${esc(emoji.e)}`;

    return `
      <article class="podium-card" data-id="${esc(user.id)}" data-ghost="${pad2(user.rank)}" tabindex="0" role="button" aria-label="Open profile for ${esc(displayName(user))}">
        <div class="podium-top">
          <span class="medal">${pad2(user.rank)}</span>
          <span class="podium-tag">${index === 0 ? 'Most messages' : index === 1 ? 'Second' : 'Third'}</span>
        </div>
        <h3>${esc(displayName(user))}</h3>
        <div class="podium-character">${esc(user.character)}</div>
        <div class="podium-stats">
          <div><strong>${fmt(user.messages)}</strong><span>messages</span></div>
          <div><strong>${dec(user.avg_words, 1)}</strong><span>words / msg</span></div>
          <div><strong>${fmt(user.reactions_received)}</strong><span>reactions</span></div>
        </div>
        <p class="podium-line">${line}</p>
      </article>`;
  }

  function renderPodium() {
    $('#podium').innerHTML = USERS.slice(0, 3).map(podiumCard).join('');
  }

  function renderFilters() {
    const counts = Object.fromEntries(FILTERS.map((filter) => [filter.id, USERS.filter(filter.test).length]));
    $('#filters').innerHTML = FILTERS.map((filter) => `
      <button class="chip${filter.id === state.filter ? ' active' : ''}" type="button" data-filter="${filter.id}">
        ${filter.label}<span class="count">${counts[filter.id]}</span>
      </button>`).join('');
  }

  function rowHtml(user) {
    const shown = displayName(user);
    const hue = hueFor(shown);
    const dot = hueFor(user.character);
    return `
      <button class="lb-row" type="button" data-id="${esc(user.id)}" aria-label="Open profile for ${esc(shown)}">
        <span class="rank">${pad2(user.rank)}</span>
        <span class="member">
          <span class="avatar" style="--hue:${hue}">${esc(initialFor(shown))}</span>
          <span class="member-text">
            <strong>${esc(shown)}</strong>
            <small>${esc(user.character)} · ${esc(user.tagline)}</small>
          </span>
        </span>
        <span class="character"><i style="--dot:${dot}"></i>${esc(user.character)}</span>
        <span class="num col-msgs">${fmt(user.messages)}</span>
        <span class="num col-share">${pct(user.share)}</span>
        <span class="num col-avg">${dec(user.avg_words, 1)}</span>
        <span class="num col-emoji">${dec(user.emoji_per, 2)}</span>
        <span class="num col-reactions">${fmt(user.reactions_received)}</span>
        <span class="num col-days">${user.active_days}</span>
        <span class="row-arrow">↗</span>
      </button>`;
  }

  function render() {
    const list = getFiltered();
    $('#rows').innerHTML = list.map(rowHtml).join('');
    $('#empty').hidden = list.length !== 0;
    $('#results-count').textContent = `Showing ${fmt(list.length)} of ${fmt(USERS.length)} voices`;
    const filter = FILTERS.find((entry) => entry.id === state.filter);
    const parts = [`Sorted by ${SORT_LABELS[state.sort] || 'rank'}`];
    if (filter && filter.id !== 'all') parts.push(filter.label);
    if (state.query.trim()) parts.push(`search “${state.query.trim()}”`);
    $('#results-note').textContent = parts.join(' · ');
    $$('.chip', $('#filters')).forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.filter === state.filter);
    });
  }

  function stat(label, value, sub = '') {
    return `<div><span>${esc(label)}</span><strong>${value}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  }

  function meter(label, value) {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    return `
      <div class="meter">
        <div class="meter-head"><span>${esc(label)}</span><span>${Math.round(safe)}</span></div>
        <div class="track"><i style="width:${safe}%"></i></div>
      </div>`;
  }

  function hourChart(user) {
    const values = Array.isArray(user.hourly) && user.hourly.length === 24 ? user.hourly : Array(24).fill(0);
    const max = Math.max(...values, 1);
    const bars = values.map((value, hour) => {
      const height = Math.max(2, Math.round((value / max) * 100));
      const peak = value === max && max > 0 ? ' peak' : '';
      return `<div class="hour-bar${peak}" title="${pad2(hour)}:00 UTC — ${fmt(value)} messages"><i style="height:${height}%"></i></div>`;
    }).join('');
    const peakHour = Number(user.peak_hour);
    const peakValue = values[peakHour] || 0;
    const peakLabel = Number.isFinite(peakHour) ? `${pad2(peakHour)}:00` : '—';
    return `
      <div class="hour-bars">${bars}</div>
      <div class="hour-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      <p class="chart-note">Peak: <strong>${esc(user.peak_weekday)} ${peakLabel} UTC</strong> · ${fmt(peakValue)} messages in that hour.</p>`;
  }

  function vocabBlock(label, items, renderItem) {
    if (!items || !items.length) return '';
    return `
      <div class="vocab-block">
        <span class="vocab-label">${esc(label)}</span>
        <div class="chips">${items.map(renderItem).join('')}</div>
      </div>`;
  }

  function profileHtml(user) {
    const tags = (user.tags || []).slice(0, 7).map((tag, index) => `<span class="tag${index === 0 ? ' accent' : ''}">${esc(tag)}</span>`).join('');
    const vocab = [
      vocabBlock('Signature words', user.signature_words, (word) => `<span class="word-chip">“${esc(word)}”</span>`),
      vocabBlock('Signature phrases', user.signature_phrases, (phrase) => `<span class="word-chip">“${esc(phrase)}”</span>`),
      vocabBlock('Top emoji', user.top_emojis, (entry) => `<span class="word-chip emoji-chip" title="${fmt(entry.n)} uses">${esc(entry.e)}<em>${fmt(entry.n)}</em></span>`),
      vocabBlock('Address terms', user.address_terms, (term) => `<span class="word-chip">“${esc(term)}”</span>`),
    ].join('') || '<span class="empty">Not enough text for stable signature terms.</span>';

    const mechanics = [
      ['One-liners', pct(user.one_liner_pct)],
      ['Median words', dec(user.median_words, 0)],
      ['Lowercase', pct(user.lower_pct)],
      ['ALL CAPS', pct(user.caps_pct)],
      ['Terminal punctuation', pct(user.term_pct)],
      ['Questions', pct(user.quest_pct)],
      ['No punctuation', pct(user.nopunct_pct)],
      ['Emoji-only', pct(user.emoji_only_pct)],
      ['Laugh markers /100', dec(user.laugh_per_100, 1)],
      ['Textese / msg', dec(user.textese_per_msg, 2)],
      ['Profanity /100', dec(user.profanity_per_100, 1)],
      ['Starts capitalized', pct(user.start_upper_pct)],
    ].map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');

    const social = [
      ['Reactions received', fmt(user.reactions_received)],
      ['Reactions given', fmt(user.reactions_given)],
      ['Most-received reaction', user.top_reaction_received || '—'],
      ['Most-given reaction', user.top_reaction_given || '—'],
      ['Most often adjacent to', user.top_interlocutor || '—'],
      ['Peak time', `${user.peak_weekday || '—'} ${pad2(user.peak_hour)}:00 UTC`],
      ['Media messages', fmt(user.media_messages)],
      ['Links shared', fmt(user.shares)],
      ['First seen', `${user.first_seen || '—'} UTC`],
      ['Last seen', `${user.last_seen || '—'} UTC`],
      ['Member status', user.current_member ? 'Still listed' : 'No longer listed'],
    ].map(([label, value]) => `<li><span>${esc(label)}</span><strong>${esc(value)}</strong></li>`).join('');

    return `
      <div class="profile-rank">Rank <strong>${pad2(user.rank)}</strong> <span>/ ${USERS.length}</span></div>
      <div class="profile-character">${esc(user.character)}</div>
      <h2 class="profile-name" id="profile-title" title="${esc(user.name)}">${esc(displayName(user))}</h2>
      <div class="tag-row">${tags}</div>
      <p class="voice">${esc(user.voice)}</p>

      <div class="stat-grid">
        ${stat('Messages', fmt(user.messages), 'total')}
        ${stat('Share of chat', pct(user.share), 'all messages')}
        ${stat('Conversational lines', fmt(user.text_lines), 'text only')}
        ${stat('Average words', dec(user.avg_words, 1), 'per line')}
        ${stat('Reactions received', fmt(user.reactions_received), 'from others')}
        ${stat('Active days', fmt(user.active_days), 'UTC days')}
      </div>

      <div class="profile-panels">
        <section class="panel">
          <h3>Character bars</h3>
          ${meter('Volume', user.radar?.volume)}
          ${meter('Brevity', user.radar?.brevity)}
          ${meter('Emoji', user.radar?.emoji)}
          ${meter('Questions', user.radar?.questions)}
          ${meter('Reactions', user.radar?.reactions)}
          ${meter('Media & links', user.radar?.media)}
        </section>
        <section class="panel">
          <h3>When they talk</h3>
          ${hourChart(user)}
        </section>
      </div>

      <div class="profile-panels">
        <section class="panel">
          <h3>Signature vocabulary</h3>
          ${vocab}
        </section>
        <section class="panel">
          <h3>Typing mechanics</h3>
          <dl class="mechanics">${mechanics}</dl>
        </section>
      </div>

      <section class="panel panel-wide">
        <h3>Social footprint</h3>
        <ul class="social-list">${social}</ul>
      </section>

      <div class="profile-foot">
        Writing-style description only — no personality, mental-health, or private-life inference.
        Times are UTC. Signature terms are filtered for names, system text, slurs, and sensitive identity terms.
      </div>`;
  }

  function replaceHash(hash) {
    try {
      history.replaceState(null, '', location.pathname + location.search + hash);
    } catch (_error) {
      /* file:// and sandboxed contexts may forbid history changes */
    }
  }

  const dialog = $('#profile');

  function openProfile(id, options = {}) {
    const user = userById.get(String(id));
    if (!user) return;
    $('#profile-content').innerHTML = profileHtml(user);
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
    const shell = $('.dialog-shell', dialog);
    if (shell) shell.scrollTop = 0;
    const closeButton = $('#dialog-close');
    if (closeButton) closeButton.focus({ preventScroll: true });
    if (options.updateHash !== false) replaceHash(`#u${user.id}`);
  }

  function closeProfile() {
    if (dialog.open) dialog.close();
  }

  function randomProfile() {
    const list = getFiltered();
    const pool = list.length ? list : USERS;
    if (!pool.length) return;
    openProfile(pool[Math.floor(Math.random() * pool.length)].id);
  }

  function handleHash() {
    const match = location.hash.match(/^#u(\d+)$/);
    if (match) openProfile(match[1], { updateHash: false });
  }

  function bind() {
    $('#search').addEventListener('input', (event) => {
      state.query = event.target.value;
      render();
    });
    $('#search').addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && event.target.value) {
        event.target.value = '';
        state.query = '';
        render();
      }
    });
    $('#sort').addEventListener('change', (event) => {
      state.sort = event.target.value;
      render();
    });
    $('#filters').addEventListener('click', (event) => {
      const chip = event.target.closest('[data-filter]');
      if (!chip) return;
      state.filter = chip.dataset.filter;
      render();
    });
    $('#random').addEventListener('click', randomProfile);
    $('#rows').addEventListener('click', (event) => {
      const row = event.target.closest('[data-id]');
      if (row) openProfile(row.dataset.id);
    });
    $('#podium').addEventListener('click', (event) => {
      const card = event.target.closest('[data-id]');
      if (card) openProfile(card.dataset.id);
    });
    $('#podium').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('[data-id]');
      if (!card) return;
      event.preventDefault();
      openProfile(card.dataset.id);
    });
    $('#dialog-close').addEventListener('click', closeProfile);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeProfile();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('modal-open');
      if (location.hash.startsWith('#u')) replaceHash('');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
        event.preventDefault();
        $('#search').focus();
      }
    });
    window.addEventListener('hashchange', handleHash);
  }

  renderMeta();
  renderPodium();
  renderFilters();
  bind();
  render();
  handleHash();
})();
