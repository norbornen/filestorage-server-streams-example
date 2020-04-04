// @ts-check
'use strict';

const http = require('http');
const logger = require('./logger');
const handler = require('./handler');

const server = http.createServer();
server.on('request', handler).on('request', logger);
server.on('clientError', (err, socket) => {
    console.error(err);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

module.exports = server;
