#!/bin/bash
#
# This script assumes a linux environment
#
# Example: import-upstream-translation.sh popupTipNoScripting1 popupTipNoScripting2 settingsNoScriptingPrompt

SCRIPT_PATH=$(dirname "$(realpath -s "$0")")
MAIN_PATH="$SCRIPT_PATH"/..
TEMP=${MAIN_PATH}/src/_locales/temp.json

for i in "$@"; do
    mapfile -t locales <  <(find "$MAIN_PATH"/src/_locales/* -type d -exec basename {} \;)
    for locale in "${locales[@]}"; do
        jq -r "{$i: .$i}" "$(realpath "$MAIN_PATH"/../uBlock/src/_locales/"$locale"/messages.json)" > "$TEMP"
        jq -s add "$(realpath "$MAIN_PATH"/src/_locales/"$locale"/messages.json)" "$TEMP" > "$TEMP".2
        mv "$TEMP".2 "$(realpath "$MAIN_PATH"/src/_locales/"$locale"/messages.json)"
        rm -rf "$TEMP"
    done
done

echo "*** uBlock Origin: Import done."
