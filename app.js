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
    downloads: {
      pdf: "downloads/CHEM121_Syllabus_Fall2026.pdf",
      word: "downloads/CHEM121_Syllabus_Fall2026.docx",
      dayone: "downloads/CHEM121_DayOne_Fall2026.pdf",
    },
  },
  chem131: {
    tabLabel: "CHEM&131",
    title: "CHEM&131: Intro to Organic/Biochemistry",
    subLine: "Dr. Karl Bailey (Dr. B) · Hybrid, September 21 – December 10, 2026",
    downloads: {
      pdf: "downloads/CHEM131_Syllabus_Fall2026.pdf",
      word: "downloads/CHEM131_Syllabus_Fall2026.docx",
      dayone: "downloads/CHEM131_DayOne_Fall2026.pdf",
    },
  },
};

function render(courseKey) {
  const meta = COURSE_META[courseKey];
  const data = GENERATED[courseKey];
  document.body.dataset.course = courseKey;
  document.getElementById("pageTitle").innerHTML = meta.title;
  document.getElementById("pageSub").textContent = meta.subLine;
  document.title = `${meta.title} — Dr. Karl Bailey — Clark College`;
  document.getElementById("btn121").setAttribute("aria-pressed", courseKey === "chem121");
  document.getElementById("btn131").setAttribute("aria-pressed", courseKey === "chem131");

  const main = document.getElementById("main");
  main.innerHTML = SECTIONS.map(s => `<section class="block" id="${s.id}">${data.html[s.id] || ""}</section>`).join("");

  const copyHtml = `
    <a href="${meta.downloads.pdf}">Full PDF</a>
    <a href="${meta.downloads.word}">Word doc</a>
    <a href="${meta.downloads.dayone}">Day One handout</a>
  `;
  document.getElementById("headerCopyBtns").innerHTML = copyHtml;
  document.getElementById("copyBtns").innerHTML = copyHtml;

  buildTOC();
  document.getElementById("updatedLine").textContent = `Last updated ${LAST_UPDATED}`;
}

function buildTOC() {
  const toc = document.getElementById("toc");
  toc.innerHTML = SECTIONS.map(s => `<a href="#${s.id}" data-target="${s.id}">${s.label}</a>`).join("");
}

function setCourse(key) {
  window.location.hash = key;
  render(key);
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

(function init() {
  const saved = localStorage.getItem("syllabus-theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) document.documentElement.setAttribute("data-theme", "dark");

  const hash = window.location.hash.replace("#", "");
  const startKey = COURSE_META[hash] ? hash : "chem121";
  render(startKey);

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
})();
