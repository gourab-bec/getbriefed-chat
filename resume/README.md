# Resume Toolkit

Turn a structured career profile + a job description into two tailored resume
variants (an executive one-pager and an ATS-optimized version), with a test
suite that proves the profile contains enough to produce a solid resume.

This lives inside `getbriefed-chat` but is **independent of the website** — none
of it is served by the static site.

## Files

| Path | Purpose | Committed? |
| --- | --- | --- |
| `lib/profile.py` | Pure functions: parse, validate, JD-match, render | yes |
| `tests/test_profile.py` | TDD suite (13 tests) | yes |
| `generate.py` | CLI: `validate` and `build` | yes |
| `PROFILE.template.md` | Blank structured template to copy | yes |
| `profile.example.md` | **Synthetic** fixture for the tests (no real data) | yes |
| `GENERATION_GUIDE.md` | The JD → resume methodology | yes |
| `PROFILE.md` | **Your real career data** | **no — git-ignored, local-only** |

## Quick start

```bash
# 1. Create your private profile from the template
cp resume/PROFILE.template.md resume/PROFILE.md   # then fill it with real facts

# 2. Make sure it's complete enough for a strong resume
python3 resume/generate.py validate

# 3. Generate tailored resumes from a job description
python3 resume/generate.py build --jd jd.txt --variant both
```

## Run the tests

```bash
python3 -m unittest discover -s resume/tests -v
```

## Where the real data comes from

The authoritative career history is the Agent Gourab knowledge base (stored in
Supabase, managed via the `agent-gourab-api` / `agent-gourab-console` repos).
Once one of those is added to the working session, populate `resume/PROFILE.md`
from it. Until then, `profile.example.md` is synthetic and exists only so the
tests can run.
