"""
TDD suite for the resume toolkit.

These tests assert two things the user actually cares about:
  1. A profile MD file contains *enough* structured information to produce a
     solid resume (completeness gate via `validate_profile`).
  2. A job description can be mapped into the profile and rendered into the two
     required resume variants (exec one-pager + ATS two-pager).

Run:  python3 -m unittest discover -s resume/tests -v
   or: python3 resume/tests/test_profile.py
"""
import os
import sys
import unittest

# Make `resume/lib` importable regardless of CWD.
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)              # resume/
sys.path.insert(0, ROOT)

from lib import profile as P  # noqa: E402

EXAMPLE = os.path.join(ROOT, "profile.example.md")

SALES_JD = """
Senior Enterprise Account Executive — Cloud Platform

We are hiring an enterprise sales executive to close complex, multi-stakeholder
SaaS and cloud deals with Fortune 500 accounts. You will own quota, build C-suite
relationships, drive consultative deal strategy (MEDDPICC), manage forecasting and
pipeline, and co-sell with strategic partners. Leadership and mentoring a plus.
"""


def load_example():
    with open(EXAMPLE, "r", encoding="utf-8") as fh:
        return P.parse_profile(fh.read())


class TestParsing(unittest.TestCase):
    def test_parses_header_and_contact(self):
        prof = load_example()
        self.assertEqual(prof["name"], "Alex Morgan")
        self.assertEqual(prof["contact"]["email"], "alex.morgan@example.com")
        self.assertTrue(prof["contact"]["phone"])
        self.assertIn("San Francisco", prof["contact"]["location"])

    def test_parses_sections(self):
        prof = load_example()
        self.assertTrue(prof["summary"])
        self.assertGreaterEqual(len(prof["competencies"]), 4)
        self.assertGreaterEqual(len(prof["experience"]), 3)
        self.assertTrue(prof["education"])

    def test_experience_entries_are_structured(self):
        prof = load_example()
        first = prof["experience"][0]
        for key in ("title", "employer", "start", "end", "bullets"):
            self.assertIn(key, first)
        self.assertEqual(first["employer"], "Northwind Cloud")
        self.assertGreaterEqual(len(first["bullets"]), 1)


class TestValidation(unittest.TestCase):
    def test_complete_profile_passes(self):
        prof = load_example()
        problems = P.validate_profile(prof)
        self.assertEqual(problems, [], f"expected no problems, got: {problems}")

    def test_missing_contact_is_flagged(self):
        prof = load_example()
        prof["contact"]["email"] = ""
        problems = P.validate_profile(prof)
        self.assertTrue(any("email" in p.lower() for p in problems))

    def test_unquantified_experience_is_flagged(self):
        prof = load_example()
        # Strip every metric (digits / $ / %) from the bullets.
        for role in prof["experience"]:
            role["bullets"] = ["Did sales things with no numbers"]
        problems = P.validate_profile(prof)
        self.assertTrue(any("quantif" in p.lower() or "metric" in p.lower()
                            for p in problems))

    def test_too_few_roles_is_flagged(self):
        prof = load_example()
        prof["experience"] = prof["experience"][:1]
        problems = P.validate_profile(prof)
        self.assertTrue(any("experience" in p.lower() or "role" in p.lower()
                            for p in problems))


class TestJobDescriptionMatching(unittest.TestCase):
    def test_keyword_extraction_drops_stopwords(self):
        kws = P.extract_jd_keywords(SALES_JD)
        self.assertIn("meddpicc", kws)
        self.assertIn("forecasting", kws)
        self.assertNotIn("the", kws)
        self.assertNotIn("and", kws)

    def test_matching_profile_scores_high(self):
        prof = load_example()
        kws = P.extract_jd_keywords(SALES_JD)
        score = P.coverage_score(prof, kws)
        self.assertGreaterEqual(score, 0.5,
                                f"coverage unexpectedly low: {score:.2f}")

    def test_unrelated_jd_scores_low(self):
        prof = load_example()
        kws = P.extract_jd_keywords(
            "Pediatric registered nurse for neonatal intensive care unit, "
            "phlebotomy, triage, immunization, electronic health records.")
        score = P.coverage_score(prof, kws)
        self.assertLess(score, 0.5)


class TestResumeBuilding(unittest.TestCase):
    def test_exec_onepage_has_core_sections_and_fits(self):
        prof = load_example()
        md = P.build_resume(prof, SALES_JD, variant="exec_onepage")
        self.assertIn("Alex Morgan", md)
        self.assertIn(prof["contact"]["email"], md)
        self.assertRegex(md.lower(), r"summary|profile")
        self.assertRegex(md.lower(), r"experience")
        # One-pager budget: keep it tight.
        self.assertLessEqual(len(md.split()), 600,
                             "exec one-pager exceeds ~1 page word budget")

    def test_ats_twopage_mirrors_jd_keywords(self):
        prof = load_example()
        md = P.build_resume(prof, SALES_JD, variant="ats_twopage").lower()
        kws = P.extract_jd_keywords(SALES_JD)
        # Keywords that have evidence in the profile must surface in the resume.
        evidenced = [k for k in kws if k in P._profile_text(prof).lower()]
        present = [k for k in evidenced if k in md]
        self.assertGreaterEqual(len(present), max(3, len(evidenced) // 2))

    def test_unknown_variant_raises(self):
        prof = load_example()
        with self.assertRaises(ValueError):
            P.build_resume(prof, SALES_JD, variant="nope")


if __name__ == "__main__":
    unittest.main(verbosity=2)
