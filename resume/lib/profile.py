"""
Resume toolkit — pure functions for turning a structured PROFILE.md plus a job
description into two tailored resume variants, and for validating that a profile
contains enough information to produce a solid resume.

Dependency-free (Python standard library only). See resume/GENERATION_GUIDE.md
for the methodology these functions encode, and resume/tests for the TDD suite.
"""
import re

# ── Parsing ──────────────────────────────────────────────────────────────────

CONTACT_KEYS = {"email", "phone", "location", "linkedin"}


def parse_profile(text):
    """Parse a PROFILE.md string into a structured dict.

    Expected shape (see resume/PROFILE.template.md):

        # <Name>
        - Email: ...
        - Phone: ...
        - Location: ...
        - LinkedIn: ...

        ## Summary
        <paragraph>

        ## Core Competencies
        - item

        ## Experience
        ### <Title> — <Employer> (<start>–<end>) | <Location>
        - achievement bullet

        ## Education
        - <degree>, <institution> (<year>)

        ## Certifications
        - <cert>
    """
    prof = {
        "name": "",
        "contact": {"email": "", "phone": "", "location": "", "linkedin": ""},
        "summary": "",
        "competencies": [],
        "experience": [],
        "education": [],
        "certifications": [],
    }
    section = None   # current H2 (lowercased)
    role = None      # current Experience H3 entry
    summary_lines = []

    for raw in text.splitlines():
        line = raw.rstrip()

        if not prof["name"]:
            m = re.match(r"^#\s+(.+)$", line)
            if m:
                prof["name"] = m.group(1).strip()
                continue

        h2 = re.match(r"^##\s+(.+)$", line)
        if h2:
            section = h2.group(1).strip().lower()
            role = None
            continue

        if section is None:
            # Preamble: contact bullets like "- Email: x@y.com"
            cm = re.match(r"^[-*]\s*([A-Za-z]+)\s*:\s*(.+)$", line)
            if cm and cm.group(1).lower() in CONTACT_KEYS:
                prof["contact"][cm.group(1).lower()] = cm.group(2).strip()
            continue

        if section.startswith("summary"):
            if line.strip() and not line.strip().startswith(">"):
                summary_lines.append(line.strip())
        elif section.startswith("core competencies") or section == "competencies":
            bm = re.match(r"^[-*]\s+(.+)$", line)
            if bm:
                prof["competencies"].append(bm.group(1).strip())
        elif section.startswith("experience"):
            h3 = re.match(r"^###\s+(.+)$", line)
            if h3:
                role = parse_experience_header(h3.group(1).strip())
                prof["experience"].append(role)
            else:
                bm = re.match(r"^[-*]\s+(.+)$", line)
                if bm and role is not None:
                    role["bullets"].append(bm.group(1).strip())
        elif section.startswith("education"):
            bm = re.match(r"^[-*]\s+(.+)$", line)
            if bm:
                prof["education"].append(bm.group(1).strip())
        elif section.startswith("certification"):
            bm = re.match(r"^[-*]\s+(.+)$", line)
            if bm:
                prof["certifications"].append(bm.group(1).strip())

    prof["summary"] = " ".join(summary_lines).strip()
    return prof


def parse_experience_header(s):
    """Parse '### Title — Employer (start–end) | Location' into a dict."""
    role = {"title": "", "employer": "", "start": "", "end": "",
            "location": "", "bullets": []}

    if "|" in s:
        s, loc = s.rsplit("|", 1)
        role["location"] = loc.strip()
        s = s.strip()

    dm = re.search(r"\(([^)]*)\)\s*$", s)
    if dm:
        dates = dm.group(1).strip()
        s = s[:dm.start()].strip()
        parts = re.split(r"\s*[–—-]\s*", dates)
        if len(parts) >= 2:
            role["start"], role["end"] = parts[0].strip(), parts[1].strip()
        elif parts:
            role["start"] = parts[0].strip()

    # Title / employer split on em- or en-dash (with surrounding spaces),
    # falling back to a spaced hyphen.
    sep = re.split(r"\s+[—–]\s+", s)
    if len(sep) < 2:
        sep = re.split(r"\s+-\s+", s)
    if len(sep) >= 2:
        role["title"] = sep[0].strip()
        role["employer"] = sep[1].strip()
    else:
        role["title"] = s.strip()
    return role


# ── Validation (the "is this MD good enough for a resume?" gate) ─────────────

_METRIC_RE = re.compile(r"\d|\$|%")


def _has_metric(bullet):
    return bool(_METRIC_RE.search(bullet))


def validate_profile(prof):
    """Return a list of human-readable problems. Empty list == ready to use."""
    problems = []

    if not prof.get("name"):
        problems.append("Missing name")

    c = prof.get("contact", {})
    if "@" not in (c.get("email") or ""):
        problems.append("Missing or invalid contact email")
    if not c.get("phone"):
        problems.append("Missing contact phone")
    if not c.get("location"):
        problems.append("Missing contact location")

    if len((prof.get("summary") or "").split()) < 10:
        problems.append("Summary is missing or too short (aim for 2–3 sentences)")

    if len(prof.get("competencies", [])) < 4:
        problems.append("Need at least 4 core competencies")

    exp = prof.get("experience", [])
    if len(exp) < 2:
        problems.append("Need at least 2 experience roles")

    quantified = 0
    roles_missing_metric = 0
    for r in exp:
        bullets = r.get("bullets", [])
        if not bullets:
            label = r.get("employer") or r.get("title") or "?"
            problems.append(f"Role '{label}' has no achievement bullets")
            roles_missing_metric += 1
            continue
        metric_bullets = [b for b in bullets if _has_metric(b)]
        quantified += len(metric_bullets)
        if not metric_bullets:
            roles_missing_metric += 1
    if quantified < 3 or roles_missing_metric > 0:
        problems.append(
            "Experience bullets need more quantified metrics "
            "(every role should have at least one $/%/number result)")

    if not prof.get("education"):
        problems.append("Missing education")

    return problems


# ── Job-description matching ─────────────────────────────────────────────────

STOPWORDS = set("""
a an the and or to of in on for with you your we our us is are be been being will
this that these those as at by from into over under about across also can may must
have has had do does done not no so if then than such own more most other any all
who whom which it its their them they he she his her him plus etc per via while
hiring hire join role roles team teams looking seeking ideal candidate candidates
responsibilities requirements ability able strong excellent great good new
""".split())


def extract_jd_keywords(jd_text):
    """Return a set of significant lowercased keywords from a job description."""
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9+/&\-]*", (jd_text or "").lower())
    keywords = set()
    for tok in tokens:
        tok = tok.strip("-/&")
        if len(tok) < 3 or tok in STOPWORDS:
            continue
        keywords.add(tok)
    return keywords


def coverage_score(prof, keywords):
    """Fraction of JD keywords that have supporting evidence in the profile."""
    if not keywords:
        return 0.0
    text = _profile_text(prof).lower()
    matched = sum(1 for k in keywords if k in text)
    return matched / len(keywords)


# ── Resume rendering ─────────────────────────────────────────────────────────

def build_resume(prof, jd_text, variant="exec_onepage"):
    """Render a tailored resume (Markdown) for the given variant."""
    keywords = extract_jd_keywords(jd_text or "")
    if variant == "exec_onepage":
        return _build_exec(prof, keywords)
    if variant == "ats_twopage":
        return _build_ats(prof, keywords)
    raise ValueError(f"unknown variant: {variant!r} "
                     "(use 'exec_onepage' or 'ats_twopage')")


def _contact_line(prof):
    c = prof.get("contact", {})
    parts = [c.get("email"), c.get("phone"), c.get("location"), c.get("linkedin")]
    return " · ".join(p for p in parts if p)


def _dates(role):
    return f"{role.get('start', '')}–{role.get('end', '')}".strip("–").strip()


def _relevance(role, keywords):
    text = " ".join([role.get("title", ""), role.get("employer", "")]
                    + role.get("bullets", [])).lower()
    return sum(1 for k in keywords if k in text)


def _build_exec(prof, keywords):
    out = [f"# {prof.get('name', '')}", _contact_line(prof), ""]

    out.append("## Summary")
    words = (prof.get("summary") or "").split()
    out.append(" ".join(words[:55]) + ("…" if len(words) > 55 else ""))
    out.append("")

    out.append("## Core Competencies")
    out.append(" · ".join(prof.get("competencies", [])[:6]))
    out.append("")

    out.append("## Experience")
    roles = sorted(prof.get("experience", []),
                   key=lambda r: _relevance(r, keywords), reverse=True)[:3]
    for r in roles:
        head = f"### {r.get('title', '')} — {r.get('employer', '')}"
        if _dates(r):
            head += f" ({_dates(r)})"
        out.append(head)
        for b in r.get("bullets", [])[:2]:
            out.append(f"- {b}")
        out.append("")

    return "\n".join(out).strip()


def _build_ats(prof, keywords):
    out = [f"# {prof.get('name', '')}", _contact_line(prof), ""]

    out.append("## Professional Summary")
    out.append(prof.get("summary", ""))
    out.append("")

    out.append("## Core Competencies")
    for comp in prof.get("competencies", []):
        out.append(f"- {comp}")
    out.append("")

    # Surface JD keywords that are actually backed by the profile — never invent.
    text = _profile_text(prof).lower()
    evidenced = [k for k in sorted(keywords) if k in text]
    if evidenced:
        out.append("## Skills & Keywords")
        out.append(", ".join(evidenced))
        out.append("")

    out.append("## Professional Experience")
    for r in prof.get("experience", []):
        head = f"### {r.get('title', '')} — {r.get('employer', '')}"
        if _dates(r):
            head += f" ({_dates(r)})"
        if r.get("location"):
            head += f" | {r['location']}"
        out.append(head)
        for b in r.get("bullets", []):
            out.append(f"- {b}")
        out.append("")

    if prof.get("education"):
        out.append("## Education")
        for e in prof["education"]:
            out.append(f"- {e}")
        out.append("")

    if prof.get("certifications"):
        out.append("## Certifications")
        for cert in prof["certifications"]:
            out.append(f"- {cert}")

    return "\n".join(out).strip()


def _profile_text(prof):
    """Flatten the whole profile into one searchable string."""
    parts = [prof.get("name", ""), prof.get("summary", "")]
    parts += prof.get("competencies", [])
    for r in prof.get("experience", []):
        parts += [r.get("title", ""), r.get("employer", ""), r.get("location", "")]
        parts += r.get("bullets", [])
    parts += prof.get("education", [])
    parts += prof.get("certifications", [])
    return " ".join(p for p in parts if p)
