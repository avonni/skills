import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../skills/experience-components/scripts/validate-view.mjs'
);

const tempDirs = [];
let fileCount = 0;

after(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runOnContent(content) {
    const dir = mkdtempSync(join(tmpdir(), 'validate-view-'));
    tempDirs.push(dir);
    const path = join(dir, `content_${fileCount++}.json`);
    writeFileSync(
        path,
        typeof content === 'string' ? content : JSON.stringify(content, null, 2),
        'utf8'
    );
    return runOnArgs(path);
}

function runOnArgs(...args) {
    const result = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
    return {
        exitCode: result.status,
        stdout: result.stdout,
        stderr: result.stderr
    };
}

/** Asserts the script exits 0. */
function pass(content) {
    const { exitCode, stdout, stderr } = runOnContent(content);
    assert.equal(exitCode, 0, `Expected pass but got errors:\n${stderr}`);
    return stdout;
}

/** Asserts the script exits 1 and that stderr contains the expected fragment. */
function fail(content, expectedFragment) {
    const { exitCode, stderr } = runOnContent(content);
    assert.equal(exitCode, 1, `Expected failure but script passed`);
    if (expectedFragment) {
        assert.ok(
            stderr.includes(expectedFragment),
            `Expected "${expectedFragment}" in stderr:\n${stderr}`
        );
    }
    return stderr;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function component(overrides = {}) {
    return {
        id: randomUUID(),
        type: 'component',
        definition: 'avxp:alert',
        attributes: {},
        ...overrides
    };
}

function region(children = [], overrides = {}) {
    return {
        id: randomUUID(),
        type: 'region',
        name: 'content',
        children,
        ...overrides
    };
}

/** Wraps a root node in the contentBody envelope used by site views. */
function view(rootNode) {
    return { contentBody: { component: rootNode } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validate-view.mjs', () => {
    test('prints usage and exits 1 without a path argument', () => {
        const { exitCode, stderr } = runOnArgs();
        assert.equal(exitCode, 1);
        assert.match(stderr, /Usage/);
    });

    test('passes a valid wrapped view and reports the node count', () => {
        const root = component({
            children: [region([component(), component()])]
        });
        const out = pass(view(root));
        assert.match(out, /OK — 4 nodes/);
    });

    test('passes a bare root node (no contentBody envelope)', () => {
        const out = pass(component());
        assert.match(out, /OK — 1 nodes/);
    });

    test('fails on invalid JSON', () => {
        const { exitCode, stderr } = runOnContent('{ not json');
        assert.equal(exitCode, 1);
        assert.match(stderr, /Invalid JSON/);
    });

    test('fails when no component tree is found', () => {
        fail({ foo: 'bar' }, 'No component tree found');
    });

    test('fails on a missing id', () => {
        fail(view(component({ id: undefined })), 'missing "id"');
    });

    test('fails on a non-UUID id', () => {
        fail(view(component({ id: 'not-a-uuid' })), 'is not a valid UUID');
    });

    test('fails on duplicate ids', () => {
        const id = randomUUID();
        const root = component({
            id,
            children: [region([component({ id })])]
        });
        fail(view(root), `Duplicate id "${id}"`);
    });

    test('fails on an unknown node type', () => {
        fail(
            view(component({ type: 'widget' })),
            '"type" must be "component" or "region"'
        );
    });

    test('fails on a component without a definition', () => {
        fail(
            view(component({ definition: undefined })),
            '"definition" must look like "namespace:name"'
        );
    });

    test('fails on a malformed definition', () => {
        fail(
            view(component({ definition: 'no-colon-here' })),
            '"definition" must look like "namespace:name"'
        );
    });

    test('fails when attributes is not an object', () => {
        fail(
            view(component({ attributes: ['a'] })),
            '"attributes" must be an object'
        );
    });

    test('fails on a malformed serialized-JSON attribute', () => {
        fail(
            view(component({ attributes: { items: '[{"label": broken' } })),
            'attribute "items" is not valid serialized JSON'
        );
    });

    test('accepts valid serialized-JSON attributes', () => {
        pass(
            view(
                component({
                    attributes: { items: '[{"label": "One"}]', title: 'plain' }
                })
            )
        );
    });

    test('skips binding expressions and record templates in attributes', () => {
        pass(
            view(
                component({
                    attributes: {
                        recordId: '{!recordId}',
                        title: '{{Record.Name}}'
                    }
                })
            )
        );
    });

    test('fails when a component child is not a region', () => {
        const root = component({ children: [component()] });
        fail(view(root), 'must be a region');
    });

    test('fails when a region child is not a component', () => {
        const root = component({ children: [region([region()])] });
        fail(view(root), 'must be a component');
    });

    test('fails when a region has no name', () => {
        const root = component({
            children: [region([], { name: undefined })]
        });
        fail(view(root), 'region is missing a "name"');
    });

    test('fails when children is not an array', () => {
        fail(view(component({ children: {} })), '"children" must be an array');
    });

    test('fails when the view mixes avxp and avcmpbuilder namespaces', () => {
        const root = component({
            definition: 'avxp:alert',
            children: [
                region([component({ definition: 'avcmpbuilder:alert' })])
            ]
        });
        fail(view(root), 'mixes Avonni package namespaces');
    });

    test('allows non-Avonni namespaces alongside a single Avonni one', () => {
        const root = component({
            definition: 'avxp:alert',
            children: [
                region([component({ definition: 'forceCommunity:richText' })])
            ]
        });
        pass(view(root));
    });

    test('reports every error, not just the first', () => {
        const root = component({
            id: 'bad-id',
            definition: 'nope',
            children: [region([], { name: undefined })]
        });
        const stderr = fail(view(root));
        assert.match(stderr, /3 error\(s\)/);
    });
});
