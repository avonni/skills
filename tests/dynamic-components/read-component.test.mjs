import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../skills/dynamic-components/scripts/read-component.mjs'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeXml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Builds a minimal CustomMetadata XML string.
 * @param {Record<string, string>} fields  fieldName → raw value (auto XML-escaped)
 */
function buildXml(fields) {
    const blocks = Object.entries(fields)
        .map(
            ([name, value]) =>
                `    <values>\n        <field>${name}</field>\n        <value xsi:type="xsd:string">${escapeXml(value)}</value>\n    </values>`
        )
        .join('\n');
    return (
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" ` +
        `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
        `xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n` +
        `    <label>My Component</label>\n` +
        `    <protected>false</protected>\n` +
        `${blocks}\n` +
        `</CustomMetadata>\n`
    );
}

/**
 * Writes an XML file to a temp dir, runs the script against it,
 * cleans up, and returns the result.
 */
function runWithXml(fields, extraArgs = []) {
    const dir = mkdtempSync(join(tmpdir(), 'read-component-test-'));
    try {
        const xmlPath = join(dir, 'test.md-meta.xml');
        writeFileSync(xmlPath, buildXml(fields), 'utf8');
        const result = spawnSync('node', [SCRIPT, xmlPath, ...extraArgs], {
            encoding: 'utf8'
        });
        let outFile = null;
        const outArg = extraArgs.indexOf('--out');
        if (outArg !== -1 && result.status === 0) {
            const outPath = extraArgs[outArg + 1];
            outFile = outPath ? readFileSync(outPath, 'utf8') : null;
        }
        return {
            exitCode: result.status,
            stdout: result.stdout,
            stderr: result.stderr,
            outFile
        };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

/** Asserts exit 0 and returns parsed stdout JSON. */
function pass(fields, extraArgs = []) {
    const r = runWithXml(fields, extraArgs);
    assert.equal(r.exitCode, 0, `Expected pass but got:\n${r.stderr}`);
    return { ...r, json: JSON.parse(r.stdout) };
}

/** Asserts exit 1 and that stderr contains the expected fragment. */
function fail(fields, expectedFragment, extraArgs = []) {
    const r = runWithXml(fields, extraArgs);
    assert.equal(r.exitCode, 1, `Expected failure but script passed`);
    if (expectedFragment) {
        assert.ok(
            r.stderr.includes(expectedFragment),
            `Expected "${expectedFragment}" in stderr:\n${r.stderr}`
        );
    }
    return r;
}

/** Runs the script with raw args (no XML file created). */
function runRaw(args = []) {
    const result = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
    return { exitCode: result.status, stderr: result.stderr };
}

const MINIMAL_FIELDS = {
    'avxp__DynamicComponentName__c': 'MyComponent',
    'avxp__Value__c': '[]',
    'avxp__Queries__c': '[]',
    'avxp__Resources__c': '[]'
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

describe('Read Component XML', () => {
    describe('CLI argument parsing', () => {
        test('no arguments prints usage error', () => {
            const r = runRaw();
            assert.equal(r.exitCode, 1);
            assert.ok(r.stderr.includes('Usage:'));
        });

        test('--out missing value', () => {
            const dir = mkdtempSync(join(tmpdir(), 'read-component-test-'));
            try {
                const xmlPath = join(dir, 'test.md-meta.xml');
                writeFileSync(xmlPath, buildXml(MINIMAL_FIELDS));
                const r = spawnSync('node', [SCRIPT, xmlPath, '--out'], {
                    encoding: 'utf8'
                });
                assert.equal(r.status, 1);
                assert.ok(r.stderr.includes('--out requires a file path'));
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        test('unknown option', () => {
            const dir = mkdtempSync(join(tmpdir(), 'read-component-test-'));
            try {
                const xmlPath = join(dir, 'test.md-meta.xml');
                writeFileSync(xmlPath, buildXml(MINIMAL_FIELDS));
                const r = spawnSync(
                    'node',
                    [SCRIPT, xmlPath, '--unknown'],
                    { encoding: 'utf8' }
                );
                assert.equal(r.status, 1);
                assert.ok(r.stderr.includes('Unknown option: --unknown'));
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        test('duplicate positional argument', () => {
            const r = runRaw(['file1.xml', 'file2.xml']);
            assert.equal(r.exitCode, 1);
            assert.ok(r.stderr.includes('Unexpected argument'));
        });

        test('file not found', () => {
            const r = runRaw(['/nonexistent/path/file.md-meta.xml']);
            assert.equal(r.exitCode, 1);
            assert.ok(r.stderr.length > 0);
        });
    });

    // ---------------------------------------------------------------------------
    // Field extraction
    // ---------------------------------------------------------------------------

    describe('field extraction', () => {
        test('apiName extracted from DynamicComponentName__c', () => {
            const { json } = pass(MINIMAL_FIELDS);
            assert.equal(json.apiName, 'MyComponent');
        });

        test('description extracted when present', () => {
            const { json } = pass({
                ...MINIMAL_FIELDS,
                'avxp__Description__c': 'A useful component'
            });
            assert.equal(json.description, 'A useful component');
        });

        test('description is empty string when field is absent', () => {
            const { json } = pass(MINIMAL_FIELDS);
            assert.equal(json.description, '');
        });

        test('value array parsed from Value__c', () => {
            const value = [{ name: 'dcCard', apiName: 'dcCard1', value: {} }];
            const { json } = pass({
                ...MINIMAL_FIELDS,
                'avxp__Value__c': JSON.stringify(value)
            });
            assert.deepEqual(json.value, value);
        });

        test('queries array parsed from Queries__c', () => {
            const queries = [{ apiName: 'getAccounts', objectApiName: 'Account' }];
            const { json } = pass({
                ...MINIMAL_FIELDS,
                'avxp__Queries__c': JSON.stringify(queries)
            });
            assert.deepEqual(json.queries, queries);
        });

        test('resources array parsed from Resources__c', () => {
            const resources = [
                {
                    apiName: 'myConst',
                    type: 'constant',
                    dataType: 'text',
                    description: 'd',
                    defaultValue: 'x'
                }
            ];
            const { json } = pass({
                ...MINIMAL_FIELDS,
                'avxp__Resources__c': JSON.stringify(resources)
            });
            assert.deepEqual(json.resources, resources);
        });

        test('missing DynamicComponentName__c is an error', () => {
            const { 'avxp__DynamicComponentName__c': _, ...rest } = MINIMAL_FIELDS;
            fail(rest, 'Could not find avxp__DynamicComponentName__c');
        });

        test('missing Value__c defaults to empty array', () => {
            const { 'avxp__Value__c': _, ...rest } = MINIMAL_FIELDS;
            const { json } = pass(rest);
            assert.deepEqual(json.value, []);
        });

        test('missing Queries__c defaults to empty array', () => {
            const { 'avxp__Queries__c': _, ...rest } = MINIMAL_FIELDS;
            const { json } = pass(rest);
            assert.deepEqual(json.queries, []);
        });

        test('missing Resources__c defaults to empty array', () => {
            const { 'avxp__Resources__c': _, ...rest } = MINIMAL_FIELDS;
            const { json } = pass(rest);
            assert.deepEqual(json.resources, []);
        });

        test('empty Value__c field is treated as empty array', () => {
            const { json } = pass({ ...MINIMAL_FIELDS, 'avxp__Value__c': '' });
            assert.deepEqual(json.value, []);
        });

        test('empty Queries__c field is treated as empty array', () => {
            const { json } = pass({ ...MINIMAL_FIELDS, 'avxp__Queries__c': '' });
            assert.deepEqual(json.queries, []);
        });

        test('empty Resources__c field is treated as empty array', () => {
            const { json } = pass({ ...MINIMAL_FIELDS, 'avxp__Resources__c': '' });
            assert.deepEqual(json.resources, []);
        });
    });

    // ---------------------------------------------------------------------------
    // XML unescaping
    // ---------------------------------------------------------------------------

    describe('XML unescaping', () => {
        test('&quot; in description is unescaped to "', () => {
            const { json } = pass({
                ...MINIMAL_FIELDS,
                'avxp__Description__c': 'say "hello"'
            });
            assert.equal(json.description, 'say "hello"');
        });

        test('&lt; in description is unescaped to <', () => {
            const { json } = pass({
                ...MINIMAL_FIELDS,
                'avxp__Description__c': 'A < B'
            });
            assert.equal(json.description, 'A < B');
        });

        test('&gt; in description is unescaped to >', () => {
            const { json } = pass({
                ...MINIMAL_FIELDS,
                'avxp__Description__c': 'A > B'
            });
            assert.equal(json.description, 'A > B');
        });

        test('&amp; in description is unescaped to &', () => {
            const { json } = pass({
                ...MINIMAL_FIELDS,
                'avxp__Description__c': 'A & B'
            });
            assert.equal(json.description, 'A & B');
        });

        test('JSON with quoted strings in Value__c is correctly unescaped and parsed', () => {
            const value = [{ name: 'dcCard', apiName: 'dcCard1', value: { label: 'Hello "World"' } }];
            const { json } = pass({
                ...MINIMAL_FIELDS,
                'avxp__Value__c': JSON.stringify(value)
            });
            assert.equal(json.value[0].value.label, 'Hello "World"');
        });
    });

    // ---------------------------------------------------------------------------
    // JSON parsing errors
    // ---------------------------------------------------------------------------

    describe('JSON parsing errors', () => {
        test('invalid JSON in Value__c is an error', () => {
            const dir = mkdtempSync(join(tmpdir(), 'read-component-test-'));
            try {
                const xmlPath = join(dir, 'test.md-meta.xml');
                // Write raw invalid JSON directly (not escaped through buildXml helper)
                const xml =
                    `<?xml version="1.0" encoding="UTF-8"?>\n` +
                    `<CustomMetadata>\n` +
                    `    <values>\n        <field>avxp__DynamicComponentName__c</field>\n        <value xsi:type="xsd:string">MyComponent</value>\n    </values>\n` +
                    `    <values>\n        <field>avxp__Value__c</field>\n        <value xsi:type="xsd:string">not valid json</value>\n    </values>\n` +
                    `    <values>\n        <field>avxp__Queries__c</field>\n        <value xsi:type="xsd:string">[]</value>\n    </values>\n` +
                    `    <values>\n        <field>avxp__Resources__c</field>\n        <value xsi:type="xsd:string">[]</value>\n    </values>\n` +
                    `</CustomMetadata>\n`;
                writeFileSync(xmlPath, xml);
                const r = spawnSync('node', [SCRIPT, xmlPath], {
                    encoding: 'utf8'
                });
                assert.equal(r.status, 1);
                assert.ok(r.stderr.includes('Failed to parse avxp__Value__c'));
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        test('non-array JSON in Queries__c is an error', () => {
            const dir = mkdtempSync(join(tmpdir(), 'read-component-test-'));
            try {
                const xmlPath = join(dir, 'test.md-meta.xml');
                const xml =
                    `<?xml version="1.0" encoding="UTF-8"?>\n` +
                    `<CustomMetadata>\n` +
                    `    <values>\n        <field>avxp__DynamicComponentName__c</field>\n        <value xsi:type="xsd:string">MyComponent</value>\n    </values>\n` +
                    `    <values>\n        <field>avxp__Value__c</field>\n        <value xsi:type="xsd:string">[]</value>\n    </values>\n` +
                    `    <values>\n        <field>avxp__Queries__c</field>\n        <value xsi:type="xsd:string">{}</value>\n    </values>\n` +
                    `    <values>\n        <field>avxp__Resources__c</field>\n        <value xsi:type="xsd:string">[]</value>\n    </values>\n` +
                    `</CustomMetadata>\n`;
                writeFileSync(xmlPath, xml);
                const r = spawnSync('node', [SCRIPT, xmlPath], {
                    encoding: 'utf8'
                });
                assert.equal(r.status, 1);
                assert.ok(r.stderr.includes('Failed to parse avxp__Queries__c'));
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    // ---------------------------------------------------------------------------
    // Output modes
    // ---------------------------------------------------------------------------

    describe('output modes', () => {
        test('writes JSON to stdout by default', () => {
            const r = runWithXml(MINIMAL_FIELDS);
            assert.equal(r.exitCode, 0);
            const json = JSON.parse(r.stdout);
            assert.equal(json.apiName, 'MyComponent');
        });

        test('output JSON has the expected top-level keys', () => {
            const { json } = pass(MINIMAL_FIELDS);
            assert.ok('apiName' in json);
            assert.ok('description' in json);
            assert.ok('value' in json);
            assert.ok('queries' in json);
            assert.ok('resources' in json);
        });

        test('writes JSON to file with --out', () => {
            const dir = mkdtempSync(join(tmpdir(), 'read-component-test-'));
            try {
                const xmlPath = join(dir, 'test.md-meta.xml');
                const outPath = join(dir, 'output.json');
                writeFileSync(xmlPath, buildXml(MINIMAL_FIELDS));
                const result = spawnSync(
                    'node',
                    [SCRIPT, xmlPath, '--out', outPath],
                    { encoding: 'utf8' }
                );
                assert.equal(result.status, 0, result.stderr);
                const json = JSON.parse(readFileSync(outPath, 'utf8'));
                assert.equal(json.apiName, 'MyComponent');
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        test('--out path is reported on stderr', () => {
            const dir = mkdtempSync(join(tmpdir(), 'read-component-test-'));
            try {
                const xmlPath = join(dir, 'test.md-meta.xml');
                const outPath = join(dir, 'output.json');
                writeFileSync(xmlPath, buildXml(MINIMAL_FIELDS));
                const result = spawnSync(
                    'node',
                    [SCRIPT, xmlPath, '--out', outPath],
                    { encoding: 'utf8' }
                );
                assert.equal(result.status, 0);
                assert.ok(result.stderr.includes('output.json'));
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        test('stdout is empty when --out is used', () => {
            const dir = mkdtempSync(join(tmpdir(), 'read-component-test-'));
            try {
                const xmlPath = join(dir, 'test.md-meta.xml');
                const outPath = join(dir, 'output.json');
                writeFileSync(xmlPath, buildXml(MINIMAL_FIELDS));
                const result = spawnSync(
                    'node',
                    [SCRIPT, xmlPath, '--out', outPath],
                    { encoding: 'utf8' }
                );
                assert.equal(result.status, 0);
                assert.equal(result.stdout.trim(), '');
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    // ---------------------------------------------------------------------------
    // Round-trip
    // ---------------------------------------------------------------------------

    describe('round-trip with validate-component', () => {
        const VALIDATE_SCRIPT = join(
            dirname(fileURLToPath(import.meta.url)),
            '../../skills/dynamic-components/scripts/validate-component.mjs'
        );

        test('output of read-component is valid input for validate-component', () => {
            const value = [{ name: 'dcCard', apiName: 'dcCard1', value: { label: 'Hello' } }];
            const queries = [{ apiName: 'getAccounts', objectApiName: 'Account' }];
            const resources = [
                {
                    apiName: 'myConst',
                    type: 'constant',
                    dataType: 'text',
                    description: 'A constant',
                    defaultValue: 'x'
                }
            ];
            const fields = {
                ...MINIMAL_FIELDS,
                'avxp__Value__c': JSON.stringify(value),
                'avxp__Queries__c': JSON.stringify(queries),
                'avxp__Resources__c': JSON.stringify(resources)
            };

            const dir = mkdtempSync(join(tmpdir(), 'read-component-test-'));
            try {
                const xmlPath = join(dir, 'test.md-meta.xml');
                writeFileSync(xmlPath, buildXml(fields));
                const read = spawnSync('node', [SCRIPT, xmlPath], {
                    encoding: 'utf8'
                });
                assert.equal(read.status, 0, read.stderr);

                const validate = spawnSync('node', [VALIDATE_SCRIPT], {
                    input: read.stdout,
                    encoding: 'utf8'
                });
                assert.equal(
                    validate.status,
                    0,
                    `validate-component failed:\n${validate.stderr}`
                );
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });
    });
});
