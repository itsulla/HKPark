// PM2 config for HK Theme Park Tycoon production hosting.
// The admin token lives in data/.admin-token (chmod 600, gitignored).

const { readFileSync } = require('fs');
const { join } = require('path');

let adminToken = '';
try {
  adminToken = readFileSync(join(__dirname, 'data', '.admin-token'), 'utf8').trim();
} catch {
  // No token file -> /admin stays disabled (fail closed).
}

module.exports = {
  apps: [
    {
      name: 'hk-park',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3020',
      env: {
        NODE_ENV: 'production',
        IMPRESSIONS_LOG: join(__dirname, 'data', 'impressions.jsonl'),
        ADMIN_TOKEN: adminToken,
      },
      max_memory_restart: '500M',
    },
  ],
};
