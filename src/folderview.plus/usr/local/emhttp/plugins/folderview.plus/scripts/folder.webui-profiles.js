// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.folderWebuiProfiles = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const MAX_PROFILES = 100;
    const MAX_PROFILE_MEMBERS = 250;
    const MAX_PROFILE_NAME_LENGTH = 80;
    const MAX_MEMBER_NAME_LENGTH = 160;
    const PROFILE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
    const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
    const cleanText = (value, maxLength) => String(value ?? '')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, maxLength);
    const uniqueStrings = (value, maxItems = MAX_PROFILE_MEMBERS) => {
        const seen = new Set();
        const result = [];
        for (const entry of Array.isArray(value) ? value : []) {
            const text = cleanText(entry, MAX_MEMBER_NAME_LENGTH);
            if (!text || seen.has(text)) continue;
            seen.add(text);
            result.push(text);
            if (result.length >= maxItems) break;
        }
        return result;
    };
    const createProfileId = (win = null) => {
        try {
            const generated = win?.crypto?.randomUUID?.();
            if (generated && PROFILE_ID_PATTERN.test(generated)) return generated;
        } catch (_error) {
            // Fall through to a locally unique identifier.
        }
        return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    };
    const normalizeProfiles = (value, options = {}) => {
        const source = Array.isArray(value) ? value : [];
        const maxProfiles = Math.max(1, Math.min(MAX_PROFILES, Number(options.maxProfiles) || MAX_PROFILES));
        const usedIds = new Set();
        const result = [];
        for (let index = 0; index < source.length && result.length < maxProfiles; index += 1) {
            const entry = isObject(source[index]) ? source[index] : null;
            if (!entry) continue;
            let id = cleanText(entry.id, 64);
            if (!PROFILE_ID_PATTERN.test(id)) id = `profile-${index + 1}`;
            const baseId = id;
            let suffix = 2;
            while (usedIds.has(id)) {
                id = `${baseId.slice(0, 58)}-${suffix}`;
                suffix += 1;
            }
            usedIds.add(id);
            result.push({
                id,
                name: cleanText(entry.name, MAX_PROFILE_NAME_LENGTH) || `Profile ${result.length + 1}`,
                containers: uniqueStrings(entry.containers || entry.members)
            });
        }
        return result;
    };
    const stripProfilesFromSettings = (settings) => {
        const next = isObject(settings) ? JSON.parse(JSON.stringify(settings)) : {};
        delete next.webui_profiles;
        delete next.webuiProfiles;
        return next;
    };
    const renameProfileMember = (profiles, oldName, newName) => normalizeProfiles(profiles).map((profile) => ({
        ...profile,
        containers: uniqueStrings(profile.containers.map((name) => name === oldName ? newName : name))
    }));
    const getRuntimeEntryName = (fallbackName, entry) => cleanText(
        entry?.name || entry?.Name || entry?.info?.Name || fallbackName,
        MAX_MEMBER_NAME_LENGTH
    );
    const collectProfileTargets = (profile, runtimeEntries, options = {}) => {
        const normalized = normalizeProfiles([profile])[0] || null;
        if (!normalized) return { profile: null, urls: [], selectedCount: 0, eligibleCount: 0, unavailableCount: 0 };
        const selected = new Set(normalized.containers);
        const matched = new Set();
        const urls = [];
        const getSafeWebuiUrl = typeof options.getSafeWebuiUrl === 'function'
            ? options.getSafeWebuiUrl
            : ((url) => cleanText(url, 2048));
        const runningOnly = options.runningOnly !== false;
        Object.entries(isObject(runtimeEntries) ? runtimeEntries : {}).forEach(([fallbackName, entry]) => {
            const name = getRuntimeEntryName(fallbackName, entry);
            if (!name || !selected.has(name)) return;
            matched.add(name);
            const running = entry?.state === true && entry?.pause !== true;
            const url = getSafeWebuiUrl(entry?.webui || entry?.WebUi || entry?.WebUI || '');
            if (url && (!runningOnly || running)) urls.push(url);
        });
        const dedupedUrls = Array.from(new Set(urls));
        return {
            profile: normalized,
            urls: dedupedUrls,
            selectedCount: normalized.containers.length,
            eligibleCount: dedupedUrls.length,
            unavailableCount: Math.max(0, normalized.containers.length - matched.size)
        };
    };
    const summarizeProfiles = (profiles, availableMemberNames = []) => {
        const available = new Set(uniqueStrings(availableMemberNames, 5000));
        const normalized = normalizeProfiles(profiles);
        let selectedReferenceCount = 0;
        let unavailableReferenceCount = 0;
        normalized.forEach((profile) => {
            selectedReferenceCount += profile.containers.length;
            unavailableReferenceCount += profile.containers.filter((name) => !available.has(name)).length;
        });
        return {
            profileCount: normalized.length,
            selectedReferenceCount,
            unavailableReferenceCount,
            duplicateProfileIdCount: 0,
            invalidProfileCount: 0
        };
    };
    const resolveProfileLaunch = (settings, profileId, runtimeEntries, options = {}) => {
        const profile = normalizeProfiles(settings?.webui_profiles || settings?.webuiProfiles)
            .find((entry) => entry.id === cleanText(profileId, 64)) || null;
        return profile ? collectProfileTargets(profile, runtimeEntries, options) : null;
    };
    const appendRuntimeMenuItems = (target, options = {}) => {
        const profiles = normalizeProfiles(options.profiles);
        if (!Array.isArray(target) || profiles.length === 0) return false;
        const translate = typeof options.translate === 'function' ? options.translate : ((_key, fallback) => fallback);
        const onOpen = typeof options.onOpen === 'function' ? options.onOpen : (() => {});
        const onManage = typeof options.onManage === 'function' ? options.onManage : (() => {});
        target.push({
            text: translate('docker.webui-profiles.open', 'Open WebUI profile'),
            icon: 'fa-list-alt',
            subMenu: profiles.map((profile) => {
                const result = collectProfileTargets(profile, options.runtimeEntries, {
                    runningOnly: true,
                    getSafeWebuiUrl: options.getSafeWebuiUrl
                });
                return {
                    text: translate('docker.webui-profiles.ready', '$1 ($2 of $3 ready)', profile.name, result.eligibleCount, result.selectedCount),
                    icon: 'fa-external-link',
                    disabled: result.eligibleCount === 0,
                    action: (event) => { event?.preventDefault?.(); onOpen(profile.id); }
                };
            })
        }, {
            text: translate('docker.webui-profiles.manage', 'Manage WebUI profiles'),
            icon: 'fa-sliders',
            action: (event) => { event?.preventDefault?.(); onManage(); }
        });
        return true;
    };

    const createEditorApi = (deps = {}) => {
        const win = deps.window || (typeof window !== 'undefined' ? window : null);
        const doc = deps.document || win?.document || null;
        const form = deps.form || doc?.getElementById?.('fvFolderEditorForm') || null;
        const getMembers = typeof deps.getMembers === 'function' ? deps.getMembers : (() => []);
        const translate = typeof deps.translate === 'function' ? deps.translate : ((_key, fallback) => fallback);
        const onChange = typeof deps.onChange === 'function' ? deps.onChange : (() => {});
        const type = cleanText(deps.type, 16).toLowerCase() === 'docker' ? 'docker' : 'vm';
        const host = form?.querySelector?.('#fvWebuiProfilesWorkspace') || null;
        const hiddenInput = form?.querySelector?.('input[name="webui_profiles"]') || null;
        let profiles = [];
        let disposed = false;
        let memberRefreshTimer = 0;

        const readIncludedMembers = () => {
            const allMembers = new Map((Array.isArray(getMembers()) ? getMembers() : [])
                .map((member) => [cleanText(member?.Name || member?.name, MAX_MEMBER_NAME_LENGTH), member])
                .filter(([name]) => Boolean(name)));
            const names = Array.from(form?.querySelectorAll?.('input[name*="containers"]:checked') || [])
                .map((input) => cleanText(input.value, MAX_MEMBER_NAME_LENGTH))
                .filter(Boolean);
            return names.map((name) => {
                const member = allMembers.get(name) || {};
                const rawState = member?.State || member?.RawState || {};
                const state = rawState?.Paused === true
                    ? 'paused'
                    : (rawState?.Running === true ? 'running' : 'stopped');
                return {
                    name,
                    state,
                    hasWebui: Boolean(member?.WebUi || member?.WebUI || member?.webui || member?.webuiCapability === true)
                };
            });
        };
        const writeHiddenInput = (notify = true) => {
            if (!hiddenInput) return;
            hiddenInput.value = JSON.stringify(profiles.map((profile) => ({
                id: profile.id,
                name: cleanText(profile.name, MAX_PROFILE_NAME_LENGTH),
                containers: uniqueStrings(profile.containers)
            })));
            if (notify) {
                hiddenInput.dispatchEvent(new win.Event('change', { bubbles: true }));
                onChange(profiles);
            }
        };
        const button = (label, icon, action, className = '') => {
            const node = doc.createElement('button');
            node.type = 'button';
            node.className = `fv-webui-profile-button ${className}`.trim();
            node.setAttribute('aria-label', label);
            const glyph = doc.createElement('i');
            glyph.className = `fa ${icon}`;
            glyph.setAttribute('aria-hidden', 'true');
            const text = doc.createElement('span');
            text.textContent = label;
            node.append(glyph, text);
            node.addEventListener('click', action);
            return node;
        };
        const setStatus = (message = '', tone = '') => {
            const node = host?.querySelector?.('.fv-webui-profiles-status');
            if (!node) return;
            node.textContent = message;
            node.className = `fv-webui-profiles-status${tone ? ` is-${tone}` : ''}`;
        };
        const validate = () => {
            if (type !== 'docker') return true;
            const names = new Set();
            let message = '';
            profiles.forEach((profile) => {
                const name = cleanText(profile.name, MAX_PROFILE_NAME_LENGTH);
                const key = name.toLocaleLowerCase();
                if (!message && !name) message = translate('editor.webui-profiles.error-name', 'Every WebUI profile needs a name.');
                if (!message && names.has(key)) message = translate('editor.webui-profiles.error-duplicate', 'WebUI profile names must be unique within this folder.');
                names.add(key);
                if (!message && uniqueStrings(profile.containers).length === 0) {
                    message = translate('editor.webui-profiles.error-members', 'Every WebUI profile must select at least one folder member.');
                }
            });
            Array.from(host?.querySelectorAll?.('.fv-webui-profile-name') || []).forEach((input) => {
                const name = cleanText(input.value, MAX_PROFILE_NAME_LENGTH).toLocaleLowerCase();
                const count = profiles.filter((profile) => cleanText(profile.name, MAX_PROFILE_NAME_LENGTH).toLocaleLowerCase() === name).length;
                input.classList.toggle('fv-input-error', !name || count > 1);
                input.setAttribute('aria-invalid', !name || count > 1 ? 'true' : 'false');
            });
            setStatus(message, message ? 'error' : 'ready');
            return !message;
        };
        const renderMemberRows = (profile, list, query = '') => {
            const members = readIncludedMembers();
            const availableNames = new Set(members.map((member) => member.name));
            profile.containers.forEach((name) => {
                if (!availableNames.has(name)) members.push({ name, state: 'unavailable', hasWebui: false });
            });
            const normalizedQuery = cleanText(query, 160).toLocaleLowerCase();
            list.replaceChildren();
            members.forEach((member) => {
                if (normalizedQuery && !member.name.toLocaleLowerCase().includes(normalizedQuery)) return;
                const row = doc.createElement('label');
                row.className = `fv-webui-profile-member is-${member.state}`;
                const checkbox = doc.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = profile.containers.includes(member.name);
                checkbox.value = member.name;
                checkbox.addEventListener('change', () => {
                    profile.containers = checkbox.checked
                        ? uniqueStrings([...profile.containers, member.name])
                        : profile.containers.filter((name) => name !== member.name);
                    writeHiddenInput();
                    validate();
                });
                const name = doc.createElement('strong');
                name.textContent = member.name;
                const meta = doc.createElement('span');
                const webuiLabel = member.hasWebui
                    ? translate('editor.webui-profiles.webui-ready', 'WebUI configured')
                    : translate('editor.webui-profiles.webui-runtime', 'WebUI checked at launch');
                meta.textContent = member.state === 'unavailable'
                    ? translate('editor.webui-profiles.unavailable', 'Unavailable in this folder')
                    : `${member.state} · ${webuiLabel}`;
                row.append(checkbox, name, meta);
                list.appendChild(row);
            });
            if (!list.children.length) {
                const empty = doc.createElement('p');
                empty.className = 'fv-webui-profile-empty-members';
                empty.textContent = translate('editor.webui-profiles.no-members', 'No matching folder members are available.');
                list.appendChild(empty);
            }
        };
        const renderProfile = (profile, index) => {
            const card = doc.createElement('article');
            card.className = 'fv-webui-profile-card';
            card.dataset.profileId = profile.id;
            const header = doc.createElement('div');
            header.className = 'fv-webui-profile-head';
            const nameInput = doc.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'fv-webui-profile-name';
            nameInput.maxLength = MAX_PROFILE_NAME_LENGTH;
            nameInput.value = profile.name;
            nameInput.setAttribute('aria-label', translate('editor.webui-profiles.name', 'Profile name'));
            nameInput.addEventListener('input', () => {
                profile.name = nameInput.value;
                writeHiddenInput();
                validate();
            });
            const actions = doc.createElement('div');
            actions.className = 'fv-webui-profile-actions';
            actions.append(
                button(translate('editor.webui-profiles.duplicate', 'Duplicate'), 'fa-copy', () => {
                    if (profiles.length >= MAX_PROFILES) return;
                    profiles.splice(index + 1, 0, {
                        id: createProfileId(win),
                        name: `${cleanText(profile.name, 68) || 'Profile'} Copy`,
                        containers: [...profile.containers]
                    });
                    writeHiddenInput();
                    render();
                }),
                button(translate('editor.webui-profiles.move-up', 'Move up'), 'fa-chevron-up', () => {
                    if (index <= 0) return;
                    [profiles[index - 1], profiles[index]] = [profiles[index], profiles[index - 1]];
                    writeHiddenInput();
                    render();
                }, 'is-icon'),
                button(translate('editor.webui-profiles.move-down', 'Move down'), 'fa-chevron-down', () => {
                    if (index >= profiles.length - 1) return;
                    [profiles[index + 1], profiles[index]] = [profiles[index], profiles[index + 1]];
                    writeHiddenInput();
                    render();
                }, 'is-icon'),
                button(translate('editor.webui-profiles.delete', 'Delete'), 'fa-trash', () => {
                    profiles.splice(index, 1);
                    writeHiddenInput();
                    render();
                }, 'is-danger')
            );
            header.append(nameInput, actions);
            const tools = doc.createElement('div');
            tools.className = 'fv-webui-profile-tools';
            const search = doc.createElement('input');
            search.type = 'search';
            search.placeholder = translate('editor.webui-profiles.search', 'Search folder members');
            search.setAttribute('aria-label', search.placeholder);
            const list = doc.createElement('div');
            list.className = 'fv-webui-profile-members';
            search.addEventListener('input', () => renderMemberRows(profile, list, search.value));
            tools.append(
                search,
                button(translate('editor.webui-profiles.select-webui', 'Select all with WebUI'), 'fa-check-square-o', () => {
                    profile.containers = uniqueStrings(readIncludedMembers().filter((member) => member.hasWebui).map((member) => member.name));
                    writeHiddenInput();
                    render();
                }),
                button(translate('editor.webui-profiles.clear', 'Clear selection'), 'fa-square-o', () => {
                    profile.containers = [];
                    writeHiddenInput();
                    render();
                })
            );
            renderMemberRows(profile, list);
            card.append(header, tools, list);
            return card;
        };
        const render = () => {
            if (!host || disposed) return;
            host.replaceChildren();
            if (type !== 'docker') {
                host.closest?.('.basic')?.setAttribute?.('hidden', 'hidden');
                return;
            }
            const toolbar = doc.createElement('div');
            toolbar.className = 'fv-webui-profiles-toolbar';
            const summary = doc.createElement('p');
            summary.textContent = profiles.length
                ? translate('editor.webui-profiles.count', '$1 saved profile(s)', profiles.length).replace('$1', String(profiles.length))
                : translate('editor.webui-profiles.empty', 'No custom WebUI profiles yet.');
            const add = button(translate('editor.webui-profiles.add', 'Add profile'), 'fa-plus', () => {
                if (profiles.length >= MAX_PROFILES) {
                    setStatus(translate('editor.webui-profiles.limit', 'This folder has reached the WebUI profile safety limit.'), 'error');
                    return;
                }
                profiles.push({ id: createProfileId(win), name: `Profile ${profiles.length + 1}`, containers: [] });
                writeHiddenInput();
                render();
            }, 'is-primary');
            toolbar.append(summary, add);
            host.appendChild(toolbar);
            const cards = doc.createElement('div');
            cards.className = 'fv-webui-profile-list';
            profiles.forEach((profile, index) => cards.appendChild(renderProfile(profile, index)));
            host.appendChild(cards);
            const status = doc.createElement('p');
            status.className = 'fv-webui-profiles-status';
            status.setAttribute('aria-live', 'polite');
            host.appendChild(status);
            validate();
        };
        const hydrate = (value) => {
            profiles = normalizeProfiles(value);
            writeHiddenInput(false);
            render();
        };
        const scheduleMemberRefresh = () => {
            if (memberRefreshTimer) win.clearTimeout(memberRefreshTimer);
            memberRefreshTimer = win.setTimeout(() => {
                memberRefreshTimer = 0;
                render();
            }, 0);
        };
        const memberChangeHandler = (event) => {
            if (event?.target?.matches?.('input[name*="containers"]')) scheduleMemberRefresh();
        };
        form?.addEventListener?.('change', memberChangeHandler);
        hydrate([]);
        return Object.freeze({
            hydrate,
            render,
            refreshMembers: scheduleMemberRefresh,
            serialize: () => normalizeProfiles(profiles),
            validate,
            snapshot: () => ({ profiles: normalizeProfiles(profiles), ...summarizeProfiles(profiles, readIncludedMembers().map((member) => member.name)) }),
            dispose: () => {
                disposed = true;
                if (memberRefreshTimer) win.clearTimeout(memberRefreshTimer);
                form?.removeEventListener?.('change', memberChangeHandler);
                host?.replaceChildren?.();
            }
        });
    };

    return Object.freeze({
        MAX_PROFILES,
        MAX_PROFILE_MEMBERS,
        MAX_PROFILE_NAME_LENGTH,
        normalizeProfiles,
        stripProfilesFromSettings,
        renameProfileMember,
        collectProfileTargets,
        summarizeProfiles,
        resolveProfileLaunch,
        appendRuntimeMenuItems,
        createEditorApi
    });
}));
