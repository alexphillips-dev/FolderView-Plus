export default [
    {
        files: ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/**/*.js'],
        ignores: ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/include/**'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script'
        },
        rules: {
            'no-unused-vars': ['error', {
                vars: 'local',
                args: 'none',
                caughtErrors: 'none',
                ignoreRestSiblings: true
            }]
        }
    }
];
