#!/usr/bin/env node
/**
 * JediRe Deep Code Analysis
 * Performs more thorough checks that may take longer
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const JEDIRE_DIR = process.env.JEDIRE_DIR || '/home/leon/clawd/jedire';
const MEMORY_FILE = '/home/leon/clawd/memory/jedire-monitoring.json';

// Utility to walk directory tree
function* walkSync(dir, filter = () => true) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.name.startsWith('.') || file.name === 'node_modules') continue;
    
    const filepath = path.join(dir, file.name);
    if (file.isDirectory()) {
      yield* walkSync(filepath, filter);
    } else if (filter(filepath)) {
      yield filepath;
    }
  }
}

// Check for unused imports/exports
function checkUnusedCode() {
  console.log('\n📦 Checking for unused code...');
  const results = { unusedImports: [], unusedExports: [] };
  
  try {
    // Simple regex-based check for unused imports
    const tsFiles = [...walkSync(path.join(JEDIRE_DIR, 'frontend/src'), f => /\.(ts|tsx)$/.test(f))];
    
    for (const file of tsFiles.slice(0, 50)) { // Limit to first 50 files for speed
      const content = fs.readFileSync(file, 'utf8');
      const imports = content.match(/import\s+{([^}]+)}\s+from/g) || [];
      
      imports.forEach(imp => {
        const importedNames = imp.match(/import\s+{([^}]+)}/)[1].split(',').map(s => s.trim());
        importedNames.forEach(name => {
          const cleanName = name.split(' as ')[0].trim();
          const usageRegex = new RegExp(`\\b${cleanName}\\b`, 'g');
          const usages = (content.match(usageRegex) || []).length;
          
          if (usages <= 1) { // Only imported once (the import itself)
            results.unusedImports.push({ file: path.relative(JEDIRE_DIR, file), import: cleanName });
          }
        });
      });
    }
    
    console.log(`  Found ${results.unusedImports.length} potentially unused imports`);
  } catch (err) {
    console.warn('  Could not analyze imports:', err.message);
  }
  
  return results;
}

// Find duplicate code blocks
function findDuplicateCode() {
  console.log('\n🔍 Checking for duplicate code...');
  const codeBlocks = new Map();
  const duplicates = [];
  
  try {
    const files = [...walkSync(path.join(JEDIRE_DIR, 'frontend/src'), f => /\.(ts|tsx|js|jsx)$/.test(f))];
    
    for (const file of files.slice(0, 30)) { // Limit for performance
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      // Look for blocks of 5+ similar lines
      for (let i = 0; i < lines.length - 5; i++) {
        const block = lines.slice(i, i + 5).join('\n').trim();
        if (block.length < 50) continue; // Skip small blocks
        
        if (codeBlocks.has(block)) {
          duplicates.push({
            block: block.substring(0, 80) + '...',
            files: [codeBlocks.get(block), path.relative(JEDIRE_DIR, file)]
          });
        } else {
          codeBlocks.set(block, path.relative(JEDIRE_DIR, file));
        }
      }
    }
    
    console.log(`  Found ${duplicates.length} potential duplicate blocks`);
  } catch (err) {
    console.warn('  Could not analyze duplicates:', err.message);
  }
  
  return duplicates.slice(0, 10); // Top 10
}

// Check bundle size breakdown
function analyzeBundleSize() {
  console.log('\n📊 Analyzing bundle size...');
  const results = { totalSize: 0, largeFiles: [], breakdown: {} };
  
  try {
    const buildDirs = [
      path.join(JEDIRE_DIR, 'frontend/dist'),
      path.join(JEDIRE_DIR, 'frontend/build')
    ];
    
    for (const buildDir of buildDirs) {
      if (!fs.existsSync(buildDir)) continue;
      
      const files = [...walkSync(buildDir)];
      files.forEach(file => {
        const stats = fs.statSync(file);
        const ext = path.extname(file);
        
        results.totalSize += stats.size;
        results.breakdown[ext] = (results.breakdown[ext] || 0) + stats.size;
        
        if (stats.size > 500 * 1024) { // >500KB
          results.largeFiles.push({
            file: path.relative(buildDir, file),
            size: Math.round(stats.size / 1024) + 'KB'
          });
        }
      });
      
      console.log(`  Total bundle size: ${Math.round(results.totalSize / 1024)}KB`);
      console.log(`  Large files (>500KB): ${results.largeFiles.length}`);
      break; // Use first found build dir
    }
  } catch (err) {
    console.warn('  Could not analyze bundle:', err.message);
  }
  
  return results;
}

// Analyze API response sizes (from backend routes)
function analyzeAPIResponses() {
  console.log('\n🌐 Analyzing API patterns...');
  const results = { potentialIssues: [] };
  
  try {
    const routeFiles = [...walkSync(path.join(JEDIRE_DIR, 'backend/src/routes'), f => /\.(ts|js)$/.test(f))];
    
    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Look for SELECT * queries (can be inefficient)
      if (content.includes('SELECT *')) {
        results.potentialIssues.push({
          file: path.relative(JEDIRE_DIR, file),
          issue: 'Uses SELECT * - consider explicit columns'
        });
      }
      
      // Look for missing pagination
      if (content.includes('.findMany') && !content.includes('limit') && !content.includes('take')) {
        results.potentialIssues.push({
          file: path.relative(JEDIRE_DIR, file),
          issue: 'Unbounded query - consider adding pagination'
        });
      }
    }
    
    console.log(`  Found ${results.potentialIssues.length} potential API issues`);
  } catch (err) {
    console.warn('  Could not analyze API:', err.message);
  }
  
  return results;
}

// Generate recommendations
function generateRecommendations(analysis) {
  console.log('\n💡 Recommendations:');
  const recommendations = [];
  
  if (analysis.unusedCode.unusedImports.length > 5) {
    recommendations.push('Remove unused imports to reduce bundle size');
  }
  
  if (analysis.duplicates.length > 3) {
    recommendations.push('Extract duplicate code into shared utilities');
  }
  
  if (analysis.bundleSize.totalSize > 5 * 1024 * 1024) { // >5MB
    recommendations.push('Bundle size is large - consider code splitting');
  }
  
  if (analysis.bundleSize.largeFiles.length > 0) {
    recommendations.push('Optimize or lazy-load large assets');
  }
  
  if (analysis.apiAnalysis.potentialIssues.length > 0) {
    recommendations.push('Review API queries for performance optimization');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✓ Code quality looks good!');
  }
  
  recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`);
  });
  
  return recommendations;
}

// Save results to memory
function saveToMemory(analysis) {
  const memory = {
    lastRun: new Date().toISOString(),
    analysis,
    trends: []
  };
  
  // Load previous data if exists
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      const previous = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
      
      // Track trends
      if (previous.analysis) {
        memory.trends = [
          {
            metric: 'bundleSize',
            previous: previous.analysis.bundleSize.totalSize,
            current: analysis.bundleSize.totalSize,
            change: analysis.bundleSize.totalSize - previous.analysis.bundleSize.totalSize
          },
          {
            metric: 'unusedImports',
            previous: previous.analysis.unusedCode.unusedImports.length,
            current: analysis.unusedCode.unusedImports.length,
            change: analysis.unusedCode.unusedImports.length - previous.analysis.unusedCode.unusedImports.length
          }
        ];
      }
    } catch (err) {
      console.warn('Could not load previous results:', err.message);
    }
  }
  
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
  console.log(`\n💾 Results saved to ${MEMORY_FILE}`);
}

// Main execution
async function main() {
  console.log('🔬 JediRe Deep Code Analysis');
  console.log('======================================');
  
  const analysis = {
    timestamp: new Date().toISOString(),
    unusedCode: checkUnusedCode(),
    duplicates: findDuplicateCode(),
    bundleSize: analyzeBundleSize(),
    apiAnalysis: analyzeAPIResponses(),
    recommendations: []
  };
  
  analysis.recommendations = generateRecommendations(analysis);
  
  saveToMemory(analysis);
  
  console.log('\n✅ Analysis complete!');
  
  // Exit with warning code if critical issues found
  const criticalIssues = 
    analysis.bundleSize.totalSize > 10 * 1024 * 1024 || // >10MB
    analysis.apiAnalysis.potentialIssues.length > 10;
  
  process.exit(criticalIssues ? 1 : 0);
}

main().catch(err => {
  console.error('❌ Analysis failed:', err);
  process.exit(1);
});
