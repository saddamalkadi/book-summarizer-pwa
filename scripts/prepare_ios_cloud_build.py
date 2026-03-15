from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: prepare_ios_cloud_build.py <build_number> <marketing_version>")
        return 1

    build_number = str(sys.argv[1]).strip()
    marketing_version = str(sys.argv[2]).strip()
    if not build_number.isdigit():
        raise SystemExit("build_number must be numeric")
    if not marketing_version:
        raise SystemExit("marketing_version is required")

    pbxproj = Path("ios/App/App.xcodeproj/project.pbxproj")
    text = pbxproj.read_text(encoding="utf-8")
    text = re.sub(r"CURRENT_PROJECT_VERSION = \d+;", f"CURRENT_PROJECT_VERSION = {build_number};", text)
    text = re.sub(r"MARKETING_VERSION = [^;]+;", f"MARKETING_VERSION = {marketing_version};", text)
    pbxproj.write_text(text, encoding="utf-8")
    print(f"Prepared iOS cloud build with build_number={build_number} marketing_version={marketing_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
