import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function readVersion(file) {
    return JSON.parse(readFileSync(join(ROOT, file), 'utf8')).version;
}

describe('Plugin', () => {
    test('Manifests use the same version as package.json', () => {
        const expected = readVersion('package.json');
        for (const file of [
            '.claude-plugin/plugin.json',
            '.codex-plugin/plugin.json'
        ]) {
            assert.equal(
                readVersion(file),
                expected,
                `${file} version must match package.json (${expected})`
            );
        }
    });
});
