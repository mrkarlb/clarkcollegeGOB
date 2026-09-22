-- a11y-docx.lua — pandoc filter for accessible Word syllabus exports
-- 1. <br><br> inside table cells -> real paragraphs (or a real bullet list when 3+ items)
-- 2. <details><summary>X</summary> -> a real Heading 3 "X"; </details> dropped
-- 3. "Dr. B's Note" blockquotes -> "Callout" paragraph style (not announced as a quotation)
-- 4. 6-column Percent/Grade table -> 2-column table in reading order
-- 5. Horizontal rules and empty headings removed (decorative graphics / empty nav stops)
-- 6. Page break before the What's Covered part

local stringify = pandoc.utils.stringify

local function is_br(el)
  return el.t == "RawInline" and el.format == "html" and el.text:match("^<br%s*/?>$")
end

-- split a list of inlines at <br> runs
local function split_inlines(inlines)
  local segs, cur, found = {}, pandoc.List(), false
  for _, el in ipairs(inlines) do
    if is_br(el) then
      found = true
      if #cur > 0 then segs[#segs + 1] = cur; cur = pandoc.List() end
    else
      cur:insert(el)
    end
  end
  if #cur > 0 then segs[#segs + 1] = cur end
  -- trim leading/trailing spaces in each segment
  for _, s in ipairs(segs) do
    while #s > 0 and (s[1].t == "Space" or s[1].t == "SoftBreak") do s:remove(1) end
    while #s > 0 and (s[#s].t == "Space" or s[#s].t == "SoftBreak") do s:remove(#s) end
  end
  return segs, found
end

local function fix_cell_blocks(blocks)
  local out = pandoc.List()
  for _, b in ipairs(blocks) do
    if b.t == "Plain" or b.t == "Para" then
      local segs, found = split_inlines(b.content)
      if not found then
        out:insert(b)
      elseif #segs >= 3 then
        local items = {}
        for _, s in ipairs(segs) do items[#items + 1] = { pandoc.Plain(s) } end
        out:insert(pandoc.BulletList(items))
      else
        for _, s in ipairs(segs) do out:insert(pandoc.Para(s)) end
      end
    else
      out:insert(b)
    end
  end
  return out
end

local function reshape_grade_table(tbl)
  local head = tbl.head.rows[1]
  if not head or #head.cells ~= 6 then return nil end
  if stringify(head.cells[1].contents) ~= "Percent" then return nil end
  local body = tbl.bodies[1].body
  local pairs_ = {}
  for col = 0, 2 do
    for _, row in ipairs(body) do
      pairs_[#pairs_ + 1] = { row.cells[col * 2 + 1], row.cells[col * 2 + 2] }
    end
  end
  local template = body[1]
  local rows = {}
  for _, p in ipairs(pairs_) do
    local r = template:clone()
    r.cells = { p[1], p[2] }
    rows[#rows + 1] = r
  end
  local hrow = head:clone()
  hrow.cells = { head.cells[1], head.cells[2] }
  tbl.head.rows = { hrow }
  tbl.bodies[1].body = rows
  tbl.colspecs = { { pandoc.AlignLeft, 0.35 }, { pandoc.AlignLeft, 0.2 } }
  return tbl
end

function Table(tbl)
  local reshaped = reshape_grade_table(tbl)
  if reshaped then tbl = reshaped end
  local function fix_rows(rows)
    for _, row in ipairs(rows) do
      for _, cell in ipairs(row.cells) do
        cell.contents = fix_cell_blocks(cell.contents)
      end
    end
  end
  fix_rows(tbl.head.rows)
  for _, b in ipairs(tbl.bodies) do fix_rows(b.body) end
  return tbl
end

function RawBlock(el)
  if el.format ~= "html" then return nil end
  local summary = el.text:match("<summary>(.-)</summary>")
  if summary then
    return pandoc.Header(3, pandoc.Str(summary))
  end
  if el.text:match("^%s*</?details>%s*$") then return {} end
  return nil
end

function HorizontalRule() return {} end

function Header(h)
  if stringify(h.content):match("^%s*$") then return {} end
  return h
end

function BlockQuote(bq)
  local txt = stringify(bq)
  if txt:match("^%s*Dr%.") then
    return pandoc.Div(bq.content, pandoc.Attr("", {}, { ["custom-style"] = "Callout" }))
  end
  return bq
end

-- page break marker: a Div with class "pagebreak"
function Div(d)
  if d.classes:includes("pagebreak") then
    return pandoc.RawBlock("openxml", '<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
  end
  return nil
end

-- <details><summary>X</summary> arrives as separate raw blocks around a Plain; fold into a Heading 3
function Blocks(blocks)
  local out = pandoc.List()
  local i = 1
  while i <= #blocks do
    local b = blocks[i]
    local nxt, nxt2 = blocks[i + 1], blocks[i + 2]
    if b.t == "RawBlock" and b.format == "html" and b.text:match("^%s*<summary>%s*$")
       and nxt and (nxt.t == "Plain" or nxt.t == "Para")
       and nxt2 and nxt2.t == "RawBlock" and nxt2.text:match("^%s*</summary>%s*$") then
      out:insert(pandoc.Header(3, nxt.content))
      i = i + 3
    elseif b.t == "RawBlock" and b.format == "html" and b.text:match("^%s*</?details>%s*$") then
      i = i + 1
    else
      out:insert(b)
      i = i + 1
    end
  end
  return out
end
