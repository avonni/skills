#!/usr/bin/env node
/**
 * Scaffolds a minimal Salesforce screen flow ready to receive Avonni
 * Flow Screen Component fields.
 *
 * Usage:
 *   node create-flow.mjs --label "My Flow" [options]
 *
 * Options:
 *   --label <text>         Flow label (required)
 *   --api-name <name>      Flow API name. Derived from --label when omitted.
 *   --screen-label <text>  Label of the initial screen. Defaults to "Screen".
 *   --out-dir <directory>  Output directory. Defaults to
 *                          ./force-app/main/default/flows relative to the
 *                          current working directory.
 *   --api-version <ver>    Salesforce API version. Defaults to 62.0.
 *   --force                Overwrite an existing file.
 *
 * Writes <out-dir>/<ApiName>.flow-meta.xml and prints its path on success.
 * The flow contains one empty screen (named "Screen1") connected to the start
 * element, with status Draft. Component fields are added to the screen
 * afterwards, between <allowPause> and <showFooter>.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_API_VERSION = '62.0';
const DEFAULT_OUT_DIR = join('force-app', 'main', 'default', 'flows');
const FLOW_NS = 'http://soap.sforce.com/2006/04/metadata';

/**
 * @param {string} s
 * @returns {string}
 */
function escapeXmlString(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Derives a valid flow API name from a label: alphanumerics kept, everything
 * else collapsed into single underscores, no leading digit or trailing
 * underscore.
 *
 * @param {string} label
 * @returns {string}
 */
function deriveApiName(label) {
    let name = label
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '');
    if (/^[0-9]/.test(name)) name = `X${name}`;
    return name;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isValidApiName(name) {
    return (
        /^[A-Za-z][A-Za-z0-9_]*$/.test(name) &&
        !name.endsWith('_') &&
        !name.includes('__')
    );
}

/**
 * @param {string[]} argv
 * @returns {{label: string, apiName: string, screenLabel: string, outDir: string, apiVersion: string, force: boolean}}
 */
function parseArgs(argv) {
    const args = {
        label: null,
        apiName: null,
        screenLabel: 'Screen',
        outDir: DEFAULT_OUT_DIR,
        apiVersion: DEFAULT_API_VERSION,
        force: false
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = () => {
            i++;
            if (i >= argv.length) {
                throw new Error(`Missing value for ${arg}`);
            }
            return argv[i];
        };
        switch (arg) {
            case '--label':
                args.label = next();
                break;
            case '--api-name':
                args.apiName = next();
                break;
            case '--screen-label':
                args.screenLabel = next();
                break;
            case '--out-dir':
                args.outDir = next();
                break;
            case '--api-version':
                args.apiVersion = next();
                break;
            case '--force':
                args.force = true;
                break;
            case '--help':
            case '-h':
                args.help = true;
                break;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }
    return args;
}

/**
 * @param {{label: string, apiName: string, screenLabel: string, apiVersion: string}} options
 * @returns {string}
 */
function buildFlowXml({ label, screenLabel, apiVersion }) {
    const escapedLabel = escapeXmlString(label);
    const escapedScreenLabel = escapeXmlString(screenLabel);
    return `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="${FLOW_NS}">
    <apiVersion>${escapeXmlString(apiVersion)}</apiVersion>
    <environments>Default</environments>
    <interviewLabel>${escapedLabel} {!$Flow.CurrentDateTime}</interviewLabel>
    <label>${escapedLabel}</label>
    <processMetadataValues>
        <name>BuilderType</name>
        <value>
            <stringValue>LightningFlowBuilder</stringValue>
        </value>
    </processMetadataValues>
    <processMetadataValues>
        <name>CanvasMode</name>
        <value>
            <stringValue>AUTO_LAYOUT_CANVAS</stringValue>
        </value>
    </processMetadataValues>
    <processMetadataValues>
        <name>OriginBuilderType</name>
        <value>
            <stringValue>LightningFlowBuilder</stringValue>
        </value>
    </processMetadataValues>
    <processType>Flow</processType>
    <screens>
        <name>Screen1</name>
        <label>${escapedScreenLabel}</label>
        <locationX>176</locationX>
        <locationY>134</locationY>
        <allowBack>true</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>true</allowPause>
        <showFooter>true</showFooter>
        <showHeader>true</showHeader>
    </screens>
    <start>
        <locationX>50</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Screen1</targetReference>
        </connector>
    </start>
    <status>Draft</status>
</Flow>
`;
}

function main() {
    let args;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }

    if (args.help) {
        console.log(
            'Usage: node create-flow.mjs --label "My Flow" [--api-name Name] [--screen-label "Screen"] [--out-dir dir] [--api-version 62.0] [--force]'
        );
        process.exit(0);
    }

    if (!args.label) {
        console.error('Missing required argument: --label');
        process.exit(1);
    }

    const apiName = args.apiName || deriveApiName(args.label);
    if (!isValidApiName(apiName)) {
        console.error(`Invalid flow API name: "${apiName}"`);
        process.exit(1);
    }

    const outDir = resolve(args.outDir);
    const outPath = join(outDir, `${apiName}.flow-meta.xml`);
    if (existsSync(outPath) && !args.force) {
        console.error(
            `${outPath} already exists. Pass --force to overwrite, or use the Update Path to modify it.`
        );
        process.exit(1);
    }

    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, buildFlowXml(args), 'utf8');
    console.log(outPath);
}

main();
