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
    '../../skills/avonni-dynamic-components/scripts/create-component.mjs'
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
                value: [{ name: 'dcCard', apiName: 'Card1', value: {} }]
            };
            const { xml } = pass(input);
            assert.ok(xml.includes('<field>avxp__Value__c</field>'));
            assert.ok(xml.includes('Card1'));
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
                        apiName: 'Card1',
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

    // ---------------------------------------------------------------------------
    // Query fields
    // ---------------------------------------------------------------------------

    describe('query fields', () => {
        const QUERIES = [{ apiName: 'getAccounts', objectApiName: 'Account' }];

        function queryList(apiName, valueOverrides = {}) {
            return {
                name: 'dcList',
                apiName,
                value: {
                    itemsTypeSelected: 'query',
                    itemsSObject: '{!$Query.getAccounts}',
                    itemsSObjectApiName: 'Account',
                    itemsSObjectMapping: {
                        label: '{{Record.Name}}',
                        description:
                            '{{Record.BillingCity}} · {{Record.Industry}}'
                    },
                    ...valueOverrides
                }
            };
        }

        function writtenValue(xml) {
            const match = xml.match(
                /<field>avxp__Value__c<\/field>\s*<value[^>]*>([\s\S]*?)<\/value>/
            );
            return JSON.parse(
                match[1]
                    .replace(/&quot;/g, '"')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
            );
        }

        test('query component gets Id and its mapped fields', () => {
            const { xml } = pass({
                ...MINIMAL,
                queries: QUERIES,
                value: [queryList('List1')]
            });
            assert.deepEqual(writtenValue(xml)[0].value.queryFields, [
                'Id',
                'Name',
                'BillingCity',
                'Industry'
            ]);
        });

        test('saved and additional query fields are kept', () => {
            const { xml } = pass({
                ...MINIMAL,
                queries: QUERIES,
                value: [
                    queryList('List1', {
                        additionalQueryFields: ['OwnerId'],
                        queryFields: ['Id', 'Type']
                    })
                ]
            });
            assert.deepEqual(writtenValue(xml)[0].value.queryFields, [
                'Id',
                'Type',
                'Name',
                'BillingCity',
                'Industry',
                'OwnerId'
            ]);
        });

        test('query component inside a slot gets its query fields', () => {
            const { xml } = pass({
                ...MINIMAL,
                queries: QUERIES,
                value: [
                    {
                        name: 'dcCard',
                        apiName: 'Card1',
                        value: {},
                        slots: [
                            { name: 'body', components: [queryList('List1')] }
                        ]
                    }
                ]
            });
            const list = writtenValue(xml)[0].slots[0].components[0];
            assert.deepEqual(list.value.queryFields, [
                'Id',
                'Name',
                'BillingCity',
                'Industry'
            ]);
        });

        test('fields used in interactions are added', () => {
            const { xml } = pass({
                ...MINIMAL,
                queries: QUERIES,
                value: [
                    queryList('List1', {
                        evtItemClick: [
                            {
                                type: 'navigateToRecord',
                                recordId: '{{Record.OwnerId}}'
                            }
                        ]
                    })
                ]
            });
            assert.deepEqual(writtenValue(xml)[0].value.queryFields, [
                'Id',
                'Name',
                'BillingCity',
                'Industry',
                'OwnerId'
            ]);
        });

        test('fields displayed through the mapping fields list are added', () => {
            const list = queryList('List1');
            list.value.itemsSObjectMapping.fields = ['Phone', 'Website'];
            const map = {
                name: 'dcMap',
                apiName: 'Map1',
                value: {
                    itemsTypeSelected: 'query',
                    itemsSObject: '{!$Query.getAccounts}',
                    itemsSObjectApiName: 'Account',
                    itemsSObjectMapping: { fields: '["BillingStreet"]' }
                }
            };
            const { xml } = pass({
                ...MINIMAL,
                queries: QUERIES,
                value: [list, map]
            });
            const [writtenList, writtenMap] = writtenValue(xml);
            assert.deepEqual(writtenList.value.queryFields, [
                'Id',
                'Name',
                'BillingCity',
                'Industry',
                'Phone',
                'Website'
            ]);
            assert.deepEqual(writtenMap.value.queryFields, [
                'Id',
                'BillingStreet'
            ]);
        });

        function queryComponent(name, apiName, valueOverrides = {}) {
            return {
                name,
                apiName,
                value: {
                    itemsTypeSelected: 'query',
                    itemsSObject: '{!$Query.getAccounts}',
                    itemsSObjectApiName: 'Account',
                    ...valueOverrides
                }
            };
        }

        test('fields named in the mapping and columns are added', () => {
            const { xml } = pass({
                ...MINIMAL,
                queries: QUERIES,
                value: [
                    queryComponent('dcChart', 'Chart1', {
                        itemsSObjectMapping: {
                            bars: [{ field: 'Industry' }],
                            barLength: [{ field: 'AnnualRevenue' }]
                        }
                    }),
                    queryComponent('dcDatatable', 'Datatable1', {
                        itemsSObjectMapping: [
                            {
                                fieldName: 'Name',
                                typeAttributes: { label: { fieldName: 'Site' } }
                            }
                        ]
                    }),
                    queryComponent('dcKanban', 'Kanban1', {
                        itemsSObjectMapping: {
                            cardAttributes: { customFields: ['Phone'] },
                            summarizeAttributes: {
                                fieldName: 'NumberOfEmployees'
                            }
                        }
                    }),
                    queryComponent('dcTreeGrid', 'TreeGrid1', {
                        columns: [{ fieldName: 'Rating' }]
                    })
                ]
            });
            const fields = writtenValue(xml).map((c) => c.value.queryFields);
            assert.deepEqual(fields, [
                ['Id', 'Industry', 'AnnualRevenue'],
                ['Id', 'Name', 'Site'],
                ['Id', 'Phone', 'NumberOfEmployees'],
                ['Id', 'Rating']
            ]);
        });

        test('field properties of the component are added', () => {
            const { xml } = pass({
                ...MINIMAL,
                queries: QUERIES,
                value: [
                    queryComponent('dcDatatable', 'Datatable1', {
                        groupByFieldApiName: 'Industry',
                        exportToFields: ['Name', 'Phone']
                    }),
                    queryComponent('dcDataLwcContainer', 'DataLwc1', {
                        keyField: 'AccountNumber',
                        fields: ['Name', 'Website']
                    })
                ]
            });
            const fields = writtenValue(xml).map((c) => c.value.queryFields);
            assert.deepEqual(fields, [
                ['Id', 'Name', 'Phone', 'Industry'],
                ['Id', 'Name', 'Website', 'AccountNumber']
            ]);
        });

        test('fields read by the slots through the component record are added', () => {
            const text = (apiName, value) => ({
                name: 'dcText',
                apiName,
                value: { value }
            });
            const { xml } = pass({
                ...MINIMAL,
                queries: QUERIES,
                value: [
                    {
                        ...queryComponent('dcRepeatable', 'Repeatable1'),
                        slots: [
                            {
                                name: 'content',
                                components: [
                                    text(
                                        'Text1',
                                        '{!Repeatable1.CurrentRecord.Name}'
                                    )
                                ]
                            }
                        ]
                    },
                    {
                        ...queryComponent('dcScheduler', 'Scheduler1'),
                        slots: [
                            {
                                name: 'event-detail-popover',
                                components: [
                                    text(
                                        'Text2',
                                        '{!Scheduler1.detailPopoverEventSObject.Owner.Name}'
                                    )
                                ]
                            }
                        ]
                    }
                ]
            });
            const fields = writtenValue(xml).map((c) => c.value.queryFields);
            assert.deepEqual(fields, [
                ['Id', 'Name'],
                ['Id', 'Owner.Name']
            ]);
        });

        test('FieldDefinition queries use DurableId instead of Id', () => {
            const { xml } = pass({
                ...MINIMAL,
                queries: [
                    { apiName: 'getFields', objectApiName: 'FieldDefinition' }
                ],
                value: [
                    queryComponent('dcList', 'List1', {
                        itemsSObject: '{!$Query.getFields}',
                        itemsSObjectApiName: 'FieldDefinition',
                        itemsSObjectMapping: { label: '{{Record.Label}}' },
                        queryFields: ['Id', 'DataType']
                    })
                ]
            });
            assert.deepEqual(writtenValue(xml)[0].value.queryFields, [
                'DurableId',
                'DataType',
                'Label'
            ]);
        });

        test('pivot table keeps its saved query fields untouched', () => {
            const savedFields = [
                'Industry',
                'GROUPING(Industry)',
                'SUM(AnnualRevenue)'
            ];
            const { xml } = pass({
                ...MINIMAL,
                queries: QUERIES,
                value: [
                    {
                        name: 'dcPivotTable',
                        apiName: 'PivotTable1',
                        value: {
                            itemsTypeSelected: 'query',
                            itemsSObject: '{!$Query.getAccounts}',
                            itemsSObjectApiName: 'Account',
                            itemsSObjectMapping: {
                                groupRows: [{ field: 'Industry' }],
                                aggregations: [
                                    { field: 'AnnualRevenue', function: 'SUM' }
                                ]
                            },
                            queryFields: savedFields
                        }
                    }
                ]
            });
            assert.deepEqual(
                writtenValue(xml)[0].value.queryFields,
                savedFields
            );
        });

        test('component without a query data source gets no query fields', () => {
            const { xml } = pass({
                ...MINIMAL,
                value: [
                    {
                        name: 'dcList',
                        apiName: 'List1',
                        value: { itemsTypeSelected: 'static', items: [] }
                    }
                ]
            });
            assert.equal('queryFields' in writtenValue(xml)[0].value, false);
        });
    });
});
