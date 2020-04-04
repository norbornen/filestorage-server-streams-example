/* eslint-disable indent */
// @ts-check
'use strict';

const http = require('http');
const path = require('path');
const url = require('url');
const { createReadStream, createWriteStream, constants: fsConstants, promises: fsPromises } = require('fs');
const mime = require('mime');
const config = require('config');
const HttpError = require('./helper/http_error');

(async () => {
    try {
        await fsPromises.access(config.get('filesRoot'), fsConstants.R_OK)
            .catch(() => fsPromises.mkdir(config.get('filesRoot')));
    } catch (err) {
        console.log(err);
    }
})();

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function requestHandler(req, res) {
    try {
        const pathname = path.normalize(decodeURI(url.parse(req.url).pathname));
        const filename = pathname.slice(1);

        switch (req.method) {
            case 'GET':
                if (pathname === '/favicon.ico') {
                    res.writeHead(204, { 'Content-Type': 'image/x-icon' });
                    return res.end();
                } else if (pathname === '/list') {
                    await sendStorageIndex(res);
                } else if (pathname === '/' || pathname === '/index.html') {
                    await sendPublicFile(res, 'index.html');
                } else {
                    await sendStorageFile(res, filename);
                }
                break;
            case 'POST':
                if (!filename) {
                    throw new HttpError('File not found', 404);
                }
                await uploadFile(req, res, path.join(config.get('filesRoot'), filename));
                break;
            case 'DELETE':
                if (!filename) {
                    throw new HttpError('File not found', 404);
                }
                await removeFile(res, path.join(config.get('filesRoot'), filename));
                break;
            default:
                res.statusCode = 502;
                res.end('Not implemented');
        }
    } catch (err) {
        res.writeHead(err.code || 500, { 'Connection': 'close' });
        res.end(err.message || 'Internal error');
    }
}

/**
 * @param {http.ServerResponse} res
 */
async function sendStorageIndex(res) {
    const files = await fsPromises.readdir(config.get('filesRoot'));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ files }));
}

/**
 * @param {http.ServerResponse} res
 * @param {string} filename
 */
async function sendPublicFile(res, filename) {
    const filepath = path.join(config.get('publicRoot'), filename);
    return sendFile(res, filepath);
}

/**
 * @param {http.ServerResponse} res
 * @param {string} filename
 */
async function sendStorageFile(res, filename) {
    const filepath = path.join(config.get('filesRoot'), filename);
    return sendFile(res, filepath);
}

/**
 * @param {http.ServerResponse} res
 * @param {string} filepath
 */
async function sendFile(res, filepath) {
    return new Promise((resolve, reject) => {
        const mimeType = mime.getType(filepath);

        const stream = createReadStream(filepath);
        stream.pipe(res);

        stream.on('open', () => res.setHeader('Content-Type', mimeType))
        .on('error', (err) => {
            if (err.code === 'ENOENT') {
                reject(new HttpError('Not found', 404));
            } else {
                console.error(err);
                reject(new HttpError('Internal error'));
            }
        })
        .on('finish', resolve);

        res.on('close', () => stream.destroy());
    });
}

/**
 * @param {http.ServerResponse} res
 * @param {http.IncomingMessage} req
 * @param {string} filepath
 */
async function uploadFile(req, res, filepath) {
    return new Promise((resolve, reject) => {
        const limitSize = config.get('limitSize');

        if (req.headers.hasOwnProperty('content-length') && req.headers['content-length'] > limitSize) {
            console.log(`${req.headers['content-length']} > ${limitSize}: 1`);
            return reject(new HttpError('Payload Too Large', 413));
        }

        const stream = createWriteStream(filepath, { flags: 'wx' });
        stream.on('error', (err) => {
            if (err.code === 'EEXIST') {
                reject(new HttpError('File exists', 409));
            } else {
                console.error('stream error ', err);
                reject(new HttpError('Internal error'));
            }
        });
        stream.on('close', resolve);

        req.pipe(stream);
        let fileSize = 0;
        const stopFn = () => {
            stream.destroy();
            reject(new HttpError('Internal error'));
        };
        req.on('abort', stopFn).on('close', stopFn).on('error', stopFn)
        .on('data', (buf) => {
            fileSize += buf.length;
            if (fileSize > limitSize) {
                console.log(`${req.headers['content-length']} > ${limitSize}: 2`);
                reject(new HttpError('Payload Too Large', 413));
                stream.destroy();
            }
        });
    })
    .then(() => res.end('ok'))
    .catch(async (/** @type {HttpError} */ err) => {
        console.error(`upload error `, err);

        if (err.code !== 409) {
            try {
                await fsPromises.access(filepath, fsConstants.F_OK).then(() => fsPromises.unlink(filepath));
            } catch (err) {
                console.error(`unlink error `, err);
            }
        }

        throw err;
    });
}

/**
 * @param {http.ServerResponse} res
 * @param {string} filepath
 */
async function removeFile(res, filepath) {
    try {
        await fsPromises.unlink(filepath);
        res.end('OK');
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.statusCode = 404;
            res.end('Not found');
        } else {
            console.error(err);
            res.statusCode = 500;
            res.end('Internal error');
        }
    }
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => requestHandler(req, res);
