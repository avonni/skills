import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    bumpLevel,
    checkVersionBumps,
    readSkillVersion
} from '../../scripts/check-version-bumps.mjs';

const SCRIPT = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../scripts/check-version-bumps.mjs'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = {
    skills: { 'skill-a': '1.0.1', 'skill-b': '1.0.0' },
    plugin: '1.0.0',
    changelog: '# Changelog\n\n## 1.0.0 - 2026-10-21\n'
};

function check(changedFiles, head = {}) {
    return checkVersionBumps({
        changedFiles,
        base: BASE,
        head: {
            ...BASE,
            ...head,
            skills: { ...BASE.skills, ...head.skills }
        }
    });
}

function changelog(version) {
    return `# Changelog\n\n## ${version} - 2026-11-01\n\n## 1.0.0 - 2026-10-21\n`;
}

function skillMd(version) {
    return `---\nname: skill\nmetadata:\n    version: '${version}'\n---\n\n# Skill\n`;
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('bumpLevel', () => {
    test('Detects single-step bumps', () => {
        assert.equal(bumpLevel('1.0.1', '1.0.2'), 'patch');
        assert.equal(bumpLevel('1.0.1', '1.1.0'), 'minor');
        assert.equal(bumpLevel('1.0.1', '2.0.0'), 'major');
    });

    test('Rejects unchanged, skipped, lower and invalid versions', () => {
        assert.equal(bumpLevel('1.0.1', '1.0.1'), null);
        assert.equal(bumpLevel('1.0.1', '1.0.3'), null);
        assert.equal(bumpLevel('1.0.1', '1.1.1'), null);
        assert.equal(bumpLevel('1.0.1', '1.0.0'), null);
        assert.equal(bumpLevel('1.0.1', '1.1'), null);
        assert.equal(bumpLevel('1.0.1', undefined), null);
    });
});

describe('readSkillVersion', () => {
    test('Reads a quoted metadata.version', () => {
        assert.equal(readSkillVersion(skillMd('1.2.3')), '1.2.3');
    });

    test('Ignores an unquoted version and versions outside metadata', () => {
        assert.equal(
            readSkillVersion('---\nmetadata:\n    version: 1.0\n---\n'),
            undefined
        );
        assert.equal(
            readSkillVersion("---\nversion: '1.0.0'\n---\n"),
            undefined
        );
    });
});

describe('checkVersionBumps', () => {
    test('Accepts changes outside skills and the plugin without bumps', () => {
        assert.deepEqual(
            check(['README.md', 'tests/skill-a/x.test.mjs', 'package.json']),
            []
        );
    });

    test('Requires a bump when a skill file changes', () => {
        const errors = check(['skills/skill-a/scripts/x.mjs']);
        assert.equal(errors.length, 2);
        assert.match(
            errors[0],
            /skills\/skill-a\/SKILL\.md must go from 1\.0\.1 to 1\.0\.2, 1\.1\.0 or 2\.0\.0/
        );
        assert.match(errors[1], /at least a patch bump of the plugin version/);
    });

    test('Accepts a skill patch with a plugin patch and changelog entry', () => {
        assert.deepEqual(
            check(['skills/skill-a/SKILL.md', 'CHANGELOG.md'], {
                skills: { 'skill-a': '1.0.2' },
                plugin: '1.0.1',
                changelog: changelog('1.0.1')
            }),
            []
        );
    });

    test('Requires the plugin bump to match the highest skill bump', () => {
        const errors = check(
            ['skills/skill-a/SKILL.md', 'skills/skill-b/SKILL.md'],
            {
                skills: { 'skill-a': '1.0.2', 'skill-b': '1.1.0' },
                plugin: '1.0.1',
                changelog: changelog('1.0.1')
            }
        );
        assert.equal(errors.length, 1);
        assert.match(errors[0], /at least a minor bump/);
    });

    test('Rejects skipped skill versions', () => {
        const errors = check(['skills/skill-a/SKILL.md'], {
            skills: { 'skill-a': '1.0.3' },
            plugin: '1.0.1',
            changelog: changelog('1.0.1')
        });
        assert.equal(errors.length, 1);
        assert.match(errors[0], /got 1\.0\.3/);
    });

    test('Requires a new skill to start at 1.0.0 with a minor plugin bump', () => {
        assert.deepEqual(
            check(['skills/skill-c/SKILL.md'], {
                skills: { 'skill-c': '1.0.0' },
                plugin: '1.1.0',
                changelog: changelog('1.1.0')
            }),
            []
        );
        const errors = check(['skills/skill-c/SKILL.md'], {
            skills: { 'skill-c': '0.1.0' },
            plugin: '1.0.1',
            changelog: changelog('1.0.1')
        });
        assert.equal(errors.length, 2);
        assert.match(
            errors[0],
            /New skill skill-c must start at version 1\.0\.0/
        );
        assert.match(errors[1], /at least a minor bump/);
    });

    test('Requires a major plugin bump when a skill is removed', () => {
        const head = {
            ...BASE,
            skills: { 'skill-b': '1.0.0' },
            plugin: '1.1.0',
            changelog: changelog('1.1.0')
        };
        const errors = checkVersionBumps({
            changedFiles: ['skills/skill-a/SKILL.md'],
            base: BASE,
            head
        });
        assert.equal(errors.length, 1);
        assert.match(errors[0], /at least a major bump/);
    });

    test('Requires a plugin bump when the plugin manifests or MCP config change', () => {
        for (const file of [
            '.claude-plugin/marketplace.json',
            '.codex-plugin/plugin.json',
            '.mcp.json'
        ]) {
            const errors = check([file]);
            assert.equal(errors.length, 1, file);
            assert.match(errors[0], /at least a patch bump/);
        }
    });

    test('Requires a changelog entry at the top for the new plugin version', () => {
        const errors = check(['package.json'], { plugin: '1.0.1' });
        assert.equal(errors.length, 1);
        assert.match(
            errors[0],
            /"## 1\.0\.1 - YYYY-MM-DD" entry at the top of CHANGELOG\.md/
        );
    });

    test('Rejects an invalid plugin bump', () => {
        const errors = check(['package.json'], {
            plugin: '1.0.2',
            changelog: changelog('1.0.2')
        });
        assert.equal(errors.length, 1);
        assert.match(errors[0], /package\.json must go from 1\.0\.0/);
    });
});

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

describe('CLI', () => {
    function write(dir, files) {
        for (const [path, content] of Object.entries(files)) {
            mkdirSync(dirname(join(dir, path)), { recursive: true });
            writeFileSync(join(dir, path), content);
        }
    }

    function git(dir, ...args) {
        const result = spawnSync(
            'git',
            [
                '-c',
                'user.name=Test',
                '-c',
                'user.email=test@example.com',
                ...args
            ],
            { cwd: dir, encoding: 'utf8' }
        );
        assert.equal(result.status, 0, result.stderr);
    }

    function runOnBranch(files) {
        const dir = mkdtempSync(join(tmpdir(), 'check-version-bumps-test-'));
        try {
            git(dir, 'init', '-q', '-b', 'main');
            write(dir, {
                'package.json': JSON.stringify({ version: '1.0.0' }),
                'CHANGELOG.md': '# Changelog\n\n## 1.0.0 - 2026-10-21\n',
                'skills/skill-a/SKILL.md': skillMd('1.0.0')
            });
            git(dir, 'add', '.');
            git(dir, 'commit', '-q', '-m', 'Base');
            git(dir, 'switch', '-q', '-c', 'feature');
            write(dir, files);
            git(dir, 'add', '.');
            git(dir, 'commit', '-q', '-m', 'Change');
            return spawnSync('node', [SCRIPT, 'main'], {
                cwd: dir,
                encoding: 'utf8'
            });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }

    test('Fails when a skill changes without bumps', () => {
        const result = runOnBranch({
            'skills/skill-a/references/x.md': 'New reference\n'
        });
        assert.equal(result.status, 1);
        assert.match(
            result.stderr,
            /skills\/skill-a\/SKILL\.md must go from 1\.0\.0/
        );
    });

    test('Passes when the skill, plugin and changelog are bumped', () => {
        const result = runOnBranch({
            'skills/skill-a/references/x.md': 'New reference\n',
            'skills/skill-a/SKILL.md': skillMd('1.0.1'),
            'package.json': JSON.stringify({ version: '1.0.1' }),
            'CHANGELOG.md': changelog('1.0.1')
        });
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /Version bumps OK/);
    });
});
