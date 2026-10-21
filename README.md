# Neko Burglars — Top 200 Voices

**Live site:** <https://methylphetamine.github.io/neko-burglars-top200/>

A static, offline-friendly website ranking the 200 most active members of the
Neko Burglars Instagram group chat. Each member has:

- rank, message count, share of chat, active days, and reaction stats
- a chat-character label (e.g. “Lowercase Rapid-Fire”, “Laugh Track”)
- a short writing-style summary
- signature words and phrases
- top emoji, typing mechanics, hourly activity, and social footprint

## Open it

Double-click `index.html`, or serve the folder locally:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

No build step or network connection is required. All data is in `data.js`.

## Files

- `index.html` — page shell
- `styles.css` — layout and theme
- `app.js` — search, sort, filters, and profile dialog
- `data.js` — 200 ranked profiles (generated)
- `top200.json` — full data export
- `top200.csv` — spreadsheet-friendly export
- `MAINTENANCE.md` — data-refresh pipeline, testing checklist, and deploy notes

## Notes

- Times are UTC.
- Display names come from the Instagram export. Duplicate display names
  (`Instagram User`, `🐧`) are merged; the `Instagram User` row is therefore
  two accounts, not one person.
- Decorative or rare-script characters are simplified in the site display for
  readability. The original export names are preserved in `top200.json` and
  `top200.csv`.
- “Chat character” describes typing habits only, not personality or mental
  health.
- Signature terms are filtered for names, system text, slurs, and sensitive
  identity/nationality terms.
- The export begins mid-conversation on 26 Aug 2026 and ends 20 Oct 2026.

## Maintaining

See [MAINTENANCE.md](MAINTENANCE.md) for the update pipeline, privacy rules,
release checklist, and deploy notes.
