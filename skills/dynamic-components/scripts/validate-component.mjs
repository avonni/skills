#!/usr/bin/env node
/**
 * Validates an Avonni Dynamic Component JSON structure and auto-generates
 * all id fields (UUID v4). Reads JSON from stdin, writes the augmented JSON
 * to stdout on success, exits with code 1 and error messages to stderr on failure.
 *
 * Usage (pipe into create-component.mjs):
 *   node validate-component.mjs <<'EOF' | node create-component.mjs - --version 1
 *   { ...component JSON... }
 *   EOF
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

// Component apiNames that intentionally use hyphens and are validated by their
// own component-specific validators rather than the general isValidApiName rule.
// Add a new prefix here whenever a new hyphenated-prefix pattern is introduced.
const HYPHENATED_API_NAME_PREFIXES = [
    'avdynamic-dc-accordion',
    'avdynamic-dc-navigation-container',
    'avdynamic-dc-tabbed-container'
];

const ALLOWED_FILTER_VAR_TYPES = new Set([
    'String',
    'Number',
    'Boolean',
    'Date',
    'DateTime',
    'Double',
    'Int',
    'Time',
    'Id'
]);

const ALLOWED_RESOURCE_TYPES = new Set(['constant', 'formula', 'variable']);

const ALLOWED_DATA_TYPES_COMMON = new Set([
    'boolean',
    'date',
    'datetime',
    'number',
    'text'
]);
const ALLOWED_DATA_TYPES_VARIABLE = new Set([
    'boolean',
    'date',
    'datetime',
    'number',
    'text',
    'record'
]);

const ALLOWED_VISIBILITY_OPERATORS = new Set([
    'eq',
    'ne',
    'sw',
    'ew',
    'ctn',
    'lt',
    'lte',
    'gt',
    'gte',
    'null',
    'notNull',
    'empty',
    'notEmpty',
    'lengthEq',
    'lengthNe',
    'lengthLt',
    'lengthLte',
    'lengthGt',
    'lengthGte'
]);

const NO_VALUE_OPERATORS = new Set(['null', 'notNull', 'empty', 'notEmpty']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @param {string} name */
function isValidApiName(name) {
    if (typeof name !== 'string' || name.length === 0) return false;
    if (!API_NAME_RE.test(name)) return false;
    if (name.endsWith('_')) return false;
    if (name.includes('__')) return false;
    return true;
}

// ---------------------------------------------------------------------------
// Auto-assign id fields (targeted: components, queries, resources only)
// ---------------------------------------------------------------------------

const UUID_V4_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @param {unknown} value */
function isValidUuidV4(value) {
    return typeof value === 'string' && UUID_V4_RE.test(value);
}

/** @param {Record<string, unknown>} obj */
function ensureId(obj) {
    if (!isValidUuidV4(obj.id)) {
        obj.id = crypto.randomUUID();
    }
}

/**
 * Ensures each component wrapper has a valid UUID v4 id, recursing into slots.
 * Only touches the wrapper object itself — not properties inside value.
 * @param {unknown[]} components
 */
function assignIdsToComponents(components) {
    if (!Array.isArray(components)) return;
    for (const comp of components) {
        if (!comp || typeof comp !== 'object' || Array.isArray(comp)) continue;
        const c = /** @type {Record<string, unknown>} */ (comp);
        ensureId(c);
        if (Array.isArray(c.slots)) {
            for (const slot of c.slots) {
                if (
                    slot &&
                    typeof slot === 'object' &&
                    Array.isArray(slot.components)
                ) {
                    assignIdsToComponents(slot.components);
                }
            }
        }
    }
}

/**
 * Ensures each item in a flat array (queries, resources) has a valid UUID v4 id.
 * @param {unknown[]} items
 */
function assignIdsToArray(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            ensureId(/** @type {Record<string, unknown>} */ (item));
        }
    }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** @type {string[]} */
const errors = [];

/** @param {string} msg */
function error(msg) {
    errors.push(msg);
}

/**
 * Validates and mutates `data` in place (auto-assigns missing id fields).
 * @param {Record<string, unknown>} data
 * @returns {string[]} validation errors (empty array = valid)
 */
export function validateComponent(data) {
    errors.length = 0;

    if (!('apiName' in data)) {
        error('Missing required top-level field "apiName"');
    } else {
        const apiName = /** @type {string} */ (data.apiName);
        if (!isValidApiName(apiName)) {
            error(`Top-level apiName "${apiName}": invalid format`);
        } else if (apiName.length > 30) {
            error(
                `Top-level apiName "${apiName}": exceeds 30 characters (${apiName.length})`
            );
        }
    }
    if (typeof data.description === 'string' && data.description.length > 255) {
        error(
            `Top-level description exceeds 255 characters (${data.description.length})`
        );
    }
    for (const field of ['value', 'queries', 'resources']) {
        if (!(field in data)) error(`Missing required top-level field "${field}"`);
    }

    if (Array.isArray(data.value)) assignIdsToComponents(data.value);
    if (Array.isArray(data.queries)) assignIdsToArray(data.queries);
    if (Array.isArray(data.resources)) assignIdsToArray(data.resources);

    if (Array.isArray(data.value)) {
        validateComponents(data.value, 'value');
        collectComponentApiNames(data.value);
    }

    const queryMap = Array.isArray(data.queries)
        ? validateQueries(data.queries, 'queries')
        : new Map();

    if (Array.isArray(data.value)) {
        validateQueryBindings(data.value, queryMap, 'value');
    }

    if (Array.isArray(data.resources)) {
        validateResources(data.resources, 'resources');
    }

    return [...errors];
}

// --- apiName uniqueness across the component value tree ---

/**
 * @param {unknown[]} components
 * @param {Set<string>} seen
 */
function collectComponentApiNames(components, seen = new Set()) {
    for (const comp of components) {
        if (!comp || typeof comp !== 'object' || Array.isArray(comp)) continue;
        const c = /** @type {Record<string, unknown>} */ (comp);
        if (typeof c.apiName === 'string') {
            if (seen.has(c.apiName)) {
                error(`Duplicate component apiName: "${c.apiName}"`);
            } else {
                seen.add(c.apiName);
            }
        }
        if (Array.isArray(c.slots)) {
            for (const slot of c.slots) {
                if (
                    slot &&
                    typeof slot === 'object' &&
                    Array.isArray(slot.components)
                ) {
                    collectComponentApiNames(slot.components, seen);
                }
            }
        }
    }
    return seen;
}

// --- Component wrappers ---

/**
 * @param {unknown[]} components
 * @param {string} path
 */
function validateComponents(components, path, parentComponentName = null) {
    if (!Array.isArray(components)) {
        error(`${path}: expected an array`);
        return;
    }
    for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        const cpath = `${path}[${i}]`;
        if (!comp || typeof comp !== 'object' || Array.isArray(comp)) {
            error(`${cpath}: component must be an object`);
            continue;
        }
        const c = /** @type {Record<string, unknown>} */ (comp);

        if (!('name' in c)) error(`${cpath}: missing required field "name"`);

        if (!('apiName' in c)) {
            error(`${cpath}: missing required field "apiName"`);
        } else {
            const apiNameVal = /** @type {string} */ (c.apiName);
            const hasKnownHyphenatedPrefix = HYPHENATED_API_NAME_PREFIXES.some(
                (p) => apiNameVal.startsWith(p)
            );
            if (!hasKnownHyphenatedPrefix && !isValidApiName(apiNameVal)) {
                error(
                    `${cpath}.apiName "${apiNameVal}": invalid format (must start with a letter, ` +
                        `use only letters/digits/underscores, no trailing or double underscore)`
                );
            }
        }

        if (!('value' in c)) {
            error(`${cpath}: missing required field "value"`);
        } else if (
            c.value &&
            typeof c.value === 'object' &&
            !Array.isArray(c.value)
        ) {
            const v = /** @type {Record<string, unknown>} */ (c.value);
            if ('inlineStyle' in v && typeof v.inlineStyle !== 'string') {
                error(
                    `${cpath}.value.inlineStyle: must be a string, not ${typeof v.inlineStyle}`
                );
            }
            if ('visibilityRule' in v) {
                validateVisibilityRule(
                    v.visibilityRule,
                    `${cpath}.value.visibilityRule`
                );
            }
        }

        if ('slots' in c) {
            if (!Array.isArray(c.slots)) {
                error(`${cpath}.slots: must be an array`);
            } else if (c.slots.length === 0) {
                error(
                    `${cpath}.slots: empty slots array is forbidden — omit "slots" entirely when there are no slot contents`
                );
            } else {
                for (let j = 0; j < c.slots.length; j++) {
                    const slot = c.slots[j];
                    const spath = `${cpath}.slots[${j}]`;
                    if (
                        !slot ||
                        typeof slot !== 'object' ||
                        Array.isArray(slot)
                    ) {
                        error(`${spath}: slot must be an object`);
                        continue;
                    }
                    const s = /** @type {Record<string, unknown>} */ (slot);
                    if (!('name' in s))
                        error(`${spath}: missing required field "name"`);
                    if (!Array.isArray(s.components)) {
                        error(`${spath}.components: must be an array`);
                    } else {
                        validateComponents(
                            s.components,
                            `${spath}.components`,
                            /** @type {string} */ (c.name)
                        );
                    }
                }
            }
        }

        // Component-specific rules
        const componentValidator =
            COMPONENT_VALIDATORS[/** @type {string} */ (c.name)];
        if (componentValidator)
            componentValidator(c, cpath, parentComponentName);
    }
}

// ---------------------------------------------------------------------------
// Component-specific validators
// ---------------------------------------------------------------------------

/**
 * Returns the slot object matching slotName from a component's slots array, or null.
 * @param {Record<string, unknown>} comp
 * @param {string} slotName
 * @returns {{ name: string, components: unknown[] } | null}
 */
function getSlot(comp, slotName) {
    if (!Array.isArray(comp.slots)) return null;
    for (const slot of comp.slots) {
        if (
            slot &&
            typeof slot === 'object' &&
            !Array.isArray(slot) &&
            slot.name === slotName
        ) {
            return /** @type {{ name: string, components: unknown[] }} */ (
                slot
            );
        }
    }
    return null;
}

// dcAccordion

/**
 * @param {Record<string, unknown>} comp
 * @param {string} cpath
 * @param {string | null} _parentComponentName
 */
function validateDcAccordion(comp, cpath, _parentComponentName) {
    const contentSlot = getSlot(comp, 'content');
    if (!contentSlot || !Array.isArray(contentSlot.components)) return;
    for (let i = 0; i < contentSlot.components.length; i++) {
        const child = contentSlot.components[i];
        if (!child || typeof child !== 'object' || Array.isArray(child))
            continue;
        const childName = /** @type {Record<string, unknown>} */ (child).name;
        if (childName !== 'dcAccordionSection') {
            error(
                `${cpath} (dcAccordion): content slot only accepts dcAccordionSection components, ` +
                    `found "${childName}" at index ${i}`
            );
        }
    }
}

// dcAccordionSection

const DC_ACCORDION_SECTION_PREFIX = 'avdynamic-dc-accordion';

/**
 * @param {Record<string, unknown>} comp
 * @param {string} cpath
 * @param {string | null} parentComponentName
 */
function validateDcAccordionSection(comp, cpath, parentComponentName) {
    if (parentComponentName !== 'dcAccordion') {
        error(
            `${cpath} (dcAccordionSection): must be placed inside a dcAccordion slot, ` +
                `found inside "${
                    parentComponentName ?? 'the top-level value array'
                }"`
        );
    }

    const apiName = /** @type {string | undefined} */ (comp.apiName);
    if (typeof apiName !== 'string') return;
    if (!apiName.startsWith(DC_ACCORDION_SECTION_PREFIX)) {
        error(
            `${cpath}.apiName "${apiName}": dcAccordionSection apiName must start with ` +
                `"${DC_ACCORDION_SECTION_PREFIX}" (pattern: ${DC_ACCORDION_SECTION_PREFIX}{sanitized_item_value})`
        );
        return;
    }
    const suffix = apiName.slice(DC_ACCORDION_SECTION_PREFIX.length);
    if (suffix.length === 0) {
        error(
            `${cpath}.apiName "${apiName}": dcAccordionSection apiName must include the ` +
                `sanitized item value after "${DC_ACCORDION_SECTION_PREFIX}"`
        );
    }
}

// dcLayout

const AVONNI_LAYOUT_ITEM_NAME = 'avonniLayoutItem';
const AVONNI_LAYOUT_ITEM_API_NAME_RE = /^avonniLayoutItem(\d+)$/;

/**
 * @param {Record<string, unknown>} comp
 * @param {string} cpath
 * @param {string | null} _parentComponentName
 */
function validateDcLayout(comp, cpath, _parentComponentName) {
    const contentSlot = getSlot(comp, 'content');
    if (!contentSlot || !Array.isArray(contentSlot.components)) return;

    const numbers = [];
    for (let i = 0; i < contentSlot.components.length; i++) {
        const child = contentSlot.components[i];
        if (!child || typeof child !== 'object' || Array.isArray(child))
            continue;
        const c = /** @type {Record<string, unknown>} */ (child);

        if (c.name !== AVONNI_LAYOUT_ITEM_NAME) {
            error(
                `${cpath} (dcLayout): content slot only accepts ${AVONNI_LAYOUT_ITEM_NAME} components, ` +
                    `found "${c.name}" at index ${i} (note: the name must not be prefixed with "dc")`
            );
            continue;
        }

        if (typeof c.apiName === 'string') {
            const match = AVONNI_LAYOUT_ITEM_API_NAME_RE.exec(c.apiName);
            if (!match) {
                error(
                    `${cpath}.content[${i}].apiName "${c.apiName}": must follow pattern ` +
                        `${AVONNI_LAYOUT_ITEM_NAME}{columnNumber} (e.g., ${AVONNI_LAYOUT_ITEM_NAME}1)`
                );
            } else {
                numbers.push(parseInt(match[1], 10));
            }
        }
    }

    // Sequential numbering starting at 1, global across the dcLayout instance
    for (let i = 0; i < numbers.length; i++) {
        if (numbers[i] !== i + 1) {
            error(
                `${cpath} (dcLayout): ${AVONNI_LAYOUT_ITEM_NAME} apiName numbering must be sequential ` +
                    `starting at 1 — expected ${AVONNI_LAYOUT_ITEM_NAME}${
                        i + 1
                    } at position ${i}, ` +
                    `found ${AVONNI_LAYOUT_ITEM_NAME}${numbers[i]}`
            );
        }
    }
}

// avonniLayoutItem

/**
 * @param {Record<string, unknown>} comp
 * @param {string} cpath
 * @param {string | null} parentComponentName
 */
function validateAvonniLayoutItem(comp, cpath, parentComponentName) {
    if (parentComponentName !== 'dcLayout') {
        error(
            `${cpath} (${AVONNI_LAYOUT_ITEM_NAME}): must be placed inside a dcLayout slot, ` +
                `found inside "${
                    parentComponentName ?? 'the top-level value array'
                }"`
        );
    }
}

// Shared helper: components whose content slot must hold exactly one dcContainer
// per item in value.items, with apiNames derived by sanitizing `${template}${item.value}`.

/**
 * @param {Record<string, unknown>} comp
 * @param {string} cpath
 * @param {string} componentLabel  used in error messages
 * @param {string} template  e.g. 'avdynamic-dc-navigation-container'
 */
function validateItemsToContainerSlot(comp, cpath, componentLabel, template) {
    const contentSlot = getSlot(comp, 'content');
    const slotComponents = Array.isArray(contentSlot?.components)
        ? contentSlot.components
        : [];

    // Collect valid dcContainers, flagging anything else in the slot
    /** @type {Array<{ apiName: string, index: number }>} */
    const containers = [];
    for (let i = 0; i < slotComponents.length; i++) {
        const child = slotComponents[i];
        if (!child || typeof child !== 'object' || Array.isArray(child))
            continue;
        const c = /** @type {Record<string, unknown>} */ (child);
        if (c.name !== 'dcContainer') {
            error(
                `${cpath} (${componentLabel}): content slot only accepts dcContainer components, ` +
                    `found "${c.name}" at index ${i}`
            );
        } else if (typeof c.apiName === 'string') {
            containers.push({ apiName: c.apiName, index: i });
        }
    }

    // Build expected apiNames from items and cross-check both directions
    const value = comp.value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const items = /** @type {Record<string, unknown>} */ (value).items;
    if (!Array.isArray(items)) return;

    /** @type {Map<string, number>} expected apiName → item index */
    const expectedByApiName = new Map();
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const itemValue = /** @type {Record<string, unknown>} */ (item).value;
        if (typeof itemValue !== 'string') {
            error(`${cpath}.value.items[${i}]: missing required field "value"`);
            continue;
        }
        expectedByApiName.set(`${template}${itemValue}`, i);
    }

    // Every item must have a matching container
    for (const [expected, itemIndex] of expectedByApiName) {
        if (!containers.some((c) => c.apiName === expected)) {
            error(
                `${cpath} (${componentLabel}): missing dcContainer with apiName "${expected}" ` +
                    `for items[${itemIndex}].value "${
                        /** @type {Record<string,unknown>} */ (items[itemIndex])
                            .value
                    }"`
            );
        }
    }

    // Every container must match an item
    for (const { apiName, index } of containers) {
        if (!expectedByApiName.has(apiName)) {
            error(
                `${cpath} (${componentLabel}): dcContainer at content[${index}] has apiName "${apiName}" ` +
                    `which does not match any item value`
            );
        }
    }
}

// dcNavigationContainer

/**
 * @param {Record<string, unknown>} comp
 * @param {string} cpath
 * @param {string | null} _parentComponentName
 */
function validateDcNavigationContainer(comp, cpath, _parentComponentName) {
    validateItemsToContainerSlot(
        comp,
        cpath,
        'dcNavigationContainer',
        'avdynamic-dc-navigation-container'
    );
}

// dcTabbedContainer

/**
 * @param {Record<string, unknown>} comp
 * @param {string} cpath
 * @param {string | null} _parentComponentName
 */
function validateDcTabbedContainer(comp, cpath, _parentComponentName) {
    validateItemsToContainerSlot(
        comp,
        cpath,
        'dcTabbedContainer',
        'avdynamic-dc-tabbed-container'
    );
}

// dcRepeatable

const CURRENT_RECORD_RE = /\{!([A-Za-z0-9_]+)\.CurrentRecord\.[A-Za-z0-9_]+\}/g;

/**
 * Recursively scans all string values inside a component value object for
 * CurrentRecord references that use the wrong repeatable apiName.
 * @param {unknown} obj
 * @param {string} repeatableApiName
 * @param {string} context  label used in error messages
 */
function scanForCurrentRecordRefs(obj, repeatableApiName, context) {
    if (typeof obj === 'string') {
        for (const m of obj.matchAll(
            new RegExp(CURRENT_RECORD_RE.source, 'g')
        )) {
            if (m[1] !== repeatableApiName) {
                error(
                    `${context}: CurrentRecord reference "${m[0]}" uses "${m[1]}" ` +
                        `but must use the dcRepeatable's apiName "${repeatableApiName}"`
                );
            }
        }
        return;
    }
    if (Array.isArray(obj)) {
        for (const item of obj)
            scanForCurrentRecordRefs(item, repeatableApiName, context);
        return;
    }
    if (obj && typeof obj === 'object') {
        for (const val of Object.values(obj)) {
            scanForCurrentRecordRefs(val, repeatableApiName, context);
        }
    }
}

/**
 * Walks all components (recursing into slots) and scans their value objects.
 * @param {unknown[]} components
 * @param {string} repeatableApiName
 * @param {string} context
 */
function scanComponentsForCurrentRecordRefs(
    components,
    repeatableApiName,
    context
) {
    for (const comp of components) {
        if (!comp || typeof comp !== 'object' || Array.isArray(comp)) continue;
        const c = /** @type {Record<string, unknown>} */ (comp);
        if (c.value && typeof c.value === 'object') {
            scanForCurrentRecordRefs(c.value, repeatableApiName, context);
        }
        if (Array.isArray(c.slots)) {
            for (const slot of c.slots) {
                if (
                    slot &&
                    typeof slot === 'object' &&
                    Array.isArray(slot.components)
                ) {
                    scanComponentsForCurrentRecordRefs(
                        slot.components,
                        repeatableApiName,
                        context
                    );
                }
            }
        }
    }
}

/**
 * @param {Record<string, unknown>} comp
 * @param {string} cpath
 * @param {string | null} _parentComponentName
 */
function validateDcRepeatable(comp, cpath, _parentComponentName) {
    const repeatableApiName =
        typeof comp.apiName === 'string' ? comp.apiName : null;
    if (!repeatableApiName) return;
    const contentSlot = getSlot(comp, 'content');
    if (!contentSlot || !Array.isArray(contentSlot.components)) return;
    scanComponentsForCurrentRecordRefs(
        contentSlot.components,
        repeatableApiName,
        `${cpath} (dcRepeatable "${repeatableApiName}")`
    );
}

/** @type {Record<string, (comp: Record<string, unknown>, cpath: string, parentComponentName: string | null) => void>} */
const COMPONENT_VALIDATORS = {
    dcAccordion: validateDcAccordion,
    dcAccordionSection: validateDcAccordionSection,
    dcLayout: validateDcLayout,
    avonniLayoutItem: validateAvonniLayoutItem,
    dcNavigationContainer: validateDcNavigationContainer,
    dcTabbedContainer: validateDcTabbedContainer,
    dcRepeatable: validateDcRepeatable
};

// --- Visibility rules ---

/**
 * @param {unknown} cond
 * @param {string} path
 */
function validateVisibilityCondition(cond, path) {
    if (!cond || typeof cond !== 'object' || Array.isArray(cond)) {
        error(`${path}: must be an object`);
        return;
    }
    const c = /** @type {Record<string, unknown>} */ (cond);
    if ('field' in c) {
        if (typeof c.field !== 'string' || !/^\{!.+\}$/.test(c.field)) {
            error(`${path}.field "${c.field}": must use {!...} syntax`);
        }
    }
    if ('operator' in c) {
        const op = /** @type {string} */ (c.operator);
        if (!ALLOWED_VISIBILITY_OPERATORS.has(op)) {
            error(
                `${path}.operator "${op}": not in the allowed operator list. ` +
                    `Allowed: ${[...ALLOWED_VISIBILITY_OPERATORS].join(', ')}`
            );
        } else if (NO_VALUE_OPERATORS.has(op)) {
            if ('value' in c) {
                error(
                    `${path}: "value" must be omitted when operator is "${op}"`
                );
            }
        } else if (!('value' in c)) {
            error(`${path}: "value" is required for operator "${op}"`);
        }
    }
}

/**
 * @param {unknown} rule
 * @param {string} path
 */
function validateVisibilityRule(rule, path) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
        error(`${path}: must be an object`);
        return;
    }
    const r = /** @type {Record<string, unknown>} */ (rule);
    if ('left' in r) {
        validateVisibilityCondition(r.left, `${path}.left`);
    } else {
        error(`${path}: missing required field "left"`);
    }
    if ('logicalOperator' in r) {
        if (r.logicalOperator !== 'and' && r.logicalOperator !== 'or') {
            error(
                `${path}.logicalOperator "${r.logicalOperator}": must be "and" or "or"`
            );
        }
        if ('right' in r) {
            validateVisibilityCondition(r.right, `${path}.right`);
        } else {
            error(
                `${path}: "right" is required when "logicalOperator" is present`
            );
        }
    }
}

// --- Queries ---

/**
 * @param {unknown[]} queries
 * @param {string} path
 * @returns {Map<string, Record<string, unknown>>}
 */
function validateQueries(queries, path) {
    /** @type {Map<string, Record<string, unknown>>} */
    const queryMap = new Map();
    if (!Array.isArray(queries)) {
        error(`${path}: must be an array`);
        return queryMap;
    }
    for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        const qpath = `${path}[${i}]`;
        if (!q || typeof q !== 'object' || Array.isArray(q)) {
            error(`${qpath}: query must be an object`);
            continue;
        }
        const query = /** @type {Record<string, unknown>} */ (q);

        if (!('apiName' in query)) {
            error(`${qpath}: missing required field "apiName"`);
        } else {
            const apiName = /** @type {string} */ (query.apiName);
            if (!isValidApiName(apiName)) {
                error(`${qpath}.apiName "${apiName}": invalid format`);
            } else if (queryMap.has(apiName)) {
                error(`${qpath}.apiName "${apiName}": duplicate query apiName`);
            } else {
                queryMap.set(apiName, query);
            }
        }

        const hasObjectApiName = 'objectApiName' in query;
        const hasNestedQueries = 'nestedQueries' in query;
        if (hasObjectApiName && hasNestedQueries) {
            error(
                `${qpath}: cannot have both "objectApiName" and "nestedQueries"`
            );
        } else if (!hasObjectApiName && !hasNestedQueries) {
            error(
                `${qpath}: must have either "objectApiName" or "nestedQueries"`
            );
        }

        if ('filter' in query) {
            validateFilterVariables(query, qpath);
        }
    }
    return queryMap;
}

/**
 * @param {Record<string, unknown>} q
 * @param {string} qpath
 */
function validateFilterVariables(q, qpath) {
    if (typeof q.filter !== 'string') {
        error(`${qpath}.filter: must be a string`);
        return;
    }
    const placeholders = new Set(
        [...q.filter.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1])
    );
    const fv = q.filterVariables;
    const fvt = q.filterVariablesTypes;

    if (placeholders.size === 0) {
        if (fv && typeof fv === 'object' && Object.keys(fv).length > 0) {
            error(
                `${qpath}: "filterVariables" has keys but filter contains no :placeholders`
            );
        }
        if (fvt && typeof fvt === 'object' && Object.keys(fvt).length > 0) {
            error(
                `${qpath}: "filterVariablesTypes" has keys but filter contains no :placeholders`
            );
        }
        return;
    }

    if (!fv || typeof fv !== 'object' || Array.isArray(fv)) {
        error(
            `${qpath}: filter contains placeholders but "filterVariables" is missing or invalid`
        );
    }
    if (!fvt || typeof fvt === 'object' || Array.isArray(fvt)) {
        // fvt check intentionally inverted — we want it to be an object
    }
    if (!fvt || typeof fvt !== 'object' || Array.isArray(fvt)) {
        error(
            `${qpath}: filter contains placeholders but "filterVariablesTypes" is missing or invalid`
        );
    }

    if (fv && typeof fv === 'object' && !Array.isArray(fv)) {
        const fvObj = /** @type {Record<string, unknown>} */ (fv);
        for (const p of placeholders) {
            if (!(p in fvObj)) {
                error(
                    `${qpath}.filterVariables: missing key "${p}" referenced in filter`
                );
            }
        }
        for (const k of Object.keys(fvObj)) {
            if (!placeholders.has(k)) {
                error(
                    `${qpath}.filterVariables: key "${k}" is not referenced as a :placeholder in filter`
                );
            }
        }
    }

    if (fvt && typeof fvt === 'object' && !Array.isArray(fvt)) {
        const fvtObj = /** @type {Record<string, unknown>} */ (fvt);
        for (const p of placeholders) {
            if (!(p in fvtObj)) {
                error(
                    `${qpath}.filterVariablesTypes: missing key "${p}" referenced in filter`
                );
            }
        }
        for (const [k, v] of Object.entries(fvtObj)) {
            if (!placeholders.has(k)) {
                error(
                    `${qpath}.filterVariablesTypes: key "${k}" is not referenced as a :placeholder in filter`
                );
            } else if (
                !ALLOWED_FILTER_VAR_TYPES.has(/** @type {string} */ (v))
            ) {
                error(
                    `${qpath}.filterVariablesTypes.${k}: "${v}" is not a valid type. ` +
                        `Allowed: ${[...ALLOWED_FILTER_VAR_TYPES].join(', ')}`
                );
            }
        }
    }
}

// --- Query bindings in component values ---

/**
 * @param {unknown[]} components
 * @param {Map<string, Record<string, unknown>>} queryMap
 * @param {string} path
 */
function validateQueryBindings(components, queryMap, path) {
    if (!Array.isArray(components)) return;
    for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        if (!comp || typeof comp !== 'object' || Array.isArray(comp)) continue;
        const c = /** @type {Record<string, unknown>} */ (comp);
        const cpath = `${path}[${i}]`;

        if (c.value && typeof c.value === 'object' && !Array.isArray(c.value)) {
            const v = /** @type {Record<string, unknown>} */ (c.value);
            if (v.itemsTypeSelected === 'query') {
                if (typeof v.itemsSObject === 'string') {
                    const refMatch = /^\{!\$Query\.([A-Za-z0-9_]+)\}$/.exec(
                        v.itemsSObject
                    );
                    if (!refMatch) {
                        error(
                            `${cpath}.value.itemsSObject "${v.itemsSObject}": ` +
                                `must match pattern {!$Query.<apiName>}`
                        );
                    } else {
                        const refApiName = refMatch[1];
                        if (!queryMap.has(refApiName)) {
                            error(
                                `${cpath}.value.itemsSObject: references query "${refApiName}" which does not exist`
                            );
                        } else if (typeof v.itemsSObjectApiName === 'string') {
                            const q = queryMap.get(refApiName);
                            if (
                                q &&
                                q.objectApiName &&
                                v.itemsSObjectApiName !== q.objectApiName
                            ) {
                                error(
                                    `${cpath}.value.itemsSObjectApiName "${v.itemsSObjectApiName}" ` +
                                        `does not match the referenced query's objectApiName "${q.objectApiName}"`
                                );
                            }
                        }
                    }
                }
                if (typeof v.nbItems === 'string') {
                    const nbMatch =
                        /^\{!\$Query\.([A-Za-z0-9_]+)\.nbItems\}$/.exec(
                            v.nbItems
                        );
                    if (!nbMatch) {
                        error(
                            `${cpath}.value.nbItems "${v.nbItems}": ` +
                                `must match pattern {!$Query.<apiName>.nbItems}`
                        );
                    } else if (!queryMap.has(nbMatch[1])) {
                        error(
                            `${cpath}.value.nbItems: references query "${nbMatch[1]}" which does not exist`
                        );
                    }
                }
            }
        }

        if (Array.isArray(c.slots)) {
            for (let j = 0; j < c.slots.length; j++) {
                const slot = c.slots[j];
                if (
                    slot &&
                    typeof slot === 'object' &&
                    Array.isArray(slot.components)
                ) {
                    validateQueryBindings(
                        slot.components,
                        queryMap,
                        `${cpath}.slots[${j}].components`
                    );
                }
            }
        }
    }
}

// --- Resources ---

/**
 * @param {unknown[]} resources
 * @param {string} path
 */
function validateResources(resources, path) {
    if (!Array.isArray(resources)) {
        error(`${path}: must be an array`);
        return;
    }
    const apiNames = new Set();
    for (let i = 0; i < resources.length; i++) {
        const res = resources[i];
        const rpath = `${path}[${i}]`;
        if (!res || typeof res !== 'object' || Array.isArray(res)) {
            error(`${rpath}: resource must be an object`);
            continue;
        }
        const r = /** @type {Record<string, unknown>} */ (res);

        if (!('apiName' in r)) {
            error(`${rpath}: missing required field "apiName"`);
        } else {
            const apiName = /** @type {string} */ (r.apiName);
            if (!isValidApiName(apiName)) {
                error(`${rpath}.apiName "${apiName}": invalid format`);
            } else if (apiNames.has(apiName)) {
                error(
                    `${rpath}.apiName "${apiName}": duplicate resource apiName`
                );
            } else {
                apiNames.add(apiName);
            }
        }

        if (!('description' in r))
            error(`${rpath}: missing required field "description"`);
        if (!('dataType' in r))
            error(`${rpath}: missing required field "dataType"`);

        if (!('type' in r)) {
            error(`${rpath}: missing required field "type"`);
        } else if (
            !ALLOWED_RESOURCE_TYPES.has(/** @type {string} */ (r.type))
        ) {
            error(
                `${rpath}.type "${r.type}": must be one of ` +
                    `${[...ALLOWED_RESOURCE_TYPES].join(', ')}`
            );
        } else {
            const type = /** @type {string} */ (r.type);
            const dataType = /** @type {string | undefined} */ (r.dataType);

            if (type === 'constant' || type === 'formula') {
                if (dataType && !ALLOWED_DATA_TYPES_COMMON.has(dataType)) {
                    error(
                        `${rpath}.dataType "${dataType}": for ${type}, must be one of ` +
                            `${[...ALLOWED_DATA_TYPES_COMMON].join(', ')}`
                    );
                }
                if (type === 'constant' && !('defaultValue' in r)) {
                    error(
                        `${rpath}: constant is missing required field "defaultValue"`
                    );
                }
                if (type === 'formula' && !('formula' in r)) {
                    error(
                        `${rpath}: formula is missing required field "formula"`
                    );
                }
            } else if (type === 'variable') {
                if (dataType && !ALLOWED_DATA_TYPES_VARIABLE.has(dataType)) {
                    error(
                        `${rpath}.dataType "${dataType}": for variable, must be one of ` +
                            `${[...ALLOWED_DATA_TYPES_VARIABLE].join(', ')}`
                    );
                }
                if ('availability' in r) {
                    if (!Array.isArray(r.availability)) {
                        error(`${rpath}.availability: must be an array`);
                    } else {
                        for (const av of r.availability) {
                            if (av !== 'input' && av !== 'output') {
                                error(
                                    `${rpath}.availability: "${av}" is not valid. Allowed: "input", "output"`
                                );
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    const raw = readFileSync(0, 'utf8');
    /** @type {unknown} */
    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        process.stderr.write(
            `Error: Invalid JSON: ${
                e instanceof Error ? e.message : String(e)
            }\n`
        );
        process.exit(1);
    }

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        process.stderr.write('Error: JSON root must be an object\n');
        process.exit(1);
    }

    const d = /** @type {Record<string, unknown>} */ (data);
    const validationErrors = validateComponent(d);

    if (validationErrors.length > 0) {
        process.stderr.write(
            `Validation failed with ${validationErrors.length} error(s):\n`
        );
        for (const e of validationErrors) {
            process.stderr.write(`  - ${e}\n`);
        }
        process.exit(1);
    }

    process.stdout.write(JSON.stringify(d, null, 4) + '\n');
    process.stderr.write('Validation passed.\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        main();
    } catch (e) {
        process.stderr.write(
            `Error: ${e instanceof Error ? e.message : String(e)}\n`
        );
        process.exit(1);
    }
}
