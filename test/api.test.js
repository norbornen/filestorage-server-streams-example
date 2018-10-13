const {describe, it, before, after} = require('mocha');
const chai = require('chai');
const chaiHttp = require('chai-http');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const crypto = require('crypto');
const server = require('../lib/server');

const readFile = promisify(fs.readFile);
const should = chai.should();
chai.use(chaiHttp);

describe('API', async () => {
    before((done) => {
        server.listen(3031, (err) => {
            if (err) {
                throw err;
            }
            done();
        }).on('error', (err) => {
            throw err;
        });
    });
    after(() => server.close());

    it('favicon.ico', async () => {
        let res = await chai.request(server).get('/favicon.ico');
        await res.should.have.status(204);
        await res.body.should.be.empty;
    });
    it('index.html', async () => {
        const content = await readFile(path.join(__dirname, '../public/index.html'), {encoding: 'utf-8'});
        let res = await chai.request(server).get('/');
        await res.should.have.status(200);
        await res.text.should.be.eql(content);
    });
    it('NOT EXISTS PATH', async () => {
        let res = await chai.request(server).get('/test');
        await res.should.have.status(404);
        res = await chai.request(server).put('/test');
        await res.should.have.status(502);
    });
    it('UPLOAD', async () => {
        // res = await chai.request(server).post('/___test.txt').type('form')
        //         .send(crypto.randomBytes(1024*100).toString('hex'));
        // await res.should.have.status(413);
        let res = await chai.request(server).post('/___test.txt').type('form')
            .send(crypto.randomBytes(1024*40).toString('hex'));
        await res.should.have.status(200);
    });
    it('GET', async () => {
        let res = await chai.request(server).get('/../a.txt');
        await res.should.have.status(404);
        res = await chai.request(server).get('/___test.txt');
        await res.should.have.status(200);
        const content = await readFile(path.join(__dirname, '../files/___test.txt'), {encoding: 'utf-8'});
        await res.text.should.be.eql(content);
    });
    it('DELETE', async () => {
        let res = await chai.request(server).delete('/___.txt');
        await res.should.have.status(404);
        res = await chai.request(server).delete('/___test.txt');
        await res.should.have.status(200);
    });
    it('NOT EXISTS PATH 2', async () => {
        let res = await chai.request(server).get('/___test.txt');
        await res.should.have.status(404);
    });

});

