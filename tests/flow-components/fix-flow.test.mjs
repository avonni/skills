import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../skills/flow-components/scripts/fix-flow.mjs'
);

const tempDirs = [];
let fileCount = 0;

after(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function runOnXml(xml) {
    const dir = mkdtempSync(join(tmpdir(), 'fix-flow-'));
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function flowWithSystemContext(stringValueXml) {
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
        <fields>
            <name>myAlert</name>
            <extensionName>avcmpbuilder:alert</extensionName>
            <fieldType>ComponentInstance</fieldType>
            <inputParameters>
                <name>systemContext</name>
                <value>
                    ${stringValueXml}
                </value>
            </inputParameters>
            <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
            <isRequired>true</isRequired>
            <storeOutputAutomatically>true</storeOutputAutomatically>
        </fields>
        <showFooter>true</showFooter>
        <showHeader>true</showHeader>
    </screens>
    <status>Draft</status>
</Flow>
`;
}

const GENERATED_VALUE_RE =
    /\{&quot;apiName&quot;:&quot;[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}&quot;,&quot;flowId&quot;:&quot;\{!\$Flow\.InterviewGuid\}&quot;\}/;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fix-flow.mjs', () => {
    test('fills an empty systemContext and is idempotent', () => {
        const first = runOnXml(
            flowWithSystemContext('<stringValue></stringValue>')
        );
        assert.equal(first.exitCode, 0, first.stderr);
        assert.match(first.stdout, /Generated 1 systemContext value/);
        const written = readFileSync(first.path, 'utf8');
        assert.match(written, GENERATED_VALUE_RE);
        // Second run finds nothing to fix and leaves the file unchanged.
        const second = runOnPath(first.path);
        assert.equal(second.exitCode, 0, second.stderr);
        assert.match(second.stdout, /Nothing to fix/);
        assert.equal(readFileSync(first.path, 'utf8'), written);
    });

    test('fills a self-closing empty stringValue', () => {
        const result = runOnXml(flowWithSystemContext('<stringValue/>'));
        assert.equal(result.exitCode, 0, result.stderr);
        assert.match(result.stdout, /Generated 1 systemContext value/);
        const written = readFileSync(result.path, 'utf8');
        assert.match(written, GENERATED_VALUE_RE);
        assert.doesNotMatch(written, /<stringValue\/>/);
    });

    test('repairs an invalid apiName and preserves other keys', () => {
        const result = runOnXml(
            flowWithSystemContext(
                '<stringValue>{&quot;apiName&quot;:&quot;not-a-uuid&quot;,&quot;flowId&quot;:&quot;customFlowId&quot;}</stringValue>'
            )
        );
        assert.equal(result.exitCode, 0, result.stderr);
        assert.match(result.stdout, /Generated 1 systemContext value/);
        const written = readFileSync(result.path, 'utf8');
        assert.match(written, /apiName&quot;:&quot;[0-9a-f]{8}-/);
        assert.match(written, /flowId&quot;:&quot;customFlowId&quot;/);
    });

    test('leaves a valid systemContext untouched', () => {
        const xml = flowWithSystemContext(
            '<stringValue>{&quot;apiName&quot;:&quot;3f2504e0-4f89-41d3-9a0c-0305e82c3301&quot;,&quot;flowId&quot;:&quot;{!$Flow.InterviewGuid}&quot;}</stringValue>'
        );
        const result = runOnXml(xml);
        assert.equal(result.exitCode, 0, result.stderr);
        assert.match(result.stdout, /Nothing to fix/);
        assert.equal(readFileSync(result.path, 'utf8'), xml);
    });

    test('leaves unparseable non-empty JSON untouched', () => {
        const xml = flowWithSystemContext(
            '<stringValue>{not json</stringValue>'
        );
        const result = runOnXml(xml);
        assert.equal(result.exitCode, 0, result.stderr);
        assert.match(result.stdout, /Nothing to fix/);
        assert.equal(readFileSync(result.path, 'utf8'), xml);
    });

    test('does not touch parameters other than systemContext', () => {
        const xml = flowWithSystemContext(
            '<stringValue></stringValue>'
        ).replace('<name>systemContext</name>', '<name>content</name>');
        const result = runOnXml(xml);
        assert.equal(result.exitCode, 0, result.stderr);
        assert.match(result.stdout, /Nothing to fix/);
        assert.equal(readFileSync(result.path, 'utf8'), xml);
    });

    test('fails on an unreadable file', () => {
        const result = runOnPath('/nonexistent/Flow.flow-meta.xml');
        assert.equal(result.exitCode, 1);
        assert.match(result.stderr, /Cannot read/);
    });
});
