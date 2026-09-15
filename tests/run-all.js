/**
 * DreamsLab Link Launcher - Master Test Runner
 * Executes all acceptance test suites across all 8 architectural domains.
 */

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

let currentSuite = '';

global.describe = function(suiteName, fn) {
  currentSuite = suiteName;
  console.log(`\n\x1b[1m\x1b[36m▶ ${suiteName}\x1b[0m`);
  try {
    fn();
  } catch (err) {
    console.error(`  \x1b[31m✖ Suite initialization failed: ${err.message}\x1b[0m`);
    failures.push({ suite: suiteName, test: 'Suite Setup', error: err });
  }
};

global.it = function(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
  } catch (err) {
    failedTests++;
    console.log(`  \x1b[31m✖ ${testName}\x1b[0m`);
    console.log(`    \x1b[90m${err.message}\x1b[0m`);
    failures.push({ suite: currentSuite, test: testName, error: err });
  }
};

console.log('======================================================================');
console.log('  DREAMSLAB LINK LAUNCHER // ACCEPTANCE VERIFICATION SUITE v1.0.9');
console.log('======================================================================');

const testSuites = [
  './local-detection.test.js',
  './cloud-state.test.js',
  './sync-conflict.test.js',
  './account-star-pin.test.js',
  './secure-auth.test.js',
  './backup-security.test.js',
  './updater-security.test.js',
  './server-production.test.js'
];

testSuites.forEach(suiteFile => {
  try {
    require(suiteFile);
  } catch (err) {
    console.error(`\x1b[31mFailed to load test suite ${suiteFile}: ${err.message}\x1b[0m`);
    failedTests++;
    failures.push({ suite: suiteFile, test: 'Require', error: err });
  }
});

console.log('\n======================================================================');
console.log('  TEST SUMMARY');
console.log('======================================================================');
console.log(`  Total:  ${totalTests}`);
console.log(`  Passed: \x1b[32m${passedTests}\x1b[0m`);
console.log(`  Failed: ${failedTests > 0 ? '\x1b[31m' : '\x1b[32m'}${failedTests}\x1b[0m`);

if (failures.length > 0) {
  console.log('\n\x1b[31mFAILURES:\x1b[0m');
  failures.forEach(f => {
    console.log(`  - [${f.suite}] ${f.test}: ${f.error.message}`);
  });
  process.exit(1);
} else {
  console.log('\n\x1b[32m✨ ALL 8 ACCEPTANCE CRITERIA SUITES PASSED WITH 100% SUCCESS!\x1b[0m\n');
  process.exit(0);
}
