# Reel Rx Editor: Design

Status: design APPROVED 2026-11-09 (Opus). Not built. Decisions in section 8. Sharing plan (free Lite + paid packs) in section 9. Packs (L2, P2) and funnel copy (L6) written. Next: phase 1 on Sonnet; P4 printable + Flodesk wiring on Sonnet.
Companion to the Reel Rx skill + Gem (`iCloud › Systems with Jwo › AI Happy Hour Membership › aihh-reel-rx`),
which stay as the planning / "before you film" side.

Why this exists: the Reel Rx skill only *told* members what to cut. Jocelyn's test verdict: "it does not allow
any editing to happen." This is the actual editor.

---

## 1. What it does, in one breath

A member opens a web page, passes the Stoplight check, adds her clip(s). The page transcribes her speech **on her
device**. She sees her words as text under the video. **Tapping a word cuts that word's footage and audio.** The
page stitches what's left with clean transitions, burns in captions and hook text, and exports a 9:16 MP4 ready
for Instagram. An AI helper (Claude) reads the *transcript only* and suggests cuts, hooks, on-screen text and the
post caption; she accepts or rejects each one.

Target: 60-second raw clip → posted reel in about 10 minutes, on a laptop. Phone: see D3.

## 2. Principles

- **P1. The video never leaves her device.** Transcription, cutting, rendering: all in the browser. The only thing
  that can leave is transcript *text*, and only for the AI step, and only after she sees exactly what will be sent.
  (Same "exact-send preview" idea as the Eval Writer import.)
- **P2. The AI suggests, she decides.** No AI edit is applied silently. Suggestions show as highlights with ✓ / ✕.
- **P3. Works with no API key and no new subscription.** The whole editor works without AI. The AI step works
  through the Claude or Gemini chat members already pay for (D9). An API key is an optional shortcut.
- **P4. Stoplight first, always.** Same 7-item check as the skill, before any clip is added. Red blocks import.
- **P5. Small, honest v1.** Cuts, transitions, captions, hook text, export. Not a full editor. Music, effects and
  b-roll layering happen in Edits afterward if she wants them.

## 3. Decisions

**D1. Platform: one static web app.** Vite + TypeScript + Preact (small, fast on phones). Hosted as static files;
no server, no database, no accounts in v1. Lives in `~/Code/reel-rx-editor` (code repos go in ~/Code). Linked
from the AIHH resource library. Needs two security headers (COOP/COEP) so the in-browser engines can use multiple
threads; set in the host's config. **Host: Cloudflare Pages** (free, static; headers via a `_headers` file). **Address: `reelrx.jocelynmwood.com`** (decided 2026-11-09). jocelynmwood.com's DNS is on Vercel (ns1/ns2.vercel-dns.com), so: add the custom domain in Cloudflare Pages, then add a CNAME `reelrx` → `<project>.pages.dev` in Vercel → Domains → jocelynmwood.com → DNS. The explicit record overrides Vercel's catch-all. The main site stays on Vercel. Jocelyn runs
no server and holds no keys.

**D2. Transcription: on-device Whisper with word timestamps.** Library: Transformers.js (Hugging Face) running a
Whisper model with word-level timestamps. The model downloads once (~40-80 MB, cached after), then works offline.
- Default model: `whisper-base` (English), quantized, **laptops only**. **Phones: `whisper-tiny` only** (tested 2026-11-10 on Jocelyn's iPhone: tiny.en transcribed in 8 s; base.en crashed Safari out of memory). `whisper-small`
  offered on laptops for better accuracy.
- Runs in a background worker so the page doesn't freeze. Progress bar says "On your device. Nothing uploaded."
- Uses the CPU path (WASM) by default; uses the GPU path only where word timestamps are confirmed to work on it
  (as of 2026-11 they're unreliable on the GPU path, and Safari's GPU support is patchy). Phase 1 measures both.
- **Known Whisper quirk: it quietly drops "um", "uh" and some restarts.** So fillers can't rely on being words.
  D4 finds them from the audio instead.
- Clinical words it gets wrong (apraxia, frenectomy...) are fixed by a local spelling list (from the skill's
  `plain-language.md`) plus her own word list, plus the AI step. Fixes change the captions, not the cuts.

**D3. Laptop first (decided).** v1 is built and tested for laptop browsers (Chrome, Safari, Edge). Phone support is
a later upgrade, only if it passes the test below. Transcribing on an iPhone's CPU is the biggest unknown. Phase
1 measures it on Jocelyn's phone.
- Gate: a 60-second clip transcribes in ≤ 2 min and exports in ≤ 2 min on her phone → phone is supported.
- If it fails: v1 says "best on a laptop" (AirDrop the clip over), and phones get a short-clip mode (≤ 30 s,
  tiny model). A cloud transcription option is a v2 idea (it would send *audio*, which breaks P1, so it would
  need its own opt-in and design).

**D4. The transcript is the timeline.** Data model:
- `Word { id, clipId, text, start, end, cut: boolean }`. Timestamps from Whisper.
- `Gap { id, clipId, start, end, kind: 'pause' | 'filler' }`: found locally from the audio:
  - **pause** = a gap between words longer than 0.4 s (adjustable).
  - **filler** = a gap where there IS sound but no word (where Whisper dropped an "um"). Shown as a grey `um?`
    chip. Detected with a simple loudness check on the audio, no AI.
- Gaps show inline in the transcript as small chips (`· 1.2s ·`, `um?`), tappable like words.
- **Kept segments** are computed, never stored: walk the words + gaps in order, merge runs of kept items into
  segments `{ clipId, in, out }`. Drop segments shorter than 0.25 s (stray syllables).
- **Cut snapping:** Whisper's word edges are off by up to ~0.1-0.2 s. Every cut edge snaps to the quietest point
  within ±150 ms, plus a small pad (40 ms) so words don't get clipped. This is what makes cuts sound clean.
- Multiple clips (she filmed in takes): clips are added in order and their transcripts appear one after another
  with a clip divider. Reordering clips = drag the divider. Reordering sentences inside a clip = v2.

**D5. Tapping words (the core interaction).**
- **Tap a word** → cut (strikethrough + faded). Tap again → restore.
- **Tap a first word, then a last word** → "Cut these 23 words?" one-tap confirm. (Phones can't drag-select text
  well; tap-tap range is easier for thumbs.) Laptop: click-drag also works.
- **"Remove pauses"** button: cuts every pause over the threshold. **"Remove um's"**: cuts every `um?` chip.
  Both are one action each, undoable.
- **Undo / redo** always visible. Every change autosaves on the device.
- **Preview** plays the edit live: the video player skips over cut ranges as it plays, and the current word
  highlights as it's spoken. Tapping a word while paused jumps the video there. Preview shows transitions
  approximately; the export is exact.
- Where a cut happens, a small **✂︎ marker** sits between the remaining words. Tap it to change that cut's
  transition (D6).

**D6. Transitions between clips.** Every place footage was removed is a join. Each join gets a transition:

| Transition | What it looks like | Auto-used for |
|---|---|---|
| **Smart punch-in** (default) | Hard cut, but the shot alternates between normal and ~110% zoom, so the jump looks intentional. | Cuts inside the same take (talking head) |
| **Crossfade** | 0.25 s dissolve between the two shots | Joins between different clips/takes |
| **Dip to white** | 0.3 s fade through white | Optional, a "new section" feel |
| **Slide** | 0.25 s push left | Optional, behind-the-scenes montages |
| **Hard cut** | Straight cut, no zoom | Optional |

- **Audio always gets a micro-fade** (~30 ms) at every join, so there are no clicks or pops, whatever the
  picture transition.
- Global setting: "Transition style: Smart (recommended) / Crossfade everything / Hard cuts". Per-join
  override via the ✂︎ marker.
- Crossfade, dip and slide overlap the two shots, so they shorten the video slightly; the timeline math accounts
  for it (D8). Punch-in and hard cut don't change length.
- Punch-in zoom centers on her face if the AI-free face-center option is on (v1.1, browser face detection),
  otherwise center-frame with a slight upward bias (talking heads sit high in frame).

**D7. Captions and text.**
- **Burned-in captions** built from the *kept* words, re-timed to the edited video. 1-2 lines, ~30 characters a
  line, big, high contrast, positioned in Instagram's safe zone (clear of the bottom fifth and right edge).
- 3 caption styles: **Clean** (white, dark outline), **Box** (white on a dark rounded box), **Pop** (current word
  highlighted in her brand color). Font + color picked once and remembered.
- **Hook text:** big text over the first ~2 seconds. **On-screen text cards:** each anchored to a word, so if she
  cuts around it, it moves with the words. 3-7 words each (soft warning past 7).
- Captions can be turned off (if she'd rather use Edits' captions or none).

**D8. Export.**
- Renders frame by frame in the browser: decode → draw on a canvas (cut, zoom, transition, captions, text) →
  encode with the device's built-in video encoder → package as MP4. Library: **Mediabunny** (browser media
  toolkit built on the WebCodecs API), with its **AAC audio add-on** for browsers (Safari) that can't encode AAC
  audio themselves.
- Output: 1080×1920, 30 fps, H.264 video + AAC audio. Instagram-ready.
- Source clips that are landscape: auto-crop to 9:16 centered (drag to reposition) or letterbox with a blurred
  background.
- Timeline math: output time = sum of kept segment lengths − transition overlaps. Captions and text are re-timed
  through the same mapping.
- Progress bar + "keep this tab open". Then: **Download video**, **Copy post caption**, and the Last Look checklist
  (sound-off watch, hook in 2 s, Stoplight on the final, length).

**D9. The AI component: "Rx it" (Claude reads the transcript, not the video).**

What the AI does (all from the transcript text, with word numbers):
1. **Tighten:** suggests cuts: slow intro, restarts, repeated sentences, the sign-off, tangents. Each with a
   one-line reason. Shows as yellow highlights; ✓ accepts (cuts those words), ✕ dismisses. "Accept all" too.
2. **Hook:** 3 hook-text options for the first 2 seconds. If the best opening line is buried, it says "Start
   here" and offers to cut everything before it.
3. **On-screen text:** 2-4 text cards anchored to specific words.
4. **Spelling fixes:** clinical words Whisper misheard ("a praxia" → "apraxia"). Changes captions only.
5. **Safety scan:** flags possible client names, age + diagnosis combos, school names, and outcome promises
   (the skill's claims check) on the exact words, with a suggested fix. Flags can't be dismissed silently: she
   picks "cut it", "it's fine (not a client)" or "edit the caption".
6. **Post caption:** in her voice, one call to action, up to 5 hashtags.

What gets sent: the transcript as numbered words (`[0] Stop [1] asking [2] your...`) + reel type + audience +
her voice notes. **No video, no audio, no file names.** Before sending, the page shows the exact text in a box
and runs a local name check (capitalized words that aren't at a sentence start, not on a common-words list,
not her own name/practice) and highlights them: "Is any of this a client's name?"

How she runs it (decided: **her own API key**; Jocelyn hosts nothing and pays nothing per reel):

- **Fallback A. Through her own Claude or Gemini chat** (for members without a key; costs nothing extra to build,
  since it uses the same edit code). Button: **"Copy for Reel Rx."** It copies
  the numbered transcript with a short instruction. She pastes it into Claude (with the Reel Rx skill on) or her
  Reel Rx Gem. The AI answers with a block of **Reel Rx edit code** (JSON in a code block). She taps
  **"Paste edit code"** and the suggestions appear in the editor. The skill and Gem get a new step that knows
  this format (phase 3).
- **Main path B. With her own Claude API key (one tap, ~1-2¢ a reel).** Settings → paste a Claude API key (stored on her device only,
  like the Eval Writer). Then "Rx it" runs right in the page. Model: **Claude Sonnet 5.5** ($2 / $10 per million
  tokens): plenty for this, and her credit rule says cheapest model that holds quality. Uses structured outputs
  so the edit code always matches the format, and the server-side refusal fallback. A 60-second reel ≈ 4K
  tokens in, 1.5K out ≈ 2¢.
- (C. Jocelyn pays and members just tap: **ruled out**, she won't host. Needs a small server holding her key, member logins and a spending
  cap. Not v1. Revisit if A turns out to be too fiddly for members.)

**Edit code format** (same for A and B; validated on paste, with a friendly error if it's mangled):
```json
{
  "version": 1,
  "cuts":    [{ "from": 0, "to": 14, "reason": "slow intro + restart" }],
  "startHere": 15,
  "hooks":   [{ "text": "Stop asking 'what's this?'", "best": true }],
  "textCards": [{ "atWord": 31, "text": "Say what you see" }],
  "fixes":   [{ "word": 52, "to": "apraxia" }],
  "flags":   [{ "from": 40, "to": 44, "kind": "name|identifying|claim", "note": "...", "suggest": "..." }],
  "postCaption": "...",
  "hashtags": ["#toddlertalk"]
}
```
Word numbers refer to the transcript she copied. If she edited words after copying, the editor warns and
matches by text where it can.

**D10. Saving.** Projects autosave on the device (browser storage: the clip itself in the browser's private file
storage, the edit as a small record). "My reels" list on the start screen. Nothing syncs between devices in v1.
Clear notice: "Saved on this device only."

**D10b. API key setup (members).** The guide + a first-run screen walk her through: make an account at the
Claude Console, add $5 of credit, **set a monthly spend limit** (e.g. $5), create a key, paste it into Reel Rx.
The key is stored on her laptop only, sent only to Anthropic, never to Jocelyn. "Remove key" button. The page shows
roughly what each Rx it costs.

**D11. Branding.** AIHH / Systems with Jwo look, Reel Rx name and 🩺 mark. Copy in Jocelyn's voice (short, warm,
no jargon), reusing the skill's wording for the Stoplight and the Last Look. Built so a client version is a
config swap (name, colors, logo, caption-style defaults), the same idea as the client factory's `brand.json`.

## 4. Screens

1. **Start:** "My reels" + **New reel**. First visit: 20-second "how it works".
2. **Stoplight:** the 7 items, tick what's true. Red → stop + "plan it differently" tips (links to the Reel Rx
   skill/Gem for planning). Yellow → fixes shown, "Got it" to continue. Green → continue.
3. **Add clips:** pick from camera roll / files. Landscape → crop choice. Transcription progress.
4. **Edit** (the main screen):
   - Top: 9:16 preview with play/pause and the edited length ("0:27 · was 0:48").
   - Middle: toolbar: Undo · Redo · Remove pauses · Remove um's · Transitions · Rx it.
   - Bottom: the transcript. Words, gap chips, ✂︎ markers, clip dividers, AI highlights.
   - On a laptop: preview left, transcript right.
5. **Rx it panel** (slides up): send preview + name check → Copy for Reel Rx / Run with my key → results as cards
   (Tighten, Hook, Text, Fixes, Safety, Caption), each with ✓ / ✕.
6. **Style:** caption style, font/color, hook text, text cards list, crop.
7. **Export:** progress → download → copy caption → Last Look checklist.

## 5. Out of scope for v1

Music (add in Edits: licensing), b-roll layering or picture-in-picture, filters/effects, reordering sentences,
multi-device sync, team accounts, direct posting to Instagram, cloud transcription, video longer than ~3 minutes
(warn above 3 min; phones may run out of memory).

## 6. Risks and how phase 1 tests them

| Risk | Test in phase 1 | If it fails |
|---|---|---|
| Phone transcription too slow | 60 s clip on her iPhone, tiny + base models, time it | Laptop-first + short-clip phone mode (D3) |
| Word timestamps too loose for clean cuts | Cut 10 words mid-sentence, listen | Tune snapping/padding (D4); try a timestamp-tuned Whisper variant |
| Fillers not detected | Clip with 5 deliberate "um"s | Raise/lower loudness threshold; manual `um?` marking |
| Export fails or is slow on Safari | Render 60 s with 6 cuts, 1 crossfade, captions, on iPhone + Mac Safari + Chrome | AAC add-on; drop to 720p on phones; laptop-only export |
| Phone memory runs out | 3-minute clip on iPhone | Cap clip length on phones |
| Instagram rejects or degrades the file | Upload the exported MP4 to IG (drafts) | Adjust bitrate/profile |
| Members find copy-paste AI fiddly | Phase 4 member test | Build option C |

## 7. Build phases and models (her standing rule)

| Phase | What | Model | Switch |
|---|---|---|---|
| 0. Design (this doc) | Decisions, screens, risks | **Opus** | done after her answers |
| 1. Feasibility spike | Bare test page: transcribe, cut, crossfade, caption, export. Run the section 6 tests on her phone + laptop. Go/no-go on D3 | **Sonnet** | "Switch to Sonnet now" once Q1-Q4 are answered |
| 2. Core editor | Screens 1-4, 6, 7: transcript editing, gaps, snapping, transitions, captions, export, saving | **Sonnet** | stay |
| 3. AI | Edit-code format, prompts, "Rx it" panel, skill + Gem update for edit code. Prompt + voice writing on **Opus**, wiring on Sonnet | **Opus**, then **Sonnet** | switch to Opus at the start of 3, back to Sonnet for wiring |
| 4. Polish + member test | Branding, onboarding, guide update, 2-3 AIHH members test | **Sonnet** | |

Rough size: phase 1 = 1-2 sessions, phase 2 = 3-4, phase 3 = 2, phase 4 = 1-2.

## 8. Decisions (Jocelyn, 2026-11-09)

- **Q1 Hosting:** Cloudflare Pages.
- **Q2 AI:** members add their own Claude API key. Jocelyn hosts no server and holds no keys. (Copy-paste via
  Claude/Gemini chat kept as a no-key fallback; same edit code.)
- **Q3:** laptop first.
- **Q4:** multiple clips in v1.

## 9. Sharing: Reel Rx Lite (free) + Practice Packs (paid)

Added 2026-11-09 (Opus). Jocelyn chose ideas 1 + 2: a free public editor as a lead magnet, and paid profession
packs. Her AI Club: she confirmed no conflict for the paid packs. Clean-room rule D1 still applies while building.

**D12. Profession packs.** Everything profession-specific is a data file (`.reelrx`, JSON), never code. The
editor ships with one built-in free pack. "Add a pack" imports a paid one, stored on the device like projects (D10).
```json
{
  "packVersion": 1,
  "id": "slp-practice",
  "name": "SLP Practice Pack",
  "profession": "slp",
  "tier": "free | paid",
  "spelling":  [{ "heard": ["a praxia", "apraxia's"], "write": "apraxia" }],
  "claims":    [{ "phrase": "cure", "why": "outcome promise", "try": "support" }],
  "stoplightExtras": [{ "id": "materials", "text": "No therapy materials showing a client's name", "level": "yellow" }],
  "reelTypes": [{ "id": "myth", "name": "Myth buster", "beats": ["myth", "truth", "one tip", "CTA"] }],
  "hooks":     [{ "reelType": "myth", "text": "Stop asking your toddler 'what's this?'" }],
  "captionDefaults": { "style": "pop", "hashtags": ["#toddlertalk"] },
  "endCard": true
}
```
- Fields, as built in `packs/` (2026-11-09): `kind` (`base` = one active at a time, starter or a paid pack;
  `addon` = stacks on top, e.g. the free hooks), `spelling` (`write`, optional `heard` variants matched
  case-insensitively as whole words, `ask: true` = suggest, don't auto-fix, for real words like "prompt" or
  "fees"), `claims` (`kind`, `match` phrases with `#` = any number, `why`, `try`), `stoplightExtras` (`id`,
  `text`, `level`, `fix`), `reelTypes` (`id`, `name`, `length`, `bestFor`, `beats`, `note`), `hooks` (`reelType`,
  `audience`: parents / referral / clinicians, `text`), `swaps` (clinical term → parent words: a "jargon check"
  for parent-audience reels), `careLines` (not-medical-advice lines), `captionPresets`, `hashtagSets` (≤ 5 tags;
  `{town}` is filled from her brand kit, dropped if blank), `notice`, `license`.
- `packs/build_packs.py` builds all three files from one source and checks them: hooks ≤ 10 words, no hook
  trips its own claims check, ≤ 5 hashtags a set, no duplicate ids. Edit the script, not the JSON.
- Spelling feeds the caption fixes (D2), claims feed the safety scan (D9 #5), Stoplight extras get added to the
  7 items (P4: they can add checks, never remove them), hooks feed the Hook step and a "Need a hook?" list.
- The AI step sends the pack's claims + spelling + reel type with the transcript (pack text only, about 0.5K more
  tokens). No client data comes from a pack.
- Imported packs are untrusted data: validate against the schema, show all text as text (never HTML), cap the size.
- **Brand kit stays separate:** her colors, font, logo and end-card handle are saved on the device, not in a
  pack. A pack can't override her brand.
- Lock honesty: a static app can't enforce payment. The pack's content is the product (like a template shop).
  `endCard: false` in paid packs is an honor-system perk.

**D13. End card (free tier).** The last 1.5 s of every export from the free pack: "Edited with Reel Rx ·
@systemswithjwo" over her brand color. With a paid pack loaded it's off by default, and she can turn it back on.

**D14. Reel Rx Lite funnel (decided 2026-11-09).**
- **The editor is open:** no email needed to use it. The built-in SLP Starter pack has no hooks.
- **Email gets the hooks:** a "Need a hook?" button in the editor (and on the landing page) → Flodesk form
  (name, email, **profession**: SLP / OT / PT / other) → segment "Reel Rx Lite" → welcome email with
  `slp-hooks-free.reelrx` (10 hooks) + a printable of the same 10.
- The profession field decides which paid pack gets written next.
- Nurture: 3 emails (first reel walkthrough → "how to use your 10 hooks" → Practice Pack offer + AIHH).
- Export screen shows one quiet line: "Want 50 hooks and the full claims check? Get the SLP Practice Pack."
- Free hooks are public at `reelrx.jocelynmwood.com/hooks` (the `.reelrx` file + printable); that's fine, the gate is soft.
  **The paid `slp-practice.reelrx` is never put in the site's public folder.** It's only delivered by Flodesk Checkout.
- **Practice Pack: $27, one-time, sold through Flodesk Checkout** (delivers the `.reelrx` file + printable).
- AIHH members get every pack free (member library download).

**Free vs paid:**

| | Lite (free) | Practice Pack (paid, one-time) |
|---|---|---|
| Editor, cuts, transitions, captions, export, AI with own key | ✓ | ✓ |
| Pack | SLP Starter (built in) | Profession-specific file |
| Spelling list | 48 entries | 235 entries |
| Claims check | 8 groups, 51 phrases | 21 groups, 112 phrases (adds superlatives, credentials, causation, tongue tie, insurance, stats, hype, scope) |
| Hooks | 10, by email | 50, sorted by reel type and audience |
| Reel types | 3 | 6 (adds Do this not that, Hands-only demo, For teachers & pediatricians) |
| Stoplight extras | 2 (materials, AAC device) | 6 (adds video call screen, background voice, forms, school) |
| Plain-language swaps | 10 | 40 |
| Not-medical-advice lines | 1 | 4 |
| Caption presets + hashtag sets | 1 + 1 | 3 + 6 |
| End card | on | off (her choice) |
| Printable hook bank + brand kit setup guide | | ✓ |

### Plan: Lite (build order)

| Step | What | Model | Needs the editor? |
|---|---|---|---|
| L1 | This section (D12-D14) | Opus | no (done) |
| L2 | `packs/slp-starter.reelrx` + `packs/slp-hooks-free.reelrx` | Opus | no (done 2026-11-09) |
| L3 | Phase 1 spike (section 7) | Sonnet | |
| L4 | Phase 2 core editor + pack loader + "Add a pack" + brand kit + end card | Sonnet | |
| L5 | Phase 3 AI: prompt reads the pack | Opus, then Sonnet | |
| L6 | Funnel copy DONE 2026-11-09: iCloud › Systems with Jwo › AI Happy Hour Membership › aihh-reel-rx › funnel/reel-rx-lite-funnel-copy.md (landing page, editor text, E1-E4, Flodesk Checkout + delivery email). Wiring (Flodesk form + segments + workflow, page) still to do | Opus copy (done), Sonnet wiring | copy no, launch yes |
| L7 | 2-3 SLP testers → public launch; launch carousels via carousel-copywriter | Sonnet | yes |

### Plan: Practice Packs (build order)

| Step | What | Model | Needs the editor? |
|---|---|---|---|
| P1 | Lineup + price: SLP Practice Pack first, $27 via Flodesk Checkout; next pack picked from Lite form data | decided | no |
| P2 | `packs/slp-practice.reelrx` | Opus | no (done 2026-11-09) |
| P3 | Pack import + validation: built in L4 | Sonnet | |
| P4 | Printable hook bank + "load your pack" + brand kit guide (SwJ brand visuals) | Sonnet | no |
| P5 | Flodesk Checkout product ($27) + delivery email; AIHH member access | Sonnet | no (can presell) |
| P6 | Upsell spots: export screen line (L4), nurture email 3 (L6) | Sonnet | |
| P7 | Next packs (OT, PT...) from form data, one Opus session each | Opus | |

Fewest model switches: one Opus session now for L2 + P2 + L6 copy (all writing), then Sonnet for L3-L4 + P4-P5,
Opus/Sonnet for L5 as section 7 says, Sonnet for L7.
