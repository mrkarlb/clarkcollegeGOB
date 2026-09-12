# CHEM&121 / CHEM&131 Living Syllabus

Live site source for: `https://mrkarlb.github.io/clarkcollegeGOB/`

## The real source of truth: Markdown

- `content/chem121.md` and `content/chem131.md` — this is what you edit. Plain Markdown with a small metadata header (YAML frontmatter) at the top of each file.
- `build.js` — run `node build.js` after editing either .md file. It regenerates:
  1. `generated-content.js` — feeds the web page
  2. `downloads/CHEM121_Syllabus_Fall2026.docx` / `CHEM131_...docx` — via Pandoc, straight from the Markdown
  3. `downloads/CHEM121_Syllabus_Fall2026.pdf` / `CHEM131_...pdf` — via Pandoc + a styled print pass
  4. `downloads/CHEM121_DayOne_Fall2026.pdf` / `CHEM131_...pdf` — the one-page condensed version, extracted automatically from the Start Here + Weekly Flow sections of the same Markdown. Nothing here is separately authored, so it cannot drift out of sync with the full syllabus.

## Other files
- `index.html` — page shell (header, layout, CSS)
- `app.js` — rendering logic (tabs, search, dark mode, nav) — reads from `generated-content.js`, which is a build output, not something you edit directly

## To update content
1. Edit `content/chem121.md` and/or `content/chem131.md` (plain Markdown — headings, tables, bold, etc.)
2. Update the `LAST_UPDATED` line inside `index.html`
3. Run: `node build.js`
4. Upload the changed files to GitHub (at minimum: the .md file you edited, `generated-content.js`, and the two files in `downloads/` for that course)

## To publish
1. Upload everything (keeping folder structure) to the `mrkarlb/clarkcollegeGOB` repo
2. Settings → Pages → Source → Deploy from a branch → main → / (root)
3. GitHub gives you a live URL within a minute or two

## Still to do
- The Word doc styling from Pandoc is plainer than a hand-built version (no table borders/shading). Fixable with a Pandoc reference template if you want the fancier look back.
- Requires Pandoc and Node.js (with the `marked` and `playwright` packages) to run the build — this isn't something GitHub does for you automatically; it has to be run locally (or via Claude Code) before uploading.
