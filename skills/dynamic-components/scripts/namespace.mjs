import { execFileSync } from 'node:child_process';

const ALLOWED_NAMESPACES = new Set(['avxp', 'avdynamic']);

// Characters allowed in an argument passed to `sf` on the Windows (shell:true)
// path. Deliberately excludes every cmd.exe metacharacter (& | < > ^ % ! ")
// so a malformed value can never alter the command. Covers what we actually
// pass: sub-commands, flags, SOQL strings (letters, digits, spaces, commas,
// single quotes, =, parentheses, backslash) and metadata names (: . _).
const SAFE_SF_ARG_RE = /^[A-Za-z0-9 _@.,:;='()/\\+-]*$/;

/**
 * Escapes a string for safe inclusion inside a single-quoted SOQL literal.
 * Backslash and single quote are the only characters SOQL requires escaping.
 * This guards the SOQL layer, not the shell layer (see runSf for that).
 * @param {string} value
 * @returns {string}
 */
export function escapeSoqlString(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

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
 * Returns the Avonni DC package namespace ('avxp' or 'avdynamic').
 * Checks AVONNI_DC_PACKAGE_NAMESPACE env var first, then queries the org.
 * Falls back to 'avxp' if detection fails.
 * @returns {string}
 */
export function detectNamespace() {
    const env = process.env.AVONNI_DC_PACKAGE_NAMESPACE;
    if (env) {
        if (ALLOWED_NAMESPACES.has(env)) return env;
        process.stderr.write(
            `Warning: ignoring AVONNI_DC_PACKAGE_NAMESPACE="${env}" — must be one of ${[
                ...ALLOWED_NAMESPACES
            ].join(', ')}.\n`
        );
    }

    try {
        const result = runSf(
            [
                'data',
                'query',
                '--query',
                "SELECT QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName IN ('avxp__AvonniDynamicComponent__mdt', 'avdynamic__AvonniDynamicComponent__mdt')",
                '--json'
            ],
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const records = JSON.parse(result)?.result?.records ?? [];
        for (const record of records) {
            if (record.QualifiedApiName?.startsWith('avdynamic')) return 'avdynamic';
            if (record.QualifiedApiName?.startsWith('avxp')) return 'avxp';
        }
    } catch {
        // fall through to default
    }
    return 'avxp';
}
