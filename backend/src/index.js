const http = require('http');
const env = require('./config/env');
const { createApp } = require('./app');
const { pingDatabase } = require('./db');
const { attachSockets } = require('./sockets');

async function main() {
  await pingDatabase();
  const app = createApp();
  const server = http.createServer(app);
  attachSockets(server);

  server.listen(env.port, () => {
    console.log(`Seni Chat API listening on http://localhost:${env.port}`);
    console.log(`Database client: ${env.dbClient}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
