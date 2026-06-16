#!/usr/bin/env node
/**
 * Validates the structure of a Digital Experience view's content.json — in
 * particular the Avonni (avxp:) component nodes and the region nodes that hold
 * them.
 *
 * Usage:
 *   node validate-view.mjs <path-to-content.json>
 *
 * Checks:
 *   - the file is valid JSON,
 *   - a component tree is present (contentBody.component, or a bare node),
 *   - every node is either a "component" or a "region",
 *   - every node has a unique `id` that is a valid UUID,
 *   - component nodes have a `definition` of the form "namespace:name", an
 *     object `attributes` (when present), and children that are all regions,
 *   - region nodes have a `name`, and children that are all components,
 *   - the component/region nesting alternates (component → regions → components),
 *   - every string attribute value that looks like JSON (starts with { or [)
 *     parses successfully — this catches malformed serialized attributes such
 *     as `items`, `evtClick`, `sectionConfig`, `*Attributes`.
 *
 * This script never modifies the file. It validates STRUCTURE only — component
 * names, property names, option values, and slot names must be checked against
 * the MCP docs (toolset "experience") before writing the file.
 *
 * Exits 0 when valid (prints a summary), exits 1 with one error per line on
 * stderr otherwise.
 */

import { readFileSync } from 'node:fs';

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFINITION_RE = /^[A-Za-z0-9_]+:[A-Za-z0-9_]+$/;

const path = process.argv[2];
if (!path) {
    console.error('Usage: node validate-view.mjs <path-to-content.json>');
    process.exit(1);
}

const errors = [];
const ids = new Map();

let root;
try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    root = data?.contentBody?.component ?? (data?.type ? data : null);
    if (!root) {
        errors.push(
            'No component tree found (expected contentBody.component or a node with a "type").'
        );
    }
} catch (e) {
    console.error(`Invalid JSON: ${e.message}`);
    process.exit(1);
}

function checkAttributes(node, where) {
    const attrs = node.attributes;
    if (attrs === undefined) return;
    if (typeof attrs !== 'object' || attrs === null || Array.isArray(attrs)) {
        errors.push(`${where}: "attributes" must be an object.`);
        return;
    }
    for (const [key, value] of Object.entries(attrs)) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        // Skip Experience binding expressions ({!recordId}) and record
        // templates ({{Record.Field}}) — they start with "{" but aren't JSON.
        if (trimmed.startsWith('{!') || trimmed.startsWith('{{')) continue;
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                JSON.parse(trimmed);
            } catch {
                errors.push(
                    `${where}: attribute "${key}" is not valid serialized JSON.`
                );
            }
        }
    }
}

function checkId(node, where) {
    if (typeof node.id !== 'string' || !node.id) {
        errors.push(`${where}: missing "id".`);
        return;
    }
    if (!UUID_RE.test(node.id)) {
        errors.push(`${where}: id "${node.id}" is not a valid UUID.`);
    }
    ids.set(node.id, (ids.get(node.id) ?? 0) + 1);
}

function walk(node, where) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
        errors.push(`${where}: node must be an object.`);
        return;
    }
    checkId(node, where);

    if (node.type === 'component') {
        const label = node.definition || where;
        if (typeof node.definition !== 'string' || !DEFINITION_RE.test(node.definition)) {
            errors.push(
                `${where}: component "definition" must look like "namespace:name" (got ${JSON.stringify(node.definition)}).`
            );
        }
        checkAttributes(node, label);
        if (node.children !== undefined) {
            if (!Array.isArray(node.children)) {
                errors.push(`${label}: "children" must be an array.`);
            } else {
                node.children.forEach((child, i) => {
                    if (child?.type !== 'region') {
                        errors.push(
                            `${label}: child ${i} must be a region (a component's children are its slot regions).`
                        );
                    }
                    walk(child, `${label} › child ${i}`);
                });
            }
        }
    } else if (node.type === 'region') {
        const label = node.name ? `region "${node.name}"` : where;
        if (typeof node.name !== 'string' || !node.name) {
            errors.push(`${where}: region is missing a "name".`);
        }
        if (node.children !== undefined) {
            if (!Array.isArray(node.children)) {
                errors.push(`${label}: "children" must be an array.`);
            } else {
                node.children.forEach((child, i) => {
                    if (child?.type !== 'component') {
                        errors.push(
                            `${label}: child ${i} must be a component (a region's children are components).`
                        );
                    }
                    walk(child, `${label} › child ${i}`);
                });
            }
        }
    } else {
        errors.push(
            `${where}: node "type" must be "component" or "region" (got ${JSON.stringify(node.type)}).`
        );
    }
}

if (root) walk(root, 'root');

for (const [id, count] of ids) {
    if (count > 1) errors.push(`Duplicate id "${id}" used ${count} times.`);
}

if (errors.length) {
    for (const e of errors) console.error(e);
    console.error(`\n${errors.length} error(s).`);
    process.exit(1);
}

console.log(`OK — ${ids.size} nodes, all ids unique and valid.`);
process.exit(0);
