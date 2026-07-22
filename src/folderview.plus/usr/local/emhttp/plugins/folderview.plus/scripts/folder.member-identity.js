// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusMemberIdentity = factory();
    root.FolderViewPlusMemberIdentityModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const asString = (value) => String(value ?? '').trim();
    const uniqueStrings = (value) => Array.from(new Set(
        (Array.isArray(value) ? value : [])
            .map(asString)
            .filter(Boolean)
    ));
    const normalizedIdentityKind = (value, fallback = 'docker') => (
        asString(value).toLowerCase() === 'vm' ? 'vm' : fallback
    );
    const readLabels = (entry) => asObject(
        entry?.info?.Config?.Labels
        || entry?.Config?.Labels
        || entry?.Labels
        || entry?.labels
    );
    const normalizeMountDestinations = (entry) => uniqueStrings(
        (Array.isArray(entry?.Mounts) ? entry.Mounts : (Array.isArray(entry?.info?.Mounts) ? entry.info.Mounts : []))
            .map((mount) => asString(mount?.Destination || mount?.destination || mount?.Target || mount?.target))
    ).sort();
    const normalizeMemberIdentity = (value, fallbackKind = 'docker') => {
        const source = asObject(value);
        const kind = normalizedIdentityKind(source.kind || source.type, fallbackKind);
        if (kind === 'vm') {
            return {
                kind,
                uuid: asString(source.uuid || source.id)
            };
        }
        return {
            kind,
            containerId: asString(source.containerId || source.container_id || source.id).replace(/^sha256:/i, '').slice(0, 64),
            image: asString(source.image || source.Image),
            imageId: asString(source.imageId || source.image_id || source.shortImageId).replace(/^sha256:/i, '').slice(0, 64),
            composeProject: asString(source.composeProject || source.compose_project),
            template: asString(source.template),
            mountDestinations: uniqueStrings(source.mountDestinations || source.mount_destinations).sort()
        };
    };
    const hasUsefulIdentity = (identity) => identity?.kind === 'vm'
        ? Boolean(identity.uuid)
        : Boolean(identity?.containerId || identity?.image || identity?.imageId);
    const buildRuntimeIdentity = (type, entry) => {
        const source = asObject(entry);
        if (asString(type).toLowerCase() === 'vm') {
            return normalizeMemberIdentity({
                kind: 'vm',
                uuid: source.uuid || source.UUID || source.id
            }, 'vm');
        }
        const labels = readLabels(source);
        return normalizeMemberIdentity({
            kind: 'docker',
            containerId: source.shortId || source.id || source.Id || source.ID,
            image: source?.info?.Config?.Image || source?.Config?.Image || source.Image || source.image,
            imageId: source.shortImageId || source.ImageID || source.imageId,
            composeProject: source.composeProject || labels['com.docker.compose.project'],
            template: labels['net.unraid.docker.template'] || labels['net.unraid.docker.xml'],
            mountDestinations: normalizeMountDestinations(source)
        }, 'docker');
    };
    const normalizeIdentityMap = (value, type = 'docker') => {
        const source = asObject(value);
        const result = {};
        Object.entries(source).forEach(([rawName, rawIdentity]) => {
            const name = asString(rawName);
            if (!name) {
                return;
            }
            const identity = normalizeMemberIdentity(rawIdentity, type === 'vm' ? 'vm' : 'docker');
            if (hasUsefulIdentity(identity)) {
                result[name] = identity;
            }
        });
        return result;
    };
    const identitiesEqual = (left, right) => JSON.stringify(normalizeMemberIdentity(left, left?.kind || 'docker'))
        === JSON.stringify(normalizeMemberIdentity(right, right?.kind || 'docker'));
    const arraysEqual = (left, right) => JSON.stringify(uniqueStrings(left).sort()) === JSON.stringify(uniqueStrings(right).sort());

    const buildRuntimeIndex = (type, runtimeEntries) => {
        const source = asObject(runtimeEntries);
        const byName = new Map();
        Object.entries(source).forEach(([fallbackName, entry]) => {
            const name = asString(entry?.info?.Name || entry?.Name || entry?.name || fallbackName);
            if (!name) {
                return;
            }
            byName.set(name, {
                name,
                entry,
                identity: buildRuntimeIdentity(type, entry)
            });
        });
        return byName;
    };

    const scoreDockerCandidate = (saved, candidate) => {
        if (!saved?.image || saved.image !== candidate?.image) {
            return { eligible: false, score: 0, discriminatorCount: 0 };
        }
        let score = 0;
        let discriminatorCount = 0;
        if (saved.containerId && candidate.containerId && saved.containerId === candidate.containerId) {
            score += 12;
            discriminatorCount += 1;
        }
        if (saved.imageId && candidate.imageId && saved.imageId === candidate.imageId) {
            score += 4;
            discriminatorCount += 1;
        }
        if (saved.composeProject && candidate.composeProject && saved.composeProject === candidate.composeProject) {
            score += 4;
            discriminatorCount += 1;
        }
        if (saved.template && candidate.template && saved.template === candidate.template) {
            score += 3;
            discriminatorCount += 1;
        }
        if (saved.mountDestinations?.length && candidate.mountDestinations?.length
            && arraysEqual(saved.mountDestinations, candidate.mountDestinations)) {
            score += 5;
            discriminatorCount += 1;
        }
        return { eligible: true, score, discriminatorCount };
    };

    const resolveRenameCandidate = (type, savedIdentity, availableEntries) => {
        const entries = Array.from(availableEntries || []);
        if (type === 'vm') {
            if (!savedIdentity?.uuid) {
                return { status: 'missing-identity', candidate: null };
            }
            const matches = entries.filter((entry) => entry.identity?.uuid === savedIdentity.uuid);
            return matches.length === 1
                ? { status: 'resolved', candidate: matches[0] }
                : { status: matches.length > 1 ? 'ambiguous' : 'not-found', candidate: null };
        }
        if (!savedIdentity?.image) {
            return { status: 'missing-identity', candidate: null };
        }
        const scored = entries
            .map((entry) => ({ entry, ...scoreDockerCandidate(savedIdentity, entry.identity) }))
            .filter((match) => match.eligible)
            .sort((left, right) => right.score - left.score || left.entry.name.localeCompare(right.entry.name));
        if (scored.length === 0) {
            return { status: 'not-found', candidate: null };
        }
        if (scored.length === 1) {
            return { status: 'resolved', candidate: scored[0].entry };
        }
        const best = scored[0];
        const tied = scored.filter((match) => match.score === best.score);
        if (tied.length === 1 && best.discriminatorCount > 0) {
            return { status: 'resolved', candidate: best.entry };
        }
        return { status: 'ambiguous', candidate: null };
    };

    const renameListEntry = (value, oldName, newName) => uniqueStrings(value).map((entry) => entry === oldName ? newName : entry);
    const renameActionTargets = (actions, oldName, newName) => (Array.isArray(actions) ? actions : []).map((action) => {
        if (!action || typeof action !== 'object') {
            return action;
        }
        const next = { ...action };
        ['containers', 'conatiners'].forEach((key) => {
            if (Array.isArray(next[key])) {
                next[key] = renameListEntry(next[key], oldName, newName);
            }
        });
        return next;
    });

    const reconcileFolders = (type, folders, runtimeEntries) => {
        const safeType = asString(type).toLowerCase() === 'vm' ? 'vm' : 'docker';
        const runtimeByName = buildRuntimeIndex(safeType, runtimeEntries);
        const liveNames = new Set(runtimeByName.keys());
        const claimedNames = new Set();
        const output = {};
        const patches = {};
        const diagnostics = { backfilled: 0, renamed: 0, ambiguous: [], unresolved: [] };

        Object.entries(asObject(folders)).forEach(([folderId, rawFolder]) => {
            const folder = { ...asObject(rawFolder) };
            folder.containers = uniqueStrings(folder.containers);
            folder.memberIdentities = normalizeIdentityMap(folder.memberIdentities || folder.member_identities, safeType);
            folder.hiddenPreviewMembers = uniqueStrings(folder.hiddenPreviewMembers || folder.hidden_preview);
            folder.actions = Array.isArray(folder.actions) ? folder.actions.map((action) => ({ ...asObject(action) })) : [];
            folder.containers.forEach((name) => {
                if (liveNames.has(name)) {
                    claimedNames.add(name);
                }
            });
            output[folderId] = folder;
        });

        Object.entries(output).forEach(([folderId, folder]) => {
            const renames = {};
            let identityChanged = false;
            const members = [...folder.containers];
            for (const oldName of members) {
                const live = runtimeByName.get(oldName);
                if (live) {
                    if (!identitiesEqual(folder.memberIdentities[oldName], live.identity)) {
                        folder.memberIdentities[oldName] = live.identity;
                        identityChanged = true;
                        diagnostics.backfilled += 1;
                    }
                    continue;
                }
                const savedIdentity = folder.memberIdentities[oldName];
                const resolution = resolveRenameCandidate(safeType, savedIdentity, runtimeByName.values());
                if (resolution.status !== 'resolved' || !resolution.candidate || claimedNames.has(resolution.candidate.name)) {
                    const record = { folderId, member: oldName };
                    if (resolution.status === 'ambiguous') {
                        diagnostics.ambiguous.push(record);
                    } else if (resolution.status !== 'missing-identity') {
                        diagnostics.unresolved.push(record);
                    }
                    continue;
                }
                const newName = resolution.candidate.name;
                folder.containers = renameListEntry(folder.containers, oldName, newName);
                folder.hiddenPreviewMembers = renameListEntry(folder.hiddenPreviewMembers, oldName, newName);
                folder.actions = renameActionTargets(folder.actions, oldName, newName);
                delete folder.memberIdentities[oldName];
                folder.memberIdentities[newName] = resolution.candidate.identity;
                renames[oldName] = newName;
                claimedNames.add(newName);
                identityChanged = true;
                diagnostics.renamed += 1;
            }
            if (identityChanged || Object.keys(renames).length > 0) {
                patches[folderId] = {
                    renames,
                    memberIdentities: folder.memberIdentities
                };
            }
        });
        return { folders: output, patches, diagnostics };
    };

    return Object.freeze({
        normalizeMemberIdentity,
        normalizeIdentityMap,
        buildRuntimeIdentity,
        buildRuntimeIndex,
        resolveRenameCandidate,
        reconcileFolders,
        renameListEntry,
        renameActionTargets
    });
}));
