// Reproduce expired dev-RPC sockets after a long synchronous host test.
// Usage: node tools/dev-rpc-check.mjs [path/to/dev.mjs]
// The child server expires its first socket while this client's event loop is
// blocked; the next command must arrive exactly once on a healthy connection.
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const source = path.resolve(process.argv[2] || fileURLToPath(new URL('./dev.mjs', import.meta.url))),
  { request } = await import(pathToFileURL(source).href),
  report = { source, node: process.versions.node, blockedMilliseconds: 7500 },
  child = spawn(process.execPath, ['-e', `
    const http = require('node:http');
    let commands = 0, connections = 0;
    const server = http.createServer((req, res) => {
      req.resume();
      req.on('end', () => res.end(JSON.stringify({ commands: ++commands, connections })));
    });
    server.on('connection', () => connections++);
    server.keepAliveTimeout = 5000;
    server.keepAliveTimeoutBuffer = 0;
    server.listen(0, '127.0.0.1', () => console.log(server.address().port));
  `], { stdio: ['ignore', 'pipe', 'inherit'] });
try {
  const port = await new Promise((resolve, reject) => {
    child.stdout.once('data', bytes => resolve(Number(String(bytes).trim())));
    child.once('error', reject);
    child.once('exit', code => reject(Error('Test server exited early: ' + code)));
  });
  report.first = await request({ op: 'status' }, { port, timeoutMs: 2000 });
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 7500);
  report.second = await request({ op: 'status' }, { port, timeoutMs: 2000 });
  if (report.first.commands !== 1 || report.second.commands !== 2 || report.second.connections !== 2)
    throw Error('The second command did not arrive once on a fresh connection');
  report.pass = true;
} catch (error) {
  report.pass = false;
  report.error = { code: error.code, message: error.message };
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  console.log(JSON.stringify(report, null, 2));
}
