import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { ESLint } from 'eslint';

const requestedBase = process.argv[2] ?? '';

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function resolveBase() {
  if (requestedBase && !/^0+$/.test(requestedBase)) {
    try {
      git(['cat-file', '-e', `${requestedBase}^{commit}`]);
      return requestedBase;
    } catch {
      // Fall through to a local parent for manual or shallow invocations.
    }
  }

  try {
    return git(['rev-parse', 'HEAD^']);
  } catch {
    return git(['rev-list', '--max-parents=0', 'HEAD']);
  }
}

function changedTypeScriptFiles(base) {
  const output = git([
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    base,
    'HEAD',
    '--',
    ':(glob)src/**/*.ts',
    ':(glob)src/**/*.tsx',
  ]);
  return output ? output.split('\n').filter(Boolean) : [];
}

function baseFile(base, path) {
  try {
    return execFileSync('git', ['show', `${base}:${path}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function findingKey(message) {
  return `${message.severity}:${message.ruleId ?? 'parser'}:${message.message}`;
}

function findingCounts(messages) {
  const counts = new Map();
  for (const message of messages) {
    const key = findingKey(message);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function main() {
  const base = resolveBase();
  const files = changedTypeScriptFiles(base);
  if (files.length === 0) {
    console.log('No changed TypeScript files to lint.');
    return;
  }

  const eslint = new ESLint();
  const regressions = [];

  for (const path of files) {
    const currentText = await readFile(path, 'utf8');
    const currentResult = (await eslint.lintText(currentText, { filePath: path }))[0];
    const previousText = baseFile(base, path);
    const previousResult = previousText === null
      ? { messages: [] }
      : (await eslint.lintText(previousText, { filePath: path }))[0];
    const previousCounts = findingCounts(previousResult.messages);
    const seenCurrent = new Map();

    for (const message of currentResult.messages) {
      const key = findingKey(message);
      const occurrence = (seenCurrent.get(key) ?? 0) + 1;
      seenCurrent.set(key, occurrence);
      if (occurrence > (previousCounts.get(key) ?? 0)) {
        regressions.push({ path, message });
      }
    }
  }

  if (regressions.length > 0) {
    console.error(`Found ${regressions.length} new ESLint finding(s):`);
    for (const { path, message } of regressions) {
      const level = message.severity === 2 ? 'error' : 'warning';
      console.error(
        `${path}:${message.line}:${message.column} ${level} ${message.ruleId ?? 'parser'} ${message.message}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`No new ESLint findings across ${files.length} changed TypeScript file(s).`);
}

await main();
