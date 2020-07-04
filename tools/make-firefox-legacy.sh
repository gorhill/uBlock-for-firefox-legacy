#!/usr/bin/env bash
#
# This script assumes a linux environment

echo "*** uBlock0.firefox-legacy: Copying files"

# Script should aways start at root/repo path
ROOT_PATH=$(dirname "$(realpath -s "$0")")/..
cd "$ROOT_PATH" || exit

BLDIR=dist/build
DES="$BLDIR"/uBlock0.firefox-legacy
rm -rf $DES
mkdir -p $DES

bash ./tools/make-assets.sh $DES

cp -R src/css                           $DES/
cp -R src/img                           $DES/
cp -R src/js                            $DES/
cp -R src/lib                           $DES/
cp -R src/_locales                      $DES/
cp    src/*.html                        $DES/

mv    $DES/img/icon_128.png             $DES/icon.png
cp    platform/firefox/css/*            $DES/css/
cp    platform/firefox/polyfill.js      $DES/js/
cp    platform/firefox/vapi-*.js        $DES/js/
cp    platform/firefox/bootstrap.js     $DES/
cp    platform/firefox/processScript.js $DES/
cp    platform/firefox/frame*.js        $DES/
cp -R platform/firefox/img              $DES/
cp    platform/firefox/chrome.manifest  $DES/
cp    platform/firefox/install.rdf      $DES/
cp    platform/firefox/*.xul            $DES/
cp    LICENSE.txt                       $DES/

echo "*** uBlock0.firefox-legacy: concatenating content scripts"
cat $DES/js/vapi-usercss.js > /tmp/contentscript.js
{
    echo
    grep -v "^'use strict';$" $DES/js/vapi-usercss.real.js
    echo
    grep -v "^'use strict';$" $DES/js/contentscript.js
} >> /tmp/contentscript.js
mv /tmp/contentscript.js $DES/js/contentscript.js
rm $DES/js/vapi-usercss.js
rm $DES/js/vapi-usercss.real.js

echo "*** uBlock0.firefox-legacy: Generating meta..."
python tools/make-firefox-legacy-meta.py $DES/

if [ "$1" = all ]; then
    echo "*** uBlock0.firefox-legacy: Creating package..."
    pushd $DES > /dev/null || exit
    zip ../uBlock0.firefox-legacy.xpi -qr -- *
    popd > /dev/null || exit
elif [ -n "$1" ]; then
    echo "*** uBlock0.firefox-legacy: Creating versioned package..."
    pushd $DES > /dev/null || exit
    zip ../uBlock0.firefox-legacy.xpi -qr -- *
    popd > /dev/null || exit
    mv "$BLDIR"/uBlock0.firefox-legacy.xpi "$BLDIR"/uBlock0_"$1".firefox-legacy.xpi
fi

echo "*** uBlock0.firefox-legacy: Package done."
