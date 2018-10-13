'use strict';

const server = require('./lib/server');
server.listen(3030);

process.on('uncaughtException', (err) => console.trace(err));
