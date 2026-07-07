#!/usr/bin/env node
/**
 * Queries existing versions of a Dynamic Component and outputs version info as JSON.
 *
 * Usage:
 *   node query-versions.mjs --api-name <apiName>
 *
 * Outputs to stdout:
 *   {
 *     nextVersion: number,
 *     currentVersion: number | null,
 *     lastModifiedDeveloperName: string | null
 *   }
 *
 * nextVersion is 1 for a first-time save.
 * currentVersion and lastModifiedDeveloperName are null when no existing versions exist.
 */

import { detectNamespace, escapeSoqlString, runSf } from './namespace.mjs';

/**
 * @param {string} name
 * @returns {boolean}
 */
function isValidApiName(name) {
    if (typeof name !== 'string' || name.length === 0) return false;
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return false;
    if (name.endsWith('_')) return false;
    if (name.includes('__')) return false;
    return true;
}

function parseArgs(argv) {
    let apiName;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--api-name') {
            apiName = argv[++i];
        } else if (!argv[i].startsWith('-')) {
            apiName = argv[i];
        }
    }
    if (!apiName) throw new Error('Usage: node query-versions.mjs --api-name <apiName>');
    if (!isValidApiName(apiName)) {
        throw new Error(
            `Invalid apiName "${apiName}": must start with a letter and use only letters, digits, and single underscores.`
        );
    }
    return { apiName };
}

function main() {
    const { apiName } = parseArgs(process.argv.slice(2));
    const ns = detectNamespace();

    const empty = { nextVersion: 1, currentVersion: null, lastModifiedDeveloperName: null };

    let records;
    try {
        const raw = runSf(
            [
                'data',
                'query',
                '--query',
                `SELECT DeveloperName, ${ns}__VersionNumber__c, ${ns}__IsLastModified__c FROM ${ns}__AvonniDynamicComponent__mdt WHERE ${ns}__DynamicComponentName__c = '${escapeSoqlString(
                    apiName
                )}'`,
                '--json'
            ],
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        records = JSON.parse(raw)?.result?.records ?? [];
    } catch {
        process.stdout.write(JSON.stringify(empty) + '\n');
        return;
    }

    if (records.length === 0) {
        process.stdout.write(JSON.stringify(empty) + '\n');
        return;
    }

    const maxVersion = Math.max(...records.map((r) => r[`${ns}__VersionNumber__c`] ?? 0));
    const nextVersion = Math.floor(maxVersion) + 1;
    const lastModified = records.find((r) => r[`${ns}__IsLastModified__c`]);

    process.stdout.write(
        JSON.stringify({
            nextVersion,
            currentVersion: Math.floor(maxVersion),
            lastModifiedDeveloperName: lastModified?.DeveloperName ?? null
        }) + '\n'
    );
}

try {
    main();
} catch (e) {
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
}
