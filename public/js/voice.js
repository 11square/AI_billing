// ===== Voice billing (Web Speech API) =====
// Say things like: "two cappuccino and one brownie", "add three samosa",
// "remove latte", "clear order", "checkout".
const Voice = {
  rec: null,
  active: false,

  supported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  toggle() {
    if (this.active) this.stop();
    else this.start();
  },

  start() {
    if (!this.supported()) {
      Ui.toast('Voice billing needs Chrome or Edge (Web Speech API not available)', 'error');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.rec = new SR();
    this.rec.lang = 'en-IN';
    this.rec.continuous = true;
    this.rec.interimResults = true;

    this.rec.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      this.setTranscript(interim || final);
      if (final.trim()) this.handle(final.trim());
    };
    this.rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        Ui.toast('Microphone permission denied — allow mic access to use voice billing', 'error');
        this.stop();
      } else if (e.error === 'no-speech') {
        this.setTranscript('');
      } else if (e.error !== 'aborted') {
        Ui.toast(`Voice error: ${e.error}`, 'error');
      }
    };
    this.rec.onend = () => {
      // Chrome auto-stops after silence; keep listening while active
      if (this.active) { try { this.rec.start(); } catch { /* already starting */ } }
    };

    try { this.rec.start(); } catch (e) { Ui.toast(e.message, 'error'); return; }
    this.active = true;
    this.renderPanel();
  },

  stop() {
    this.active = false;
    if (this.rec) { try { this.rec.stop(); } catch { } this.rec = null; }
    document.getElementById('voice-panel')?.remove();
    document.getElementById('pos-mic')?.classList.remove('listening');
  },

  renderPanel() {
    document.getElementById('pos-mic')?.classList.add('listening');
    const panel = document.createElement('div');
    panel.id = 'voice-panel';
    panel.className = 'voice-panel';
    panel.innerHTML = `
      <div class="voice-top">
        <span class="voice-dot"></span>
        <b>Listening…</b>
        <button class="voice-close" title="Stop">✕</button>
      </div>
      <div class="voice-transcript" id="voice-transcript">Say an order…</div>
      <div class="voice-hints">
        Try: <i>"2 cappuccino and 1 brownie"</i> · <i>"remove latte"</i> · <i>"clear order"</i> · <i>"checkout"</i>
      </div>
      <div class="voice-log" id="voice-log"></div>`;
    panel.querySelector('.voice-close').addEventListener('click', () => this.stop());
    document.body.appendChild(panel);
  },

  setTranscript(text) {
    const el = document.getElementById('voice-transcript');
    if (el) el.textContent = text || 'Say an order…';
  },

  log(msg, ok = true) {
    const el = document.getElementById('voice-log');
    if (el) {
      const row = document.createElement('div');
      row.className = 'voice-log-row ' + (ok ? 'ok' : 'bad');
      row.textContent = (ok ? '✓ ' : '✕ ') + msg;
      el.prepend(row);
      while (el.children.length > 4) el.lastChild.remove();
    }
    Ui.toast(msg, ok ? 'success' : 'error');
  },

  // Voice output disabled per shop preference — the app should act on what it
  // hears, not talk back. Feedback still surfaces silently via this.log() +
  // Ui.toast(). Also cancel anything already queued in case the browser had
  // an utterance mid-flight when this shipped.
  say(_msg) {
    try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch {}
  },

  // ---------- command parsing ----------
  NUM_WORDS: {
    a: 1, an: 1, one: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20
  },

  normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  },

  handle(raw) {
    const text = this.normalize(raw);
    if (!text) return;

    // whole-utterance commands
    if (/^(clear|empty|cancel)( the)?( order| cart| bill)?$/.test(text)) {
      Pos.cart = {}; Pos.discount = 0; Pos.renderCart(); Pos.renderGrid();
      this.log('Order cleared');
      this.say('Order cleared');
      return;
    }
    if (/(checkout|check out|charge|payment|complete order|make (the )?bill|billing karo)/.test(text)) {
      if (!Object.keys(Pos.cart).length) { this.log('Cart is empty', false); this.say('Cart is empty'); return; }
      this.log('Opening payment');
      Pos.openCheckout();
      return;
    }

    // remove commands: "remove latte", "remove 2 samosa"
    const rem = text.match(/^(remove|delete|minus|hata do|hatao)\s+(.*)$/);
    if (rem) {
      const { qty, query } = this.splitQty(rem[2]);
      const p = this.findProduct(query, Object.values(Pos.cart).map(l => l.product));
      if (!p) { this.log(`"${rem[2]}" is not in the cart`, false); return; }
      Pos.changeQty(p.id, -(qty || Pos.cart[p.id]?.qty || 1));
      this.log(`Removed ${p.name}`);
      this.say(`Removed ${p.name}`);
      return;
    }

    // add commands — possibly multiple: "2 cappuccino and 1 brownie"
    const segments = text.replace(/^(add|adding|include|order|get|i want|give me|de do)\s+/, '')
      .split(/\s+(?:and|plus|with|aur)\s+|,/).map(s => s.trim()).filter(Boolean);

    const added = [], failed = [];
    for (const seg of segments) {
      const { qty, query } = this.splitQty(seg);
      if (!query) continue;
      const p = this.findProduct(query, Pos.products.filter(x => x.stock > 0));
      if (!p) { failed.push(query); continue; }
      const n = Math.max(qty || 1, 1);
      const line = Pos.cart[p.id] || { product: p, qty: 0 };
      line.qty = Math.min(line.qty + n, p.stock);
      Pos.cart[p.id] = line;
      added.push(`${n} ${p.name}`);
    }
    if (added.length) {
      Pos.renderCart(); Pos.renderGrid();
      this.log(`Added ${added.join(', ')}`);
      this.say(`Added ${added.join(', ')}`);
    }
    if (failed.length) this.log(`Couldn't find: ${failed.join(', ')}`, false);
    if (!added.length && !failed.length) this.log(`Didn't catch that — "${raw}"`, false);
  },

  // "2 cold coffee" -> { qty: 2, query: "cold coffee" }
  splitQty(s) {
    const words = s.split(' ');
    let qty = null;
    if (/^\d+$/.test(words[0])) qty = parseInt(words.shift());
    else if (this.NUM_WORDS[words[0]] !== undefined && words.length > 1) qty = this.NUM_WORDS[words.shift()];
    return { qty, query: words.join(' ').trim() };
  },

  // fuzzy product match: score by token overlap, prefer exact / prefix matches
  findProduct(query, pool) {
    if (!query) return null;
    const qTokens = this.normalize(query).split(' ').filter(t => t.length > 1 || /\d/.test(t));
    if (!qTokens.length) return null;
    let best = null, bestScore = 0;
    for (const p of pool) {
      const name = this.normalize(p.name);
      const nTokens = name.split(' ');
      let score = 0;
      for (const qt of qTokens) {
        if (nTokens.some(nt => nt === qt)) score += 3;
        else if (nTokens.some(nt => nt.startsWith(qt) && qt.length >= 3)) score += 2;
        else if (name.includes(qt)) score += 1;
      }
      if (!score) continue;
      if (name === qTokens.join(' ')) score += 5;              // exact name
      if (nTokens[0] === qTokens[0]) score += 1;               // same first word
      score -= nTokens.length * 0.1;                           // prefer shorter names on ties
      if (score > bestScore) { bestScore = score; best = p; }
    }
    // require at least one strong token hit
    return bestScore >= 2 ? best : null;
  }
};
