#!/usr/bin/env python3
"""Strip all article blocks + bullets whose Circle space is `utilisateurs-d-airsaas`.

- For sections 1/4 (Articles à mettre à jour / Articles rejetés par l'audit IA):
  each article is a block starting with `### 📝` or `### 🚫`, terminated by the
  next `### ` / `## ` / end-of-file. We strip the block if it contains
  `**Espace :** utilisateurs-d-airsaas`. We also drop the trailing `---`
  separator that precedes the next block.
- For section 5 (Articles non couverts), entries are bullets `- **...** (espace : X) — URL`.
  We strip bullets where `(espace : utilisateurs-d-airsaas)`.
- Counts in TOC + section intros are updated in-place.
"""

import re
import sys

if len(sys.argv) != 3:
    print("Usage: strip-space-from-audit.py <input.md> <output.md>", file=sys.stderr)
    sys.exit(1)

inp, outp = sys.argv[1], sys.argv[2]
with open(inp, "r", encoding="utf-8") as f:
    lines = f.read().split("\n")

EXCLUDE_SPACE = "utilisateurs-d-airsaas"

out = []
i = 0
removed_section1 = 0   # update_needed
removed_section4 = 0   # off_topic
removed_section5 = 0   # articles non couverts (skipped)
current_section = None

ARTICLE_HEADER_RE = re.compile(r"^### (📝|🚫|🆕) ")
SECTION_HEADER_RE = re.compile(r"^## ")

while i < len(lines):
    line = lines[i]

    if SECTION_HEADER_RE.match(line):
        stripped = line.strip()
        # Only update section on the 5 known top-level H2s. Sub-`##` headers
        # appearing inside proposed article content must NOT reset the tracker.
        if stripped.startswith("## Articles à mettre à jour"):
            current_section = "update"
        elif stripped.startswith("## Nouveaux articles proposés"):
            current_section = "new"
        elif stripped.startswith("## Articles déjà alignés"):
            current_section = "aligned"
        elif stripped.startswith("## Articles rejetés par l'audit IA"):
            current_section = "rejected"
        elif stripped.startswith("## Articles non couverts"):
            current_section = "uncovered"

    if ARTICLE_HEADER_RE.match(line):
        j = i + 1
        while j < len(lines):
            nxt = lines[j]
            if ARTICLE_HEADER_RE.match(nxt) or SECTION_HEADER_RE.match(nxt):
                break
            j += 1

        block = lines[i:j]
        block_text = "\n".join(block)
        should_drop = f"**Espace :** {EXCLUDE_SPACE}" in block_text

        if should_drop:
            if current_section == "update":
                removed_section1 += 1
            elif current_section == "rejected":
                removed_section4 += 1
            while out and out[-1].strip() == "":
                out.pop()
            i = j
            while i < len(lines) and (lines[i].strip() == "" or lines[i].strip() == "---"):
                if i + 1 < len(lines) and SECTION_HEADER_RE.match(lines[i + 1]):
                    break
                if SECTION_HEADER_RE.match(lines[i]):
                    break
                i += 1
            out.append("")
            continue
        else:
            out.extend(block)
            i = j
            continue

    if current_section == "uncovered":
        m = re.match(r"^- \*\*.*\*\* \(espace : ([^)]+)\) —", line)
        if m and m.group(1).strip() == EXCLUDE_SPACE:
            removed_section5 += 1
            i += 1
            continue

    out.append(line)
    i += 1

md = "\n".join(out)


def replace_count(md_text, pattern, delta):
    def sub(m):
        n = int(m.group("n"))
        new_n = max(0, n - delta)
        return m.group(0).replace(str(n), str(new_n), 1)
    return re.sub(pattern, sub, md_text)


md = replace_count(md, r"\[Articles à mettre à jour\]\(#[^)]*\) \((?P<n>\d+)\)", removed_section1)
md = replace_count(md, r"\[Articles rejetés par l'audit IA\]\(#[^)]*\) \((?P<n>\d+)\)", removed_section4)
md = replace_count(md, r"\[Articles non couverts par la FAQ\]\(#[^)]*\) \((?P<n>\d+)\)", removed_section5)

md = replace_count(md, r"> (?P<n>\d+) articles existants dont le contenu diverge", removed_section1)
md = replace_count(md, r"> (?P<n>\d+) articles dont le mapping lexical", removed_section4)
md = replace_count(md, r"> (?P<n>\d+) articles Circle dont le sujet n'a aucun", removed_section5)

total_removed = removed_section1 + removed_section4 + removed_section5
md = replace_count(md, r"> (?P<n>\d+) articles Circle analysés", total_removed)

with open(outp, "w", encoding="utf-8") as f:
    f.write(md)

print(f"Section 1 (update_needed) removed: {removed_section1}")
print(f"Section 4 (rejected) removed: {removed_section4}")
print(f"Section 5 (uncovered) removed: {removed_section5}")
print(f"Total removed: {total_removed}")
print(f"Wrote {outp}")
