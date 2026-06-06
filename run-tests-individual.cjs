#!/usr/bin/env node

/**
 * Run test files individually to avoid memory issues
 */

const { spawnSync } = require('child_process');
const path = require('path');

const testFiles = [
  'src/lib/components/pack-editor/CodeEditor.test.ts',
  'src/lib/components/pack-editor/FileTree.test.ts',
  'src/lib/components/pack-editor/FileTreeNode.test.ts',
  'src/lib/components/pack-editor/PackEditor.test.ts'
];

console.log('Running tests individually to avoid memory issues...\n');

let allPassed = true;
const results = [];

for (const testFile of testFiles) {
  console.log(`Running: ${testFile}`);
  
  const result = spawnSync(
    'npm',
    ['exec', 'vitest', 'run', testFile, '--no-coverage', '--run', '--reporter=basic'],
    {
      cwd: __dirname,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10 // 10MB
    }
  );
  
  const passed = result.status === 0;
  results.push({ file: testFile, passed, stdout: result.stdout, stderr: result.stderr });
  
  if (passed) {
    console.log(`  ✅ PASSED\n`);
  } else {
    console.log(`  ❌ FAILED`);
    if (result.stderr) {
      console.log(`  Error: ${result.stderr.substring(0, 200)}`);
    }
    console.log();
    allPassed = false;
  }
}

console.log('='.repeat(60));
console.log('\nTest Results Summary:');
console.log('-'.repeat(60));

for (const result of results) {
  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${result.file}`);
}

console.log('-'.repeat(60));
if (allPassed) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed');
  process.exit(1);
}
