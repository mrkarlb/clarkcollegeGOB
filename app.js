// app.js — renders GENERATED (from generated-content.js, built by build.js from Markdown)
// into the page, handles nav/search/theme/course switching.

const SECTIONS = [
  { id: "why", label: "Why This Course, Why You" },
  { id: "starthere", label: "Start Here" },
  { id: "terms", label: "Course Terms" },
  { id: "firstweek", label: "Your First Week" },
  { id: "courseinfo", label: "Course Information" },
  { id: "welcome", label: "Welcome to Class" },
  { id: "weeklyflow", label: "Weekly Flow" },
  { id: "instructor", label: "About Your Instructor" },
  { id: "materials", label: "Course Materials" },
  { id: "agreements", label: "Course Agreements" },
  { id: "goals", label: "Learning Goals" },
  { id: "grading", label: "Grading" },
  { id: "resources", label: "Resources &amp; Support" },
  { id: "getstarted", label: "Getting Started" },
  { id: "appendix", label: "Appendix: College Policies" },
];

const COURSE_META = {
  chem121: {
    tabLabel: "CHEM&121",
    title: "CHEM&121: Introduction to Chemistry",
    subLine: "Dr. Karl Bailey (Dr. B) · Hybrid, September 21 – December 10, 2026",
    whatsCoveredTitle: "CHEM&121: What's Covered",
    downloads: {
      pdf: "downloads/CHEM121_Syllabus_Fall2026.pdf",
      word: "downloads/CHEM121_Syllabus_Fall2026.docx",
      dayone: "downloads/CHEM121_DayOne_Fall2026.pdf",
      whatsCovered: "downloads/CHEM121_WhatsCovered_Fall2026.pdf",
    },
  },
  chem131: {
    tabLabel: "CHEM&131",
    title: "CHEM&131: Intro to Organic/Biochemistry",
    subLine: "Dr. Karl Bailey (Dr. B) · Hybrid, September 21 – December 10, 2026",
    whatsCoveredTitle: "CHEM&131: What's Covered",
    downloads: {
      pdf: "downloads/CHEM131_Syllabus_Fall2026.pdf",
      word: "downloads/CHEM131_Syllabus_Fall2026.docx",
      dayone: "downloads/CHEM131_DayOne_Fall2026.pdf",
      whatsCovered: "downloads/CHEM131_WhatsCovered_Fall2026.pdf",
    },
  },
};

let currentPage = "syllabus"; // "syllabus" | "whatscovered"

function render(courseKey) {
  document.body.dataset.course = courseKey;
  document.getElementById("btn121").setAttribute("aria-pressed", courseKey === "chem121");
  document.getElementById("btn131").setAttribute("aria-pressed", courseKey === "chem131");
  document.getElementById("pageBtnSyllabus").setAttribute("aria-pressed", currentPage === "syllabus");
  document.getElementById("pageBtnCovered").setAttribute("aria-pressed", currentPage === "whatscovered");

  if (currentPage === "whatscovered") renderWhatsCovered(courseKey);
  else renderSyllabus(courseKey);

  document.getElementById("updatedLine").textContent = `Last updated ${LAST_UPDATED}`;
}

function renderSyllabus(courseKey) {
  const meta = COURSE_META[courseKey];
  const data = GENERATED[courseKey];
  document.getElementById("pageTitle").innerHTML = meta.title;
  document.getElementById("pageSub").textContent = meta.subLine;
  document.title = `${meta.title} — Dr. Karl Bailey — Clark College`;

  const main = document.getElementById("main");
  main.innerHTML = SECTIONS.map(s => `<section class="block" id="${s.id}">${data.html[s.id] || ""}</section>`).join("");

  document.getElementById("headerCopyBtns").innerHTML = `
    <a href="${meta.downloads.pdf}">Full PDF</a>
    <a href="${meta.downloads.word}">Word doc</a>
    <a href="${meta.downloads.dayone}">Day One handout</a>
  `;

  const toc = document.getElementById("toc");
  toc.innerHTML = SECTIONS.map(s => `<a href="#${s.id}" data-target="${s.id}">${s.label}</a>`).join("");
  observeSections();
}

function renderWhatsCovered(courseKey) {
  const meta = COURSE_META[courseKey];
  const data = GENERATED[courseKey].whatsCovered;
  document.getElementById("pageTitle").innerHTML = meta.whatsCoveredTitle;
  document.getElementById("pageSub").textContent = "For students previewing the term, and for transfer evaluators comparing course content.";
  document.title = `${meta.whatsCoveredTitle} — Dr. Karl Bailey — Clark College`;

  const main = document.getElementById("main");
  main.innerHTML = data.introHtml + data.modules.map(m => `<section class="block" id="${m.id}">${m.html}</section>`).join("");

  document.getElementById("headerCopyBtns").innerHTML = `
    <a href="${meta.downloads.whatsCovered}">Course Content PDF</a>
  `;

  const toc = document.getElementById("toc");
  toc.innerHTML = data.modules.map(m => `<a href="#${m.id}" data-target="${m.id}">Module ${m.num}: ${m.title}</a>`).join("");
  observeSections();
}

function setCourse(key) {
  window.location.hash = currentPage === "whatscovered" ? `${key}-covered` : key;
  render(key);
  window.scrollTo({ top: 0 });
}

function setPage(page) {
  currentPage = page;
  const courseKey = document.body.dataset.course || "chem121";
  window.location.hash = page === "whatscovered" ? `${courseKey}-covered` : courseKey;
  render(courseKey);
  window.scrollTo({ top: 0 });
}

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  if (next === "dark") html.setAttribute("data-theme", "dark");
  else html.removeAttribute("data-theme");
  localStorage.setItem("syllabus-theme", next);
}

function doSearch(qRaw) {
  const q = qRaw.trim().toLowerCase();
  document.querySelectorAll("main mark").forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
  if (!q) return;
  const walker = document.createTreeWalker(document.getElementById("main"), NodeFilter.SHOW_TEXT);
  const matches = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent.toLowerCase().includes(q)) matches.push(node);
  }
  matches.forEach(node => {
    const idx = node.textContent.toLowerCase().indexOf(q);
    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + q.length);
    const mark = document.createElement("mark");
    range.surroundContents(mark);
  });
  if (matches.length) document.querySelector("main mark").scrollIntoView({ block: "center", behavior: "smooth" });
}

function observeSections() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        document.querySelectorAll("nav.toc a").forEach(a => a.classList.remove("active"));
        const link = document.querySelector(`nav.toc a[data-target="${entry.target.id}"]`);
        if (link) link.classList.add("active");
      }
    });
  }, { rootMargin: "-10% 0px -75% 0px" });
  setTimeout(() => document.querySelectorAll("section.block").forEach(s => observer.observe(s)), 100);
}

(function init() {
  const saved = localStorage.getItem("syllabus-theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) document.documentElement.setAttribute("data-theme", "dark");

  // Hash formats: "#chem121" (syllabus, default) or "#chem121-covered" (What's Covered)
  let hash = window.location.hash.replace("#", "");
  if (hash.endsWith("-covered")) {
    currentPage = "whatscovered";
    hash = hash.replace(/-covered$/, "");
  }
  const startKey = COURSE_META[hash] ? hash : "chem121";
  render(startKey);
})();
