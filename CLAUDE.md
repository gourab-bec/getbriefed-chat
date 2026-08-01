# Gourab's Venture Portfolio — Session Router

This repo hosts three agent-run ventures. All work lives on branch
`claude/clinkit-hyperlocal-marketplace-8ohukb` — **check it out before doing anything**:
`git checkout claude/clinkit-hyperlocal-marketplace-8ohukb && git pull`.

| Working on… | Go to | Charter |
|---|---|---|
| ZipNab (delivery marketplace) | `clinkit/` | `portfolio/zipnab-master.md` |
| MountainHouseLive (talk show) | `mhlive/` | `mhlive/agents/00-MASTER-AGENT.md` |
| Data & AI consultancy | `portfolio/` | `portfolio/dataai-master.md` (inputs: `portfolio/dataai-inputs.md`) |

Portfolio-wide rules: `portfolio/README.md` — the founder-time contract (~7 hrs/wk), the
autopilot boundary (agents never sign, spend, appear on camera, or send from the founder's
personal accounts), and the Accenture-conflict + county-disclosure rails.

Conventions: every venture session ends by committing its outputs (reports to
`reports/<venture>/YYYY-MM-DD.md`, doc/code changes in place) and pushing to the branch
above. Tests must stay green (`cd clinkit/server && node --test test/*.test.js`). Founder
decisions go in the report under "## Founder queue" — never assumed, never skipped.
