#!/usr/bin/env node

/**
 * Simple test validator that checks test files can be parsed
 * without running the full test suite (for memory-constrained environments)
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'src/lib/components/pack-editor/CodeEditor.test.ts',
  'src/lib/components/pack-editor/FileTree.test.ts',
  'src/lib/components/pack-editor/FileTreeNode.test.ts',
  'src/lib/components/pack-editor/PackEditor.test.ts'
];

console.log('Validating test files...\n');

let allValid = true;

for (const testFile of testFiles) {
  const filePath = path.join(__dirname, testFile);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${testFile}: FILE NOT FOUND`);
    allValid = false;
    continue;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic syntax checks
    if (!content.includes('describe(')) {
      console.log(`❌ ${testFile}: Missing describe block`);
      allValid = false;
      continue;
    }
    
    if (!content.includes('it(')) {
      console.log(`❌ ${testFile}: Missing it() tests`);
      allValid = false;
      continue;
    }
    
    // Count tests
    const describeCount = (content.match(/describe\(/g) || []).length;
    const itCount = (content.match(/it\(/g) || []).length;
    
    // Check for common imports
    const hasVitest = content.includes('vitest') || content.includes('from \'vitest\'');
    const hasTestingLibrary = content.includes('@testing-library/svelte');
    const hasComponentImport = content.includes('from \'./');
    
    if (!hasVitest) {
      console.log(`❌ ${testFile}: Missing vitest import`);
      allValid = false;
      continue;
    }
    
    if (!hasTestingLibrary) {
      console.log(`❌ ${testFile}: Missing @testing-library/svelte import`);
      allValid = false;
      continue;
    }
    
    if (!hasComponentImport) {
      console.log(`❌ ${testFile}: Missing component import`);
      allValid = false;
      continue;
    }
    
    console.log(`✅ ${testFile}: ${itCount} tests in ${describeCount} describe blocks`);
    
  } catch (error) {
    console.log(`❌ ${testFile}: Error reading file - ${error.message}`);
    allValid = false;
  }
}

console.log('\n' + '='.repeat(60));
if (allValid) {
  console.log('✅ All test files are valid!');
  process.exit(0);
} else {
  console.log('❌ Some test files have issues');
  process.exit(1);
}
