import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SKILLS_DIR = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../skills'
);

const SKILLS = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

function readVersion(skill) {
    const content = readFileSync(join(SKILLS_DIR, skill, 'SKILL.md'), 'utf8');
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const metadata =
        frontmatter.match(/^metadata:\n((?:[ \t]+.*(?:\n|$))+)/m)?.[1] ?? '';
    return metadata.match(/^[ \t]+version:[ \t]*'([^']*)'[ \t]*$/m)?.[1];
}

describe('Skills', () => {
    for (const skill of SKILLS) {
        test(`${skill} has a semver metadata.version`, () => {
            const version = readVersion(skill);
            assert.ok(
                version,
                `${skill}/SKILL.md must set metadata.version as a quoted string, e.g. version: '1.0.0'`
            );
            assert.match(
                version,
                /^\d+\.\d+\.\d+$/,
                `${skill}/SKILL.md metadata.version must be MAJOR.MINOR.PATCH (got '${version}')`
            );
        });
    }
});
