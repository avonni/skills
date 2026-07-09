import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../skills/avonni-flow-components/scripts/create-flow.mjs'
);

const tempDirs = [];

function makeTempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'create-flow-'));
    tempDirs.push(dir);
    return dir;
}

after(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function run(args) {
    const result = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
    return {
        exitCode: result.status,
        stdout: result.stdout,
        stderr: result.stderr
    };
}

describe('create-flow.mjs', () => {
    test('creates a flow file from a label', () => {
        const dir = makeTempDir();
        const { exitCode, stdout } = run([
            '--label',
            'My Test Flow',
            '--out-dir',
            dir
        ]);
        assert.equal(exitCode, 0);
        const path = stdout.trim();
        assert.equal(path, join(dir, 'My_Test_Flow.flow-meta.xml'));
        assert.ok(existsSync(path));
    });

    test('scaffold contains the required flow elements', () => {
        const dir = makeTempDir();
        run(['--label', 'Anatomy', '--out-dir', dir]);
        const xml = readFileSync(join(dir, 'Anatomy.flow-meta.xml'), 'utf8');
        assert.match(
            xml,
            /<Flow xmlns="http:\/\/soap\.sforce\.com\/2006\/04\/metadata">/
        );
        assert.match(xml, /<processType>Flow<\/processType>/);
        assert.match(xml, /<status>Draft<\/status>/);
        assert.match(
            xml,
            /<interviewLabel>Anatomy \{!\$Flow\.CurrentDateTime\}<\/interviewLabel>/
        );
        assert.match(xml, /<stringValue>AUTO_LAYOUT_CANVAS<\/stringValue>/);
        assert.match(xml, /<screens>\s*<name>Screen1<\/name>/);
        assert.match(xml, /<targetReference>Screen1<\/targetReference>/);
        assert.match(xml, /<showFooter>true<\/showFooter>/);
    });

    test('derives a valid API name from labels with accents and symbols', () => {
        const dir = makeTempDir();
        const { exitCode, stdout } = run([
            '--label',
            ' Éléphant & Co — 2nd round! ',
            '--out-dir',
            dir
        ]);
        assert.equal(exitCode, 0);
        assert.ok(stdout.includes('Elephant_Co_2nd_round.flow-meta.xml'));
    });

    test('escapes XML special characters in the label', () => {
        const dir = makeTempDir();
        run(['--label', 'A & B <Test>', '--api-name', 'Esc', '--out-dir', dir]);
        const xml = readFileSync(join(dir, 'Esc.flow-meta.xml'), 'utf8');
        assert.match(xml, /<label>A &amp; B &lt;Test&gt;<\/label>/);
    });

    test('honors --api-name, --screen-label and --api-version', () => {
        const dir = makeTempDir();
        run([
            '--label',
            'Custom',
            '--api-name',
            'My_Name',
            '--screen-label',
            'First Screen',
            '--api-version',
            '60.0',
            '--out-dir',
            dir
        ]);
        const xml = readFileSync(join(dir, 'My_Name.flow-meta.xml'), 'utf8');
        assert.match(xml, /<apiVersion>60\.0<\/apiVersion>/);
        assert.match(xml, /<label>First Screen<\/label>/);
    });

    test('refuses to overwrite an existing file without --force', () => {
        const dir = makeTempDir();
        run(['--label', 'Dup', '--out-dir', dir]);
        const second = run(['--label', 'Dup', '--out-dir', dir]);
        assert.equal(second.exitCode, 1);
        assert.match(second.stderr, /already exists/);
        const forced = run(['--label', 'Dup', '--out-dir', dir, '--force']);
        assert.equal(forced.exitCode, 0);
    });

    test('fails without --label', () => {
        const { exitCode, stderr } = run([]);
        assert.equal(exitCode, 1);
        assert.match(stderr, /--label/);
    });

    test('rejects invalid API names', () => {
        const dir = makeTempDir();
        const { exitCode, stderr } = run([
            '--label',
            'Bad',
            '--api-name',
            '1_Bad__Name_',
            '--out-dir',
            dir
        ]);
        assert.equal(exitCode, 1);
        assert.match(stderr, /Invalid flow API name/);
    });
});
