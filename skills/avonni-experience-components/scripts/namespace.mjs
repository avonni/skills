#!/usr/bin/env node
/**
 * Detects the Avonni Experience package namespace ('avxp' or 'avcmpbuilder')
 * used for component definitions in a Digital Experience view.
 *
 * Usage:
 *   node namespace.mjs [path-to-content.json]
 *
 * Detection order:
 *   1. AVONNI_XP_PACKAGE_NAMESPACE env var (must be 'avxp' or 'avcmpbuilder'),
 *   2. the existing Avonni component nodes in the given content.json — if the
 *      view already uses exactly one of the two prefixes, that one wins,
 *   3. the org's Avonni entities (EntityDefinition query via the sf CLI),
 *   4. fallback: 'avxp'.
 *
 * Prints the namespace on stdout and exits 0. If both packages are installed
 * and no other signal disambiguates, exits 2 with a message on stderr — the
 * caller must ask the user which package to use. If the org is reachable but
 * has neither package, warns on stderr and still falls back to 'avxp'.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ALLOWED_NAMESPACES = new Set(['avxp', 'avcmpbuilder']);

// Characters allowed in an argument passed to `sf` on the Windows (shell:true)
// path. Deliberately excludes every cmd.exe metacharacter (& | < > ^ % ! ")
// so a malformed value can never alter the command.
const SAFE_SF_ARG_RE = /^[A-Za-z0-9 _@.,:;='()/\\+-]*$/;

/**
 * Runs the Salesforce CLI cross-platform without a command-injection surface.
 *
 * macOS/Linux: spawned with shell:false, so arguments are passed verbatim and
 * no shell ever interprets them.
 *
 * Windows: the CLI ships as `sf.cmd`, which Node refuses to spawn with
 * shell:false (since the CVE-2024-27980 fix), so shell:true is required. To
 * keep that safe this path fails closed — every argument must match
 * SAFE_SF_ARG_RE (no cmd.exe metacharacters) or the call throws before running.
 *
 * @param {string[]} args arguments to pass to `sf`
 * @param {import('node:child_process').ExecFileSyncOptions} [options]
 * @returns {Buffer | string} the child's stdout (per options.encoding)
 */
export function runSf(args, options = {}) {
    if (process.platform === 'win32') {
        for (const arg of args) {
            if (!SAFE_SF_ARG_RE.test(arg)) {
                throw new Error(
                    `Refusing to run sf: argument contains unsafe characters: ${JSON.stringify(
                        arg
                    )}`
                );
            }
        }
        const commandLine = ['sf', ...args]
            .map((arg) => (/[\s()]/.test(arg) ? `"${arg}"` : arg))
            .join(' ');
        return execFileSync(commandLine, { shell: true, ...options });
    }
    return execFileSync('sf', args, { shell: false, ...options });
}

/**
 * Collects the Avonni namespaces already used by component nodes in a view.
 * @param {string} contentJsonPath
 * @returns {Set<string>} subset of ALLOWED_NAMESPACES found in the file
 */
function namespacesInView(contentJsonPath) {
    const found = new Set();
    let root;
    try {
        const data = JSON.parse(readFileSync(contentJsonPath, 'utf8'));
        root = data?.contentBody?.component ?? (data?.type ? data : null);
    } catch {
        return found;
    }
    (function walk(node) {
        if (typeof node !== 'object' || node === null) return;
        if (typeof node.definition === 'string') {
            const prefix = node.definition.split(':')[0];
            if (ALLOWED_NAMESPACES.has(prefix)) found.add(prefix);
        }
        if (Array.isArray(node.children)) node.children.forEach(walk);
    })(root);
    return found;
}

/**
 * Queries the org for entities belonging to the Avonni package namespaces.
 * Uses a plain EntityDefinition query.
 * @returns {Set<string> | null} subset of ALLOWED_NAMESPACES present in the
 * org, or null when the org could not be queried (no CLI or no org access)
 */
function namespacesInOrg() {
    try {
        const result = runSf(
            [
                'data',
                'query',
                '--query',
                "SELECT NamespacePrefix FROM EntityDefinition WHERE NamespacePrefix IN ('avxp', 'avcmpbuilder')",
                '--json'
            ],
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const records = JSON.parse(result)?.result?.records ?? [];
        const found = new Set();
        for (const record of records) {
            const prefix = record?.NamespacePrefix;
            if (ALLOWED_NAMESPACES.has(prefix)) found.add(prefix);
        }
        return found;
    } catch {
        return null; // no org access — caller falls back silently
    }
}

/**
 * Returns the Avonni Experience package namespace ('avxp' or 'avcmpbuilder'),
 * or null when both packages are installed and nothing disambiguates.
 * @param {string} [contentJsonPath] optional view to inspect for evidence
 * @returns {string | null}
 */
export function detectNamespace(contentJsonPath) {
    const env = process.env.AVONNI_XP_PACKAGE_NAMESPACE;
    if (env) {
        if (ALLOWED_NAMESPACES.has(env)) return env;
        process.stderr.write(
            `Warning: ignoring AVONNI_XP_PACKAGE_NAMESPACE="${env}" — must be one of ${[
                ...ALLOWED_NAMESPACES
            ].join(', ')}.\n`
        );
    }

    if (contentJsonPath) {
        const inView = namespacesInView(contentJsonPath);
        if (inView.size === 1) return [...inView][0];
        if (inView.size > 1) {
            process.stderr.write(
                `Warning: ${contentJsonPath} mixes ${[...inView].join(
                    ' and '
                )} components — it should use a single namespace.\n`
            );
        }
    }

    const inOrg = namespacesInOrg();
    if (inOrg) {
        if (inOrg.size === 1) return [...inOrg][0];
        if (inOrg.size > 1) return null; // ambiguous — caller must ask the user
        process.stderr.write(
            'Warning: no Avonni Experience package (avxp or avcmpbuilder) detected in the default org — components will use "avxp" but will not render until a package is installed.\n'
        );
    }

    return 'avxp';
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const namespace = detectNamespace(process.argv[2]);
    if (namespace === null) {
        process.stderr.write(
            'Ambiguous: both the avxp and avcmpbuilder packages are installed and the view gives no hint. Ask the user which package namespace to use (or set AVONNI_XP_PACKAGE_NAMESPACE).\n'
        );
        process.exit(2);
    }
    console.log(namespace);
}
