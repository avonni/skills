#!/usr/bin/env node
/**
 * Reads Avonni Dynamic Component build JSON and writes
 * avxp__AvonniDynamicComponent.<apiName>_<version>.md-meta.xml for deployment.
 *
 * Usage:
 *   node create-component.mjs <path-to.json | -> [--out-dir <directory>] [--version <number>] [--edit] [--prev-developer-name <name>]
 *
 * Pass `-` (or omit the path) to read JSON from stdin.
 * If --version is omitted, defaults to 1.
 * If --out-dir is omitted, writes under ./force-app/main/default/customMetadata
 * relative to the current working directory (run from repo root or pass --out-dir).
 *
 * Fields managed by this script (always written with fresh values):
 *   DynamicComponentName__c, IsLastModified__c, LastModifiedDateTime__c,
 *   LastModifiedByName__c, VersionNumber__c, Value__c, Queries__c, Resources__c,
 *   Description__c (when present), ObjectApiName__c (when present).
 *
 * Fields with defaults (taken from _passthrough when available, otherwise defaulted):
 *   CreatedDateTime__c → now, Status__c → "Inactive".
 *   CreatedByName__c → current user (new/new-version) or preserved from _passthrough (--edit).
 *
 * Pass --edit when updating an existing version in place (preserves CreatedByName__c).
 *
 * All other fields in _passthrough are written verbatim, preserving their xsi:type.
 * This means any field added to the object in the future is automatically preserved
 * on update without any script changes.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectNamespace, escapeSoqlString, runSf } from './namespace.mjs';
import { validateComponent } from './validate-component.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CUSTOM_METADATA_NS = 'http://soap.sforce.com/2006/04/metadata';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema';
const NAMESPACE = detectNamespace();

/**
 * @param {string} s
 * @returns {string}
 */
function escapeXmlString(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @returns {string}
 */
function nowUtc() {
    const d = new Date();
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    return `${y}-${mo}-${day}T${h}:${mi}:${s}.000Z`;
}

/**
 * @param {string} localName field name without namespace prefix
 * @returns {string}
 */
function addNamespace(localName) {
    return NAMESPACE ? `${NAMESPACE}__${localName}` : localName;
}

/**
 * @param {string} apiName
 * @returns {string}
 */
function labelFromApiName(apiName) {
    return apiName.replace(/_/g, ' ');
}

/**
 * Generic <values> block — accepts the full qualified field name and xsi:type.
 * innerValue must already be XML-escaped.
 * @param {string} fieldName fully-qualified field name (e.g. avxp__Status__c)
 * @param {string} type xsi:type value (e.g. xsd:string)
 * @param {string} innerValue XML-escaped value text
 * @returns {string}
 */
function valuesBlock(fieldName, type, innerValue) {
    return `    <values>
        <field>${fieldName}</field>
        <value xsi:type="${type}">${innerValue}</value>
    </values>`;
}

// Convenience wrappers that apply the namespace prefix and correct xsi:type.
const str = (localName, v) =>
    valuesBlock(addNamespace(localName), 'xsd:string', v);
const dt = (localName, v) =>
    valuesBlock(addNamespace(localName), 'xsd:dateTime', v);
const bool = (localName, v) =>
    valuesBlock(addNamespace(localName), 'xsd:boolean', String(v));
const dbl = (localName, v) =>
    valuesBlock(addNamespace(localName), 'xsd:double', String(v));

// Fields this script writes explicitly — skipped when emitting _passthrough entries
// to avoid duplicates.
const MANAGED_FIELDS = new Set(
    [
        'CreatedByName__c',
        'CreatedDateTime__c',
        'Description__c',
        'DynamicComponentName__c',
        'IsLastModified__c',
        'LastModifiedByName__c',
        'LastModifiedDateTime__c',
        'ObjectApiName__c',
        'Queries__c',
        'Resources__c',
        'Status__c',
        'Value__c',
        'VersionNumber__c'
    ].map(addNamespace)
);

/**
 * Fetches the current Salesforce user's full name via the SF CLI.
 * Returns null if any step fails (non-blocking).
 * @returns {string | null}
 */
function fetchCurrentUserName() {
    try {
        const userJson = runSf(['org', 'display', 'user', '--json'], {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        const username = JSON.parse(userJson)?.result?.username;

        // Salesforce usernames are email-format. Reject anything outside that
        // safe charset so the value can never carry shell metacharacters.
        if (
            !username ||
            typeof username !== 'string' ||
            !/^[A-Za-z0-9@._+-]+$/.test(username)
        ) {
            return null;
        }

        const queryJson = runSf(
            [
                'data',
                'query',
                '--query',
                `SELECT FirstName, LastName FROM User WHERE Username = '${escapeSoqlString(
                    username
                )}'`,
                '--json'
            ],
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );

        const record = JSON.parse(queryJson)?.result?.records?.[0];
        if (!record) return null;

        const fullName = `${record.FirstName ?? ''} ${
            record.LastName ?? ''
        }`.trim();
        return fullName || null;
    } catch {
        return null;
    }
}

/**
 * @param {unknown} data
 * @param {number} versionNumber
 * @param {string | null} currentUserName
 * @param {boolean} isEdit
 * @returns {string}
 */
function buildCustomMetadataXml(data, versionNumber, currentUserName, isEdit) {
    const apiName = data.apiName;
    const queries = Array.isArray(data.queries) ? data.queries : [];
    const resources = Array.isArray(data.resources) ? data.resources : [];
    const value = Array.isArray(data.value) ? data.value : [];

    const description =
        typeof data.description === 'string' ? data.description.trim() : '';
    const objectApiName =
        typeof data.objectApiName === 'string' ? data.objectApiName.trim() : '';

    // _passthrough carries fields read from an existing file that this script
    // does not regenerate. Each entry is { type: string, value: string } where
    // value is unescaped.
    /** @type {Record<string, { type: string, value: string }>} */
    const passthrough = data._passthrough ?? {};

    const now = nowUtc();

    // CreatedDateTime__c: preserve from passthrough (update case) or use now (create case).
    const createdAt =
        passthrough[addNamespace('CreatedDateTime__c')]?.value ?? now;

    // Status__c: preserve from passthrough or default to Inactive.
    const status = passthrough[addNamespace('Status__c')]?.value ?? 'Inactive';

    // CreatedByName__c: preserve from passthrough when editing an existing version,
    // otherwise use the current user (new component or new version).
    const createdByName = isEdit
        ? passthrough[addNamespace('CreatedByName__c')]?.value ??
          currentUserName
        : currentUserName;

    // LastModifiedByName__c: always the current user.
    const lastModifiedByName = currentUserName;

    const label = labelFromApiName(apiName);

    const parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<CustomMetadata xmlns="${CUSTOM_METADATA_NS}" xmlns:xsi="${XSI_NS}" xmlns:xsd="${XSD_NS}">`,
        `    <label>${escapeXmlString(label)}</label>`,
        '    <protected>false</protected>',
        dt('CreatedDateTime__c', createdAt)
    ];

    if (createdByName) {
        parts.push(str('CreatedByName__c', escapeXmlString(createdByName)));
    }

    if (description) {
        parts.push(str('Description__c', escapeXmlString(description)));
    }

    parts.push(
        str('DynamicComponentName__c', escapeXmlString(apiName)),
        bool('IsLastModified__c', true),
        dt('LastModifiedDateTime__c', now)
    );

    if (lastModifiedByName) {
        parts.push(
            str('LastModifiedByName__c', escapeXmlString(lastModifiedByName))
        );
    }

    if (objectApiName) {
        parts.push(str('ObjectApiName__c', escapeXmlString(objectApiName)));
    }

    parts.push(
        str('Queries__c', escapeXmlString(JSON.stringify(queries))),
        str('Resources__c', escapeXmlString(JSON.stringify(resources))),
        str('Status__c', escapeXmlString(status))
    );

    // Emit all passthrough fields that this script does not manage explicitly.
    // Sorted for deterministic output.
    for (const fieldName of Object.keys(passthrough).sort()) {
        if (!MANAGED_FIELDS.has(fieldName)) {
            const { type, value: raw } = passthrough[fieldName];
            parts.push(valuesBlock(fieldName, type, escapeXmlString(raw)));
        }
    }

    parts.push(
        str('Value__c', escapeXmlString(JSON.stringify(value))),
        dbl('VersionNumber__c', versionNumber),
        '</CustomMetadata>',
        ''
    );

    return parts.join('\n');
}

/**
 * Recursively searches dir for the metadata file of the given DeveloperName.
 * @param {string} dir
 * @param {string} developerName
 * @returns {string | null}
 */
function findPrevFile(dir, developerName) {
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
 * Clears IsLastModified__c on the previous version's metadata file.
 * Retrieves the file from Salesforce if not found locally.
 * @param {string} developerName
 */
function clearPrevLastModified(developerName) {
    let filePath = findPrevFile('./force-app', developerName);

    if (!filePath) {
        process.stderr.write(`Previous version file not found locally. Retrieving from Salesforce...\n`);
        try {
            runSf(
                [
                    'project',
                    'retrieve',
                    'start',
                    '--metadata',
                    `CustomMetadata:${NAMESPACE}__AvonniDynamicComponent.${developerName}`
                ],
                { stdio: 'inherit' }
            );
        } catch (e) {
            throw new Error(
                `Salesforce retrieval failed: ${e instanceof Error ? e.message : String(e)}`
            );
        }
        filePath = findPrevFile('./force-app', developerName);
    }

    if (!filePath) {
        throw new Error(
            `${NAMESPACE}__AvonniDynamicComponent.${developerName}.md-meta.xml not found under ./force-app after retrieval attempt.`
        );
    }

    const fieldName = `${NAMESPACE}__IsLastModified__c`;
    const content = readFileSync(filePath, 'utf8');
    const updated = content.replace(
        new RegExp(`(<field>${fieldName}<\\/field>[\\s\\S]*?<value[^>]*>)true(<\\/value>)`),
        '$1false$2'
    );
    if (updated === content) {
        throw new Error(`${fieldName} not found or already false in ${filePath}`);
    }
    writeFileSync(filePath, updated, 'utf8');
    process.stderr.write(`Updated ${filePath}: ${fieldName} set to false\n`);
}

function parseArgs(argv) {
    /** @type {string | undefined} */
    let jsonPath;
    /** @type {string | undefined} */
    let outDir;
    /** @type {number} */
    let versionNumber = 1;
    /** @type {boolean} */
    let isEdit = false;
    /** @type {string | undefined} */
    let prevDeveloperName;

    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--out-dir') {
            const next = argv[i + 1];
            if (!next) {
                throw new Error('--out-dir requires a directory path');
            }
            outDir = next;
            i += 1;
        } else if (a === '--version') {
            const next = argv[i + 1];
            if (!next || next.startsWith('-')) {
                throw new Error('--version requires a positive number');
            }
            const parsed = parseFloat(next);
            if (isNaN(parsed) || parsed <= 0) {
                throw new Error('--version requires a positive number');
            }
            versionNumber = parsed;
            i += 1;
        } else if (a === '--edit') {
            isEdit = true;
        } else if (a === '--prev-developer-name') {
            const next = argv[i + 1];
            if (!next || next.startsWith('-')) {
                throw new Error('--prev-developer-name requires a value');
            }
            if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(next)) {
                throw new Error(
                    `--prev-developer-name "${next}" is invalid: must start with a letter and use only letters, digits, and underscores.`
                );
            }
            prevDeveloperName = next;
            i += 1;
        } else if (a === '-' || !a.startsWith('-')) {
            if (jsonPath) {
                throw new Error(`Unexpected argument: ${a}`);
            }
            jsonPath = a;
        } else {
            throw new Error(`Unknown option: ${a}`);
        }
    }

    const defaultOut = join(
        process.cwd(),
        'force-app',
        'main',
        'default',
        'customMetadata'
    );

    const useStdin = !jsonPath || jsonPath === '-';

    return {
        jsonPath: useStdin ? null : resolve(jsonPath),
        outDir: resolve(outDir ?? defaultOut),
        versionNumber,
        isEdit,
        prevDeveloperName
    };
}

function main() {
    const { jsonPath, outDir, versionNumber, isEdit, prevDeveloperName } = parseArgs(
        process.argv.slice(2)
    );

    const source = jsonPath ?? 'stdin';
    const raw = readFileSync(jsonPath ?? 0, 'utf8');
    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        throw new Error(
            `Invalid JSON in ${source}: ${
                e instanceof Error ? e.message : String(e)
            }`
        );
    }

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('JSON root must be an object');
    }

    const validationErrors = validateComponent(
        /** @type {Record<string, unknown>} */ (data)
    );
    if (validationErrors.length > 0) {
        process.stderr.write(
            `Validation failed with ${validationErrors.length} error(s):\n`
        );
        for (const e of validationErrors) {
            process.stderr.write(`  - ${e}\n`);
        }
        process.exit(1);
    }
    process.stderr.write('Validation passed.\n');

    const currentUserName = fetchCurrentUserName();
    if (!currentUserName) {
        process.stderr.write(
            'Warning: could not retrieve current Salesforce user name. CreatedByName__c / LastModifiedByName__c will be omitted.\n'
        );
    }

    const xml = buildCustomMetadataXml(
        data,
        versionNumber,
        currentUserName,
        isEdit
    );
    const apiName = data.apiName;
    const fileName = `${addNamespace(
        'AvonniDynamicComponent'
    )}.${apiName}_${versionNumber}.md-meta.xml`;
    const outPath = join(outDir, fileName);

    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, xml, 'utf8');
    process.stderr.write(`Wrote ${outPath}\n`);

    if (prevDeveloperName) {
        clearPrevLastModified(prevDeveloperName);
    }
}

try {
    main();
} catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`Error: ${msg}\n`);
    process.exit(1);
}
