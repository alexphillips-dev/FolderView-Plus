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
    },
    {
        files: ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'],
        languageOptions: {
            globals: {
                addEventListener: 'readonly',
                Blob: 'readonly',
                Chart: 'readonly',
                clearInterval: 'readonly',
                clearTimeout: 'readonly',
                console: 'readonly',
                context: 'readonly',
                csrf_token: 'readonly',
                CustomEvent: 'readonly',
                dockerload: 'readonly',
                document: 'readonly',
                editContainer: 'readonly',
                eventControl: 'readonly',
                eventURL: 'readonly',
                folderEvents: 'readonly',
                getComputedStyle: 'readonly',
                HTMLElement: 'readonly',
                loadlist: 'readonly',
                localStorage: 'readonly',
                location: 'readonly',
                MouseEvent: 'readonly',
                MutationObserver: 'readonly',
                navigator: 'readonly',
                openBox: 'readonly',
                openDocker: 'readonly',
                openTerminal: 'readonly',
                performance: 'readonly',
                rmContainer: 'readonly',
                setInterval: 'readonly',
                setTimeout: 'readonly',
                swal: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                window: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error'
        }
    }
];
