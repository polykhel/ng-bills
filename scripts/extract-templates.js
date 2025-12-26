#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to extract inline templates from Angular components to separate HTML files
 * Usage: node scripts/extract-templates.js
 */

function findComponentFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findComponentFiles(filePath, fileList);
    } else if (file.endsWith('.component.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function extractTemplate(content) {
  // Match template property with backticks (multi-line)
  const templateMatch = content.match(/template:\s*`([\s\S]*?)`\s*/);

  if (templateMatch) {
    return {
      found: true,
      template: templateMatch[1],
      fullMatch: templateMatch[0]
    };
  }

  // Match template property with single/double quotes (single-line)
  const singleLineMatch = content.match(/template:\s*(['"])([\s\S]*?)\1\s*,/);

  if (singleLineMatch) {
    return {
      found: true,
      template: singleLineMatch[2],
      fullMatch: singleLineMatch[0]
    };
  }

  return {found: false};
}

function processComponentFile(filePath) {
  console.log(`\nProcessing: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf8');

  // Check if already using templateUrl
  if (content.includes('templateUrl:')) {
    console.log('  ⏭️  Already using templateUrl, skipping');
    return false;
  }

  const templateData = extractTemplate(content);

  if (!templateData.found) {
    console.log('  ⏭️  No inline template found, skipping');
    return false;
  }

  // Create HTML file path
  const htmlFilePath = filePath.replace('.component.ts', '.component.html');
  const relativeHtmlPath = './' + path.basename(htmlFilePath);

  // Write template to HTML file
  fs.writeFileSync(htmlFilePath, templateData.template);
  console.log(`  ✅ Created: ${htmlFilePath}`);

  // Update component file to use templateUrl
  const newContent = content.replace(
    templateData.fullMatch,
    `templateUrl: '${relativeHtmlPath}',`
  );

  fs.writeFileSync(filePath, newContent);
  console.log(`  ✅ Updated component to use templateUrl`);

  return true;
}

function main() {
  const srcDir = path.join(__dirname, '..', 'src');

  if (!fs.existsSync(srcDir)) {
    console.error('Error: src directory not found');
    process.exit(1);
  }

  console.log('🔍 Searching for Angular components...\n');

  const componentFiles = findComponentFiles(srcDir);
  console.log(`Found ${componentFiles.length} component files\n`);
  console.log('='.repeat(60));

  let processedCount = 0;

  componentFiles.forEach(file => {
    if (processComponentFile(file)) {
      processedCount++;
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`\n✨ Done! Processed ${processedCount} of ${componentFiles.length} components`);
}

main();
