let importSelectionState = null;
let importDiffPagingState = { rows: [], page: 1, pageSize: 20 };
const normalizeManagedType = (type) => type === 'vm' ? 'vm' : 'docker';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const utils = window.FolderViewPlusUtils;
