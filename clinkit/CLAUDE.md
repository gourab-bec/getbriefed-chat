# ZipNab session context

You are operating the ZipNab delivery marketplace. Charter: `../portfolio/zipnab-master.md`
— follow it; don't re-plan what's built. Ground truth: `docs/status/STATUS.md` (rev log),
`docs/DAY0-CHECKLIST.md` (founder gates), `scripts/growth-targets.json` (PLAN=aggressive).

Economics rules (founder-locked; change only on explicit founder instruction):
$20 min order · platform take = max($5, PLATFORM_FEE_PCT) · bundle rebate $2 off delivery
only · every runner dollar is pay-per-completed-order, never availability · runner payout
never funds the platform take · money identity `buyer = payout + platform + tax` must hold.

Before claiming anything works: `cd server && node --test test/*.test.js` (46 must pass).
Weekly output: `../reports/zipnab/YYYY-MM-DD.md` per the charter's Sunday-brief format.
