/* Speak & Play — a tiny speech-practice game for little kids.
 * Pure vanilla JS, no build step, no dependencies. Runs on GitHub Pages.
 *
 * Uses the Web Speech API:
 *   - speechSynthesis        -> models the word out loud ("Listen")
 *   - SpeechRecognition      -> listens to the child and checks the word
 * Both degrade gracefully: if a browser lacks recognition, the grown-up
 * can tap "He said it!" to award the star.
 */
(function () {
  "use strict";

  // ---------- State ----------
  const state = {
    category: null,
    order: [],        // shuffled indices into category.words for "Say It"
    pos: 0,
    stars: loadStars(),
  };

  // ---------- Element helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const screens = {
    home: $("#screen-home"),
    mode: $("#screen-mode"),
    say: $("#screen-say"),
    find: $("#screen-find"),
    edit: $("#screen-edit"),
    import: $("#screen-import"),
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo(0, 0);
    // Refresh the home grid so the "My Words" count stays current.
    if (name === "home") buildHome();
  }

  // ---------- Stars (saved locally) ----------
  function loadStars() {
    const n = parseInt(localStorage.getItem("snp_stars") || "0", 10);
    return isNaN(n) ? 0 : n;
  }
  function saveStars() {
    localStorage.setItem("snp_stars", String(state.stars));
  }
  function addStar(n) {
    state.stars += n;
    saveStars();
    renderStars();
  }
  function renderStars() {
    $("#starCount").textContent = state.stars;
  }

  // ---------- Custom "My Words" category (saved locally) ----------
  const CUSTOM_KEY = "snp_custom";
  function loadCustom() {
    try {
      const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.filter((w) => w && typeof w.word === "string" && w.word.trim());
    } catch (_) {
      return [];
    }
  }
  function saveCustom(words) {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(words));
  }
  // A category object like the ones in words.js, but its words come from
  // whatever the grown-up has added. Refreshed from storage on open.
  const customCategory = {
    id: "custom",
    name: "My Words",
    icon: "💛",
    color: "#ffe08a",
    words: [],
  };
  function allCategories() {
    return CATEGORIES.concat([customCategory]);
  }

  // ---------- Speech synthesis ("Listen") ----------
  let voice = null;
  function pickVoice() {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    if (!voices.length) return;
    // Prefer an English voice; a "child"/female tends to be friendlier.
    voice =
      voices.find((v) => /en(-|_)?US/i.test(v.lang) && /female|zira|samantha|google us/i.test(v.name)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      voices[0];
  }
  if (window.speechSynthesis) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text, opts) {
    opts = opts || {};
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = opts.rate || 0.8;   // slow and clear for little ears
    u.pitch = opts.pitch || 1.15;
    u.lang = "en-US";
    if (opts.onend) u.onend = opts.onend;
    speechSynthesis.speak(u);
  }

  // What to say for a word. Letters also say their phonics sound
  // ("A. A says aah.") so kids hear the name and the sound together.
  function sayText(w) {
    if (w.sound) return w.word + ". " + w.word + " says " + w.sound + ".";
    return w.say || w.word;
  }

  // Draw a word's picture into an element. Counting words draw a group
  // of objects to be counted; everything else shows a single emoji.
  function renderPicture(el, w) {
    el.innerHTML = "";
    if (w.count && w.item) {
      const group = document.createElement("div");
      group.className = "count-group";
      for (let i = 0; i < w.count; i++) {
        const span = document.createElement("span");
        span.textContent = w.item;
        group.appendChild(span);
      }
      el.appendChild(group);
    } else {
      el.textContent = w.emoji;
    }
  }

  // ---------- Speech recognition ("Your turn") ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canRecognize = !!SR;
  let recognizer = null;
  let listening = false;

  function normalize(s) {
    return (s || "").toLowerCase().replace(/[^a-z ]/g, "").trim();
  }

  // Did the heard transcript contain (or closely resemble) the target word?
  function matches(heard, target) {
    heard = normalize(heard);
    target = normalize(target);
    if (!heard) return false;
    const words = heard.split(/\s+/);
    if (words.includes(target)) return true;
    // Accept close attempts (little mouths approximate sounds).
    return words.some((w) => similar(w, target));
  }

  function similar(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a[0] !== b[0]) return false;         // first sound should match
    return levenshtein(a, b) <= (b.length <= 4 ? 1 : 2);
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
    }
    return d[m][n];
  }

  function startListening(target, onResult) {
    if (!canRecognize) return false;
    stopListening();
    recognizer = new SR();
    recognizer.lang = "en-US";
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 5;
    listening = true;

    recognizer.onresult = (e) => {
      let hit = false;
      for (let i = 0; i < e.results.length; i++) {
        for (let j = 0; j < e.results[i].length; j++) {
          if (matches(e.results[i][j].transcript, target)) { hit = true; break; }
        }
      }
      onResult(hit);
    };
    recognizer.onerror = () => onResult(null); // null = couldn't hear
    recognizer.onend = () => { listening = false; };
    try { recognizer.start(); } catch (_) { return false; }
    return true;
  }

  function stopListening() {
    if (recognizer) {
      try { recognizer.stop(); } catch (_) {}
      recognizer = null;
    }
    listening = false;
  }

  // ---------- Home: build category grid ----------
  function buildHome() {
    renderStars();
    const grid = $("#categoryGrid");
    grid.innerHTML = "";
    allCategories().forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "cat-btn";
      btn.style.background = cat.color;
      const icon = document.createElement("span");
      icon.className = "cat-icon";
      icon.textContent = cat.icon;
      const name = document.createElement("span");
      name.className = "cat-name";
      name.textContent = cat.name;
      btn.appendChild(icon);
      btn.appendChild(name);
      if (cat.id === "custom") {
        const n = loadCustom().length;
        const count = document.createElement("span");
        count.className = "cat-count";
        count.textContent = n ? n + (n === 1 ? " word" : " words") : "tap to add";
        btn.appendChild(count);
      }
      btn.addEventListener("click", () => openCategory(cat));
      grid.appendChild(btn);
    });
  }

  function openCategory(cat) {
    state.category = cat;
    if (cat.id === "custom") cat.words = loadCustom();
    $("#modeCatIcon").textContent = cat.icon;
    $("#modeCatName").textContent = cat.name;
    // The "Add / Edit Words" card only makes sense for My Words.
    $("#editModeCard").style.display = cat.id === "custom" ? "flex" : "none";
    show("mode");
  }

  // ---------- Utility: shuffle ----------
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- Custom word editor ----------
  function openEdit() {
    renderCustomList();
    show("edit");
  }

  function renderCustomList() {
    const list = $("#customList");
    list.innerHTML = "";
    const words = loadCustom();
    if (!words.length) {
      const empty = document.createElement("p");
      empty.className = "custom-empty";
      empty.textContent = "No words yet. Add your first one above! 👆";
      list.appendChild(empty);
      return;
    }
    words.forEach((w, i) => {
      const row = document.createElement("div");
      row.className = "custom-row";
      const pic = document.createElement("span");
      pic.className = "custom-row-emoji";
      pic.textContent = w.emoji || "⭐";
      const label = document.createElement("span");
      label.className = "custom-row-word";
      label.textContent = w.word;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "custom-del";
      del.textContent = "🗑️";
      del.setAttribute("aria-label", "Delete " + w.word);
      del.addEventListener("click", () => {
        const cur = loadCustom();
        cur.splice(i, 1);
        saveCustom(cur);
        renderCustomList();
      });
      row.appendChild(pic);
      row.appendChild(label);
      row.appendChild(del);
      list.appendChild(row);
    });
  }

  function addCustomWord() {
    const emojiEl = $("#newEmoji");
    const wordEl = $("#newWord");
    const word = wordEl.value.trim();
    const emoji = emojiEl.value.trim();
    if (!word) { wordEl.focus(); return; }
    const words = loadCustom();
    words.push({ word: word, emoji: emoji || "⭐" });
    saveCustom(words);
    emojiEl.value = "";
    wordEl.value = "";
    renderCustomList();
    wordEl.focus();
    speak(word); // model the new word once so the grown-up hears it
  }

  // ---------- Share & sync (link carries the words in its #hash) ----------
  // The words live in the URL fragment, which never gets sent to any server,
  // so the list stays private to whoever holds the link.
  function encodeWords(words) {
    const json = JSON.stringify(
      words.map((w) => ({ w: w.word, e: w.emoji || "" }))
    );
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    // URL-safe base64 (no +, /, or = to survive being pasted anywhere).
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeWords(str) {
    try {
      let b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const arr = JSON.parse(new TextDecoder().decode(bytes));
      if (!Array.isArray(arr)) return [];
      return arr
        .map((o) => ({
          word: typeof o.w === "string" ? o.w.trim().slice(0, 40) : "",
          emoji: typeof o.e === "string" ? o.e.slice(0, 8) : "",
        }))
        .filter((o) => o.word)
        .slice(0, 300);
    } catch (_) {
      return [];
    }
  }

  function buildShareUrl() {
    return (
      location.origin + location.pathname + location.search +
      "#words=" + encodeWords(loadCustom())
    );
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for older browsers.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) {}
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  async function shareWords() {
    const msg = $("#shareMsg");
    const words = loadCustom();
    if (!words.length) {
      msg.textContent = "Add some words first! 👆";
      return;
    }
    const url = buildShareUrl();
    $("#shareLink").value = url;
    $("#shareBox").classList.add("show");
    msg.textContent = "";
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Words",
          text: "Open our Speak & Play words:",
          url: url,
        });
        return;
      } catch (_) {
        // Share sheet cancelled — the copyable link is still shown below.
      }
    } else {
      copyToClipboard(url).then(() => {
        msg.textContent = "Link copied! Paste it anywhere. 📋";
      });
    }
  }

  // ---------- Import shared words ----------
  let pendingImport = null;

  function clearHash() {
    if (history.replaceState) {
      history.replaceState(null, "", location.pathname + location.search);
    } else {
      location.hash = "";
    }
  }

  // Merge incoming words into the saved list, skipping ones we already have.
  function mergeCustom(incoming) {
    const cur = loadCustom();
    const have = new Set(cur.map((w) => w.word.trim().toLowerCase()));
    let added = 0;
    incoming.forEach((w) => {
      const key = w.word.trim().toLowerCase();
      if (!key || have.has(key)) return;
      have.add(key);
      cur.push({ word: w.word.trim(), emoji: w.emoji || "⭐" });
      added++;
    });
    saveCustom(cur);
    return added;
  }

  function renderImportPreview(words) {
    $("#importTitle").textContent =
      words.length === 1
        ? "Someone shared 1 word!"
        : "Someone shared " + words.length + " words!";
    const box = $("#importPreview");
    box.innerHTML = "";
    words.slice(0, 24).forEach((w) => {
      const chip = document.createElement("span");
      chip.className = "import-chip";
      const e = document.createElement("span");
      e.className = "chip-emoji";
      e.textContent = w.emoji || "⭐";
      const t = document.createElement("span");
      t.textContent = w.word;
      chip.appendChild(e);
      chip.appendChild(t);
      box.appendChild(chip);
    });
    if (words.length > 24) {
      const more = document.createElement("span");
      more.className = "import-chip";
      more.textContent = "+" + (words.length - 24) + " more";
      box.appendChild(more);
    }
  }

  // If the page was opened with a #words=... link, offer to import them.
  function checkImportFromUrl() {
    const m = location.hash.match(/[#&]words=([^&]+)/);
    if (!m) return false;
    const incoming = decodeWords(decodeURIComponent(m[1]));
    if (!incoming.length) {
      clearHash();
      return false;
    }
    pendingImport = incoming;
    renderImportPreview(incoming);
    show("import");
    return true;
  }

  function doImport() {
    if (!pendingImport) return show("home");
    const added = mergeCustom(pendingImport);
    pendingImport = null;
    clearHash();
    // Drop the grown-up into the My Words editor to see the result.
    state.category = customCategory;
    customCategory.words = loadCustom();
    $("#editModeCard").style.display = "flex";
    $("#modeCatIcon").textContent = customCategory.icon;
    $("#modeCatName").textContent = customCategory.name;
    openEdit();
    if (added > 0) {
      celebrate(added === 1 ? "Added 1 word!" : "Added " + added + " words!", "🎉", 0);
    } else {
      $("#shareMsg").textContent = "Those words were already saved. 👍";
    }
  }

  // ---------- SAY IT mode ----------
  function startSay() {
    if (state.category.id === "custom") state.category.words = loadCustom();
    if (!state.category.words.length) return openEdit();
    state.order = shuffled(state.category.words.map((_, i) => i));
    state.pos = 0;
    renderSay();
    show("say");
  }

  function currentWord() {
    return state.category.words[state.order[state.pos]];
  }

  function renderSay() {
    const w = currentWord();
    renderPicture($("#sayEmoji"), w);
    $("#sayWord").textContent = w.word;
    setFeedback("#sayFeedback", "", "");
    renderProgress("#sayProgress", state.order.length, state.pos);
    // Auto-model the word (and letter sound) when a new card appears.
    speak(sayText(w));
  }

  function renderProgress(sel, total, pos) {
    const box = $(sel);
    box.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const d = document.createElement("span");
      d.className = "dot" + (i < pos ? " done" : i === pos ? " current" : "");
      box.appendChild(d);
    }
  }

  function setFeedback(sel, text, cls) {
    const el = $(sel);
    el.textContent = text;
    el.className = "feedback" + (cls ? " " + cls : "");
  }

  function nextSay() {
    stopListening();
    if (state.pos < state.order.length - 1) {
      state.pos++;
      renderSay();
    } else {
      // Finished the set — big celebration, then reshuffle.
      celebrate("You finished them all!", "🏆", 3);
      state.order = shuffled(state.order);
      state.pos = 0;
      setTimeout(renderSay, 100);
    }
  }

  function onSpeakPressed() {
    const w = currentWord();
    const btn = $("#btnSpeak");
    if (!canRecognize) {
      // No recognition available — coach the grown-up path.
      setFeedback("#sayFeedback", "Say it together, then tap 😃", "try");
      speak(w.word);
      return;
    }
    if (listening) { stopListening(); resetSpeakBtn(); return; }

    setFeedback("#sayFeedback", "I'm listening… 👂", "try");
    btn.classList.add("listening");
    btn.textContent = "👂 Listening…";

    const started = startListening(w.word, (hit) => {
      resetSpeakBtn();
      if (hit === true) {
        wordSuccess();
      } else if (hit === false) {
        setFeedback("#sayFeedback", "So close! Try again 💪", "try");
        setTimeout(() => speak(w.word), 400);
      } else {
        setFeedback("#sayFeedback", "I didn't hear you. Try again! 🎤", "try");
      }
    });
    if (!started) { resetSpeakBtn(); setFeedback("#sayFeedback", "Tap 😃 when he says it!", "try"); }
  }

  function resetSpeakBtn() {
    const btn = $("#btnSpeak");
    btn.classList.remove("listening");
    btn.textContent = "🎤 Your turn";
  }

  function wordSuccess() {
    addStar(1);
    const cheers = ["Great job!", "Woohoo!", "You did it!", "Amazing!", "Perfect!", "Well done!"];
    const cheer = cheers[Math.floor(Math.random() * cheers.length)];
    setFeedback("#sayFeedback", cheer + " ⭐", "good");
    celebrate(cheer, "🎉", 1);
    setTimeout(nextSay, 1500);
  }

  // ---------- FIND IT mode ----------
  const findState = { target: null, tiles: [], round: 0, rounds: 6 };

  function startFind() {
    if (state.category.id === "custom") state.category.words = loadCustom();
    if (!state.category.words.length) return openEdit();
    findState.round = 0;
    nextFind();
    show("find");
  }

  function nextFind() {
    const words = state.category.words;
    const isLetters = state.category.id === "letters";
    const choiceCount = Math.min(4, words.length);
    const picks = shuffled(words).slice(0, choiceCount);
    findState.target = picks[Math.floor(Math.random() * picks.length)];
    findState.tiles = shuffled(picks);

    // Letters play as an uppercase→lowercase matching game: we show the
    // big UPPERCASE letter and the tiles are the little (lowercase) ones.
    $("#findPromptText").textContent = isLetters
      ? "Find the little letter!"
      : "Where is the…";
    $("#findTarget").textContent = isLetters ? findState.target.word : "";

    const grid = $("#findGrid");
    grid.innerHTML = "";
    findState.tiles.forEach((w) => {
      const tile = document.createElement("button");
      tile.className = "find-tile";
      if (isLetters) {
        tile.textContent = w.word.toLowerCase();
      } else {
        renderPicture(tile, w);
      }
      tile.setAttribute("aria-label", w.word);
      tile.addEventListener("click", () => onFindPick(w, tile));
      grid.appendChild(tile);
    });

    setFeedback("#findFeedback", "", "");
    renderProgress("#findProgress", findState.rounds, findState.round);
    setTimeout(() => speak(findState.target.word, { rate: 0.75 }), 350);
  }

  function onFindPick(w, tile) {
    if (w.word === findState.target.word) {
      tile.classList.add("correct");
      addStar(1);
      setFeedback("#findFeedback", "Yes! " + w.word + "! ⭐", "good");
      speak("Yes! " + w.word);
      celebrate("Yes!", "🌟", 1);
      findState.round++;
      setTimeout(() => {
        if (findState.round >= findState.rounds) {
          celebrate("You found them all!", "🏆", 3);
          findState.round = 0;
          setTimeout(nextFind, 200);
        } else {
          nextFind();
        }
      }, 1400);
    } else {
      tile.classList.add("wrong");
      setFeedback("#findFeedback", "Try again! 👀", "try");
      speak(findState.target.word, { rate: 0.75 });
      setTimeout(() => tile.classList.remove("wrong"), 500);
    }
  }

  // ---------- Celebration + confetti ----------
  const canvas = $("#confetti");
  const ctx = canvas.getContext("2d");
  let confettiPieces = [];
  let confettiRAF = null;

  function celebrate(text, emoji, starCount) {
    $("#celebrateText").textContent = text;
    $("#celebrateEmoji").textContent = emoji;
    $("#celebrateStars").textContent = "⭐".repeat(starCount);
    const box = $("#celebrate");
    box.classList.add("show");
    launchConfetti();
    setTimeout(() => box.classList.remove("show"), 1300);
  }

  function launchConfetti() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#ff9f1c"];
    confettiPieces = [];
    for (let i = 0; i < 120; i++) {
      confettiPieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.3,
        r: 5 + Math.random() * 7,
        c: colors[Math.floor(Math.random() * colors.length)],
        vx: -2 + Math.random() * 4,
        vy: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: -0.2 + Math.random() * 0.4,
      });
    }
    if (confettiRAF) cancelAnimationFrame(confettiRAF);
    const start = performance.now();
    function frame(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      confettiPieces.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.05;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
        ctx.restore();
      });
      if (now - start < 1400) {
        confettiRAF = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    confettiRAF = requestAnimationFrame(frame);
  }

  // ---------- Wire up buttons ----------
  function bind() {
    // Back buttons
    document.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => {
        stopListening();
        show(btn.getAttribute("data-go"));
      });
    });

    // Mode cards
    document.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        if (mode === "say") startSay();
        else if (mode === "find") startFind();
        else if (mode === "edit") openEdit();
      });
    });

    // Add-a-word form (My Words editor)
    $("#addWordForm").addEventListener("submit", (e) => {
      e.preventDefault();
      addCustomWord();
    });

    // Share & sync
    $("#shareBtn").addEventListener("click", shareWords);
    $("#copyLinkBtn").addEventListener("click", () => {
      const input = $("#shareLink");
      input.select();
      copyToClipboard(input.value).then(() => {
        $("#shareMsg").textContent = "Copied! 📋";
      });
    });

    // Import screen
    $("#importAddBtn").addEventListener("click", doImport);
    $("#importCancelBtn").addEventListener("click", () => {
      pendingImport = null;
      clearHash();
      show("home");
    });

    // Say It actions
    $("#btnListen").addEventListener("click", () => speak(sayText(currentWord())));
    $("#btnSpeak").addEventListener("click", onSpeakPressed);
    $("#btnSaidIt").addEventListener("click", wordSuccess);
    $("#btnNext").addEventListener("click", nextSay);

    // Find It listen-again
    $("#btnFindListen").addEventListener("click", () =>
      speak(findState.target.word, { rate: 0.75 })
    );

    window.addEventListener("resize", () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }

  // ---------- Go ----------
  buildHome();
  bind();
  // If opened via a share link, offer the import; otherwise start at home.
  if (!checkImportFromUrl()) show("home");
})();
