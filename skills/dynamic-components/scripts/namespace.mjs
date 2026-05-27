import { execSync } from 'node:child_process';

/**
 * Returns the Avonni DC package namespace ('avxp' or 'avdynamic').
 * Checks AVONNI_DC_PACKAGE_NAMESPACE env var first, then queries the org.
 * Falls back to 'avxp' if detection fails.
 * @returns {string}
 */
export function detectNamespace() {
    const env = process.env.AVONNI_DC_PACKAGE_NAMESPACE;
    if (env) return env;

    try {
        const result = execSync(
            `sf data query --query "SELECT QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName IN ('avxp__AvonniDynamicComponent__mdt', 'avdynamic__AvonniDynamicComponent__mdt')" --json`,
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
