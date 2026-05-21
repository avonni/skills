#!/usr/bin/env node
/**
 * Reads an Avonni Dynamic Component .md-meta.xml file and writes
 * the component JSON structure to stdout or a file.
 *
 * Usage:
 *   node read-component.mjs <path-to.md-meta.xml> [--out <output.json>]
 *
 * Outputs { apiName, description?, objectApiName?, value, queries, resources, _passthrough? }.
 * _passthrough carries every other <values> field verbatim (with its xsi:type) so they
 * survive a round-trip through create-component.mjs without any field-by-field handling.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NAMESPACE = 'avxp';

/**
 * @param {string} localName field name without namespace prefix
 * @returns {string}
 */
function addNamespace(localName) {
    return NAMESPACE ? `${NAMESPACE}__${localName}` : localName;
}

/**
 * @param {string} str
 * @returns {string}
 */
function unescapeXml(str) {
    return str
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

/**
 * Extracts all <values> blocks from the XML.
 * Returns a map of field name → { rawValue: string, type: string }.
 * rawValue is the XML-escaped text inside <value>; type is the xsi:type attribute value.
 * @param {string} xml
 * @returns {Record<string, { rawValue: string, type: string }>}
 */
function parseFieldValues(xml) {
    const fields = {};
    const blockRe = /<values>([\s\S]*?)<\/values>/g;
    let block;
    while ((block = blockRe.exec(xml)) !== null) {
        const inner = block[1];
        const fieldMatch = /<field>([^<]+)<\/field>/.exec(inner);
        const valueMatch = /<value[^>]*>([\s\S]*?)<\/value>/.exec(inner);
        const typeMatch = /<value[^>]*xsi:type="([^"]*)"/.exec(inner);
        if (fieldMatch && valueMatch) {
            fields[fieldMatch[1].trim()] = {
                rawValue: valueMatch[1],
                type: typeMatch ? typeMatch[1] : 'xsd:string'
            };
        }
    }
    return fields;
}

/**
 * @param {string | undefined} raw XML-escaped JSON string
 * @param {string} fieldName used in error messages
 * @returns {unknown[]}
 */
function parseJsonArray(raw, fieldName) {
    try {
        const parsed = JSON.parse(unescapeXml(raw || '[]'));
        if (!Array.isArray(parsed)) {
            throw new Error('expected a JSON array');
        }
        return parsed;
    } catch (e) {
        throw new Error(
            `Failed to parse ${fieldName}: ${
                e instanceof Error ? e.message : String(e)
            }`
        );
    }
}

// Fields extracted as structured output — excluded from _passthrough.
const STRUCTURED_FIELDS = new Set(
    [
        'DynamicComponentName__c',
        'Description__c',
        'ObjectApiName__c',
        'Value__c',
        'Queries__c',
        'Resources__c'
    ].map(addNamespace)
);

function parseArgs(argv) {
    /** @type {string | undefined} */
    let xmlPath;
    /** @type {string | undefined} */
    let outPath;

    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--out') {
            const next = argv[i + 1];
            if (!next || next.startsWith('-')) {
                throw new Error('--out requires a file path');
            }
            outPath = next;
            i += 1;
        } else if (!a.startsWith('-')) {
            if (xmlPath) {
                throw new Error(`Unexpected argument: ${a}`);
            }
            xmlPath = a;
        } else {
            throw new Error(`Unknown option: ${a}`);
        }
    }

    if (!xmlPath) {
        throw new Error(
            'Usage: node read-component.mjs <path-to.md-meta.xml> [--out <output.json>]'
        );
    }

    return {
        xmlPath: resolve(xmlPath),
        outPath: outPath ? resolve(outPath) : undefined
    };
}

function main() {
    const { xmlPath, outPath } = parseArgs(process.argv.slice(2));

    const xml = readFileSync(xmlPath, 'utf8');
    const fields = parseFieldValues(xml);

    const apiName = unescapeXml(
        fields[addNamespace('DynamicComponentName__c')]?.rawValue ?? ''
    ).trim();
    if (!apiName) {
        throw new Error(
            `Could not find ${addNamespace(
                'DynamicComponentName__c'
            )} in the metadata file.`
        );
    }

    const description = fields[addNamespace('Description__c')]
        ? unescapeXml(fields[addNamespace('Description__c')].rawValue).trim()
        : '';

    const objectApiName = fields[addNamespace('ObjectApiName__c')]
        ? unescapeXml(fields[addNamespace('ObjectApiName__c')].rawValue).trim()
        : '';

    const value = parseJsonArray(
        fields[addNamespace('Value__c')]?.rawValue,
        addNamespace('Value__c')
    );
    const queries = parseJsonArray(
        fields[addNamespace('Queries__c')]?.rawValue,
        addNamespace('Queries__c')
    );
    const resources = parseJsonArray(
        fields[addNamespace('Resources__c')]?.rawValue,
        addNamespace('Resources__c')
    );

    const result = { apiName, value, queries, resources };
    if (description) result.description = description;
    if (objectApiName) result.objectApiName = objectApiName;

    // Collect all remaining fields as opaque passthrough so they survive a
    // round-trip through create-component.mjs without any field-by-field handling.
    const passthrough = {};
    for (const [fieldName, { rawValue, type }] of Object.entries(fields)) {
        if (!STRUCTURED_FIELDS.has(fieldName)) {
            passthrough[fieldName] = { type, value: unescapeXml(rawValue) };
        }
    }
    if (Object.keys(passthrough).length > 0) {
        result._passthrough = passthrough;
    }

    const output = JSON.stringify(result, null, 4);

    if (outPath) {
        writeFileSync(outPath, output, 'utf8');
        process.stderr.write(`Wrote ${outPath}\n`);
    } else {
        process.stdout.write(output + '\n');
    }
}

try {
    main();
} catch (e) {
    process.stderr.write(
        `Error: ${e instanceof Error ? e.message : String(e)}\n`
    );
    process.exit(1);
}
