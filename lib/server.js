'use strict';

const http = require('http');
const logger = require('./logger');
const handler = require('./handler');

const server = module.exports = http.createServer();
server.on('request', handler);
server.on('request', logger);
server.on('clientError', (err, socket) => {
    console.error(err);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
