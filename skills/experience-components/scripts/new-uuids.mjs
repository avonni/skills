#!/usr/bin/env node
/**
 * Prints fresh UUIDs, one per line — one for each new component or region node
 * you add to a view's content.json. Never reuse an existing id.
 *
 * Usage:
 *   node new-uuids.mjs [count]   # count defaults to 1
 */

import { randomUUID } from 'node:crypto';

const count = Math.max(1, parseInt(process.argv[2] ?? '1', 10) || 1);
for (let i = 0; i < count; i++) console.log(randomUUID());
