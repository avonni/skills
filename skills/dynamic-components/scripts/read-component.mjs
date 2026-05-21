#!/usr/bin/env node
/**
 * Reads an Avonni Dynamic Component .md-meta.xml file and writes
 * the component JSON structure to stdout or a file.
 *
 * Usage:
 *   node read-component.mjs <path-to.md-meta.xml> [--out <output.json>]
 *
 * Writes { apiName, description, value, queries, resources } as JSON.
 * Outputs to stdout if --out is omitted.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
 * Extracts all <values> blocks from the XML and returns a map of field name → raw inner text.
 * @param {string} xml
 * @returns {Record<string, string>}
 */
function parseFieldValues(xml) {
    const fields = {};
    const blockRe = /<values>([\s\S]*?)<\/values>/g;
    let block;
    while ((block = blockRe.exec(xml)) !== null) {
        const inner = block[1];
        const fieldMatch = /<field>([^<]+)<\/field>/.exec(inner);
        const valueMatch = /<value[^>]*>([\s\S]*?)<\/value>/.exec(inner);
        if (fieldMatch && valueMatch) {
            fields[fieldMatch[1].trim()] = valueMatch[1];
        }
    }
    return fields;
}

/**
 * @param {string} raw XML-escaped JSON string, or undefined
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
        fields['avxp__DynamicComponentName__c'] ?? ''
    ).trim();
    if (!apiName) {
        throw new Error(
            'Could not find avxp__DynamicComponentName__c in the metadata file.'
        );
    }

    const description = fields['avxp__Description__c']
        ? unescapeXml(fields['avxp__Description__c']).trim()
        : '';

    const value = parseJsonArray(fields['avxp__Value__c'], 'avxp__Value__c');
    const queries = parseJsonArray(
        fields['avxp__Queries__c'],
        'avxp__Queries__c'
    );
    const resources = parseJsonArray(
        fields['avxp__Resources__c'],
        'avxp__Resources__c'
    );

    const output = JSON.stringify(
        { apiName, description, value, queries, resources },
        null,
        4
    );

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
