(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.folderGroups = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    const planCreates = (folders, existingFolders) => {
        const names = new Set(Object.values(existingFolders || {}).map(folder => String(folder.name || '').trim().toLowerCase()));
        const creates = (folders || []).filter(folder => {
            const name = String(folder.name || '').trim().toLowerCase();
            if (!name || names.has(name)) return false;
            names.add(name); return true;
        });
        return { creates, skipped: (folders || []).length - creates.length };
    };
    const createApi = (deps) => {
        const { ui, utils, document, getGroups, saveGroups, getBlueprints, getSmartIndexes, createFolders } = deps;
        const starterTemplateT = (key, fallback, ...params) => deps.translate?.(key, fallback, ...params)
            || fallback.replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token));
        const escape = utils.escapeHtml;
        const defaultIcon = '/plugins/folderview.plus/images/folder-icon.png';
        let active = null;
        const button = (label, action, icon = '', options = {}) => ui.button({ label, action, icon, ...options });
        const open = (type) => {
            type = type === 'vm' ? 'vm' : 'docker';
            if (active?.element.isConnected) {
                if (active.element.classList.contains('is-busy')) return active;
                active.close();
            }
            const blueprints = getBlueprints(type);
            const categories = [...new Set(blueprints.flatMap(folder => folder.categories || []))];
            const smart = getSmartIndexes(type, blueprints);
            const state = { mode: 'single', single: { name: '', icon: defaultIcon }, category: 'smart', selected: new Set(smart), id: '', name: '', folders: [{ name: '', icon: defaultIcon }] };
            const modal = ui.openModal({
                title: starterTemplateT('settings.groups.add', 'Add folder/group'),
                eyebrow: type === 'docker' ? 'Docker' : 'VM', size: 'lg', className: 'fv-folder-create-modal',
                content: '<div data-fv-group-content></div>', initialFocus: '[data-fv-group-name]',
                actions: button(starterTemplateT('common.cancel', 'Cancel'), 'cancel')
                    + button(starterTemplateT('settings.groups.save', 'Save group'), 'save', 'fa-save')
                    + button(starterTemplateT('legacy.surface.82b9e1ef0b404cf1', 'Create folder'), 'create', 'fa-plus'),
                onClose() { if (active === modal) active = null; }
            });
            if (!modal) return null;
            active = modal;
            const settingsRoot = document.getElementById('fv-settings-root');
            if (settingsRoot) {
                const theme = document.defaultView.getComputedStyle(settingsRoot);
                for (const name of Array.from(theme).filter(name => name.startsWith('--fvplus-'))) {
                    modal.element.style.setProperty(name, theme.getPropertyValue(name));
                }
            }
            const content = modal.body.querySelector('[data-fv-group-content]');
            const createButton = modal.footer.querySelector('[data-fv-ui-action="create"]');
            const saveButton = modal.footer.querySelector('[data-fv-ui-action="save"]');
            const iconOptions = [...new Set([defaultIcon, ...blueprints.map(folder => folder.icon), ...(deps.getIcons?.(type) || [])])]
                .filter(Boolean).map(icon => utils.sanitizeImageUrl(icon, defaultIcon));
            const iconControl = (folder, index) => `<label class="fv-group-icon-field fv-ui-field-control"><span>${escape(starterTemplateT('legacy.surface.a35abcd6dac9a2e5', 'Icon'))}</span><select data-fv-group-icon="${index}">${[...new Set([...iconOptions, folder.icon])].map(icon => `<option value="${escape(icon)}"${icon === folder.icon ? ' selected' : ''}>${escape(icon.split('/').pop().replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))}</option>`).join('')}</select></label>`;
            const editorFolders = () => state.mode === 'single' ? [state.single] : state.folders;
            const editorRows = () => editorFolders().map((folder, index) => `<div class="fv-group-editor-row"><img src="${utils.sanitizeImageSrc(folder.icon, defaultIcon)}" alt=""><label class="fv-ui-field-control"><span>${escape(starterTemplateT('legacy.surface.14d34edf50ef6c87', 'Folder name'))}</span><input type="text" data-fv-group-name="${index}" maxlength="160" required value="${escape(folder.name)}"></label>${iconControl(folder, index)}${state.mode === 'custom' ? button(starterTemplateT('remove', 'Remove'), 'remove-row', 'fa-trash', { actionData: String(index), disabled: state.folders.length === 1 }) : ''}</div>`).join('');
            const render = (focus = '') => {
                const modes = [
                    ['single', starterTemplateT('settings.groups.single', 'Single folder'), 'fa-folder-o'],
                    ['templates', starterTemplateT('settings.groups.preconfigured', 'Preconfigured groups'), 'fa-cubes'],
                    ['custom', starterTemplateT('settings.groups.custom', 'My groups'), 'fa-bookmark-o']
                ];
                let body = '';
                if (state.mode === 'templates') {
                    const visible = blueprints.map((folder, index) => ({ folder, index })).filter(({ folder, index }) => state.category === 'smart' ? smart.has(index) : folder.categories?.includes(state.category));
                    body = `<p class="fv-ui-muted">${escape(starterTemplateT('settings.groups.template-help', 'Choose the folders to create. Existing matching folder names are skipped.'))}</p><label class="fv-ui-field fv-ui-field-control"><span>${escape(starterTemplateT('legacy.surface.292c06f0045a45d0', 'Category'))}</span><select data-fv-group-category>${['smart', ...categories].map(category => `<option value="${escape(category)}"${category === state.category ? ' selected' : ''}>${escape(category === 'smart' ? starterTemplateT('settings.groups.smart', 'Smart suggestions') : deps.categoryLabel(category))}</option>`).join('')}</select></label><div class="fv-group-template-grid">${visible.map(({ folder, index }) => `<label class="fv-group-template"><input type="checkbox" data-fv-group-template="${index}"${state.selected.has(index) ? ' checked' : ''}><img src="${utils.sanitizeImageSrc(folder.icon, defaultIcon)}" alt=""><span>${escape(folder.name)}</span></label>`).join('')}</div>`;
                    if (!visible.length) body += `<p>${escape(starterTemplateT('settings.groups.no-suggestions', 'No suggestions yet. Choose another category to browse available folders.'))}</p>`;
                } else {
                    if (state.mode === 'custom') {
                        body = `<p class="fv-ui-muted">${escape(starterTemplateT('settings.groups.custom-help', 'Build a reusable group of folders. Saving a group does not create its folders.'))}</p><div class="fv-group-library"><label class="fv-ui-field fv-ui-field-control"><span>${escape(starterTemplateT('settings.groups.saved', 'Saved groups'))}</span><select data-fv-group-saved><option value="">${escape(starterTemplateT('settings.groups.new', 'New custom group'))}</option>${getGroups(type).map(group => `<option value="${escape(group.id)}"${group.id === state.id ? ' selected' : ''}>${escape(group.name)}</option>`).join('')}</select></label>${button(starterTemplateT('settings.groups.delete', 'Delete saved group'), 'delete', 'fa-trash', { disabled: !state.id })}</div><label class="fv-ui-field fv-ui-field-control"><span>${escape(starterTemplateT('settings.groups.name', 'Group name'))}</span><input type="text" data-fv-group-title maxlength="64" value="${escape(state.name)}" required></label>`;
                    }
                    body += `<div class="fv-group-editor">${editorRows()}</div>`;
                    if (state.mode === 'custom') body += button(starterTemplateT('settings.groups.add-row', 'Add another folder'), 'add-row', 'fa-plus', { disabled: state.folders.length >= 50 });
                }
                content.innerHTML = `<nav class="fv-group-modes" aria-label="${escape(starterTemplateT('settings.groups.creation-mode', 'Folder creation mode'))}">${modes.map(([mode, label, icon]) => button(label, `mode-${mode}`, icon, { attributes: `aria-pressed="${state.mode === mode}"` })).join('')}</nav><div class="fv-group-panel">${body}</div><p class="fv-group-feedback" role="status" aria-live="polite" hidden></p>`;
                saveButton.hidden = state.mode !== 'custom';
                createButton.textContent = state.mode === 'single' ? starterTemplateT('legacy.surface.82b9e1ef0b404cf1', 'Create folder') : starterTemplateT('settings.groups.create', 'Create folders');
                createButton.disabled = state.mode === 'templates' && !state.selected.size;
                const field = focus ? content.querySelector(focus) : null;
                field?.focus();
            };
            const feedback = (message, error = false) => {
                const element = content.querySelector('.fv-group-feedback');
                if (!element) return;
                element.hidden = false; element.textContent = message;
                element.classList.toggle('is-error', error);
                if (error) element.focus();
                modal.announce(message);
            };
            const collect = () => {
                if (state.mode === 'templates') return blueprints.filter((_, index) => state.selected.has(index)).map(folder => ({ name: folder.name, icon: folder.icon }));
                const invalid = [...content.querySelectorAll('input[required]')].find(input => !input.value.trim() || !input.checkValidity());
                if (invalid) { invalid.focus(); throw new Error(starterTemplateT('settings.groups.required', 'Enter a name for each required field.')); }
                const folders = editorFolders();
                const names = folders.map(folder => folder.name.trim().toLowerCase());
                if (new Set(names).size !== names.length) throw new Error(starterTemplateT('settings.groups.duplicate', 'Use a different name for each folder in the group.'));
                return folders.map(folder => ({ name: folder.name.trim(), icon: folder.icon }));
            };
            modal.element.addEventListener('input', event => {
                if (event.target.matches('[data-fv-group-title]')) state.name = event.target.value;
                if (event.target.matches('[data-fv-group-name]')) editorFolders()[Number(event.target.dataset.fvGroupName)].name = event.target.value;
            });
            modal.element.addEventListener('change', event => {
                const field = event.target;
                if (field.matches('[data-fv-group-icon]')) { editorFolders()[Number(field.dataset.fvGroupIcon)].icon = field.value; field.closest('.fv-group-editor-row').querySelector('img').src = field.value; }
                if (field.matches('[data-fv-group-template]')) { const index = Number(field.dataset.fvGroupTemplate); if (field.checked) state.selected.add(index); else state.selected.delete(index); createButton.disabled = !state.selected.size; }
                if (field.matches('[data-fv-group-category]')) { state.category = field.value; state.selected = new Set(blueprints.flatMap((folder, index) => (field.value === 'smart' ? smart.has(index) : folder.categories?.includes(field.value)) ? [index] : [])); render('[data-fv-group-category]'); }
                if (field.matches('[data-fv-group-saved]')) {
                    const saved = getGroups(type).find(group => group.id === field.value);
                    state.id = saved?.id || ''; state.name = saved?.name || '';
                    state.folders = saved ? saved.folders.map(folder => ({ ...folder })) : [{ name: '', icon: defaultIcon }];
                    render('[data-fv-group-title]');
                }
            });
            modal.element.addEventListener('click', async event => {
                const target = event.target.closest('[data-fv-ui-action]');
                if (!target || target.disabled || modal.element.classList.contains('is-busy')) return;
                const action = target.dataset.fvUiAction;
                if (action === 'cancel') { modal.close('cancel'); return; }
                if (action.startsWith('mode-')) {
                    state.mode = action.slice(5);
                    render(state.mode === 'templates' ? '[data-fv-group-category]' : state.mode === 'custom' ? '[data-fv-group-title]' : '[data-fv-group-name]'); return;
                }
                if (action === 'add-row') { state.folders.push({ name: '', icon: defaultIcon }); render(`[data-fv-group-name="${state.folders.length - 1}"]`); return; }
                if (action === 'remove-row') { state.folders.splice(Number(target.dataset.fvUiActionData), 1); render('[data-fv-group-name]'); return; }
                if (!['create', 'save', 'delete'].includes(action)) return;
                try {
                    if (!deps.ensureAllowed()) return;
                    const folders = action === 'delete' ? [] : collect();
                    if (action === 'create' && !folders.length) throw new Error(starterTemplateT('common.audit.select-template', 'Select at least one template.'));
                    modal.setBusy(true, starterTemplateT('settings.groups.saving', 'Saving…'));
                    if (action === 'create') {
                        const result = await createFolders(type, folders);
                        modal.close('created'); deps.onCreated(type, result); return;
                    }
                    const groups = getGroups(type);
                    if (action === 'delete') {
                        await saveGroups(type, groups.filter(group => group.id !== state.id));
                        state.id = ''; state.name = ''; state.folders = [{ name: '', icon: defaultIcon }];
                    } else {
                        if (!state.id && groups.length >= 30) throw new Error(starterTemplateT('settings.groups.limit', 'You can save up to 30 groups. Edit or delete a saved group first.'));
                        const name = state.name.trim();
                        if (groups.some(group => group.id !== state.id && group.name.toLowerCase() === name.toLowerCase())) throw new Error(starterTemplateT('settings.groups.name-exists', 'A saved group already has this name. Choose another name.'));
                        const id = state.id || `custom:${utils.createSecureRuntimeId('group')}`;
                        state.id = id;
                        await saveGroups(type, [...groups.filter(group => group.id !== id), { id, name, folders }]);
                    }
                    if (!modal.element.isConnected) return;
                    render('[data-fv-group-saved]');
                    feedback(action === 'delete' ? starterTemplateT('settings.groups.deleted', 'Saved group deleted. Existing folders are unchanged.') : starterTemplateT('settings.groups.saved-ok', 'Group saved. You can reuse it from My groups.'));
                } catch (error) { feedback(String(error?.message || error), true); }
                finally {
                    if (modal.element.isConnected) {
                        modal.setBusy(false);
                        createButton.disabled = state.mode === 'templates' && !state.selected.size;
                        content.querySelector('[data-fv-ui-action="delete"]')?.toggleAttribute('disabled', !state.id);
                        content.querySelector('[data-fv-ui-action="add-row"]')?.toggleAttribute('disabled', state.folders.length >= 50);
                        content.querySelectorAll('[data-fv-ui-action="remove-row"]').forEach(button => { button.disabled = state.folders.length === 1; });
                    }
                }
            });
            render(); content.querySelector('[data-fv-group-name]')?.focus();
            return modal;
        };
        return Object.freeze({ open, close: () => active?.close('navigation') });
    };
    return Object.freeze({ createApi, planCreates });
}));
