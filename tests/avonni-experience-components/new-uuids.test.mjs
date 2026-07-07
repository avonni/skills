import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../skills/avonni-experience-components/scripts/new-uuids.mjs'
);

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function run(...args) {
    const result = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
    return {
        exitCode: result.status,
        lines: result.stdout.split('\n').filter(Boolean)
    };
}

describe('new-uuids.mjs', () => {
    test('prints one UUID by default', () => {
        const { exitCode, lines } = run();
        assert.equal(exitCode, 0);
        assert.equal(lines.length, 1);
        assert.match(lines[0], UUID_RE);
    });

    test('prints the requested number of UUIDs, all valid and unique', () => {
        const { exitCode, lines } = run('5');
        assert.equal(exitCode, 0);
        assert.equal(lines.length, 5);
        for (const line of lines) assert.match(line, UUID_RE);
        assert.equal(new Set(lines).size, 5);
    });

    test('clamps zero and negative counts to one', () => {
        assert.equal(run('0').lines.length, 1);
        assert.equal(run('-3').lines.length, 1);
    });

    test('falls back to one on a non-numeric count', () => {
        const { exitCode, lines } = run('banana');
        assert.equal(exitCode, 0);
        assert.equal(lines.length, 1);
        assert.match(lines[0], UUID_RE);
    });
});
