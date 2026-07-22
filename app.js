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
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo(0, 0);
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
    CATEGORIES.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "cat-btn";
      btn.style.background = cat.color;
      btn.innerHTML =
        '<span class="cat-icon">' + cat.icon + "</span>" +
        '<span class="cat-name">' + cat.name + "</span>";
      btn.addEventListener("click", () => openCategory(cat));
      grid.appendChild(btn);
    });
  }

  function openCategory(cat) {
    state.category = cat;
    $("#modeCatIcon").textContent = cat.icon;
    $("#modeCatName").textContent = cat.name;
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

  // ---------- SAY IT mode ----------
  function startSay() {
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
    $("#sayEmoji").textContent = w.emoji;
    $("#sayWord").textContent = w.word;
    setFeedback("#sayFeedback", "", "");
    renderProgress("#sayProgress", state.order.length, state.pos);
    // Auto-model the word when a new card appears.
    speak(w.word);
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
    findState.round = 0;
    nextFind();
    show("find");
  }

  function nextFind() {
    const words = state.category.words;
    const choiceCount = Math.min(4, words.length);
    const picks = shuffled(words).slice(0, choiceCount);
    findState.target = picks[Math.floor(Math.random() * picks.length)];
    findState.tiles = shuffled(picks);

    const grid = $("#findGrid");
    grid.innerHTML = "";
    findState.tiles.forEach((w) => {
      const tile = document.createElement("button");
      tile.className = "find-tile";
      tile.textContent = w.emoji;
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
      setFeedback("#findFeedback", "Yes! That's the " + w.word + "! ⭐", "good");
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
      speak("Find the " + findState.target.word, { rate: 0.75 });
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
        else startFind();
      });
    });

    // Say It actions
    $("#btnListen").addEventListener("click", () => speak(currentWord().word));
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
  show("home");
})();
