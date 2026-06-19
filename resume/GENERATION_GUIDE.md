# Resume Generation Guide

This is the methodology an AI assistant (or the `generate.py` CLI) follows to
turn a **structured profile** + a **job description (JD)** into two tailored
resume variants. The single source of truth for the candidate's facts is
`resume/PROFILE.md` (local-only) — or, once available, the authoritative career
MD from the Agent Gourab knowledge base (Supabase / `agent-gourab-api`).

## Golden rule

**Never fabricate.** Titles, employers, dates, deal sizes, percentages, and
metrics may only come from the profile. If the JD asks for something the profile
doesn't support, omit it — do not invent it. When a gap matters, flag it to the
user instead of papering over it.

## Inputs

1. **Profile** — `resume/PROFILE.md`, structured per `PROFILE.template.md`.
2. **Job description** — pasted in chat or passed via `--jd`.

## Process

1. **Validate the profile.** Run `validate_profile` (or
   `python3 resume/generate.py validate`). Resolve missing sections, contact
   details, and un-quantified bullets before generating.
2. **Parse the JD.** Extract the significant keywords/requirements
   (`extract_jd_keywords`) — skills, tools, methodologies, seniority, domain.
3. **Score coverage.** `coverage_score` reports how much of the JD the profile
   already supports. High coverage → a strong, honest match. Low coverage →
   tell the user this role is a stretch and where.
4. **Select & order evidence.** Rank experience by relevance to the JD keywords;
   lead with the most relevant roles and the bullets that map to the JD's stated
   priorities. Mirror the JD's vocabulary **only where the profile backs it up.**
5. **Render both variants** (below).
6. **Review.** Re-read against the golden rule; confirm every claim traces to the
   profile.

## Variants

### `exec_onepage` — concise executive one-pager
- Audience: hiring managers / executives skimming quickly.
- Contents: name + contact, a tight summary (≤ ~55 words), top 6 competencies,
  and the 3 most relevant roles with the 2 strongest bullets each.
- Budget: keep it to roughly one page (the test suite enforces ≤ 600 words).

### `ats_twopage` — ATS-optimized, keyword-rich
- Audience: applicant-tracking-system parsers and recruiters.
- Contents: full summary, full competency list, a **Skills & Keywords** line that
  surfaces JD terms *that the profile actually supports*, all roles with all
  bullets, education, and certifications.
- Goal: maximize legitimate keyword overlap with the JD without keyword-stuffing
  or inventing experience.

## CLI quick reference

```bash
python3 resume/generate.py validate                     # check PROFILE.md
python3 resume/generate.py build --jd jd.txt --variant both
cat jd.txt | python3 resume/generate.py build           # JD via stdin
```

## Using it from a chat prompt

When the user pastes a JD here and asks for a resume:
1. Load `resume/PROFILE.md` (or the authoritative KB MD once accessible).
2. Follow the process above.
3. Return both variants, then note any JD requirements the profile couldn't
   substantiate so the user can decide whether to add real supporting facts.
