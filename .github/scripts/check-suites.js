#!/usr/bin/env node
// Release checks for the two userscript suites. Run by .github/workflows/suite-checks.yml on every
// push and pull request, and locally with: node .github/scripts/check-suites.js [base-ref]
//
// Checks, for each suite:
//   1. The file parses (node --check).
//   2. The header @version equals the suite's SCRIPT_VERSION.
//   3. Every SCRIPT_VERSION (suite and each tool or helper) equals the top "Version X:" of the CHANGELOG after it.
//   4. Ticket Helpers: the Short Description section carries the suite version too.
//   5. The newest changelog entry of every changelog has no dashes used as punctuation.
//   6. With a base ref: a changed suite has a higher @version than in the base.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SUITES = [
    { name: 'Tools Toolbar', file: 'Toolbar Scripts/Toolbar-Suite.user.js', sameAsSuite: 0 },
    // The Short Description section (second SCRIPT_VERSION) keeps the suite version.
    { name: 'Ticket Helpers', file: 'Standalone Scripts/ServiceNowShortDescriptionHelper.user.js', sameAsSuite: 1 },
];

const errors = [];
const fail = (suite, msg) => errors.push(`${suite.name}: ${msg}`);

function cmpVersion(a, b) {
    const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d) return Math.sign(d);
    }
    return 0;
}

function headerVersion(src) {
    const m = /^\/\/\s*@version\s+(\S+)/m.exec(src);
    return m ? m[1] : null;
}

function lineOf(src, index) { return src.slice(0, index).split('\n').length; }

// Each SCRIPT_VERSION paired with the first CHANGELOG that follows it.
function versionBlocks(src) {
    const out = [];
    const re = /const SCRIPT_VERSION\s*=\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src))) {
        const rest = src.slice(m.index);
        const cl = /const CHANGELOG\s*=\s*`([\s\S]*?)`;/.exec(rest);
        out.push({ version: m[1], line: lineOf(src, m.index), changelog: cl ? cl[1] : null });
    }
    return out;
}

// A dash used as punctuation: an em or en dash anywhere, or a spaced hyphen. The "- " bullet marker
// at the start of a line is structural and allowed.
function dashProblems(entry) {
    return entry.split('\n')
        .map(l => l.replace(/^\s*- /, ''))
        .filter(l => /[—–]| - /.test(l));
}

function baseSource(baseRef, file) {
    try { return execFileSync('git', ['show', `${baseRef}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (e) { return null; }
}

const baseRef = process.argv[2] && !/^0+$/.test(process.argv[2]) ? process.argv[2] : null;

for (const suite of SUITES) {
    const abs = path.join(ROOT, suite.file);
    if (!fs.existsSync(abs)) { fail(suite, `${suite.file} not found`); continue; }
    const src = fs.readFileSync(abs, 'utf8');

    try { execFileSync(process.execPath, ['--check', abs], { stdio: ['ignore', 'ignore', 'pipe'] }); }
    catch (e) { fail(suite, `syntax error:\n${String(e.stderr || e.message).trim()}`); }

    const header = headerVersion(src);
    const blocks = versionBlocks(src);
    if (!header) fail(suite, 'no // @version line in the header');
    if (!blocks.length) { fail(suite, 'no SCRIPT_VERSION found'); continue; }

    if (header && blocks[0].version !== header) {
        fail(suite, `@version ${header} but SCRIPT_VERSION ${blocks[0].version} (line ${blocks[0].line})`);
    }
    const same = blocks[suite.sameAsSuite];
    if (suite.sameAsSuite && same && same.version !== blocks[0].version) {
        fail(suite, `SCRIPT_VERSION on line ${same.line} is ${same.version}, it must equal the suite version ${blocks[0].version}`);
    }

    for (const b of blocks) {
        if (b.changelog === null) { fail(suite, `no CHANGELOG after SCRIPT_VERSION on line ${b.line}`); continue; }
        const top = /^\s*Version\s+([^:\s]+):/.exec(b.changelog);
        if (!top) { fail(suite, `CHANGELOG after line ${b.line} does not start with "Version X:"`); continue; }
        if (top[1] !== b.version) {
            fail(suite, `SCRIPT_VERSION ${b.version} on line ${b.line}, but its CHANGELOG starts with Version ${top[1]}`);
        }
        const newest = b.changelog.split(/\n\s*(?=Version\s+\d)/)[0];
        for (const l of dashProblems(newest)) {
            fail(suite, `changelog ${b.version} (line ${b.line}) uses a dash as punctuation: "${l.trim()}"`);
        }
    }

    if (baseRef && header) {
        const old = baseSource(baseRef, suite.file);
        if (old !== null && old !== src) {
            const oldHeader = headerVersion(old);
            if (oldHeader && cmpVersion(header, oldHeader) <= 0) {
                fail(suite, `the file changed but @version stayed at ${header} (was ${oldHeader}): bump it`);
            }
        }
    }

    console.log(`${suite.name} ${header}: ${blocks.length} version blocks checked`);
}

if (errors.length) {
    console.error(`\n${errors.length} problem(s):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
}
console.log('\nAll suite checks passed.');
