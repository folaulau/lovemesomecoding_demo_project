#!/usr/bin/env bash
#
# Regenerates Pizza.xcodeproj from project.yml.
#
# The generated project is COMMITTED, so this only needs running after project.yml changes — and
# both files are then committed together.
#
# ⚠️ The objectVersion rewrite at the end is not cosmetic.
#
# XcodeGen 2.46 writes object version 77, the project format Xcode 16 introduced, and it does so
# even when `options.objectVersion` asks for something else — the option parses (confirm with
# `xcodegen dump --type yaml`) and is then ignored. Xcode 15 refuses such a project outright:
#
#     The project 'Pizza' cannot be opened because it is in a future Xcode project file format (77).
#
# Format 56 is what Xcode 13 through 15 write, and Xcode 16 opens it without complaint, so the lower
# number is the compatible one rather than the worse one. The rewrite is safe here because the
# generated project uses classic PBXBuildFile groups, not the PBXFileSystemSynchronizedRootGroup
# entries that genuinely require 77 — the check below fails loudly if that ever stops being true.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v xcodegen >/dev/null 2>&1; then
    echo "error: xcodegen is not installed. Run: brew install xcodegen" >&2
    exit 1
fi

xcodegen generate

PBXPROJ="Pizza.xcodeproj/project.pbxproj"

if grep -q "PBXFileSystemSynchronizedRootGroup" "$PBXPROJ"; then
    echo "error: the generated project uses synchronized groups, which require object version 77." >&2
    echo "       Remove the downgrade below and raise the minimum Xcode version instead." >&2
    exit 1
fi

sed -i '' \
    -e 's/objectVersion = 77;/objectVersion = 56;/' \
    -e '/preferredProjectObjectVersion = 77;/d' \
    "$PBXPROJ"

echo "Generated Pizza.xcodeproj (object version 56, readable by Xcode 15 and later)."
