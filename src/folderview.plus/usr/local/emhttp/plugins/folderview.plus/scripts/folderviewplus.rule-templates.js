(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.ruleTemplates = factory();
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function() {
    'use strict';

    const TEMPLATE_DEFINITIONS = Object.freeze({
        'name-prefix': Object.freeze({
            labelKey: 'editor.rules.templates.name-prefix', labelFallback: 'Name starts with',
            types: Object.freeze(['docker', 'vm']),
            kind: 'name_regex',
            placeholderKey: 'editor.rules.templates.name-prefix-placeholder', placeholderFallback: 'Prefix (example: media-)',
            patternMode: 'prefix'
        }),
        'name-contains': Object.freeze({
            labelKey: 'editor.rules.templates.name-contains', labelFallback: 'Name contains',
            types: Object.freeze(['docker', 'vm']),
            kind: 'name_regex',
            placeholderKey: 'editor.rules.templates.name-contains-placeholder', placeholderFallback: 'Text in the name (example: arr)',
            patternMode: 'contains'
        }),
        'image-repository': Object.freeze({
            labelKey: 'editor.rules.templates.image-repository', labelFallback: 'Image repository contains',
            types: Object.freeze(['docker']),
            kind: 'image_regex',
            placeholderKey: 'editor.rules.templates.image-repository-placeholder', placeholderFallback: 'Repository (example: linuxserver/)',
            patternMode: 'contains'
        }),
        'compose-project': Object.freeze({
            labelKey: 'editor.rules.templates.compose-project', labelFallback: 'Compose project equals',
            types: Object.freeze(['docker']),
            kind: 'compose_project_regex',
            placeholderKey: 'editor.rules.templates.compose-project-placeholder', placeholderFallback: 'Project name (example: media)',
            patternMode: 'exact'
        }),
        'label-equals': Object.freeze({
            labelKey: 'editor.rules.templates.label-equals', labelFallback: 'Docker label equals',
            types: Object.freeze(['docker']),
            kind: 'label',
            placeholderKey: 'editor.rules.templates.label-equals-placeholder', placeholderFallback: 'Label key=value',
            patternMode: 'label'
        })
    });
    const normalizeType = (type) => type === 'vm' ? 'vm' : 'docker', translate = (key, fallback) => globalThis?.FolderViewPlusI18n?.t?.(key, fallback) || fallback || key;
    const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const createRuleId = (prefix = 'template-rule') => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const listTemplates = (type) => {
        const normalizedType = normalizeType(type);
        return Object.entries(TEMPLATE_DEFINITIONS)
            .filter(([, definition]) => definition.types.includes(normalizedType))
            .map(([id, definition]) => Object.freeze({ id, ...definition,
                label: translate(definition.labelKey, definition.labelFallback), placeholder: translate(definition.placeholderKey, definition.placeholderFallback) }));
    };

    const parseLabelValue = (value) => {
        const source = String(value || '').trim();
        const separator = source.indexOf('=');
        if (separator < 1) {
            throw new Error('Enter the label as key=value.');
        }
        const labelKey = source.slice(0, separator).trim();
        const labelValue = source.slice(separator + 1).trim();
        if (!labelKey) {
            throw new Error('Label key cannot be empty.');
        }
        return { labelKey, labelValue };
    };

    const buildTemplateRule = ({ templateId, type, folderId, value, effect = 'include', id = '' }) => {
        const normalizedType = normalizeType(type);
        const definition = TEMPLATE_DEFINITIONS[String(templateId || '')];
        const targetFolderId = String(folderId || '').trim();
        const input = String(value || '').trim();
        if (!definition || !definition.types.includes(normalizedType)) {
            throw new Error('Select a template supported by this folder type.');
        }
        if (!targetFolderId) {
            throw new Error('Save the folder before creating a rule.');
        }
        if (!input) {
            throw new Error('Enter a match value for the template.');
        }
        const rule = {
            id: String(id || '').trim() || createRuleId(),
            enabled: true,
            folderId: targetFolderId,
            effect: effect === 'exclude' ? 'exclude' : 'include',
            kind: definition.kind,
            pattern: '',
            labelKey: '',
            labelValue: ''
        };
        if (definition.patternMode === 'label') {
            Object.assign(rule, parseLabelValue(input));
        } else if (definition.patternMode === 'prefix') {
            rule.pattern = `^${escapeRegex(input)}`;
        } else if (definition.patternMode === 'exact') {
            rule.pattern = `^${escapeRegex(input)}$`;
        } else {
            rule.pattern = escapeRegex(input);
        }
        return rule;
    };

    const buildCatchAllRule = ({ folderId, effect = 'include', id = '' }) => {
        const targetFolderId = String(folderId || '').trim();
        if (!targetFolderId) {
            throw new Error('Save the folder before creating a catch-all rule.');
        }
        return {
            id: String(id || '').trim() || createRuleId('catch-all'),
            enabled: true,
            folderId: targetFolderId,
            effect: effect === 'exclude' ? 'exclude' : 'include',
            kind: 'name_regex',
            pattern: '^',
            labelKey: '',
            labelValue: ''
        };
    };

    const isExplicitCatchAll = (rule) => (
        String(rule?.id || '').startsWith('catch-all-')
        && rule?.kind === 'name_regex'
        && String(rule?.pattern || '') === '^'
    );

    const insertBeforeCatchAll = (rules, additions) => {
        const existing = Array.isArray(rules) ? [...rules] : [];
        const next = Array.isArray(additions) ? additions.filter(Boolean) : [additions].filter(Boolean);
        const firstCatchAll = existing.findIndex(isExplicitCatchAll);
        const insertAt = firstCatchAll < 0 ? existing.length : firstCatchAll;
        existing.splice(insertAt, 0, ...next);
        return existing;
    };

    const buildInfoIndex = (items) => {
        const infoByName = {};
        (Array.isArray(items) ? items : []).forEach((item) => {
            const name = String(item?.Name || item?.name || '').trim();
            if (name && !Object.prototype.hasOwnProperty.call(infoByName, name)) {
                infoByName[name] = item;
            }
        });
        return infoByName;
    };

    const previewRuleEffect = ({ rule, rules, items, folders, type, utils }) => {
        const infoByName = buildInfoIndex(items);
        const targetFolderId = String(rule?.folderId || '');
        const existingRules = Array.isArray(rules) ? rules : [];
        const folderMap = folders && typeof folders === 'object' ? folders : {};
        const manuallyAssigned = new Set();
        Object.values(folderMap).forEach((folder) => {
            (Array.isArray(folder?.containers) ? folder.containers : []).forEach((name) => manuallyAssigned.add(String(name)));
        });
        const result = { matched: [], newlyAssigned: [], alreadyControlled: [], manualMembers: [] };
        if (!utils || typeof utils.ruleMatchesItem !== 'function' || typeof utils.getAutoRuleDecision !== 'function') {
            return result;
        }
        Object.keys(infoByName).forEach((name) => {
            if (!utils.ruleMatchesItem(rule, name, infoByName, normalizeType(type))) {
                return;
            }
            result.matched.push(name);
            if (manuallyAssigned.has(name)) {
                result.manualMembers.push(name);
                return;
            }
            const decision = utils.getAutoRuleDecision({ rules: existingRules, name, infoByName, type: normalizeType(type) });
            if (decision?.matchedRule) {
                result.alreadyControlled.push(name);
            } else if (rule?.effect !== 'exclude' && targetFolderId) {
                result.newlyAssigned.push(name);
            }
        });
        return result;
    };

    return Object.freeze({
        TEMPLATE_DEFINITIONS,
        listTemplates,
        buildTemplateRule,
        buildCatchAllRule,
        isExplicitCatchAll,
        insertBeforeCatchAll,
        previewRuleEffect
    });
}));
