#!/usr/bin/env node
// Checks that a branch bumps the skill and plugin versions as described in
// CONTRIBUTING.md#versioning, compared to a base branch.
//
// Usage: node scripts/check-version-bumps.mjs [base-ref]   (default: origin/main)

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVELS = ['patch', 'minor', 'major'];
const PLUGIN_PATHS = ['.claude-plugin/', '.codex-plugin/', '.mcp.json'];

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

/**
 * Returns `metadata.version` from the frontmatter of a SKILL.md, or
 * undefined when it's missing or not a quoted string.
 */
export function readSkillVersion(content) {
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const metadata =
        frontmatter.match(/^metadata:\n((?:[ \t]+.*(?:\n|$))+)/m)?.[1] ?? '';
    return metadata.match(/^[ \t]+version:[ \t]*'([^']*)'[ \t]*$/m)?.[1];
}

function parseVersion(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
    return match ? match.slice(1).map(Number) : null;
}

function nextVersions(version) {
    const parsed = parseVersion(version);
    if (!parsed) return 'a MAJOR.MINOR.PATCH version';
    const [major, minor, patch] = parsed;
    return `${major}.${minor}.${patch + 1}, ${major}.${minor + 1}.0 or ${
        major + 1
    }.0.0`;
}

/**
 * Returns 'patch', 'minor' or 'major' when `to` is the next version of
 * `from` at that level, or null otherwise (unchanged, skipped or invalid).
 */
export function bumpLevel(from, to) {
    const a = parseVersion(from);
    const b = parseVersion(to);
    if (!a || !b) return null;
    const [major, minor, patch] = a;
    if (b[0] === major + 1 && b[1] === 0 && b[2] === 0) return 'major';
    if (b[0] === major && b[1] === minor + 1 && b[2] === 0) return 'minor';
    if (b[0] === major && b[1] === minor && b[2] === patch + 1) return 'patch';
    return null;
}

function isLower(level, other) {
    return LEVELS.indexOf(level) < LEVELS.indexOf(other);
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

/**
 * Compares the base and head states of the repository and returns a list of
 * errors, empty when the versions follow the rules.
 *
 * @param {object} input
 * @param {string[]} input.changedFiles Paths changed on the branch.
 * @param {{ skills: Object<string, string|undefined>, plugin: string }} input.base
 * @param {{ skills: Object<string, string|undefined>, plugin: string, changelog: string }} input.head
 * @returns {string[]}
 */
export function checkVersionBumps({ changedFiles, base, head }) {
    const errors = [];
    // Lowest plugin bump the changes require, or null when none is required.
    let requiredLevel = null;
    const requirePluginBump = (level) => {
        if (isLower(requiredLevel, level)) requiredLevel = level;
    };

    const changedSkills = new Set(
        changedFiles
            .map((file) => file.split('/'))
            .filter((parts) => parts[0] === 'skills' && parts.length > 2)
            .map((parts) => parts[1])
    );

    for (const skill of [...changedSkills].sort()) {
        const inBase = Object.hasOwn(base.skills, skill);
        const inHead = Object.hasOwn(head.skills, skill);
        const from = base.skills[skill];
        const to = head.skills[skill];

        if (!inHead) {
            requirePluginBump('major');
        } else if (!inBase) {
            if (to !== '1.0.0') {
                errors.push(
                    `New skill ${skill} must start at version 1.0.0 (got ${
                        to ?? 'none'
                    }).`
                );
            }
            requirePluginBump('minor');
        } else {
            const level = bumpLevel(from, to);
            // A changed skill needs at least a patch bump of the plugin too.
            requirePluginBump(level ?? 'patch');
            if (!level) {
                errors.push(
                    `skills/${skill} changed, so metadata.version in skills/${skill}/SKILL.md must go from ${from} to ${nextVersions(
                        from
                    )} (got ${to ?? 'none'}).`
                );
            }
        }
    }

    if (
        changedFiles.some((file) =>
            PLUGIN_PATHS.some((path) => file.startsWith(path))
        )
    ) {
        requirePluginBump('patch');
    }

    const pluginChanged = head.plugin !== base.plugin;
    const pluginLevel = bumpLevel(base.plugin, head.plugin);
    if (pluginChanged && !pluginLevel) {
        errors.push(
            `The version in package.json must go from ${
                base.plugin
            } to ${nextVersions(base.plugin)} (got ${head.plugin}).`
        );
    } else if (requiredLevel && isLower(pluginLevel, requiredLevel)) {
        errors.push(
            `These changes need at least a ${requiredLevel} bump of the plugin version (${
                base.plugin
            } to ${nextVersions(
                base.plugin
            )}) in package.json, .claude-plugin/plugin.json and .codex-plugin/plugin.json.`
        );
    }

    if (pluginLevel) {
        const latest = head.changelog.match(/^## (\S+)/m)?.[1];
        if (latest !== head.plugin) {
            errors.push(
                `Add a "## ${head.plugin} - YYYY-MM-DD" entry at the top of CHANGELOG.md.`
            );
        }
    }

    return errors;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function git(...args) {
    return execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
}

function show(ref, path) {
    try {
        return git('show', `${ref}:${path}`);
    } catch {
        return null;
    }
}

function readState(ref) {
    const skills = {};
    const dirs = git('ls-tree', '-d', '--name-only', ref, 'skills/');
    for (const dir of dirs.split('\n').filter(Boolean)) {
        const content = show(ref, `${dir}/SKILL.md`);
        skills[dir.slice('skills/'.length)] =
            content === null ? undefined : readSkillVersion(content);
    }
    return {
        skills,
        plugin: JSON.parse(show(ref, 'package.json')).version,
        changelog: show(ref, 'CHANGELOG.md') ?? ''
    };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
    const baseRef = process.argv[2] ?? 'origin/main';
    const changedFiles = git(
        'diff',
        '--name-only',
        '--no-renames',
        `${baseRef}...HEAD`
    )
        .split('\n')
        .filter(Boolean);
    const errors = checkVersionBumps({
        changedFiles,
        base: readState(baseRef),
        head: readState('HEAD')
    });

    if (errors.length > 0) {
        console.error(
            `Version bumps don't follow CONTRIBUTING.md#versioning (compared to ${baseRef}):`
        );
        for (const error of errors) console.error(`- ${error}`);
        process.exit(1);
    }
    console.log(`Version bumps OK (compared to ${baseRef}).`);
}
