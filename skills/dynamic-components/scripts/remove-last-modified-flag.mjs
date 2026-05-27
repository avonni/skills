#!/usr/bin/env node
/**
 * Finds the metadata file for the given DeveloperName under ./force-app (or
 * --search-dir) and sets avxp__IsLastModified__c to false.
 * If the file is not found locally, attempts to retrieve it from Salesforce
 * using the Salesforce CLI before retrying.
 *
 * Usage:
 *   node remove-last-modified-flag.mjs <DeveloperName> [--search-dir <dir>]
 */

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { detectNamespace } from './namespace.mjs';

const NAMESPACE = detectNamespace();

/**
 * Recursively searches dir for a file named
 * avxp__AvonniDynamicComponent.<developerName>.md-meta.xml.
 * @param {string} dir
 * @param {string} developerName
 * @returns {string | null}
 */
function findFile(dir, developerName) {
    const target = `${NAMESPACE}__AvonniDynamicComponent.${developerName}.md-meta.xml`;

    function walk(current) {
        let entries;
        try {
            entries = readdirSync(current, { withFileTypes: true });
        } catch {
            return null;
        }
        for (const ent of entries) {
            const p = join(current, ent.name);
            if (ent.isDirectory()) {
                const found = walk(p);
                if (found) return found;
            } else if (ent.name === target) {
                return p;
            }
        }
        return null;
    }

    return walk(resolve(dir));
}

/**
 * Sets avxp__IsLastModified__c to false in the given file.
 * Throws if the field is not found or is already false.
 * @param {string} filePath
 */
function deactivate(filePath) {
    const fieldName = `${NAMESPACE}__IsLastModified__c`;
    const content = readFileSync(filePath, 'utf8');
    const updated = content.replace(
        new RegExp(
            `(<field>${fieldName}<\\/field>[\\s\\S]*?<value[^>]*>)true(<\\/value>)`
        ),
        '$1false$2'
    );
    if (updated === content) {
        throw new Error(
            `${fieldName} not found or already false in ${filePath}`
        );
    }
    writeFileSync(filePath, updated, 'utf8');
}

function parseArgs(argv) {
    /** @type {string | undefined} */
    let developerName;
    let searchDir = './force-app';

    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--search-dir') {
            const next = argv[i + 1];
            if (!next || next.startsWith('-')) {
                throw new Error('--search-dir requires a directory path');
            }
            searchDir = next;
            i += 1;
        } else if (!a.startsWith('-')) {
            if (developerName) {
                throw new Error(`Unexpected argument: ${a}`);
            }
            developerName = a;
        } else {
            throw new Error(`Unknown option: ${a}`);
        }
    }

    if (!developerName) {
        throw new Error(
            'Usage: node remove-last-modified-flag.mjs <DeveloperName> [--search-dir <dir>]'
        );
    }

    return { developerName, searchDir };
}

function main() {
    const { developerName, searchDir } = parseArgs(process.argv.slice(2));

    let filePath = findFile(searchDir, developerName);

    if (!filePath) {
        process.stderr.write(
            `File not found locally. Retrieving from Salesforce...\n`
        );
        try {
            execSync(
                `sf project retrieve start --metadata "CustomMetadata:${NAMESPACE}__AvonniDynamicComponent.${developerName}"`,
                { stdio: 'inherit' }
            );
        } catch (e) {
            throw new Error(
                `Salesforce retrieval failed: ${
                    e instanceof Error ? e.message : String(e)
                }`
            );
        }
        filePath = findFile(searchDir, developerName);
    }

    if (!filePath) {
        throw new Error(
            `${NAMESPACE}__AvonniDynamicComponent.${developerName}.md-meta.xml not found under ${searchDir} after retrieval attempt.`
        );
    }

    deactivate(filePath);
    process.stderr.write(
        `Updated ${filePath}: ${NAMESPACE}__IsLastModified__c set to false\n`
    );
}

try {
    main();
} catch (e) {
    process.stderr.write(
        `Error: ${e instanceof Error ? e.message : String(e)}\n`
    );
    process.exit(1);
}
