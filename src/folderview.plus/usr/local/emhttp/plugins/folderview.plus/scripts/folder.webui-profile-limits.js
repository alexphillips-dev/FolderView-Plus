// @ts-check
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.folderWebuiProfileLimits = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const MAX_PROFILE_MEMBERS = 250;
    const MAX_PROFILE_NAME_LENGTH = 80;
    const MAX_MEMBER_NAME_LENGTH = 160;
    const cleanText = (value, maxLength = Infinity) => String(value ?? '')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, maxLength);
    const utf8 = new TextEncoder();
    const profileNameTooLong = (name) => utf8.encode(name).length > MAX_PROFILE_NAME_LENGTH;
    const truncateProfileName = (name, maxBytes = MAX_PROFILE_NAME_LENGTH) => {
        const bytes = utf8.encode(cleanText(name));
        let end = Math.min(maxBytes, bytes.length);
        // A UTF-8 continuation byte cannot be the first byte of a new character.
        while ((bytes[end] & 0xc0) === 0x80) end -= 1;
        return new TextDecoder().decode(bytes.subarray(0, end));
    };
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
    return Object.freeze({
        MAX_PROFILE_MEMBERS, MAX_PROFILE_NAME_LENGTH, MAX_MEMBER_NAME_LENGTH,
        cleanText, profileNameTooLong, truncateProfileName, uniqueStrings
    });
}));
