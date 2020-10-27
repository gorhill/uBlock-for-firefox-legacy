#!/usr/bin/env bash
#
# This script assumes a linux environment
#
# Example: import-upstream-translation.sh popupTipNoScripting1 popupTipNoScripting2 settingsNoScriptingPrompt

SCRIPT_PATH="$(cd "$(dirname "$0")">/dev/null 2>&1; pwd -P)"
SRC_PATH="$SCRIPT_PATH"/../../uBlock/src/_locales/
DST_PATH="$SCRIPT_PATH"/../src/_locales/
TEMP="$DST_PATH"temp.json

locales=($(find "$DST_PATH"* -type d -exec basename {} \;))

for i in "$@"; do
    for locale in "${locales[@]}"; do
        jq --arg i "$i" -r '{($i): .[$i]}' "${SRC_PATH}${locale}/messages.json" > "$TEMP"
        jq -s add "${DST_PATH}${locale}/messages.json" "$TEMP" > "$TEMP".2
        mv "$TEMP".2 "${DST_PATH}${locale}/messages.json"
        rm -f "$TEMP"
    done
done

echo "*** uBlock Origin: Import done."
