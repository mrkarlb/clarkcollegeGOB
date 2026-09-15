// build.js — the single-source pipeline.
// Reads content/chem121.md and content/chem131.md (the real source of truth),
// and produces: generated content.js (for the web page), .docx (via pandoc),
// and .pdf (via pandoc -> styled HTML -> Playwright print).
//
// Usage: node build.js

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { marked } = require("marked");
const { chromium } = require("playwright");

marked.setOptions({ gfm: true });

const H1_TOP = {
  "Why This Course, Why You": "why",
  "Start Here": "starthere",
  "Course Information": "courseinfo",
  "Welcome to Class!": "welcome",
  "About Your Instructor": "instructor",
  "What Course Materials Will I Need?": "materials",
  "What Are the Course Agreements?": "agreements",
  "What Are the Learning Goals in This Course?": "goals",
  "How Will I Be Graded, and Why?": "grading",
  "What Resources and Support Services Are Available to Me?": "resources",
  "How Should I Get Started in Class?": "getstarted",
  "Appendix: Official College Policies": "appendix",
};
// H2 headings that should become their OWN top-level section (not nested)
const H2_PULLOUT = {
  "Course Terms You'll See": "terms",
  "Your First Week": "firstweek",
  "Weekly Flow": "weeklyflow",
};

const SECTION_LABELS = {
  why: "Why This Course, Why You", starthere: "Start Here", terms: "Course Terms",
  firstweek: "Your First Week", courseinfo: "Course Information", welcome: "Welcome to Class",
  weeklyflow: "Weekly Flow", instructor: "About Your Instructor", materials: "Course Materials",
  agreements: "Course Agreements", goals: "Learning Goals", grading: "Grading",
  resources: "Resources & Support", getstarted: "Getting Started", appendix: "Appendix: College Policies",
};
const SECTION_ORDER = Object.keys(SECTION_LABELS);

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  m[1].split("\n").forEach((line) => {
    const mm = line.match(/^(\w+):\s*"?(.*?)"?$/);
    if (mm) meta[mm[1]] = mm[2];
  });
  return { meta, body: m[2] };
}

function splitIntoSections(body) {
  const lines = body.split("\n");
  const sections = {}; // id -> array of source lines
  let current = null;
  for (const line of lines) {
    const h1 = line.match(/^# (.+)$/);
    const h2 = line.match(/^## (.+)$/);
    if (h1 && H1_TOP[h1[1]]) {
      current = H1_TOP[h1[1]];
      sections[current] = sections[current] || [];
      sections[current].push(`# ${h1[1]}`);
      continue;
    }
    if (h2 && H2_PULLOUT[h2[1]]) {
      current = H2_PULLOUT[h2[1]];
      sections[current] = sections[current] || [];
      sections[current].push(`## ${h2[1]}`);
      continue;
    }
    if (current) sections[current].push(line);
  }
  return sections;
}

function wrapAppendixAccordion(html) {
  const parts = html.split(/<h2>(.*?)<\/h2>/);
  let out = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i];
    const bodyHtml = parts[i + 1] || "";
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    out += `<details class="policy" id="policy-${id}"><summary>${title}</summary><div class="policy-body">${bodyHtml}</div></details>`;
  }
  return out;
}

function buildCourseData(mdPath) {
  const raw = fs.readFileSync(mdPath, "utf8");
  const { meta, body } = parseFrontmatter(raw);
  const rawSections = splitIntoSections(body);
  const html = {};
  for (const id of SECTION_ORDER) {
    const src = (rawSections[id] || []).join("\n");
    let rendered = marked.parse(src);
    if (id === "appendix") rendered = wrapAppendixAccordion(rendered);
    html[id] = rendered;
  }
  return { meta, html };
}

// Parses a "What's Covered" file (content/<course>-whatscovered.md) into an
// intro block plus an ordered array of module cards. Separate from
// buildCourseData/SECTION_ORDER because this content is module-shaped, not
// syllabus-section-shaped, and is term-agnostic (no Weekly Flow dates here).
function buildWhatsCoveredData(mdPath) {
  const raw = fs.readFileSync(mdPath, "utf8");
  const { meta, body } = parseFrontmatter(raw);
  const lines = body.split("\n");
  const modules = [];
  const introLines = [];
  let current = null;
  for (const line of lines) {
    // Accepts either "## Module N: Title" (GOB-era, module-based) or
    // "## Week N: Title" (Fall Chemfolio schedule, week-based) — the unit
    // label varies by term/curriculum, the parser doesn't care which.
    const h2unit = line.match(/^## (Module|Week) (\d+): (.+)$/);
    if (h2unit) {
      if (current) modules.push(current);
      current = { num: h2unit[2], label: `${h2unit[1]} ${h2unit[2]}`, title: h2unit[3].trim(), id: `${h2unit[1].toLowerCase()}-${h2unit[2]}`, lines: [line] };
      continue;
    }
    if (current) current.lines.push(line);
    else introLines.push(line);
  }
  if (current) modules.push(current);

  const introHtml = marked.parse(introLines.join("\n"));
  const moduleData = modules.map((m) => ({
    id: m.id,
    num: m.num,
    label: m.label,
    title: m.title,
    html: marked.parse(m.lines.join("\n")),
  }));
  return { meta, introHtml, modules: moduleData };
}

const PRINT_FONTS = `<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600;700&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">`;
const PRINT_BASE_CSS = `
  body { font-family: 'Source Sans 3', sans-serif; color: #17211E; font-size: 12.5px; line-height: 1.5; max-width: 100%; }
  h1 { font-family: 'Source Serif 4', serif; color: #143F49; font-size: 22px; border-bottom: 2px solid #1D5C6B; padding-bottom: 4px; margin-top: 22px; }
  h2 { font-family: 'Source Serif 4', serif; color: #143F49; font-size: 16px; margin-top: 16px; }
  h3 { font-size: 13.5px; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11.5px; }
  td, th { border: 1px solid #D8DDD9; padding: 6px 8px; text-align: left; vertical-align: top; }
  tr td:first-child { background: #E4EEEC; font-weight: 700; width: 26%; }
  blockquote { border-left: 3px solid #1D5C6B; background: #E4EEEC; margin: 10px 0; padding: 8px 12px; font-size: 11.5px; }
  ul, ol { padding-left: 20px; }
  li { margin-bottom: 4px; }
`;

async function mdToStyledHtml(mdPath, title) {
  const raw = fs.readFileSync(mdPath, "utf8");
  const { body } = parseFrontmatter(raw);
  const content = marked.parse(body);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  ${PRINT_FONTS}
  <style>${PRINT_BASE_CSS}</style></head><body><h1 style="border:none;font-size:26px;">${title}</h1>${content}</body></html>`;
}

// Evaluator-facing "What's Covered" PDF: same brand styling as the full
// syllabus PDF, but every <details> logistics block is forced open, since a
// printed page can't be expanded by clicking. Deliberately excludes the
// syllabus's policy/grading/AI-agreement content — modules and labs only.
async function whatsCoveredPdfHtml(mdPath, title, termLine) {
  const raw = fs.readFileSync(mdPath, "utf8");
  const { body } = parseFrontmatter(raw);
  let content = marked.parse(body).replace(/<details>/g, "<details open>");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  ${PRINT_FONTS}
  <style>
    ${PRINT_BASE_CSS}
    .band { background: #143F49; color: #fff; padding: 3px 10px; font-weight: 700; font-size: 10.5px; border-radius: 3px; display: inline-block; margin-bottom: 8px; }
    .sub { color: #445048; font-size: 11.5px; margin-bottom: 10px; }
    details { margin: 8px 0 14px; }
    details summary { font-weight: 700; color: #1D5C6B; cursor: default; margin-bottom: 4px; }
  </style></head><body>
  <div class="band">COURSE CONTENT SUMMARY — FOR TRANSFER EVALUATION</div>
  <h1 style="border:none;font-size:26px;">${title}</h1>
  <div class="sub">${termLine}</div>
  ${content}
  </body></html>`;
}

async function dayOneHtml(courseData, title) {
  const s = courseData.html;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600;700&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Source Sans 3', sans-serif; color: #17211E; font-size: 11.5px; line-height: 1.45; }
    h1 { font-family: 'Source Serif 4', serif; color: #143F49; font-size: 22px; margin: 0 0 2px; }
    h2 { font-family: 'Source Serif 4', serif; color: #143F49; font-size: 15px; margin-top: 14px; border-bottom: 2px solid #1D5C6B; padding-bottom: 3px; }
    .band { background: #143F49; color: #fff; padding: 3px 10px; font-weight: 700; font-size: 10.5px; border-radius: 3px; display: inline-block; margin-bottom: 8px; }
    .sub { color: #445048; font-size: 11.5px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 10.8px; }
    td, th { border: 1px solid #D8DDD9; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: #1D5C6B; color: #fff; }
    table.def td:first-child { background: #E4EEEC; font-weight: 700; width: 24%; }
    .foot { margin-top: 12px; font-size: 9.5px; color: #445048; border-top: 1px solid #D8DDD9; padding-top: 6px; }
    .placeholder { color: #B54747; font-style: italic; }
  </style></head><body>
  <div class="band">DAY ONE — READ THIS FIRST</div>
  <h1>${title}</h1>
  <div class="sub">Dr. Karl Bailey (Dr. B) · Fall 2026 · September 21 – December 10, 2026 · Canvas Inbox only</div>
  ${s.starthere.replace("<h1>Start Here</h1>", "").replace(/<table>/, '<table class="def">')}
  ${s.weeklyflow}
  <div class="foot">This is the condensed version, generated automatically from the same source as the full syllabus — so it can never drift out of sync. The full syllabus (with grading detail, the AI agreement, lab requirements, and all college policies) is linked from the top of the living syllabus page. If anything here and the full syllabus disagree, the full syllabus online is correct.</div>
  </body></html>`;
}

async function main() {
  fs.mkdirSync("downloads", { recursive: true });

  const courses = [
    { md: "content/chem121.md", key: "chem121", pdfTitle: "CHEM&121: Introduction to Chemistry",
      docx: "downloads/CHEM121_Syllabus_Fall2026.docx", pdf: "downloads/CHEM121_Syllabus_Fall2026.pdf",
      dayone: "downloads/CHEM121_DayOne_Fall2026.pdf",
      whatsCoveredMd: "content/chem121-whatscovered.md", whatsCoveredPdfTitle: "CHEM&121: Introduction to Chemistry",
      whatsCoveredPdf: "downloads/CHEM121_WhatsCovered_Fall2026.pdf" },
    { md: "content/chem131.md", key: "chem131", pdfTitle: "CHEM&131: Introduction to Organic and Biochemistry",
      docx: "downloads/CHEM131_Syllabus_Fall2026.docx", pdf: "downloads/CHEM131_Syllabus_Fall2026.pdf",
      dayone: "downloads/CHEM131_DayOne_Fall2026.pdf",
      whatsCoveredMd: "content/chem131-whatscovered.md", whatsCoveredPdfTitle: "CHEM&131: Introduction to Organic and Biochemistry",
      whatsCoveredPdf: "downloads/CHEM131_WhatsCovered_Fall2026.pdf" },
  ];

  const generated = {};
  for (const c of courses) {
    generated[c.key] = buildCourseData(c.md);
    generated[c.key].whatsCovered = buildWhatsCoveredData(c.whatsCoveredMd);
    // DOCX via pandoc, straight from markdown
    execSync(`pandoc "${c.md}" -o "${c.docx}" --standalone`);
    console.log("built", c.docx);
  }

  // PDFs via pandoc-rendered HTML -> Playwright print (keeps our brand styling)
  const browser = await chromium.launch();
  for (const c of courses) {
    const html = await mdToStyledHtml(c.md, c.pdfTitle);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({ path: c.pdf, format: "Letter", printBackground: true, margin: { top: "0.6in", bottom: "0.6in", left: "0.6in", right: "0.6in" } });
    await page.close();
    console.log("built", c.pdf);

    // Day One handout: extracted from the same parsed sections, not separately authored
    const dayOneContent = await dayOneHtml(generated[c.key], c.pdfTitle);
    const dayPage = await browser.newPage();
    await dayPage.setContent(dayOneContent, { waitUntil: "networkidle" });
    await dayPage.pdf({ path: c.dayone, format: "Letter", printBackground: true, margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" } });
    await dayPage.close();
    console.log("built", c.dayone);

    // Evaluator-facing "What's Covered" PDF — separate from the syllabus PDF/Word/Day One
    const wcHtml = await whatsCoveredPdfHtml(c.whatsCoveredMd, c.whatsCoveredPdfTitle, generated[c.key].meta.term || "");
    const wcPage = await browser.newPage();
    await wcPage.setContent(wcHtml, { waitUntil: "networkidle" });
    await wcPage.pdf({ path: c.whatsCoveredPdf, format: "Letter", printBackground: true, margin: { top: "0.6in", bottom: "0.6in", left: "0.6in", right: "0.6in" } });
    await wcPage.close();
    console.log("built", c.whatsCoveredPdf);
  }
  await browser.close();

  // Write generated-content.js for the web page to consume
  const out = [
    "// AUTO-GENERATED by build.js from content/*.md — do not hand-edit this file.",
    "// Edit the .md files instead, then run: node build.js",
    "",
    `const GENERATED = ${JSON.stringify(generated, null, 2)};`,
    "",
  ].join("\n");
  fs.writeFileSync("generated-content.js", out);
  console.log("built generated-content.js");
}

main().catch((e) => { console.error(e); process.exit(1); });
