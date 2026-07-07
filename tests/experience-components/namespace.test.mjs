import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../skills/experience-components/scripts/namespace.mjs'
);

// The org lookup shells out to the `sf` CLI. These tests stub it with a fake
// POSIX executable placed first on PATH, so they never touch a real org.
// The stub prints $FAKE_SF_OUTPUT, or exits 1 when $FAKE_SF_FAIL is set.
const isWindows = process.platform === 'win32';

const tempDirs = [];
let fakeBin;
let fileCount = 0;

before(() => {
    fakeBin = mkdtempSync(join(tmpdir(), 'fake-sf-'));
    tempDirs.push(fakeBin);
    const shim = join(fakeBin, 'sf');
    writeFileSync(
        shim,
        '#!/bin/sh\nif [ -n "$FAKE_SF_FAIL" ]; then exit 1; fi\nprintf \'%s\' "$FAKE_SF_OUTPUT"\n',
        'utf8'
    );
    chmodSync(shim, 0o755);
});

after(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sfQueryResult(namespaces) {
    return JSON.stringify({
        result: { records: namespaces.map((n) => ({ NamespacePrefix: n })) }
    });
}

/**
 * Runs namespace.mjs with the fake `sf` on PATH.
 * @param {object} opts
 * @param {string} [opts.viewPath] content.json path passed as argv[2]
 * @param {string} [opts.envNamespace] AVONNI_XP_PACKAGE_NAMESPACE value
 * @param {string[]} [opts.orgNamespaces] namespaces the fake org reports
 * @param {boolean} [opts.orgFails] make the fake sf exit 1 (no org access)
 */
function run({ viewPath, envNamespace, orgNamespaces = [], orgFails } = {}) {
    const env = {
        ...process.env,
        PATH: fakeBin + delimiter + process.env.PATH,
        FAKE_SF_OUTPUT: sfQueryResult(orgNamespaces),
        FAKE_SF_FAIL: orgFails ? '1' : ''
    };
    delete env.AVONNI_XP_PACKAGE_NAMESPACE;
    if (envNamespace !== undefined) {
        env.AVONNI_XP_PACKAGE_NAMESPACE = envNamespace;
    }
    const args = [SCRIPT];
    if (viewPath) args.push(viewPath);
    const result = spawnSync('node', args, { encoding: 'utf8', env });
    return {
        exitCode: result.status,
        stdout: result.stdout.trim(),
        stderr: result.stderr
    };
}

/** Writes a view whose components use the given definition prefixes. */
function writeView(...prefixes) {
    const dir = mkdtempSync(join(tmpdir(), 'namespace-view-'));
    tempDirs.push(dir);
    const path = join(dir, `content_${fileCount++}.json`);
    const children = prefixes.map((prefix) => ({
        id: randomUUID(),
        type: 'component',
        definition: `${prefix}:alert`
    }));
    writeFileSync(
        path,
        JSON.stringify({
            contentBody: {
                component: {
                    id: randomUUID(),
                    type: 'component',
                    definition: 'siteforce:sldsOneCol',
                    children: [
                        {
                            id: randomUUID(),
                            type: 'region',
                            name: 'content',
                            children
                        }
                    ]
                }
            }
        }),
        'utf8'
    );
    return path;
}

// ---------------------------------------------------------------------------
// Tests (the sf stub is a POSIX shell script, so skip on Windows)
// ---------------------------------------------------------------------------

describe('namespace.mjs', { skip: isWindows }, () => {
    test('env var wins over the view and the org', () => {
        const viewPath = writeView('avxp');
        const { exitCode, stdout } = run({
            viewPath,
            envNamespace: 'avcmpbuilder',
            orgNamespaces: ['avxp']
        });
        assert.equal(exitCode, 0);
        assert.equal(stdout, 'avcmpbuilder');
    });

    test('an invalid env var warns and is ignored', () => {
        const viewPath = writeView('avxp');
        const { exitCode, stdout, stderr } = run({
            viewPath,
            envNamespace: 'bogus',
            orgNamespaces: ['avcmpbuilder']
        });
        assert.equal(exitCode, 0);
        assert.match(stderr, /ignoring AVONNI_XP_PACKAGE_NAMESPACE="bogus"/);
        assert.equal(stdout, 'avxp'); // the view still disambiguates
    });

    test('a view using a single namespace wins over the org', () => {
        const viewPath = writeView('avcmpbuilder');
        const { exitCode, stdout } = run({
            viewPath,
            orgNamespaces: ['avxp', 'avcmpbuilder'] // would be ambiguous
        });
        assert.equal(exitCode, 0);
        assert.equal(stdout, 'avcmpbuilder');
    });

    test('a mixed view warns and falls through to the org', () => {
        const viewPath = writeView('avxp', 'avcmpbuilder');
        const { exitCode, stdout, stderr } = run({
            viewPath,
            orgNamespaces: ['avcmpbuilder']
        });
        assert.equal(exitCode, 0);
        assert.match(stderr, /mixes avxp and avcmpbuilder/);
        assert.equal(stdout, 'avcmpbuilder');
    });

    test('an unreadable view path falls through to the org', () => {
        const { exitCode, stdout } = run({
            viewPath: '/nonexistent/content.json',
            orgNamespaces: ['avcmpbuilder']
        });
        assert.equal(exitCode, 0);
        assert.equal(stdout, 'avcmpbuilder');
    });

    test('uses the single namespace installed in the org', () => {
        const { exitCode, stdout } = run({ orgNamespaces: ['avcmpbuilder'] });
        assert.equal(exitCode, 0);
        assert.equal(stdout, 'avcmpbuilder');
    });

    test('exits 2 when both packages are installed and nothing disambiguates', () => {
        const { exitCode, stdout, stderr } = run({
            orgNamespaces: ['avxp', 'avcmpbuilder']
        });
        assert.equal(exitCode, 2);
        assert.equal(stdout, '');
        assert.match(stderr, /Ambiguous/);
    });

    test('warns and falls back to avxp when the org has neither package', () => {
        const { exitCode, stdout, stderr } = run({ orgNamespaces: [] });
        assert.equal(exitCode, 0);
        assert.equal(stdout, 'avxp');
        assert.match(stderr, /no Avonni Experience package/);
    });

    test('falls back to avxp silently when the org is unreachable', () => {
        const { exitCode, stdout, stderr } = run({ orgFails: true });
        assert.equal(exitCode, 0);
        assert.equal(stdout, 'avxp');
        assert.equal(stderr, '');
    });
});
