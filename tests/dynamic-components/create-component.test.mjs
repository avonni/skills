import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../skills/dynamic-components/scripts/create-component.mjs'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a temp dir, runs the script with --out-dir pointing at it,
 * then reads and returns the written XML file (if any) before cleanup.
 */
function runAndRead(json, extraArgs = []) {
    const dir = mkdtempSync(join(tmpdir(), 'create-component-test-'));
    try {
        const input =
            typeof json === 'string' ? json : JSON.stringify(json, null, 2);
        const result = spawnSync(
            'node',
            [SCRIPT, '--out-dir', dir, ...extraArgs],
            {
                input,
                encoding: 'utf8'
            }
        );
        const files = readdirSync(dir);
        const fileName = files[0] ?? null;
        const xml = fileName ? readFileSync(join(dir, fileName), 'utf8') : null;
        return {
            exitCode: result.status,
            stderr: result.stderr,
            xml,
            fileName
        };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

/** Asserts exit 0 and returns parsed result. */
function pass(json, extraArgs = []) {
    const r = runAndRead(json, extraArgs);
    assert.equal(r.exitCode, 0, `Expected pass but got:\n${r.stderr}`);
    return r;
}

/** Asserts exit 1 and that stderr contains the expected fragment. */
function fail(json, expectedFragment, extraArgs = []) {
    const r = runAndRead(json, extraArgs);
    assert.equal(r.exitCode, 1, `Expected failure but script passed`);
    if (expectedFragment) {
        assert.ok(
            r.stderr.includes(expectedFragment),
            `Expected "${expectedFragment}" in stderr:\n${r.stderr}`
        );
    }
    return r;
}

/** Runs the script WITHOUT --out-dir (raw args only). */
function runRaw(json, args = []) {
    const input =
        typeof json === 'string' ? json : JSON.stringify(json, null, 2);
    const result = spawnSync('node', [SCRIPT, ...args], {
        input,
        encoding: 'utf8'
    });
    return { exitCode: result.status, stderr: result.stderr };
}

const MINIMAL = {
    apiName: 'MyComponent',
    value: [],
    queries: [],
    resources: []
};

describe('Create Component XML', () => {
    // ---------------------------------------------------------------------------
    // CLI argument parsing
    // ---------------------------------------------------------------------------

    describe('CLI argument parsing', () => {
        test('--out-dir missing value', () => {
            const r = runRaw(MINIMAL, ['--out-dir']);
            assert.equal(r.exitCode, 1);
            assert.ok(r.stderr.includes('--out-dir requires a directory path'));
        });

        test('--version missing value', () => {
            const r = runRaw(MINIMAL, ['--version']);
            assert.equal(r.exitCode, 1);
            assert.ok(
                r.stderr.includes('--version requires a positive number')
            );
        });

        test('--version with non-numeric value', () => {
            const r = runRaw(MINIMAL, ['--version', 'abc']);
            assert.equal(r.exitCode, 1);
            assert.ok(
                r.stderr.includes('--version requires a positive number')
            );
        });

        test('--version with zero', () => {
            const r = runRaw(MINIMAL, ['--version', '0']);
            assert.equal(r.exitCode, 1);
            assert.ok(
                r.stderr.includes('--version requires a positive number')
            );
        });

        test('--version with negative number', () => {
            const r = runRaw(MINIMAL, ['--version', '-1']);
            assert.equal(r.exitCode, 1);
            assert.ok(
                r.stderr.includes('--version requires a positive number')
            );
        });

        test('unknown option', () => {
            const r = runRaw(MINIMAL, ['--unknown']);
            assert.equal(r.exitCode, 1);
            assert.ok(r.stderr.includes('Unknown option: --unknown'));
        });

        test('--version defaults to 1', () => {
            const { fileName } = pass(MINIMAL);
            assert.ok(fileName.endsWith('_1.md-meta.xml'));
        });

        test('--version sets custom version in filename', () => {
            const { fileName } = pass(MINIMAL, ['--version', '3']);
            assert.ok(
                fileName.endsWith('_3.md-meta.xml'),
                `Unexpected filename: ${fileName}`
            );
        });

        test('--version accepts float', () => {
            const { fileName } = pass(MINIMAL, ['--version', '2.5']);
            assert.ok(
                fileName.endsWith('_2.5.md-meta.xml'),
                `Unexpected filename: ${fileName}`
            );
        });

        test('reads JSON from a file path argument', () => {
            const dir = mkdtempSync(join(tmpdir(), 'create-component-test-'));
            try {
                const inputFile = join(dir, 'input.json');
                const outDir = join(dir, 'out');
                mkdirSync(outDir);
                writeFileSync(inputFile, JSON.stringify(MINIMAL));
                const result = spawnSync(
                    'node',
                    [SCRIPT, inputFile, '--out-dir', outDir],
                    { encoding: 'utf8' }
                );
                assert.equal(result.status, 0, result.stderr);
                const files = readdirSync(outDir);
                assert.equal(files.length, 1);
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        test('- reads from stdin', () => {
            const dir = mkdtempSync(join(tmpdir(), 'create-component-test-'));
            try {
                const outDir = join(dir, 'out');
                mkdirSync(outDir);
                const result = spawnSync(
                    'node',
                    [SCRIPT, '-', '--out-dir', outDir],
                    { input: JSON.stringify(MINIMAL), encoding: 'utf8' }
                );
                assert.equal(result.status, 0, result.stderr);
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    // ---------------------------------------------------------------------------
    // Input validation
    // ---------------------------------------------------------------------------

    describe('input validation', () => {
        test('invalid JSON', () => {
            fail('{not json', 'Invalid JSON in stdin');
        });

        test('JSON root is an array', () => {
            fail('[]', 'JSON root must be an object');
        });

        test('JSON root is null', () => {
            fail('null', 'JSON root must be an object');
        });
    });

    // ---------------------------------------------------------------------------
    // Output filename
    // ---------------------------------------------------------------------------

    describe('output filename', () => {
        test('follows pattern avxp__AvonniDynamicComponent.<apiName>_<version>.md-meta.xml', () => {
            const { fileName } = pass(MINIMAL);
            assert.equal(
                fileName,
                'avxp__AvonniDynamicComponent.MyComponent_1.md-meta.xml'
            );
        });

        test('version appears in filename', () => {
            const { fileName } = pass(MINIMAL, ['--version', '5']);
            assert.equal(
                fileName,
                'avxp__AvonniDynamicComponent.MyComponent_5.md-meta.xml'
            );
        });

        test('output directory is created recursively if missing', () => {
            const base = mkdtempSync(join(tmpdir(), 'create-component-test-'));
            try {
                const deepDir = join(base, 'a', 'b', 'c');
                const result = spawnSync(
                    'node',
                    [SCRIPT, '--out-dir', deepDir],
                    { input: JSON.stringify(MINIMAL), encoding: 'utf8' }
                );
                assert.equal(result.status, 0, result.stderr);
                const files = readdirSync(deepDir);
                assert.equal(files.length, 1);
            } finally {
                rmSync(base, { recursive: true, force: true });
            }
        });

        test('written path is reported on stderr', () => {
            const { exitCode, stderr } = runAndRead(MINIMAL);
            assert.equal(exitCode, 0);
            assert.ok(
                stderr.includes(
                    'avxp__AvonniDynamicComponent.MyComponent_1.md-meta.xml'
                )
            );
        });
    });

    // ---------------------------------------------------------------------------
    // XML structure
    // ---------------------------------------------------------------------------

    describe('XML structure', () => {
        test('starts with XML declaration', () => {
            const { xml } = pass(MINIMAL);
            assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
        });

        test('contains CustomMetadata root with correct namespaces', () => {
            const { xml } = pass(MINIMAL);
            assert.ok(
                xml.includes('xmlns="http://soap.sforce.com/2006/04/metadata"')
            );
            assert.ok(
                xml.includes(
                    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
                )
            );
            assert.ok(
                xml.includes('xmlns:xsd="http://www.w3.org/2001/XMLSchema"')
            );
        });

        test('label is apiName with underscores replaced by spaces', () => {
            const { xml } = pass({ ...MINIMAL, apiName: 'My_Cool_Component' });
            assert.ok(xml.includes('<label>My Cool Component</label>'));
        });

        test('protected is false', () => {
            const { xml } = pass(MINIMAL);
            assert.ok(xml.includes('<protected>false</protected>'));
        });

        test('CreatedDateTime__c has correct xsi:type and UTC format', () => {
            const { xml } = pass(MINIMAL);
            assert.ok(xml.includes('<field>avxp__CreatedDateTime__c</field>'));
            assert.ok(xml.includes('xsi:type="xsd:dateTime"'));
            assert.match(
                xml,
                /avxp__CreatedDateTime__c[\s\S]*?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z/
            );
        });

        test('LastModifiedDateTime__c equals CreatedDateTime__c', () => {
            const { xml } = pass(MINIMAL);
            const created =
                /<field>avxp__CreatedDateTime__c<\/field>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>/.exec(
                    xml
                )?.[1];
            const modified =
                /<field>avxp__LastModifiedDateTime__c<\/field>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>/.exec(
                    xml
                )?.[1];
            assert.equal(created, modified);
        });

        test('DynamicComponentName__c contains apiName', () => {
            const { xml } = pass(MINIMAL);
            assert.ok(
                xml.includes('<field>avxp__DynamicComponentName__c</field>')
            );
            assert.ok(xml.includes('>MyComponent<'));
        });

        test('IsLastModified__c is true with boolean xsi:type', () => {
            const { xml } = pass(MINIMAL);
            assert.ok(xml.includes('<field>avxp__IsLastModified__c</field>'));
            const block =
                /<field>avxp__IsLastModified__c<\/field>[\s\S]*?<value([^>]*)>([\s\S]*?)<\/value>/.exec(
                    xml
                );
            assert.ok(block[1].includes('xsd:boolean'));
            assert.equal(block[2].trim(), 'true');
        });

        test('Status__c is Inactive', () => {
            const { xml } = pass(MINIMAL);
            assert.ok(xml.includes('<field>avxp__Status__c</field>'));
            assert.ok(xml.includes('>Inactive<'));
        });

        test('VersionNumber__c has xsd:double type and correct value', () => {
            const { xml } = pass(MINIMAL, ['--version', '3']);
            const block =
                /<field>avxp__VersionNumber__c<\/field>[\s\S]*?<value([^>]*)>([\s\S]*?)<\/value>/.exec(
                    xml
                );
            assert.ok(block[1].includes('xsd:double'));
            assert.equal(block[2].trim(), '3');
        });

        test('Queries__c contains JSON-stringified queries', () => {
            const input = {
                ...MINIMAL,
                queries: [{ apiName: 'getAccounts', objectApiName: 'Account' }]
            };
            const { xml } = pass(input);
            assert.ok(xml.includes('<field>avxp__Queries__c</field>'));
            assert.ok(xml.includes('getAccounts'));
        });

        test('Resources__c contains JSON-stringified resources', () => {
            const input = {
                ...MINIMAL,
                resources: [
                    {
                        apiName: 'myConst',
                        type: 'constant',
                        dataType: 'text',
                        description: 'd',
                        defaultValue: 'x'
                    }
                ]
            };
            const { xml } = pass(input);
            assert.ok(xml.includes('<field>avxp__Resources__c</field>'));
            assert.ok(xml.includes('myConst'));
        });

        test('Value__c contains JSON-stringified value', () => {
            const input = {
                ...MINIMAL,
                value: [{ name: 'dcCard', apiName: 'dcCard1', value: {} }]
            };
            const { xml } = pass(input);
            assert.ok(xml.includes('<field>avxp__Value__c</field>'));
            assert.ok(xml.includes('dcCard1'));
        });

        test('empty arrays produce [] in Queries__c, Resources__c, Value__c', () => {
            const { xml } = pass(MINIMAL);
            // JSON.stringify([]) → "[]", XML-escaped is still "[]"
            const queryBlock =
                /<field>avxp__Queries__c<\/field>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>/.exec(
                    xml
                );
            assert.equal(queryBlock[1].trim(), '[]');
        });
    });

    // ---------------------------------------------------------------------------
    // Description field
    // ---------------------------------------------------------------------------

    describe('description field', () => {
        test('description block present when description is non-empty', () => {
            const { xml } = pass({
                ...MINIMAL,
                description: 'A useful component'
            });
            assert.ok(xml.includes('<field>avxp__Description__c</field>'));
            assert.ok(xml.includes('A useful component'));
        });

        test('description block absent when description is empty string', () => {
            const { xml } = pass({ ...MINIMAL, description: '' });
            assert.ok(!xml.includes('avxp__Description__c'));
        });

        test('description block absent when description field is missing', () => {
            const { xml } = pass(MINIMAL);
            assert.ok(!xml.includes('avxp__Description__c'));
        });

        test('description block absent when description is only whitespace', () => {
            const { xml } = pass({ ...MINIMAL, description: '   ' });
            assert.ok(!xml.includes('avxp__Description__c'));
        });
    });

    // ---------------------------------------------------------------------------
    // XML escaping
    // ---------------------------------------------------------------------------

    describe('XML escaping', () => {
        test('description with & is escaped', () => {
            const { xml } = pass({ ...MINIMAL, description: 'A & B' });
            assert.ok(xml.includes('A &amp; B'));
        });

        test('description with < is escaped', () => {
            const { xml } = pass({ ...MINIMAL, description: 'A < B' });
            assert.ok(xml.includes('A &lt; B'));
        });

        test('description with > is escaped', () => {
            const { xml } = pass({ ...MINIMAL, description: 'A > B' });
            assert.ok(xml.includes('A &gt; B'));
        });

        test('description with " is escaped', () => {
            const { xml } = pass({ ...MINIMAL, description: 'say "hello"' });
            assert.ok(xml.includes('say &quot;hello&quot;'));
        });

        test('value array with special chars in strings is escaped', () => {
            const input = {
                ...MINIMAL,
                value: [
                    {
                        name: 'dcCard',
                        apiName: 'dcCard1',
                        value: { label: 'A & <B>' }
                    }
                ]
            };
            const { xml } = pass(input);
            // JSON.stringify wraps strings in quotes; the whole JSON is then XML-escaped
            assert.ok(xml.includes('&amp;'));
            assert.ok(xml.includes('&lt;'));
            assert.ok(xml.includes('&gt;'));
        });
    });
});
