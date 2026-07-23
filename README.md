# Speak & Play 🌟

A gentle, colorful speech-practice game for little kids (built with a 4-year-old
in mind). Pick a group of words, and your child can **hear each word**, **say it
back**, and **earn stars** — or play a **Find It!** picture-matching game.

It's a single static web app: no accounts, no build tools, no installs. It runs
entirely in the browser and works great on a phone or tablet.

👉 **Live site:** once GitHub Pages is on (see below), it lives at
`https://<your-username>.github.io/<repo-name>/`

## How to play

1. **Pick a category** on the home screen (ABC, 123, Counting, Animals, Food, …).
2. **Choose a game:**
   - **🎤 Say It!** — A big picture appears and the app says the word.
     - Tap **🔊 Listen** to hear it again (nice and slow).
     - Tap **🎤 Your turn** and let your child say the word. If the app hears it,
       you get confetti and a ⭐.
     - No microphone or quiet moment? Tap **😃 He said it!** to give the star, or
       **Next ➡️** to move on.
   - **🔍 Find It!** — The app names a word; your child taps the matching picture.
     Great for building understanding even before speech comes.
3. **Collect stars** ⭐ — they're saved on the device and shown at the top.

### Learning extras

- **ABC** teaches **letter sounds** — the app says the letter *and* its sound
  ("A. A says aah."). In **Find It!**, ABC becomes an **uppercase → lowercase
  matching game**: a big `A` appears and your child taps the little `a`.
- **Counting** shows a group of objects (🐟🐟🐟) so your child can count them
  and say **how many** — great early number sense to go with the **123**
  numerals.
- **My Words 💛** is your own custom category. Tap it, then **Add / Edit Words**
  to add the words your child loves — names, pets, favorite foods, toys. Tap the
  picture box and use your keyboard's emoji 😀 button to pick a picture, type the
  word, and press **Add**. They're saved on the device and play in both **Say
  It!** and **Find It!** just like the built-in words. Tap 🗑️ to remove one.
- **Sync across devices with a link.** In **My Words → Add / Edit Words**, tap
  **🔗 Share my words**. On a phone/tablet this opens the normal share sheet
  (Messages, AirDrop, email…); everywhere it also shows a **copyable link**.
  Open that link on another device and you'll get a friendly **"add these
  words?"** screen — tap **Add to My Words** and they're merged in (duplicates
  are skipped). The words travel inside the link's `#` fragment, which is never
  sent to any server, so your list stays private. Re-share after adding new
  words to sync again.

## Tips for grown-ups

- **Model first, then wait.** Let the app (or you) say the word, then give your
  child a few seconds. Praise every attempt — the goal is trying, not perfection.
- The recognizer is **forgiving on purpose** — close attempts still count, so
  little ones stay encouraged.
- Keep sessions short and fun (a few minutes). Follow your child's lead.
- This is a practice-and-play tool, **not a substitute** for a licensed
  speech-language pathologist. If you have concerns about your child's speech,
  talk to your pediatrician or an SLP.

## Browser notes

- **Hearing words (text-to-speech)** works in essentially every modern browser.
- **Listening to your child (speech recognition)** works best in **Chrome** (and
  Chrome on Android). On browsers without it — including iPhone/iPad Safari — the
  game automatically falls back to the **😃 He said it!** button, so nothing
  breaks.
- The first time, the browser will ask for **microphone permission** — tap Allow.
- Best experience: use it **over HTTPS** (which GitHub Pages provides). The mic
  only works on secure pages.

## Turning on GitHub Pages

This repo is ready to publish two ways — pick whichever you like:

**Option A — Deploy from a branch (simplest):**
1. Go to your repo → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Pick the branch that has these files and the `/ (root)` folder, then **Save**.
4. Wait a minute, then open `https://<your-username>.github.io/<repo-name>/`.

**Option B — GitHub Actions (already set up):**
A workflow at `.github/workflows/deploy.yml` will build and publish the site
automatically on every push. Just set **Settings → Pages → Source** to
**GitHub Actions** once, and every future push deploys for you.

## Making it your own

- **Add words:** edit `words.js`. Each word is `{ word: "dog", emoji: "🐶" }`.
- **Add a category:** copy one of the blocks in `words.js`, give it an `id`,
  `name`, `icon`, `color`, and a list of `words`.
- No rebuild needed — just save and refresh (or push to redeploy).

## Files

| File | What it does |
|------|--------------|
| `index.html` | Page structure / screens |
| `styles.css` | Big, kid-friendly styling |
| `app.js`     | Game logic, speech, stars, confetti |
| `words.js`   | The words and pictures (edit me!) |

Made with ❤️ for early talkers.
