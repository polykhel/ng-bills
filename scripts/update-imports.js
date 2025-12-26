#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to update all relative imports to use TypeScript path aliases
 * Usage: node scripts/update-imports.js
 */

const srcDir = path.join(__dirname, '..', 'src', 'app');

// Path alias mappings - order matters (most specific first)
const pathMappings = [
  // Specific file imports from services
  {
    pattern: /from ['"](\.\.(\/\.\.)*\/core\/services\/[^'"]+)['"]/g,
    getAlias: (match, relativePath) => {
      const fileName = relativePath.split('/').pop();
      return `from '@services/${fileName}'`;
    },
  },
  // Barrel import from services index
  {
    pattern: /from ['"](\.\.(\/\.\.)*\/core\/services)['"]/g,
    getAlias: () => `from '@services'`,
  },
  // Other core imports
  {
    pattern: /from ['"](\.\.(\/\.\.)*\/core\/[^'"]+)['"]/g,
    getAlias: (match, relativePath) => {
      const parts = relativePath.split('/core/');
      if (parts.length > 1) {
        return `from '@core/${parts[1]}'`;
      }
      return match;
    },
  },
  // Specific file imports from shared/components
  {
    pattern: /from ['"](\.\.(\/\.\.)*\/shared\/components\/[^'"]+)['"]/g,
    getAlias: (match, relativePath) => {
      const fileName = relativePath.split('/').pop();
      return `from '@components/${fileName}'`;
    },
  },
  // Barrel import from shared/components index
  {
    pattern: /from ['"](\.\.(\/\.\.)*\/shared\/components)['"]/g,
    getAlias: () => `from '@components'`,
  },
  // Other shared imports
  {
    pattern: /from ['"](\.\.(\/\.\.)*\/shared\/[^'"]+)['"]/g,
    getAlias: (match, relativePath) => {
      const parts = relativePath.split('/shared/');
      if (parts.length > 1) {
        return `from '@shared/${parts[1]}'`;
      }
      return match;
    },
  },
  // Features imports
  {
    pattern: /from ['"](\.\.(\/\.\.)*\/features\/[^'"]+)['"]/g,
    getAlias: (match, relativePath) => {
      const parts = relativePath.split('/features/');
      if (parts.length > 1) {
        return `from '@features/${parts[1]}'`;
      }
      return match;
    },
  },
];

let totalFiles = 0;
let modifiedFiles = 0;
let totalReplacements = 0;

function processFile(filePath) {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.html')) {
    return;
  }

  totalFiles++;
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let fileReplacements = 0;

  pathMappings.forEach(({ pattern, getAlias }) => {
    const originalContent = content;
    content = content.replace(pattern, (...args) => {
      fileReplacements++;
      return getAlias(...args);
    });
    if (content !== originalContent) {
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    modifiedFiles++;
    totalReplacements += fileReplacements;
    console.log(`✓ Updated ${filePath} (${fileReplacements} replacements)`);
  }
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDirectory(filePath);
    } else {
      processFile(filePath);
    }
  });
}

console.log('Starting import path update...\n');
walkDirectory(srcDir);

console.log('\n=== Summary ===');
console.log(`Total files scanned: ${totalFiles}`);
console.log(`Files modified: ${modifiedFiles}`);
console.log(`Total replacements: ${totalReplacements}`);

if (modifiedFiles === 0) {
  console.log('\n✓ All imports are already using path aliases!');
} else {
  console.log('\n✓ Import paths updated successfully!');
  console.log('\nNext steps:');
  console.log('1. Review the changes: git diff');
  console.log('2. Test your application: npm start');
  console.log('3. Run tests: npm test');
}
