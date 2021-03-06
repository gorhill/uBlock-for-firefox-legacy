/*******************************************************************************

    uBlock Origin - a browser extension to block requests.
    Copyright (C) 2014-2018 Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

/* global uDom */

'use strict';

/******************************************************************************/

(function() {

/******************************************************************************/


const lastUpdateTemplateString = vAPI.i18n('3pLastUpdate');
const reValidExternalList = /[a-z-]+:\/\/\S*\/\S+/;

let listDetails = {};
let filteringSettingsHash = '';
let hideUnusedSet = new Set();

/******************************************************************************/

var onMessage = function(msg) {
    switch ( msg.what ) {
    case 'assetUpdated':
        updateAssetStatus(msg);
        break;
    case 'assetsUpdated':
        document.body.classList.remove('updating');
        renderWidgets();
        break;
    case 'staticFilteringDataChanged':
        renderFilterLists();
        break;
    default:
        break;
    }
};

var messaging = vAPI.messaging;
messaging.addChannelListener('dashboard', onMessage);

/******************************************************************************/

var renderNumber = function(value) {
    return value.toLocaleString();
};

/******************************************************************************/

var renderFilterLists = function(soft) {
    var listGroupTemplate = uDom('#templates .groupEntry'),
        listEntryTemplate = uDom('#templates .listEntry'),
        listStatsTemplate = vAPI.i18n('3pListsOfBlockedHostsPerListStats'),
        renderElapsedTimeToString = vAPI.i18n.renderElapsedTimeToString,
        groupNames = new Map();

    // Assemble a pretty list name if possible
    var listNameFromListKey = function(listKey) {
        var list = listDetails.current[listKey] || listDetails.available[listKey];
        var listTitle = list ? list.title : '';
        if ( listTitle === '' ) { return listKey; }
        return listTitle;
    };

    var liFromListEntry = function(listKey, li, hideUnused) {
        var entry = listDetails.available[listKey],
            elem;
        if ( !li ) {
            li = listEntryTemplate.clone().nodeAt(0);
        }
        var on = entry.off !== true;
        li.classList.toggle('checked', on);
        if ( li.getAttribute('data-listkey') !== listKey ) {
            li.setAttribute('data-listkey', listKey);
            elem = li.querySelector('input[type="checkbox"]');
            elem.checked = on;
            elem = li.querySelector('.listname');
            elem.textContent = listNameFromListKey(listKey);
            elem = li.querySelector('a.content');
            elem.setAttribute('href', 'asset-viewer.html?url=' + encodeURI(listKey));
            elem.setAttribute('type', 'text/html');
            li.classList.remove('toRemove');
            if ( entry.supportName ) {
                li.classList.add('support');
                elem = li.querySelector('a.support');
                elem.setAttribute('href', entry.supportURL);
                elem.setAttribute('title', entry.supportName);
            } else {
                li.classList.remove('support');
            }
            if ( entry.external ) {
                li.classList.add('external');
            } else {
                li.classList.remove('external');
            }
            if ( entry.instructionURL ) {
                li.classList.add('mustread');
                elem = li.querySelector('a.mustread');
                elem.setAttribute('href', entry.instructionURL);
            } else {
                li.classList.remove('mustread');
            }
            li.classList.toggle('unused', hideUnused && !on);
        }
        // https://github.com/gorhill/uBlock/issues/1429
        if ( !soft ) {
            li.querySelector('input[type="checkbox"]').checked = on;
        }
        elem = li.querySelector('span.counts');
        var text = '';
        if ( !isNaN(+entry.entryUsedCount) && !isNaN(+entry.entryCount) ) {
            text = listStatsTemplate
                .replace('{{used}}', renderNumber(on ? entry.entryUsedCount : 0))
                .replace('{{total}}', renderNumber(entry.entryCount));
        }
        elem.textContent = text;
        // https://github.com/chrisaljoudi/uBlock/issues/104
        var asset = listDetails.cache[listKey] || {};
        var remoteURL = asset.remoteURL;
        li.classList.toggle(
            'unsecure',
            typeof remoteURL === 'string' && remoteURL.lastIndexOf('http:', 0) === 0
        );
        li.classList.toggle('failed', asset.error !== undefined);
        li.classList.toggle('obsolete', asset.obsolete === true);
        if ( asset.cached === true ) {
            li.classList.add('cached');
            li.querySelector('.status.cache').setAttribute(
                'title',
                lastUpdateTemplateString.replace(
                    '{{ago}}',
                    renderElapsedTimeToString(asset.writeTime)
                )
            );
        } else {
            li.classList.remove('cached');
        }
        li.classList.remove('discard');
        return li;
    };

    var listEntryCountFromGroup = function(listKeys) {
        if ( Array.isArray(listKeys) === false ) { return ''; }
        var count = 0,
            total = 0;
        var i = listKeys.length;
        while ( i-- ) {
            if ( listDetails.available[listKeys[i]].off !== true ) {
                count += 1;
            }
            total += 1;
        }
        return total !== 0 ?
            '(' + count.toLocaleString() + '/' + total.toLocaleString() + ')' :
            '';
    };

    var liFromListGroup = function(groupKey, listKeys) {
        var liGroup = document.querySelector('#lists > .groupEntry[data-groupkey="' + groupKey + '"]');
        if ( liGroup === null ) {
            liGroup = listGroupTemplate.clone().nodeAt(0);
            var groupName = groupNames.get(groupKey);
            if ( groupName === undefined ) {
                groupName = vAPI.i18n('3pGroup' + groupKey.charAt(0).toUpperCase() + groupKey.slice(1));
                // Category "Social" is being renamed "Annoyances": ensure
                // smooth transition.
                // TODO: remove when majority of users are post-1.14.8 uBO.
                if ( groupName === '' && groupKey === 'social' ) {
                    groupName = vAPI.i18n('3pGroupAnnoyances');
                }
                groupNames.set(groupKey, groupName);
            }
            if ( groupName !== '' ) {
                liGroup.querySelector('.geName').textContent = groupName;
            }
        }
        if ( liGroup.querySelector('.geName:empty') === null ) {
            liGroup.querySelector('.geCount').textContent = listEntryCountFromGroup(listKeys);
        }
        var hideUnused = mustHideUnusedLists(groupKey);
        liGroup.classList.toggle('hideUnused', hideUnused);
        var ulGroup = liGroup.querySelector('.listEntries');
        if ( !listKeys ) { return liGroup; }
        listKeys.sort(function(a, b) {
            return (listDetails.available[a].title || '').localeCompare(listDetails.available[b].title || '');
        });
        for ( var i = 0; i < listKeys.length; i++ ) {
            var liEntry = liFromListEntry(
                listKeys[i],
                ulGroup.children[i],
                hideUnused
            );
            if ( liEntry.parentElement === null ) {
                ulGroup.appendChild(liEntry);
            }
        }
        return liGroup;
    };

    var groupsFromLists = function(lists) {
        var groups = {};
        var listKeys = Object.keys(lists);
        var i = listKeys.length;
        var listKey, list, groupKey;
        while ( i-- ) {
            listKey = listKeys[i];
            list = lists[listKey];
            groupKey = list.group || 'nogroup';
            if ( groups[groupKey] === undefined ) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(listKey);
        }
        return groups;
    };

    var onListsReceived = function(details) {
        // Before all, set context vars
        listDetails = details;

        // "My filters" will now sit in its own group. The following code
        // ensures smooth transition.
        listDetails.available['user-filters'].group = 'user';

        // Incremental rendering: this will allow us to easily discard unused
        // DOM list entries.
        uDom('#lists .listEntries .listEntry[data-listkey]').addClass('discard');

        // Remove import widget while we recreate list of lists.
        var importWidget = uDom('.listEntry.toImport').detach();

        // Visually split the filter lists in purpose-based groups
        var ulLists = document.querySelector('#lists'),
            groups = groupsFromLists(details.available),
            liGroup, i, groupKey,
            groupKeys = [
                'user',
                'default',
                'ads',
                'privacy',
                'malware',
                'social',
                'multipurpose',
                'regions',
                'custom'
            ];
        document.body.classList.toggle('hideUnused', mustHideUnusedLists('*'));
        for ( i = 0; i < groupKeys.length; i++ ) {
            groupKey = groupKeys[i];
            liGroup = liFromListGroup(groupKey, groups[groupKey]);
            liGroup.setAttribute('data-groupkey', groupKey);
            liGroup.classList.toggle(
                'collapsed',
                vAPI.localStorage.getItem('collapseGroup' + (i + 1)) === 'y'
            );
            if ( liGroup.parentElement === null ) {
                ulLists.appendChild(liGroup);
            }
            delete groups[groupKey];
        }
        // For all groups not covered above (if any left)
        groupKeys = Object.keys(groups);
        for ( i = 0; i < groupKeys.length; i++ ) {
            groupKey = groupKeys[i];
            ulLists.appendChild(liFromListGroup(groupKey, groups[groupKey]));
        }

        uDom('#lists .listEntries .listEntry.discard').remove();

        // Re-insert import widget.
        uDom('[data-groupkey="custom"] .listEntries').append(importWidget);

        uDom.nodeFromId('autoUpdate').checked = listDetails.autoUpdate === true;
        uDom.nodeFromId('listsOfBlockedHostsPrompt').textContent =
            vAPI.i18n('3pListsOfBlockedHostsPrompt')
                .replace(
                    '{{netFilterCount}}',
                    renderNumber(details.netFilterCount)
                )
                .replace(
                    '{{cosmeticFilterCount}}',
                    renderNumber(details.cosmeticFilterCount)
                );
        uDom.nodeFromId('parseCosmeticFilters').checked =
            listDetails.parseCosmeticFilters === true;
        uDom.nodeFromId('ignoreGenericCosmeticFilters').checked =
            listDetails.ignoreGenericCosmeticFilters === true;

        // Compute a hash of the settings so that we can keep track of changes
        // affecting the loading of filter lists.
        if ( !soft ) {
            filteringSettingsHash = hashFromCurrentFromSettings();
        }
        renderWidgets();
    };

    messaging.send('dashboard', { what: 'getLists' }, onListsReceived);
};

/******************************************************************************/

const renderWidgets = function() {
    let cl = uDom.nodeFromId('buttonApply').classList;
    cl.toggle(
        'disabled',
        filteringSettingsHash === hashFromCurrentFromSettings()
    );
    const updating = document.body.classList.contains('updating');
    cl = uDom.nodeFromId('buttonUpdate').classList;
    cl.toggle('active', updating);
    cl.toggle(
        'disabled',
        updating === false &&
        document.querySelector('#lists .listEntry.obsolete:not(.toRemove) input[type="checkbox"]:checked') === null
        );
    cl = uDom.nodeFromId('buttonPurgeAll').classList;
    cl.toggle(
        'disabled',
        updating || document.querySelector('#lists .listEntry.cached:not(.obsolete)') === null
    );
};

/******************************************************************************/

var updateAssetStatus = function(details) {
    var li = document.querySelector('#lists .listEntry[data-listkey="' + details.key + '"]');
    if ( li === null ) { return; }
    li.classList.toggle('failed', !!details.failed);
    li.classList.toggle('obsolete', !details.cached);
    li.classList.toggle('cached', !!details.cached);
    if ( details.cached ) {
        li.querySelector('.status.cache').setAttribute(
            'title',
            lastUpdateTemplateString.replace(
                '{{ago}}',
                vAPI.i18n.renderElapsedTimeToString(Date.now())
            )
        );
    }
    renderWidgets();
};

/*******************************************************************************

    Compute a hash from all the settings affecting how filter lists are loaded
    in memory.

**/

const hashFromCurrentFromSettings = function() {
    const hash = [
        uDom.nodeFromId('parseCosmeticFilters').checked,
        uDom.nodeFromId('ignoreGenericCosmeticFilters').checked
    ];
    const listHash = [];
    let listEntries = document.querySelectorAll('#lists .listEntry[data-listkey]:not(.toRemove)');
    for ( let liEntry of listEntries ) {
        if ( liEntry.querySelector('input[type="checkbox"]:checked') !== null ) {
            listHash.push(liEntry.getAttribute('data-listkey'));
        }
    }
    hash.push(
        listHash.sort().join(),
        uDom.nodeFromId('importLists').checked &&
            reValidExternalList.test(uDom.nodeFromId('externalLists').value),
        document.querySelector('#lists .listEntry.toRemove') !== null
    );
    return hash.join();
};

/******************************************************************************/

const onListsetChanged = function(ev) {
    const input = ev.target;
    const li = input.closest('.listEntry');
    li.classList.toggle('checked', input.checked);
    onFilteringSettingsChanged();
};

/******************************************************************************/

const onFilteringSettingsChanged = function() {
    renderWidgets();
};

/******************************************************************************/

const onRemoveExternalList = function(ev) {
    const liEntry = ev.target.closest('[data-listkey]');
    if ( liEntry === null ) { return; }
    liEntry.classList.toggle('toRemove');
    renderWidgets();
};

/******************************************************************************/

const onPurgeClicked = function(ev) {
    const liEntry = ev.target.closest('[data-listkey]');
    const listKey = liEntry.getAttribute('data-listkey') || '';
    if ( listKey === '' ) { return; }

    messaging.send('dashboard', { what: 'purgeCache', assetKey: listKey });

    // If the cached version is purged, the installed version must be assumed
    // to be obsolete.
    // https://github.com/gorhill/uBlock/issues/1733
    //   An external filter list must not be marked as obsolete, they will
    //   always be fetched anyways if there is no cached copy.
    liEntry.classList.add('obsolete');
    liEntry.classList.remove('cached');

    if ( liEntry.querySelector('input[type="checkbox"]').checked ) {
        renderWidgets();
    }
};

/******************************************************************************/

var selectFilterLists = function(callback) {
    // Cosmetic filtering switch
    messaging.send('dashboard', {
        what: 'userSettings',
        name: 'parseAllABPHideFilters',
        value: uDom.nodeFromId('parseCosmeticFilters').checked,
    });
    messaging.send('dashboard', {
        what: 'userSettings',
        name: 'ignoreGenericCosmeticFilters',
        value: uDom.nodeFromId('ignoreGenericCosmeticFilters').checked,
    });

    // Filter lists to select
    const toSelect = [];
    for (
        let liEntry of
        document.querySelectorAll('#lists .listEntry[data-listkey]:not(.toRemove)')
    ) {
        if ( liEntry.querySelector('input[type="checkbox"]:checked') !== null ) {
            toSelect.push(liEntry.getAttribute('data-listkey'));
        }
    }

    // External filter lists to remove
    const toRemove = [];
    for (
        let liEntry of
        document.querySelectorAll('#lists .listEntry.toRemove[data-listkey]')
    ) {
        toRemove.push(liEntry.getAttribute('data-listkey'));
    }

    // External filter lists to import
    const externalListsElem = document.getElementById('externalLists');
    const toImport = externalListsElem.value.trim();
    {
        const liEntry = externalListsElem.closest('.listEntry');
        liEntry.classList.remove('checked');
        liEntry.querySelector('input[type="checkbox"]').checked = false;
        externalListsElem.value = '';
    }

    messaging.send(
        'dashboard',
        {
            what: 'applyFilterListSelection',
            toSelect: toSelect,
            toImport: toImport,
            toRemove: toRemove
        },
        callback
    );
    filteringSettingsHash = hashFromCurrentFromSettings();
};

/******************************************************************************/

var buttonApplyHandler = function() {
    uDom('#buttonApply').removeClass('enabled');
    var onSelectionDone = function() {
        messaging.send('dashboard', { what: 'reloadAllFilters' });
    };
    selectFilterLists(onSelectionDone);
    renderWidgets();
};

/******************************************************************************/

var buttonUpdateHandler = function() {
    var onSelectionDone = function() {
        document.body.classList.add('updating');
        messaging.send('dashboard', { what: 'forceUpdateAssets' });
        renderWidgets();
    };
    selectFilterLists(onSelectionDone);
    renderWidgets();
};

/******************************************************************************/

var buttonPurgeAllHandler = function(ev) {
    uDom('#buttonPurgeAll').removeClass('enabled');
    messaging.send(
        'dashboard',
        {
            what: 'purgeAllCaches',
            hard: ev.ctrlKey && ev.shiftKey
        },
        function() { renderFilterLists(true); }
    );
};

/******************************************************************************/

var autoUpdateCheckboxChanged = function() {
    messaging.send(
        'dashboard',
        {
            what: 'userSettings',
            name: 'autoUpdate',
            value: this.checked
        }
    );
};

/******************************************************************************/

// Collapsing of unused lists.

var mustHideUnusedLists = function(which) {
    var hideAll = hideUnusedSet.has('*');
    if ( which === '*' ) { return hideAll; }
    return hideUnusedSet.has(which) !== hideAll;
};

var toggleHideUnusedLists = function(which) {
    var groupSelector,
        doesHideAll = hideUnusedSet.has('*'),
        mustHide;
    if ( which === '*' ) {
        mustHide = doesHideAll === false;
        groupSelector = '';
        hideUnusedSet.clear();
        if ( mustHide ) {
            hideUnusedSet.add(which);
        }
        document.body.classList.toggle('hideUnused', mustHide);
        uDom('.groupEntry[data-groupkey]').toggleClass('hideUnused', mustHide);
    } else {
        var doesHide = hideUnusedSet.has(which);
        if ( doesHide ) {
            hideUnusedSet.delete(which);
        } else {
            hideUnusedSet.add(which);
        }
        mustHide = doesHide === doesHideAll;
        groupSelector = '.groupEntry[data-groupkey="' + which + '"] ';
        uDom(groupSelector).toggleClass('hideUnused', mustHide);
    }
    uDom(groupSelector + '.listEntry input[type="checkbox"]:not(:checked)')
        .ancestors('.listEntry[data-listkey]')
        .toggleClass('unused', mustHide);
    vAPI.localStorage.setItem(
        'hideUnusedFilterLists',
        JSON.stringify(Array.from(hideUnusedSet))
    );
};

const revealHiddenUsedLists = function() {
    uDom('#lists .listEntry.unused input[type="checkbox"]:checked')
        .ancestors('.listEntry[data-listkey]')
        .removeClass('unused');
};

uDom('#listsOfBlockedHostsPrompt').on('click', function() {
    toggleHideUnusedLists('*');
});

uDom('#lists').on('click', '.groupEntry[data-groupkey] > .geDetails', function(ev) {
    toggleHideUnusedLists(
        uDom(ev.target)
            .ancestors('.groupEntry[data-groupkey]')
            .attr('data-groupkey')
    );
});

(function() {
    var aa;
    try {
        var json = vAPI.localStorage.getItem('hideUnusedFilterLists');
        if ( json !== null ) {
            aa = JSON.parse(json);
        }
    } catch (ex) {
    }
    if ( Array.isArray(aa) === false ) {
        aa = [ '*' ];
    }
    hideUnusedSet = new Set(aa);
})();

/******************************************************************************/

// Cloud-related.

var toCloudData = function() {
    var bin = {
        parseCosmeticFilters: uDom.nodeFromId('parseCosmeticFilters').checked,
        ignoreGenericCosmeticFilters: uDom.nodeFromId('ignoreGenericCosmeticFilters').checked,
        selectedLists: []
    };

    var liEntries = uDom('#lists .listEntry'), liEntry;
    var i = liEntries.length;
    while ( i-- ) {
        liEntry = liEntries.at(i);
        if ( liEntry.descendants('input').prop('checked') ) {
            bin.selectedLists.push(liEntry.attr('data-listkey'));
        }
    }

    return bin;
};

var fromCloudData = function(data, append) {
    if ( typeof data !== 'object' || data === null ) { return; }

    var elem, checked;

    elem = uDom.nodeFromId('parseCosmeticFilters');
    checked = data.parseCosmeticFilters === true || append && elem.checked;
    elem.checked = listDetails.parseCosmeticFilters = checked;

    elem = uDom.nodeFromId('ignoreGenericCosmeticFilters');
    checked = data.ignoreGenericCosmeticFilters === true || append && elem.checked;
    elem.checked = listDetails.ignoreGenericCosmeticFilters = checked;

    var selectedSet = new Set(data.selectedLists),
        listEntries = uDom('#lists .listEntry'),
        listEntry, listKey;
    for ( var i = 0, n = listEntries.length; i < n; i++ ) {
        listEntry = listEntries.at(i);
        listKey = listEntry.attr('data-listkey');
        var hasListKey = selectedSet.has(listKey);
        selectedSet.delete(listKey);
        var input = listEntry.descendants('input').first();
        if ( append && input.prop('checked') ) { continue; }
        input.prop('checked', hasListKey);
    }

    // If there are URL-like list keys left in the selected set, import them.
    for ( listKey of selectedSet ) {
        if ( reValidExternalList.test(listKey) === false ) {
            selectedSet.delete(listKey);
        }
    }
    if ( selectedSet.size !== 0 ) {
        elem = uDom.nodeFromId('externalLists');
        if ( append ) {
            if ( elem.value.trim() !== '' ) { elem.value += '\n'; }
        } else {
            elem.value = '';
        }
        elem.value += Array.from(selectedSet).join('\n');
        uDom.nodeFromId('importLists').checked = true;
    }

    revealHiddenUsedLists();
    renderWidgets();
};

self.cloud.onPush = toCloudData;
self.cloud.onPull = fromCloudData;

/******************************************************************************/

self.hasUnsavedData = function() {
    return hashFromCurrentFromSettings() !== filteringSettingsHash;
};

/******************************************************************************/

uDom('#autoUpdate').on('change', autoUpdateCheckboxChanged);
uDom('#parseCosmeticFilters').on('change', onFilteringSettingsChanged);
uDom('#ignoreGenericCosmeticFilters').on('change', onFilteringSettingsChanged);
uDom('#buttonApply').on('click', buttonApplyHandler);
uDom('#buttonUpdate').on('click', buttonUpdateHandler);
uDom('#buttonPurgeAll').on('click', buttonPurgeAllHandler);
uDom('#lists').on('change', '.listEntry input', onListsetChanged);
uDom('#lists').on('click', '.listEntry .remove', onRemoveExternalList);
uDom('#lists').on('click', 'span.cache', onPurgeClicked);
uDom('#externalLists').on('input', onFilteringSettingsChanged);

uDom('#lists').on('click', '.listEntry label *', ev => {
    if ( ev.target.matches('a,input,.forinput') ) { return; }
    ev.preventDefault();
});

/******************************************************************************/

renderFilterLists();

/******************************************************************************/

})();

