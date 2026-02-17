const JobManager = require('../src/orchestrator/job-manager');
require('dotenv').config();

async function runTests() {
  console.log('AccessibilityAI Auditor - Manual Test Suite\n');

  if (!process.env.OPENAI_API_KEY) {
    console.log('No OpenAI API key found. Running without LLM analysis.\n');
  }

  const manager = new JobManager(process.env.OPENAI_API_KEY);
  
  try {
    await manager.initialize();

    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: Simple Website (example.com)');
    console.log('='.repeat(60));
    
    const test1 = await manager.auditWebsite('https://example.com', {
      skipLLM: !process.env.OPENAI_API_KEY
    });
    
    console.log(`\nTest 1 Complete`);
    console.log(`  Violations: ${test1.results.summary.totalViolations}`);
    console.log(`  Compliance Score: ${test1.summary.overallScore}/100`);

    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Complex Website (wikipedia.org)');
    console.log('='.repeat(60));
    
    const test2 = await manager.auditWebsite('https://en.wikipedia.org/wiki/Web_accessibility', {
      skipLLM: !process.env.OPENAI_API_KEY
    });
    
    console.log(`\nTest 2 Complete`);
    console.log(`  Violations: ${test2.results.summary.totalViolations}`);
    console.log(`  Compliance Score: ${test2.summary.overallScore}/100`);

    console.log('\n' + '='.repeat(60));
    console.log('SAMPLE VIOLATIONS FROM TEST 2');
    console.log('='.repeat(60) + '\n');

    const violations = test2.results.violations.slice(0, 5);
    violations.forEach((v, idx) => {
      console.log(`${idx + 1}. [${v.source.toUpperCase()}] ${v.type}`);
      console.log(`   Severity: ${v.impact}`);
      console.log(`   Description: ${v.description}`);
      console.log(`   Fix: ${v.recommendation}`);
      
      if (v.examples && v.examples.length > 0) {
        console.log(`   Example: ${v.examples[0].html?.substring(0, 80) || 'N/A'}...`);
      }
      console.log();
    });

    console.log('\n' + '='.repeat(60));
    console.log('GENERATING JSON REPORT');
    console.log('='.repeat(60) + '\n');

    const fs = require('fs');
    const reportPath = './test-report.json';
    
    const report = {
      generatedAt: new Date().toISOString(),
      tests: [
        { name: 'example.com', ...test1 },
        { name: 'wikipedia.org', ...test2 }
      ]
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${reportPath}`);

    console.log('\n' + '='.repeat(60));
    console.log('TEST SUITE COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total tests run: 2`);
    console.log(`Total violations found: ${test1.results.summary.totalViolations + test2.results.summary.totalViolations}`);
    console.log(`Average compliance score: ${((test1.summary.overallScore + test2.summary.overallScore) / 2).toFixed(1)}/100`);
    console.log(`Report: ${reportPath}\n`);

  } catch (error) {
    console.error('\nTest suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await manager.close();
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
