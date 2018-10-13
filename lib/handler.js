'use strict';

const path = require('path');
const url = require('url');
const fs = require('fs');
const { promisify } = require('util');
const mime = require('mime');
const config = require('config');

const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);

fs.mkdir(config.get('filesRoot'), '0775', () => {});

module.exports = async (req, res) => {
    try {
        await requestHandler(req, res);
    } catch (err) {
        console.trace(err);
        res.statusCode = err.status || 500;
        res.end(err.message);
    }
};

async function requestHandler(req, res) {
    const method = req.method;
    const pathname = path.normalize(decodeURI(url.parse(req.url).pathname));
    const filename = pathname.slice(1);

    switch (method) {
        case 'GET':
            if (pathname === '/favicon.ico') {
                res.writeHead(204, {'Content-Type': 'image/x-icon'});
                return res.end();
            }
            if (pathname === '/list') {
                const files = await readdir(config.get('filesRoot'));
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({files}));
            }
            if (pathname === '/' || pathname === '/index.html') {
                sendFile(path.join(config.get('publicRoot'), 'index.html'), res);
            } else {
                sendFile(path.join(config.get('filesRoot'), filename), res);
            }
            break;
        case 'POST':
            if (!filename) {
                res.statusCode = 404;
                return res.end('File not found');
            }
            uploadFile(path.join(config.get('filesRoot'), filename), req, res);
            break;
        case 'DELETE':
            if (!filename) {
                res.statusCode = 404;
                return res.end('File not found');
            }
            removeFile(path.join(config.get('filesRoot'), filename), res);
            break;
        default:
            res.statusCode = 502;
            res.end('Not implemented');
    }
}

function sendFile(filepath, res) {
    const stream = fs.createReadStream(filepath);
    stream.pipe(res);

    stream.on('error', (err) => {
        if (err.code === 'ENOENT') {
            res.statusCode = 404;
            res.end('Not found');
        } else {
            res.statusCode = 500;
            res.end('Internal error');
            console.error(err);
        }
    });
    stream.on('open', () => res.setHeader('Content-Type', mime.getType(filepath)));
    res.on('close', () => stream.destroy());
}

async function uploadFile(filepath, req, res) {
    const limitSize = config.get('limitSize');
    if (req.headers.hasOwnProperty('content-length') && req.headers['content-length'] > limitSize) {
        console.log(`${req.headers['content-length']} > ${limitSize}: 1`);
        res.writeHead(413, {'Connection': 'close'});
        return res.end('Payload Too Large');
    }

    const stream = fs.createWriteStream(filepath, {flags: 'wx'});

    req.pipe(stream);
    req.on('abort', () => {
        stream.destroy();
        unlink(filepath).catch((error) => console.error(error));
    });
    req.on('close', () => {
        stream.destroy();
        unlink(filepath).catch((error) => console.error(error));
    });
    req.on('error', () => {
        stream.destroy();
        unlink(filepath).catch((error) => console.error(error));
    });
    let fileSize = 0;
    req.on('data', (buf) => {
        fileSize += buf.length;
        if (fileSize > limitSize) {
            console.log(`${req.headers['content-length']} > ${limitSize}: 2`);
            stream.destroy();
            unlink(filepath).catch((error) => console.error(error));
            res.writeHead(413, {'Connection': 'close'});
            res.end('Payload Too Large');
        }
    });

    stream.on('error', (err) => {
        if (err.code === 'EEXIST') {
            res.statusCode = 409;
            res.end('File exists');
        } else {
            console.error(err);
            res.writeHead(500, {'Connection': 'close'});
            unlink(filepath)
                .catch((error) => console.error(error))
                .finally(() => res.end('Internal error'));
        }
    });
    stream.on('close', () => res.end('ok'));
}

function removeFile(filepath, res) {
    unlink(filepath).then(() => res.end('OK')).catch((err) => {
        if (err.code === 'ENOENT') {
            res.statusCode = 404;
            res.end('Not found');
        } else {
            res.statusCode = 500;
            res.end('Internal error');
            console.error(err);
        }
    });
}
