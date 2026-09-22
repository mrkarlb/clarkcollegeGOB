# Accessible Word export (Syllabus + What's Covered)

Builds one combined, accessible .docx per course from the same Markdown source as the site.

    python3 tools/a11y-docx/build_a11y_docx.py chem121 "CHEM&121" . downloads/CHEM121_Syllabus_Fall2026_Accessible.docx
    python3 tools/a11y-docx/build_a11y_docx.py chem131 "CHEM&131" . downloads/CHEM131_Syllabus_Fall2026_Accessible.docx

Requires pandoc. What it fixes versus the plain pandoc export:
- <br><br> in table cells become real paragraphs (3+ items become a real bulleted list)
- What's Covered "Weekly logistics" become real Heading 3s; topic lines become real lists
- Dr. B's Notes use a "Callout" paragraph style instead of a block quote
- Grading scale reshaped to a 2-column table that reads in order
- Header rows marked to repeat; rows never split across pages
- No decorative graphics; no empty headings; document title, author, subject, language (en-US) set
- Styled headings (teal, >= 7:1 contrast), bordered tables, page-numbered footer
The `ref/` folder is the unzipped reference document holding all styles.
