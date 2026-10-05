// Bundle analysis script for PMK Form
// Run: ANALYZE=true npm run build

const fs = require('fs');
const path = require('path');

console.log('Check .next/static directory for bundle composition');
const nextStaticDir = path.join(__dirname, '.next', 'static');
if (fs.existsSync(nextStaticDir)) {
  const chunksDir = path.join(nextStaticDir, 'chunks');
  if (fs.existsSync(chunksDir)) {
    const files = fs.readdirSync(chunksDir).sort((a, b) => {
      const fa = fs.statSync(path.join(chunksDir, a)).size;
      const fb = fs.statSync(path.join(chunksDir, b)).size;
      return fb - fa;
    });
    console.log('\nLargest chunks:');
    files.slice(0, 20).forEach(f => {
      const stat = fs.statSync(path.join(chunksDir, f));
      console.log(`  ${f}: ${(stat.size / 1024).toFixed(1)} KB`);
    });
  }
}
