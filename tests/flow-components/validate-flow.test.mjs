import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../skills/flow-components/scripts/validate-flow.mjs'
);

const tempDirs = [];
let fileCount = 0;

after(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function runOnXml(xml) {
    const dir = mkdtempSync(join(tmpdir(), 'validate-flow-'));
    tempDirs.push(dir);
    const path = join(dir, `Flow_${fileCount++}.flow-meta.xml`);
    writeFileSync(path, xml, 'utf8');
    return runOnPath(path);
}

function runOnPath(path) {
    const result = spawnSync('node', [SCRIPT, path], { encoding: 'utf8' });
    return {
        exitCode: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        path
    };
}

/** Asserts the script exits 0. */
function pass(xml) {
    const { exitCode, stdout, stderr } = runOnXml(xml);
    assert.equal(exitCode, 0, `Expected pass but got errors:\n${stderr}`);
    return stdout;
}

/** Asserts the script exits 1 and that stderr contains the expected fragment. */
function fail(xml, expectedFragment) {
    const { exitCode, stderr } = runOnXml(xml);
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

function flowWithFields(fieldsXml) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>62.0</apiVersion>
    <label>Test</label>
    <processType>Flow</processType>
    <screens>
        <name>Screen1</name>
        <label>Screen 1</label>
        <allowBack>true</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>true</allowPause>
${fieldsXml}
        <showFooter>true</showFooter>
        <showHeader>true</showHeader>
    </screens>
    <start>
        <connector>
            <targetReference>Screen1</targetReference>
        </connector>
    </start>
    <status>Draft</status>
</Flow>
`;
}

const VALID_ALERT_FIELD = `        <fields>
            <name>myAlert</name>
            <extensionName>avcmpbuilder:alert</extensionName>
            <fieldType>ComponentInstance</fieldType>
            <inputParameters>
                <name>content</name>
                <value>
                    <stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>
                </value>
            </inputParameters>
            <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
            <isRequired>true</isRequired>
            <storeOutputAutomatically>true</storeOutputAutomatically>
        </fields>`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validate-flow.mjs', () => {
    test('passes a valid flow with one Avonni field', () => {
        const out = pass(flowWithFields(VALID_ALERT_FIELD));
        assert.match(out, /1 Avonni component field/);
    });

    test('passes a flow with no Avonni field', () => {
        const out = pass(flowWithFields(''));
        assert.match(out, /0 Avonni component field/);
    });

    test('fails on malformed XML', () => {
        const broken = flowWithFields(VALID_ALERT_FIELD).replace(
            '</screens>',
            '</screen>'
        );
        const { exitCode, stderr } = runOnXml(broken);
        assert.equal(exitCode, 1);
        assert.match(stderr, /Malformed XML/);
    });

    test('fails when the root element is not Flow', () => {
        fail(
            '<?xml version="1.0" encoding="UTF-8"?>\n<NotAFlow xmlns="http://soap.sforce.com/2006/04/metadata"></NotAFlow>',
            'expected <Flow>'
        );
    });

    test('fails when the Flow namespace is missing', () => {
        fail(
            '<?xml version="1.0" encoding="UTF-8"?>\n<Flow></Flow>',
            'missing the xmlns'
        );
    });

    test('fails when an avcmpbuilder field is not a ComponentInstance', () => {
        fail(
            flowWithFields(
                VALID_ALERT_FIELD.replace(
                    '<fieldType>ComponentInstance</fieldType>',
                    '<fieldType>DisplayText</fieldType>'
                )
            ),
            'ComponentInstance'
        );
    });

    test('fails on duplicate field names', () => {
        fail(
            flowWithFields(VALID_ALERT_FIELD + '\n' + VALID_ALERT_FIELD),
            'duplicate field name "myAlert"'
        );
    });

    test('fails on invalid field API names', () => {
        fail(
            flowWithFields(
                VALID_ALERT_FIELD.replace(
                    '<name>myAlert</name>',
                    '<name>my__Alert_</name>'
                )
            ),
            'invalid field API name'
        );
    });

    test('fails when systemContext is empty and never modifies the file', () => {
        const empty = VALID_ALERT_FIELD.replace(
            '<name>content</name>',
            '<name>systemContext</name>'
        ).replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<stringValue></stringValue>'
        );
        const xml = flowWithFields(empty);
        const result = runOnXml(xml);
        assert.equal(result.exitCode, 1);
        assert.match(result.stderr, /run fix-flow\.mjs to generate it/);
        assert.equal(readFileSync(result.path, 'utf8'), xml);
    });

    test('fails when the systemContext apiName is not a UUID', () => {
        const invalid = VALID_ALERT_FIELD.replace(
            '<name>content</name>',
            '<name>systemContext</name>'
        ).replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<stringValue>{&quot;apiName&quot;:&quot;not-a-uuid&quot;,&quot;flowId&quot;:&quot;customFlowId&quot;}</stringValue>'
        );
        fail(flowWithFields(invalid), 'apiName must be a UUID v4');
    });

    test('passes a generated systemContext value', () => {
        const valid = VALID_ALERT_FIELD.replace(
            '<name>content</name>',
            '<name>systemContext</name>'
        ).replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<stringValue>{&quot;apiName&quot;:&quot;3f2504e0-4f89-41d3-9a0c-0305e82c3301&quot;,&quot;flowId&quot;:&quot;{!$Flow.InterviewGuid}&quot;}</stringValue>'
        );
        pass(flowWithFields(valid));
    });

    test('fails on a doubled Serialized suffix', () => {
        const doubled = VALID_ALERT_FIELD.replace(
            '<name>content</name>',
            '<name>headerActionsSerializedSerialized</name>'
        ).replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<stringValue>[{&quot;label&quot;:&quot;New&quot;,&quot;name&quot;:&quot;new&quot;}]</stringValue>'
        );
        fail(flowWithFields(doubled), 'doubled "Serialized" suffix');
    });

    test('fails on duplicate parameter names within a field', () => {
        const dupParam = VALID_ALERT_FIELD.replace(
            '<inputsOnNextNavToAssocScrn>',
            `<inputParameters>
                <name>content</name>
                <value>
                    <stringValue>again</stringValue>
                </value>
            </inputParameters>
            <inputsOnNextNavToAssocScrn>`
        );
        fail(flowWithFields(dupParam), 'duplicate parameter');
    });

    test('fails when a parameter has no value tag', () => {
        const noValue = VALID_ALERT_FIELD.replace(
            /<value>[\s\S]*?<\/value>/,
            '<value></value>'
        );
        fail(flowWithFields(noValue), 'exactly one of');
    });

    test('fails on invalid JSON in a Serialized parameter', () => {
        const badJson = VALID_ALERT_FIELD.replace(
            '<name>content</name>',
            '<name>itemsSerialized</name>'
        ).replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<stringValue>[{&quot;label&quot;:}]</stringValue>'
        );
        fail(flowWithFields(badJson), 'invalid JSON');
    });

    test('passes valid JSON in Serialized and SObjectMapping parameters', () => {
        const jsonParams = VALID_ALERT_FIELD.replace(
            /<inputParameters>[\s\S]*?<\/inputParameters>/,
            `<inputParameters>
                <name>itemsSerialized</name>
                <value>
                    <stringValue>[{&quot;label&quot;:&quot;A&quot;,&quot;value&quot;:&quot;a&quot;}]</stringValue>
                </value>
            </inputParameters>
            <inputParameters>
                <name>itemsSObjectMapping</name>
                <value>
                    <stringValue>{&quot;label&quot;:&quot;{{Record.Name}}&quot;}</stringValue>
                </value>
            </inputParameters>`
        );
        pass(flowWithFields(jsonParams));
    });

    test('fails when an interaction parameter is not a JSON array', () => {
        const notArray = VALID_ALERT_FIELD.replace(
            '<name>content</name>',
            '<name>evtClick</name>'
        ).replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<stringValue>{&quot;type&quot;:&quot;ShowToastEvent&quot;}</stringValue>'
        );
        fail(flowWithFields(notArray), 'must be JSON arrays');
    });

    test('fails when an interaction entry has no type', () => {
        const noType = VALID_ALERT_FIELD.replace(
            '<name>content</name>',
            '<name>evtClick</name>'
        ).replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<stringValue>[{&quot;targetName&quot;:&quot;a&quot;}]</stringValue>'
        );
        fail(flowWithFields(noType), 'string "type"');
    });

    test('fails on an unknown itemsTypeSelected value', () => {
        const badType = VALID_ALERT_FIELD.replace(
            '<name>content</name>',
            '<name>itemsTypeSelected</name>'
        ).replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<stringValue>manual</stringValue>'
        );
        fail(flowWithFields(badType), 'itemsTypeSelected');
    });

    test('fails on an invalid extensionName format', () => {
        fail(
            flowWithFields(
                VALID_ALERT_FIELD.replace(
                    '<extensionName>avcmpbuilder:alert</extensionName>',
                    '<extensionName>avcmpbuilder:Alert Component</extensionName>'
                )
            ),
            'invalid extensionName'
        );
    });

    test('accepts multiple dataTypeMappings with distinct typeNames', () => {
        const dual = VALID_ALERT_FIELD.replace(
            '<extensionName>',
            `<dataTypeMappings>
                <typeName>T</typeName>
                <typeValue>Event</typeValue>
            </dataTypeMappings>
            <dataTypeMappings>
                <typeName>R</typeName>
                <typeValue>User</typeValue>
            </dataTypeMappings>
            <extensionName>`
        );
        pass(flowWithFields(dual));
    });

    test('fails on duplicate dataTypeMappings typeNames', () => {
        const dup = VALID_ALERT_FIELD.replace(
            '<extensionName>',
            `<dataTypeMappings>
                <typeName>T</typeName>
                <typeValue>Event</typeValue>
            </dataTypeMappings>
            <dataTypeMappings>
                <typeName>T</typeName>
                <typeValue>User</typeValue>
            </dataTypeMappings>
            <extensionName>`
        );
        fail(flowWithFields(dup), 'duplicate dataTypeMappings typeName "T"');
    });

    test('fails on incomplete dataTypeMappings', () => {
        const mapping = VALID_ALERT_FIELD.replace(
            '<extensionName>',
            `<dataTypeMappings>
                <typeName>T</typeName>
            </dataTypeMappings>
            <extensionName>`
        );
        fail(flowWithFields(mapping), 'dataTypeMappings');
    });

    test('elementReference values are accepted and not JSON-checked', () => {
        const ref = VALID_ALERT_FIELD.replace(
            '<name>content</name>',
            '<name>itemsSerialized</name>'
        ).replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<elementReference>myVariable</elementReference>'
        );
        pass(flowWithFields(ref));
    });

    test('validates nested fields inside sections and columns', () => {
        const nested = `        <fields>
            <name>Section1</name>
            <fieldType>RegionContainer</fieldType>
            <fields>
                <name>Section1_Column1</name>
                <fieldType>Region</fieldType>
${VALID_ALERT_FIELD.replace('myAlert', 'nestedAlert')}
                <inputParameters>
                    <name>width</name>
                    <value>
                        <stringValue>12</stringValue>
                    </value>
                </inputParameters>
                <isRequired>false</isRequired>
            </fields>
            <isRequired>false</isRequired>
        </fields>`;
        const out = pass(flowWithFields(nested));
        assert.match(out, /1 Avonni component field/);
    });

    test('fails when inputsOnNextNavToAssocScrn is not UseStoredValues', () => {
        fail(
            flowWithFields(
                VALID_ALERT_FIELD.replace('UseStoredValues', 'ResetValues')
            ),
            '<inputsOnNextNavToAssocScrn> must be "UseStoredValues" (found "ResetValues")'
        );
    });

    test('fails when isRequired is not true', () => {
        fail(
            flowWithFields(
                VALID_ALERT_FIELD.replace(
                    '<isRequired>true</isRequired>',
                    '<isRequired>false</isRequired>'
                )
            ),
            '<isRequired> must be "true" (found "false")'
        );
    });

    test('fails when storeOutputAutomatically is missing', () => {
        fail(
            flowWithFields(
                VALID_ALERT_FIELD.replace(
                    /\s*<storeOutputAutomatically>true<\/storeOutputAutomatically>/,
                    ''
                )
            ),
            '<storeOutputAutomatically> must be "true" (found none)'
        );
    });

    test('fails when field children are out of order', () => {
        const swapped = VALID_ALERT_FIELD.replace(
            '<extensionName>avcmpbuilder:alert</extensionName>\n            <fieldType>ComponentInstance</fieldType>',
            '<fieldType>ComponentInstance</fieldType>\n            <extensionName>avcmpbuilder:alert</extensionName>'
        );
        fail(
            flowWithFields(swapped),
            '<extensionName> must appear before <fieldType>'
        );
    });

    test('fails when a query data source has no systemContext', () => {
        const query = VALID_ALERT_FIELD.replace(
            '<name>content</name>',
            '<name>itemsTypeSelected</name>'
        ).replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<stringValue>query</stringValue>'
        );
        fail(
            flowWithFields(query),
            'a query data source requires a systemContext parameter'
        );
    });

    test('passes when a query data source has a systemContext', () => {
        const query = VALID_ALERT_FIELD.replace(
            /<inputParameters>[\s\S]*?<\/inputParameters>/,
            `<inputParameters>
                <name>itemsTypeSelected</name>
                <value>
                    <stringValue>query</stringValue>
                </value>
            </inputParameters>
            <inputParameters>
                <name>systemContext</name>
                <value>
                    <stringValue>{&quot;apiName&quot;:&quot;3f2504e0-4f89-41d3-9a0c-0305e82c3301&quot;,&quot;flowId&quot;:&quot;{!$Flow.InterviewGuid}&quot;}</stringValue>
                </value>
            </inputParameters>`
        );
        pass(flowWithFields(query));
    });

    test('fails on {!} braces inside an elementReference', () => {
        const braced = VALID_ALERT_FIELD.replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<elementReference>{!myVariable}</elementReference>'
        );
        fail(flowWithFields(braced), 'without {!} braces');
    });

    test('fails on an empty parameter value', () => {
        const empty = VALID_ALERT_FIELD.replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<stringValue></stringValue>'
        );
        fail(flowWithFields(empty), 'empty value');
    });

    test('reports unparseable non-empty systemContext JSON and leaves the file untouched', () => {
        const invalid = VALID_ALERT_FIELD.replace(
            '<name>content</name>',
            '<name>systemContext</name>'
        ).replace(
            '<stringValue>&lt;p&gt;Hello&lt;/p&gt;</stringValue>',
            '<stringValue>{not json</stringValue>'
        );
        const xml = flowWithFields(invalid);
        const result = runOnXml(xml);
        assert.equal(result.exitCode, 1);
        assert.match(result.stderr, /invalid JSON/);
        assert.equal(readFileSync(result.path, 'utf8'), xml);
    });
});
