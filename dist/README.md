## INSTALL

### Firefox legacy

Compatible with Firefox 24-56, [Pale Moon](https://www.palemoon.org/) and [SeaMonkey](http://www.seamonkey-project.org/).

- Download `ublock0.firefox-legacy.xpi` ([latest release desirable](https://github.com/gorhill/uBlock-for-firefox-legacy/releases)).
    - Right-click and select "Save Link As..."
- Drag and drop the previously downloaded `ublock0.firefox-legacy.xpi` into the browser.

With Firefox 43 and beyond, you may need to toggle the setting `xpinstall.signatures.required` to `false` in `about:config`.<sup>[see "Add-on signing in Firefox"](https://support.mozilla.org/en-US/kb/add-on-signing-in-firefox)</sup>

Your uBlock Origin settings are kept intact even after you uninstall the addon.

On Linux, the settings are saved in a SQlite file located at `~/.mozilla/firefox/[profile name]/extension-data/ublock0.sqlite`.

On Windows, the settings are saved in a SQlite file located at `%APPDATA%\Mozilla\Firefox\Profiles\[profile name]\extension-data\ublock0.sqlite`.

### Build instructions (for developers)

- Clone [uBlock](https://github.com/gorhill/uBlock-for-firefox-legacy) and [uAssets](https://github.com/uBlockOrigin/uAssets) repositories in the same parent directory
    - `git clone https://github.com/gorhill/uBlock-for-firefox-legacy.git`
    - `git clone https://github.com/uBlockOrigin/uAssets.git`
- Set path to uBlock: `cd uBlock-for-firefox-legacy`
- The official version of uBO is in the `master` branch
    - `git checkout master`
- Build the plugin:
    - `./tools/make-firefox-legacy.sh all`
- Load the result of the build into your browser:
    - Drag-and-drop `/uBlock-for-firefox-legacy/dist/build/uBlock0.firefox-legacy.xpi` into the browser.
