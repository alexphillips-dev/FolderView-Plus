import fs from 'node:fs';

const profiles = JSON.parse(fs.readFileSync(new URL('../fixture_browser_profiles.json', import.meta.url), 'utf8'));
export function selectFixtureTests(tests, profile = 'all') {
    if (profile === 'all') return tests;
    if (!profiles[profile]) throw new Error(`Unknown fixture profile: ${profile}`);
    const patterns = profiles[profile].map(value => new RegExp(value, 'i'));
    const selected = tests.filter(entry => patterns.some(pattern => pattern.test(entry.name)));
    if (!selected.length) throw new Error(`Fixture profile ${profile} selected no tests`);
    return selected;
}
