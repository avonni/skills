#!/usr/bin/env node
/**
 * Validates the structure of Avonni Flow Screen Component fields inside a
 * .flow-meta.xml file.
 *
 * Usage:
 *   node validate-flow.mjs <path-to-flow-meta.xml>
 *
 * Checks:
 *   - the XML is well formed (balanced tags, no stray characters),
 *   - the root element is <Flow> with the metadata namespace,
 *   - every avcmpbuilder field has <fieldType>ComponentInstance</fieldType>,
 *   - avcmpbuilder field children appear in the documented order, with
 *     <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>,
 *     <isRequired>true</isRequired> and
 *     <storeOutputAutomatically>true</storeOutputAutomatically> present,
 *   - field names are unique across the flow and are valid API names,
 *   - extensionName format is avcmpbuilder:<componentName>,
 *   - input parameter names are unique per field, never contain a doubled
 *     "Serialized" suffix, and each has exactly one value (stringValue,
 *     numberValue, booleanValue, dateValue, dateTimeValue, or
 *     elementReference),
 *   - no parameter value is empty,
 *   - elementReference values are bare resource names, without {!} braces,
 *   - JSON payloads parse: *Serialized, *SObjectMapping, systemContext and
 *     evt* parameters (evt* must be arrays),
 *   - systemContext values carry an apiName that is a valid UUID v4,
 *   - itemsTypeSelected is one of static, query, variables, picklistValues,
 *   - fields using a query data source have a systemContext parameter,
 *   - dataTypeMappings blocks contain a typeName and a typeValue, with no
 *     duplicate typeName within a field.
 *
 * This script never modifies the file. Auto-generated values (such as
 * systemContext) are produced by fix-flow.mjs, which the workflow runs right
 * before validation; an empty or unrepaired systemContext is reported as an
 * error pointing to that script.
 *
 * Exits 0 when valid (prints a summary), exits 1 with one error per line on
 * stderr otherwise. It validates structure only — component and property
 * names must be checked against the MCP docs before writing the file.
 */

import { readFileSync } from 'node:fs';

const FLOW_NS = 'http://soap.sforce.com/2006/04/metadata';
const VALUE_TAGS = new Set([
    'stringValue',
    'numberValue',
    'booleanValue',
    'dateValue',
    'dateTimeValue',
    'elementReference'
]);
const ITEMS_TYPES = new Set(['static', 'query', 'variables', 'picklistValues']);
const FIELD_CHILD_ORDER = [
    'name',
    'dataTypeMappings',
    'extensionName',
    'fieldType',
    'inputParameters',
    'inputsOnNextNavToAssocScrn',
    'isRequired',
    'storeOutputAutomatically'
];
const FIELD_FIXED_CHILDREN = [
    ['inputsOnNextNavToAssocScrn', 'UseStoredValues'],
    ['isRequired', 'true'],
    ['storeOutputAutomatically', 'true']
];
const API_NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
const UUID_V4_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
 * Minimal XML parser producing a node tree. Throws on malformed input.
 * Supports the subset of XML used by flow metadata files: elements, text,
 * comments, and the XML declaration. No CDATA, no processing instructions.
 *
 * @param {string} xml
 * @returns {{tag: string, attributes: string, children: object[], text: string}}
 */
function parseXml(xml) {
    let pos = 0;
    const len = xml.length;

    function error(message) {
        const line = xml.slice(0, pos).split('\n').length;
        throw new Error(`line ${line}: ${message}`);
    }

    function skipMisc() {
        for (;;) {
            const start = pos;
            while (pos < len && /\s/.test(xml[pos])) pos++;
            if (xml.startsWith('<?', pos)) {
                const end = xml.indexOf('?>', pos);
                if (end === -1) error('unterminated XML declaration');
                pos = end + 2;
            } else if (xml.startsWith('<!--', pos)) {
                const end = xml.indexOf('-->', pos);
                if (end === -1) error('unterminated comment');
                pos = end + 3;
            } else if (pos === start) {
                return;
            }
        }
    }

    function parseElement() {
        if (xml[pos] !== '<') error('expected element');
        const openMatch = /^<([A-Za-z_][\w.-]*)((?:\s+[^<>]*?)?)(\/?)>/.exec(
            xml.slice(pos)
        );
        if (!openMatch) error('malformed opening tag');
        const [whole, tag, attributes, selfClosing] = openMatch;
        pos += whole.length;
        const node = {
            tag,
            attributes: attributes.trim(),
            children: [],
            text: ''
        };
        if (selfClosing) return node;

        for (;;) {
            const nextLt = xml.indexOf('<', pos);
            if (nextLt === -1) error(`unclosed element <${tag}>`);
            node.text += xml.slice(pos, nextLt);
            pos = nextLt;
            if (xml.startsWith('<!--', pos)) {
                const end = xml.indexOf('-->', pos);
                if (end === -1) error('unterminated comment');
                pos = end + 3;
            } else if (xml.startsWith(`</`, pos)) {
                const closeMatch = /^<\/([A-Za-z_][\w.-]*)\s*>/.exec(
                    xml.slice(pos)
                );
                if (!closeMatch) error('malformed closing tag');
                if (closeMatch[1] !== tag)
                    error(
                        `mismatched closing tag: expected </${tag}>, found </${closeMatch[1]}>`
                    );
                pos += closeMatch[0].length;
                return node;
            } else {
                node.children.push(parseElement());
            }
        }
    }

    skipMisc();
    if (pos >= len) throw new Error('empty document');
    const root = parseElement();
    skipMisc();
    if (pos < len) error('content after root element');
    return root;
}

/** @param {object} node @param {string} tag */
function childrenOf(node, tag) {
    return node.children.filter((c) => c.tag === tag);
}

/** @param {object} node @param {string} tag */
function childText(node, tag) {
    const child = node.children.find((c) => c.tag === tag);
    return child ? unescapeXml(child.text.trim()) : null;
}

/**
 * Recursively collects every <fields> element, with the label of the screen
 * it belongs to.
 *
 * @param {object} node
 * @param {string} screenLabel
 * @param {{node: object, screenLabel: string}[]} acc
 */
function collectFields(node, screenLabel, acc) {
    for (const child of node.children) {
        if (child.tag === 'screens') {
            collectFields(child, childText(child, 'label') ?? '', acc);
        } else if (child.tag === 'fields') {
            acc.push({ node: child, screenLabel });
            collectFields(child, screenLabel, acc);
        } else {
            collectFields(child, screenLabel, acc);
        }
    }
}

/**
 * @param {object} field
 * @param {string} label
 * @param {string[]} errors
 */
function validateAvonniField(field, label, errors) {
    const extension = childText(field, 'extensionName');
    if (!/^avcmpbuilder:[a-z][A-Za-z0-9]*$/.test(extension)) {
        errors.push(
            `${label}: invalid extensionName "${extension}" (expected avcmpbuilder:<componentName>)`
        );
    }
    if (childText(field, 'fieldType') !== 'ComponentInstance') {
        errors.push(
            `${label}: avcmpbuilder fields must have <fieldType>ComponentInstance</fieldType>`
        );
    }

    let lastOrderIndex = -1;
    let lastOrderedTag = null;
    for (const child of field.children) {
        const orderIndex = FIELD_CHILD_ORDER.indexOf(child.tag);
        if (orderIndex === -1) continue;
        if (orderIndex < lastOrderIndex) {
            errors.push(
                `${label}: <${
                    child.tag
                }> must appear before <${lastOrderedTag}> (expected order: ${FIELD_CHILD_ORDER.join(
                    ', '
                )})`
            );
        } else {
            lastOrderIndex = orderIndex;
            lastOrderedTag = child.tag;
        }
    }

    for (const [tag, expected] of FIELD_FIXED_CHILDREN) {
        const actual = childText(field, tag);
        if (actual !== expected) {
            errors.push(
                `${label}: <${tag}> must be "${expected}" (found ${
                    actual === null ? 'none' : `"${actual}"`
                })`
            );
        }
    }

    const seenTypeNames = new Set();
    for (const mapping of childrenOf(field, 'dataTypeMappings')) {
        const typeName = childText(mapping, 'typeName');
        if (!typeName || !childText(mapping, 'typeValue')) {
            errors.push(
                `${label}: dataTypeMappings must contain a typeName and a typeValue`
            );
        }
        if (typeName && seenTypeNames.has(typeName)) {
            errors.push(
                `${label}: duplicate dataTypeMappings typeName "${typeName}"`
            );
        }
        if (typeName) seenTypeNames.add(typeName);
    }

    const seenParams = new Set();
    for (const param of childrenOf(field, 'inputParameters')) {
        const name = childText(param, 'name');
        if (!name) {
            errors.push(`${label}: inputParameters without a <name>`);
            continue;
        }
        const paramLabel = `${label}, parameter "${name}"`;
        if (seenParams.has(name)) {
            errors.push(`${paramLabel}: duplicate parameter`);
        }
        seenParams.add(name);
        if (name.includes('SerializedSerialized')) {
            errors.push(
                `${paramLabel}: doubled "Serialized" suffix — the documented property name already ends in Serialized`
            );
        }

        const values = childrenOf(param, 'value');
        if (values.length !== 1) {
            errors.push(`${paramLabel}: expected exactly one <value>`);
            continue;
        }
        const valueChildren = values[0].children;
        if (
            valueChildren.length !== 1 ||
            !VALUE_TAGS.has(valueChildren[0].tag)
        ) {
            errors.push(
                `${paramLabel}: <value> must contain exactly one of ${[
                    ...VALUE_TAGS
                ].join(', ')}`
            );
            continue;
        }
        const valueNode = valueChildren[0];
        const rawValue = unescapeXml(valueNode.text.trim());

        if (rawValue === '') {
            errors.push(
                name === 'systemContext'
                    ? `${paramLabel}: empty value — run fix-flow.mjs to generate it`
                    : `${paramLabel}: empty value — omit the parameter instead`
            );
            continue;
        }
        if (valueNode.tag === 'elementReference' && rawValue.includes('{!')) {
            errors.push(
                `${paramLabel}: elementReference must be a bare resource name, without {!} braces`
            );
        }

        if (valueNode.tag !== 'stringValue') continue;

        const isJsonParam =
            name.endsWith('Serialized') ||
            name.endsWith('SObjectMapping') ||
            name === 'systemContext';
        const isInteractionParam = /^evt[A-Z]/.test(name);
        if (!isJsonParam && !isInteractionParam) continue;

        let parsed;
        try {
            parsed = JSON.parse(rawValue);
        } catch (jsonError) {
            errors.push(`${paramLabel}: invalid JSON — ${jsonError.message}`);
            continue;
        }
        if (name === 'systemContext') {
            if (
                typeof parsed !== 'object' ||
                parsed === null ||
                Array.isArray(parsed) ||
                typeof parsed.apiName !== 'string' ||
                !UUID_V4_RE.test(parsed.apiName)
            ) {
                errors.push(
                    `${paramLabel}: apiName must be a UUID v4 — run fix-flow.mjs to generate it`
                );
            }
        }
        if (isInteractionParam) {
            if (!Array.isArray(parsed)) {
                errors.push(
                    `${paramLabel}: interaction parameters must be JSON arrays`
                );
            } else if (
                parsed.some((entry) => !entry || typeof entry.type !== 'string')
            ) {
                errors.push(
                    `${paramLabel}: every interaction must have a string "type"`
                );
            }
        }
    }

    for (const param of childrenOf(field, 'inputParameters')) {
        if (childText(param, 'name') !== 'itemsTypeSelected') continue;
        const values = childrenOf(param, 'value');
        const value =
            values.length === 1
                ? unescapeXml(values[0].children[0]?.text.trim() ?? '')
                : '';
        if (!ITEMS_TYPES.has(value)) {
            errors.push(
                `${label}: itemsTypeSelected must be one of ${[
                    ...ITEMS_TYPES
                ].join(', ')} (found "${value}")`
            );
        }
        if (value === 'query' && !seenParams.has('systemContext')) {
            errors.push(
                `${label}: a query data source requires a systemContext parameter (add it with an empty stringValue and run fix-flow.mjs)`
            );
        }
    }
}

function main() {
    const path = process.argv[2];
    if (!path || path === '--help' || path === '-h') {
        console.log('Usage: node validate-flow.mjs <path-to-flow-meta.xml>');
        process.exit(path ? 0 : 1);
    }

    let xml;
    try {
        xml = readFileSync(path, 'utf8');
    } catch (readError) {
        console.error(`Cannot read ${path}: ${readError.message}`);
        process.exit(1);
    }

    let root;
    try {
        root = parseXml(xml);
    } catch (parseError) {
        console.error(`Malformed XML — ${parseError.message}`);
        process.exit(1);
    }

    const errors = [];
    if (root.tag !== 'Flow') {
        errors.push(`root element is <${root.tag}>, expected <Flow>`);
    } else if (!root.attributes.includes(FLOW_NS)) {
        errors.push(`<Flow> is missing the xmlns="${FLOW_NS}" namespace`);
    }

    const allFields = [];
    collectFields(root, '', allFields);

    const seenNames = new Set();
    let avonniCount = 0;
    for (const { node: field, screenLabel } of allFields) {
        const name = childText(field, 'name');
        if (name) {
            if (seenNames.has(name)) {
                errors.push(`duplicate field name "${name}"`);
            }
            seenNames.add(name);
            if (
                !API_NAME_RE.test(name) ||
                name.endsWith('_') ||
                name.includes('__')
            ) {
                errors.push(`invalid field API name "${name}"`);
            }
        }

        const extension = childText(field, 'extensionName');
        if (!extension || !extension.startsWith('avcmpbuilder:')) continue;
        avonniCount++;
        const label = `field "${name ?? '?'}" (screen "${screenLabel}")`;
        validateAvonniField(field, label, errors);
    }

    if (errors.length > 0) {
        for (const e of errors) console.error(e);
        process.exit(1);
    }

    console.log(
        `OK — ${avonniCount} Avonni component field(s) validated in ${allFields.length} field(s) total.`
    );
}

main();
