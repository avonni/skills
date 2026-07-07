import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['node_modules/'] },
    js.configs.recommended,
    {
        files: ['**/*.{js,mjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node
        },
        rules: {
            // The repo uses a leading underscore to mark intentionally
            // unused variables and parameters.
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_'
                }
            ],
            // The scripts intentionally swallow caught errors and emit
            // their own user-facing messages instead of chaining causes.
            'preserve-caught-error': 'off'
        }
    }
];
