#!/usr/bin/env node
/**
 * Reads Avonni Dynamic Component build JSON and writes
 * avxp__AvonniDynamicComponent.<apiName>_<version>.md-meta.xml for deployment.
 *
 * Usage:
 *   node create-component.mjs <path-to.json> [--out-dir <directory>] [--user "<full name>"] [--version <number>]
 *
 * If --user is set, CreatedByName__c and LastModifiedByName__c are written with that value.
 * If --version is omitted, defaults to 1.
 * If --out-dir is omitted, writes under ./force-app/main/default/customMetadata
 * relative to the current working directory (run from repo root or pass --out-dir).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CUSTOM_METADATA_NS = 'http://soap.sforce.com/2006/04/metadata';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema';
const NAMESPACE = 'avxp';

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
 * @param {string} name
 * @returns {boolean}
 */
function isValidApiName(name) {
    if (typeof name !== 'string' || name.length === 0) {
        return false;
    }
    if (!/^[A-Za-z]/.test(name)) {
        return false;
    }
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
        return false;
    }
    if (name.endsWith('_')) {
        return false;
    }
    if (name.includes('__')) {
        return false;
    }
    return true;
}

/**
 * @returns {string}
 */
function formatCreatedDateTimeUtc() {
    const d = new Date();
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    return `${y}-${mo}-${day}T${h}:${mi}:${s}.000Z`;
}

function addNamespace(fieldName) {
    return NAMESPACE ? `${NAMESPACE}__${fieldName}` : fieldName;
}

/**
 * @param {string} apiName
 * @returns {string}
 */
function labelFromApiName(apiName) {
    return apiName.replace(/_/g, ' ');
}

/**
 * @param {string} fieldName
 * @param {string} innerValue
 * @returns {string}
 */
function valuesBlockStringField(fieldName, innerValue) {
    return `    <values>
        <field>${addNamespace(fieldName)}</field>
        <value xsi:type="xsd:string">${innerValue}</value>
    </values>`;
}

/**
 * @param {string} fieldName
 * @param {string} innerValue
 * @returns {string}
 */
function valuesBlockDateTimeField(fieldName, innerValue) {
    return `    <values>
        <field>${addNamespace(fieldName)}</field>
        <value xsi:type="xsd:dateTime">${innerValue}</value>
    </values>`;
}

/**
 * @param {string} fieldName
 * @param {boolean} bool
 * @returns {string}
 */
function valuesBlockBooleanField(fieldName, bool) {
    return `    <values>
        <field>${addNamespace(fieldName)}</field>
        <value xsi:type="xsd:boolean">${bool}</value>
    </values>`;
}

/**
 * @param {string} fieldName
 * @param {string} doubleText literal xsd:double text (e.g. "1.0")
 * @returns {string}
 */
function valuesBlockDoubleField(fieldName, doubleText) {
    return `    <values>
        <field>${addNamespace(fieldName)}</field>
        <value xsi:type="xsd:double">${doubleText}</value>
    </values>`;
}

/**
 * @param {unknown} data
 * @param {string | undefined} userFullName trimmed display name for CreatedByName__c / LastModifiedByName__c
 * @param {number} versionNumber
 * @returns {string}
 */
function buildCustomMetadataXml(data, userFullName, versionNumber) {
    const apiName = data.apiName;
    if (!isValidApiName(apiName)) {
        throw new Error(
            'Invalid or missing apiName: must start with a letter, use only letters, digits, and single underscores (no trailing or double underscore).'
        );
    }

    const queries = Array.isArray(data.queries) ? data.queries : [];
    const resources = Array.isArray(data.resources) ? data.resources : [];
    const value = Array.isArray(data.value) ? data.value : [];

    const description =
        typeof data.description === 'string' ? data.description.trim() : '';
    const hasDescription = description.length > 0;

    const label = labelFromApiName(apiName);
    const createdAt = formatCreatedDateTimeUtc();
    const hasUserFullName =
        typeof userFullName === 'string' && userFullName.length > 0;

    const parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<CustomMetadata xmlns="${CUSTOM_METADATA_NS}" xmlns:xsi="${XSI_NS}" xmlns:xsd="${XSD_NS}">`,
        `    <label>${escapeXmlString(label)}</label>`,
        '    <protected>false</protected>'
    ];

    if (hasUserFullName) {
        parts.push(
            valuesBlockStringField(
                'CreatedByName__c',
                escapeXmlString(userFullName)
            )
        );
    }

    parts.push(valuesBlockDateTimeField('CreatedDateTime__c', createdAt));

    if (hasDescription) {
        parts.push(
            valuesBlockStringField(
                'Description__c',
                escapeXmlString(description)
            )
        );
    }

    parts.push(
        valuesBlockStringField(
            'DynamicComponentName__c',
            escapeXmlString(apiName)
        ),
        valuesBlockBooleanField('IsLastModified__c', true)
    );

    if (hasUserFullName) {
        parts.push(
            valuesBlockStringField(
                'LastModifiedByName__c',
                escapeXmlString(userFullName)
            )
        );
    }
    parts.push(valuesBlockDateTimeField('LastModifiedDateTime__c', createdAt));

    parts.push(
        valuesBlockStringField(
            'Queries__c',
            escapeXmlString(JSON.stringify(queries))
        ),
        valuesBlockStringField(
            'Resources__c',
            escapeXmlString(JSON.stringify(resources))
        ),
        valuesBlockStringField('Status__c', escapeXmlString('Inactive')),
        valuesBlockStringField(
            'Value__c',
            escapeXmlString(JSON.stringify(value))
        ),
        valuesBlockDoubleField('VersionNumber__c', String(versionNumber)),
        '</CustomMetadata>',
        ''
    );

    return parts.join('\n');
}


function parseArgs(argv) {
    /** @type {string | undefined} */
    let jsonPath;
    /** @type {string | undefined} */
    let outDir;
    /** @type {string | undefined} */
    let userFullName;
    /** @type {number} */
    let versionNumber = 1;

    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--out-dir') {
            const next = argv[i + 1];
            if (!next) {
                throw new Error('--out-dir requires a directory path');
            }
            outDir = next;
            i += 1;
        } else if (a === '--user') {
            const next = argv[i + 1];
            if (!next || next.startsWith('-')) {
                throw new Error('--user requires a non-empty full name');
            }
            const trimmed = next.trim();
            if (!trimmed) {
                throw new Error('--user requires a non-empty full name');
            }
            userFullName = trimmed;
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
        } else if (!a.startsWith('-')) {
            if (jsonPath) {
                throw new Error(`Unexpected argument: ${a}`);
            }
            jsonPath = a;
        } else {
            throw new Error(`Unknown option: ${a}`);
        }
    }

    if (!jsonPath) {
        throw new Error(
            'Usage: node create-component.mjs <path-to.json> [--out-dir <directory>] [--user "<full name>"] [--version <number>]'
        );
    }

    const defaultOut = join(
        process.cwd(),
        'force-app',
        'main',
        'default',
        'customMetadata'
    );

    return {
        jsonPath: resolve(jsonPath),
        outDir: resolve(outDir ?? defaultOut),
        userFullName,
        versionNumber
    };
}

function main() {
    const { jsonPath, outDir, userFullName, versionNumber } = parseArgs(
        process.argv.slice(2)
    );

    const raw = readFileSync(jsonPath, 'utf8');
    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        throw new Error(
            `Invalid JSON in ${jsonPath}: ${
                e instanceof Error ? e.message : String(e)
            }`
        );
    }

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('JSON root must be an object');
    }

    const xml = buildCustomMetadataXml(data, userFullName, versionNumber);
    const apiName = data.apiName;
    const fileName = `${addNamespace('AvonniDynamicComponent')}.${apiName}_${versionNumber}.md-meta.xml`;
    const outPath = join(outDir, fileName);

    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, xml, 'utf8');

    process.stderr.write(`Wrote ${outPath}\n`);
}

try {
    main();
} catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`Error: ${msg}\n`);
    process.exit(1);
}
