# Maintainer guide

**For the next person updating the Neko Burglars Top 200 site.**

This repository is the publishable static site, not the private data workspace. The
raw Instagram export, the SQLite database, and the feature files are intentionally
kept out of the repo. The site is generated from those files; `data.js`,
`top200.json`, and `top200.csv` are build artifacts.

> **Do not hand-edit `data.js`, `top200.json`, or `top200.csv` for a normal data
> update.** They will be overwritten by the next build. Fix the build script or
> the source data instead.

---

## 1. What lives where

### This repo

| Path | Purpose |
| --- | --- |
| `index.html` | Page shell, hero copy, fallback counts, footer |
| `styles.css` | Theme, responsive layout, profile-dialog styling |
| `app.js` | Search, sorting, filters, profile dialog, rendering |
| `data.js` | Generated 200-person dataset (`window.CHAT_META`, `window.CHAT_USERS`) |
| `top200.json` | Full generated export |
| `top200.csv` | Spreadsheet-friendly export (UTF-8 BOM, for Excel) |
| `.nojekyll` | Tells GitHub Pages to serve the files directly |
| `README.md` | Public project summary |
| `MAINTENANCE.md` | This guide |

### Private build workspace

A typical workspace looks like this:

```text
neko-work/
├── chat_data/
│   └── message_*.json          # extracted Instagram thread export
├── neko_burglars.db            # SQLite database
├── user_characteristics.csv    # per-user activity/social metrics
├── report.md                   # data-quality report
├── style_features_debug.json   # extracted writing-style features
├── analyze_chat.py             # export -> SQLite DB + metrics
├── style_analysis.py           # DB -> style_features_debug.json
├── build_site.py               # DB + features -> site/data.js + exports
├── build_profiles.py           # optional long-form Markdown document
├── how_each_person_talks.md    # optional generated document
└── site/                       # this repository
```

The Python pipeline uses only the standard library. The site itself has **no build
step, framework, package manager, or network dependency**.

If you take over and do not have the private workspace, ask the previous maintainer
for it. Do not reconstruct message data from the published site; the site only
contains aggregate stats and filtered signature terms.

---

## 2. Data contract

`data.js` is the contract between the build and the front-end. It contains:

```js
window.CHAT_META = {
  totalMessages, topMessages, textMessages, topTextMessages,
  rankedVoices, allPosters, days, range, generated
};
window.CHAT_USERS = [ /* exactly 200 records */ ];
```

Each user record includes, at minimum:

```text
id, rank, name, display_name, character, tagline, voice, tags,
messages, share, active_days, msgs_per_day, text_lines, words,
avg_words, median_words, one_liner_pct, lower_pct, caps_pct,
term_pct, quest_pct, emoji_per, laugh_per_100, reactions_received,
reactions_given, peak_hour, peak_weekday, night_share_pct,
top_emojis, signature_words, signature_phrases, hourly[24],
radar{volume,brevity,emoji,questions,reactions,media}
```

Important rules:

- `rank` is 1-based, ordered by **total messages** (`messages`). Ties are broken
  alphabetically by the raw export name.
- `name` is the raw Instagram display name. `display_name` is the simplified name
  used in the UI. Keep both: the raw name belongs in exports; the display name is
  for readability.
- `messages` counts all message rows. `text_lines` counts only conversational
  text after system notices and media-only rows are removed. Do not compare them
  as if they were the same measure.
- `share` is the percentage of **all** messages in the export, not the top-200
  subset.
- `hourly` always has 24 values, in UTC. `peak_hour` is UTC.
- `radar` values are 0–100 scores for the profile chart.
- `signature_words` and `signature_phrases` are log-odds terms with names, system
  text, slurs, profanity, and sensitive identity/nationality terms filtered out.
  Do not remove those filters to make a profile look more interesting.
- `top200.csv` uses a UTF-8 BOM and joins signature lists with `; `.

If you add a field, update all of these together:

1. `build_site.py` (record construction and CSV field list)
2. `app.js` (only if the UI should use it)
3. `top200.json` / `top200.csv` generation
4. This guide, if the field is part of the maintenance contract

---

## 3. Privacy and editorial rules

These are not optional style preferences:

- **Never commit** `chat_data/`, `neko_burglars.db`, `style_features_debug.json`,
  `user_characteristics.csv`, `report.md`, or the long-form
  `how_each_person_talks.md`. They can contain raw messages or unfiltered terms.
- The public site may publish display names, aggregate counts, typing habits,
  filtered signature terms, and short common phrases. Do not add raw message
  transcripts, private media, links, or identifying personal details.
- “Chat character” and “voice” describe **observable typing habits**, not
  personality, mental health, attractiveness, or identity.
- Do not print slurs or profanity in signature terms. Rates are acceptable;
  quoted terms are not.
- Do not infer someone’s gender, nationality, ethnicity, religion, or age from
  their messages or name.
- If a participant asks to be removed, exclude their user ID before ranking and
  rebuild. Removing a row from `data.js` alone is not enough; it will come back on
  the next build.
- The export starts mid-conversation and cannot tell whether two accounts are the
  same person. Do not silently merge or split identities by display name.

Current known quirks:

- `Instagram User` is a merged display name covering two accounts. It is one row
  in the ranking, not one confirmed person.
- `🐧` is also a duplicate/merged display name.
- Decorative and rare-script characters are simplified in the UI. Raw names stay
  in `top200.json` and `top200.csv`.
- Small samples are noisy. Fewer than 10 conversational lines gets a “Cameo”
  label, not a style verdict.
- `current_member` comes from the export and may not reflect the group’s actual
  membership.

---

## 4. Update pipeline

Run these from the **private workspace**, not from the repo directory.

### Step 0 — Get a fresh export

Replace `chat_data/message_*.json` with the new Instagram thread export. The
current pipeline expects files named `message_*.json`; if the export uses a
different naming scheme, update the glob in `analyze_chat.py`.

### Step 1 — Rebuild the database and per-user metrics

```bash
python3 analyze_chat.py
```

This rewrites:

- `neko_burglars.db`
- `user_characteristics.csv`
- `report.md`

Check the console summary: message count, user count, reaction count, and top 10.
If those look wrong, stop and inspect the export before building the site.

### Step 2 — Re-extract writing-style features

```bash
python3 style_analysis.py
```

This rewrites `style_features_debug.json` and prints style diagnostics for the top
25 users. It reads the database from step 1; do not skip it after a data refresh.

### Step 3 — Update hardcoded snapshot metadata

`build_site.py` contains a small `meta` block near the bottom. Update it for the
new export:

```python
meta = {
    "totalMessages": ...,
    "topMessages": ...,
    "textMessages": ...,
    "topTextMessages": ...,
    "rankedVoices": len(records),
    "allPosters": ...,
    "days": 56,                         # update
    "range": "26 Aug – 20 Oct 2026",    # update
    "generated": "21 Oct 2026",         # update
}
```

Also update the static fallbacks in `index.html` so the page looks correct before
JavaScript runs:

- `#meta-messages`
- `#meta-lines`
- `#meta-days`
- footer text (`Generated ...`)
- `README.md` counts/date range, if they changed

The hero share percentage is calculated from the new data, so it does not need a
manual edit.

### Step 4 — Rebuild the site data and exports

```bash
python3 build_site.py
cp top200.csv top200.json site/
```

`build_site.py` writes:

- `site/data.js`
- `top200.json` (workspace root)
- `top200.csv` (workspace root)

The copy step is easy to forget. Without it, the footer’s CSV/JSON links serve
stale files.

### Step 5 — Optional long-form document

```bash
python3 build_profiles.py
```

This writes `how_each_person_talks.md` in the workspace root. It is useful for
review and for sharing a full document, but it is not linked from the site and
should not be committed without a privacy review.

### Step 6 — Local test

From the repo directory:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>. Then run the checklist in section 6.

### Step 7 — Publish

```bash
cd site
git add index.html styles.css app.js data.js top200.csv top200.json README.md
git commit -m "Refresh Top 200 data for <date range>"
git push origin main
```

GitHub Pages deploys from `main` and the repository root. Wait for the Pages build
to finish (usually under two minutes), then hard-refresh the live site:

<https://methylphetamine.github.io/neko-burglars-top200/>

If the repository is renamed or transferred, update the live URL in `README.md`
and create a `CNAME` file only if you are using a custom domain.

---

## 5. What to regenerate, in one line each

```text
analyze_chat.py      raw JSON  -> SQLite DB + user_characteristics.csv + report.md
style_analysis.py    DB        -> style_features_debug.json
build_site.py        DB + features -> site/data.js + top200.json + top200.csv
build_profiles.py    DB + features -> how_each_person_talks.md (optional)
```

Regenerate in that order. Each stage depends on the previous one.

---

## 6. Release checklist

### Data

- [ ] Export contains the expected date range and all message shards.
- [ ] `analyze_chat.py` reports a plausible message/user/reaction count.
- [ ] `style_analysis.py` completes without a missing-user error.
- [ ] Top 200 cutoff and share are plausible for this chat.
- [ ] `top200.json` has exactly **200** users and 200 unique `rank` values.
- [ ] Every user has `hourly` with 24 entries and a complete `radar` object.
- [ ] `top200.csv` has 200 data rows plus the header.
- [ ] CSV/JSON were copied into the repo after the build.

### Site

- [ ] 200 leaderboard rows and 3 podium cards render.
- [ ] Hero counts and footer date match the new snapshot.
- [ ] Search works for an exact name, a partial name, and a signature word.
- [ ] Search is case-insensitive and returns name matches before incidental matches.
- [ ] Sort options work, including messages, reactions, message length, and emoji rate.
- [ ] Filter chips show the expected counts and the empty state behaves correctly.
- [ ] Clicking a row and a podium card opens the correct profile.
- [ ] Profile dialog closes via the × button, Escape, and backdrop click.
- [ ] Random voice button opens a profile.
- [ ] Keyboard navigation works (Tab, Enter/Space, Escape).
- [ ] No console errors or page errors.
- [ ] No horizontal page overflow at 390 px, 768 px, and 1440 px.
- [ ] On mobile, the row character column is hidden and rows do not overlap.
- [ ] The podium scrolls horizontally on tablet/mobile instead of stacking forever.
- [ ] Footer CSV and JSON links return 200 and the correct content.
- [ ] Live URL serves the new build (not a cached old one).

A quick data-shape check:

```bash
python3 - <<'PY'
import json, re
src = open('data.js', encoding='utf-8').read()
users = json.loads(re.search(r'window\.CHAT_USERS = (\[.*\]);', src, re.S).group(1))
required = {'id','rank','name','display_name','character','messages',
            'text_lines','avg_words','one_liner_pct','emoji_per',
            'hourly','radar','signature_words','signature_phrases'}
assert len(users) == 200, len(users)
assert len({u['rank'] for u in users}) == 200
assert all(required <= set(u) for u in users)
assert all(len(u['hourly']) == 24 for u in users)
print('data.js shape OK:', len(users), 'users')
PY
```

---

## 7. Front-end conventions

- Keep the site dependency-free: plain HTML, CSS, and JavaScript. No framework,
  bundler, external font, CDN script, or analytics by default.
- Keep all data in `data.js`; the page must work by opening `index.html` directly.
- Escape every dynamic string with `esc()` before inserting it into HTML. User
  names and signature terms are untrusted input.
- Use `data-id` and event delegation for row/card actions; keep IDs stable.
- Keep the native `<dialog>` and its `showModal()` behavior. Preserve Escape and
  backdrop close handling.
- Reuse the CSS variables and existing breakpoints (1040, 860, 620 px) before
  inventing new colors or layout systems.
- Keep the page usable with keyboard and reduced motion. Do not remove focus
  styles.
- Avoid adding large images or libraries. The current site is about 1 MB total;
  GitHub Pages is fast because there is almost nothing to load.
- If you change a visible label or method, update the “How to read this” section
  and `README.md` so the public explanation stays accurate.

---

## 8. Common failure modes

| Symptom | Likely cause |
| --- | --- |
| Counts are right but downloads are stale | `top200.csv` / `top200.json` not copied into `site/` |
| Hero says 56 days after a new export | `meta.days` in `build_site.py` and `index.html` not updated |
| Hero share looks wrong | `topMessages` / `totalMessages` built from different snapshots |
| Profile dialog shows `undefined` | A field was removed from `data.js` without updating `app.js` |
| Search finds the wrong person first | Name relevance or search haystack changed; check `nameScore()` |
| Signature words look generic | Stop-word/sensitive-term filters need review in `style_analysis.py` |
| Ranking is off by one | Top 200 is zero/one-indexed somewhere; `rank` must be 1-based |
| Mobile rows overlap | `.character` was not hidden at the 860 px breakpoint, or grid columns changed |
| Page shows an old build | GitHub Pages cache; hard-refresh or wait for the build |
| A removed person reappears | Only `data.js` was edited; rebuild from the source/exclusion list |

Rollback is a normal git revert:

```bash
git revert HEAD
git push origin main
```

Pages will redeploy the previous commit.

---

## 9. Current snapshot (for orientation)

These values will change with the next export; they are here so you can sanity-check
the pipeline against the version this guide was written for.

- 73,203 messages, 463 users in the database, 19,612 reactions.
- 446 users posted at least one message.
- Top 200 cutoff: 17 messages.
- Top 200 account for 72,089 messages (98.5% of the export).
- 62,345 conversational text lines in the whole chat; 61,551 among the top 200.
- Date range: 26 Aug – 20 Oct 2026 (56 days), all times UTC.
- Top 5 by messages: `_𝙰𝚛𝚘𝚑𝚒𝚗𝚒𖧷`, Anas Siddique, فرزين, el3anor 🦈, Tanmayi.
- The `Instagram User` row is a merged display name covering two accounts.

If those numbers move dramatically, verify the export and filters before
publishing. A data refresh should change the snapshot, not the meaning of the
labels.
