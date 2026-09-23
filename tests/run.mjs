import { writeFile } from 'node:fs/promises';
import { runTests } from './core.test.mjs';
import { runIntegrationTests } from './integration.test.mjs';
const results = [await runTests(), await runIntegrationTests()];
const report = { total: results.reduce((n,r)=>n+r.total,0), passed: results.reduce((n,r)=>n+r.passed,0), failed: results.flatMap(r=>r.failed), results: results.flatMap(r=>r.results) };
await writeFile(new URL('../test-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed},null,2));
if(report.failed.length) process.exitCode=1;
