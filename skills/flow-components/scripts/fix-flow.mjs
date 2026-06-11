#!/usr/bin/env node
/**
 * Applies automatic fix-ups to Avonni Flow Screen Component fields inside a
 * .flow-meta.xml file, in place. The workflow runs it right before
 * validate-flow.mjs, which checks the result and never modifies the file
 * itself. New auto-fillable elements belong here.
 *
 * Usage:
 *   node fix-flow.mjs <path-to-flow-meta.xml>
 *
 * Fix-ups:
 *   - every systemContext parameter with an empty <stringValue> (including a
 *     self-closing <stringValue/>) gets its whole value generated
 *     ({"apiName":"<uuid v4>","flowId":"{!$Flow.InterviewGuid}"}); non-empty
 *     values with a missing or invalid apiName get a fresh UUID. Generators
 *     must leave the value empty and let this script fill it.
 *
 * The pass is idempotent: valid values are left untouched, and unparseable
 * non-empty JSON is left as is for validate-flow.mjs to report. The file is
 * only rewritten when at least one fix-up was applied. Exits 0 on success
 * (prints what was fixed), 1 when the file cannot be read.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const FLOW_ID_MERGE_FIELD = '{!$Flow.InterviewGuid}';
const UUID_V4_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {string} s
 * @returns {string}
 */
function escapeXml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {string} s
 * @returns {string}
 */
function unescapeXml(s) {
    return s
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
            String.fromCodePoint(parseInt(h, 16))
        )
        .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&amp;/g, '&');
}

/**
 * Generates the value of every systemContext parameter left empty by the
 * generator, and repairs values whose "apiName" is not a valid UUID v4.
 * Valid values (and unparseable non-empty JSON — reported by validation) are
 * left untouched, so the pass is idempotent.
 *
 * @param {string} xml
 * @returns {{xml: string, generated: number}}
 */
function fillSystemContext(xml) {
    let generated = 0;
    const out = xml.replace(
        /(<name>systemContext<\/name>\s*<value>\s*)(?:<stringValue>([^<]*)<\/stringValue>|<stringValue\s*\/>)/g,
        (whole, open, raw = '') => {
            let context;
            if (unescapeXml(raw).trim() === '') {
                context = { flowId: FLOW_ID_MERGE_FIELD };
            } else {
                try {
                    context = JSON.parse(unescapeXml(raw));
                } catch {
                    return whole;
                }
                if (
                    typeof context !== 'object' ||
                    context === null ||
                    Array.isArray(context)
                ) {
                    return whole;
                }
                if (
                    typeof context.apiName === 'string' &&
                    UUID_V4_RE.test(context.apiName)
                ) {
                    return whole;
                }
                context.flowId ??= FLOW_ID_MERGE_FIELD;
            }
            delete context.apiName;
            const value = { apiName: randomUUID(), ...context };
            generated++;
            return `${open}<stringValue>${escapeXml(
                JSON.stringify(value)
            )}</stringValue>`;
        }
    );
    return { xml: out, generated };
}

function main() {
    const path = process.argv[2];
    if (!path || path === '--help' || path === '-h') {
        console.log('Usage: node fix-flow.mjs <path-to-flow-meta.xml>');
        process.exit(path ? 0 : 1);
    }

    let xml;
    try {
        xml = readFileSync(path, 'utf8');
    } catch (readError) {
        console.error(`Cannot read ${path}: ${readError.message}`);
        process.exit(1);
    }

    const filled = fillSystemContext(xml);
    if (filled.generated > 0) {
        writeFileSync(path, filled.xml, 'utf8');
        console.log(
            `Generated ${filled.generated} systemContext value(s) in ${path}.`
        );
    } else {
        console.log(`Nothing to fix in ${path}.`);
    }
}

main();
