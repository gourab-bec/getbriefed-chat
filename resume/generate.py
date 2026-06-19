#!/usr/bin/env python3
"""
CLI for the resume toolkit.

Usage:
  # Validate that a profile has enough info to produce a solid resume
  python3 resume/generate.py validate [PROFILE.md]

  # Generate a tailored resume from a profile + a job description
  python3 resume/generate.py build  --jd path/to/jd.txt  [--profile PROFILE.md] \\
                                     --variant exec_onepage|ats_twopage|both

If --profile is omitted it defaults to resume/PROFILE.md (your real, local-only
profile), falling back to resume/profile.example.md if that does not exist.
You can also pipe a JD on stdin instead of --jd.
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import profile as P  # noqa: E402

DEFAULT_PROFILE = os.path.join(HERE, "PROFILE.md")
EXAMPLE_PROFILE = os.path.join(HERE, "profile.example.md")


def _resolve_profile(path):
    if path:
        return path
    if os.path.exists(DEFAULT_PROFILE):
        return DEFAULT_PROFILE
    return EXAMPLE_PROFILE


def _load(path):
    with open(path, "r", encoding="utf-8") as fh:
        return P.parse_profile(fh.read())


def cmd_validate(args):
    path = _resolve_profile(args.profile)
    prof = _load(path)
    problems = P.validate_profile(prof)
    print(f"Profile: {path}")
    if not problems:
        print("✅ Profile is complete — ready to generate resumes.")
        return 0
    print(f"❌ {len(problems)} issue(s) to fix before generating a strong resume:")
    for p in problems:
        print(f"  • {p}")
    return 1


def _read_jd(args):
    if args.jd:
        with open(args.jd, "r", encoding="utf-8") as fh:
            return fh.read()
    if not sys.stdin.isatty():
        return sys.stdin.read()
    sys.exit("error: provide a job description via --jd PATH or stdin")


def cmd_build(args):
    path = _resolve_profile(args.profile)
    prof = _load(path)
    jd = _read_jd(args)

    problems = P.validate_profile(prof)
    if problems:
        sys.stderr.write(
            f"⚠️  Profile '{path}' has {len(problems)} gap(s); "
            "resume may be incomplete. Run `validate` for details.\n")

    score = P.coverage_score(prof, P.extract_jd_keywords(jd))
    sys.stderr.write(f"JD keyword coverage by profile: {score:.0%}\n")

    variants = (["exec_onepage", "ats_twopage"]
                if args.variant == "both" else [args.variant])
    for i, v in enumerate(variants):
        if i:
            print("\n\n" + "=" * 70 + "\n")
        print(f"<!-- variant: {v} -->")
        print(P.build_resume(prof, jd, variant=v))
    return 0


def main():
    ap = argparse.ArgumentParser(description="Resume toolkit CLI")
    sub = ap.add_subparsers(dest="cmd", required=True)

    v = sub.add_parser("validate", help="check a profile is resume-ready")
    v.add_argument("profile", nargs="?", default=None)
    v.set_defaults(func=cmd_validate)

    b = sub.add_parser("build", help="generate a tailored resume from a JD")
    b.add_argument("--profile", default=None)
    b.add_argument("--jd", default=None, help="path to job-description text")
    b.add_argument("--variant", default="both",
                   choices=["exec_onepage", "ats_twopage", "both"])
    b.set_defaults(func=cmd_build)

    args = ap.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
