// Load modules

var Code = require('code');
var Hapi = require('hapi');
var Lab = require('lab');
var Nes = require('../');
var Ws = require('ws');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Socket', function () {

    describe('send()', function () {

        it('errors on invalid message', function (done) {

            var server = new Hapi.Server();
            var client;
            server.connection();
            server.register({ register: Nes, options: { auth: false } }, function (err) {

                expect(err).to.not.exist();

                server.on('log', function (event, tags) {

                    expect(event.data).to.equal('other');
                    client.disconnect();
                    server.stop(done);
                });

                server.start(function (err) {

                    client = new Nes.Client('http://localhost:' + server.info.port);
                    client.connect(function (err) {

                        expect(err).to.not.exist();
                        var a = { b: 1 };
                        a.c = a;                    // Circular reference

                        server.connections[0].plugins.nes._listener._sockets[0]._send(a, { id: 1, type: 'other' });
                    });
                });
            });
        });
    });

    describe('onMessage()', function () {

        it('supports route id', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { auth: false } }, function (err) {

                expect(err).to.not.exist();

                server.route({
                    method: 'GET',
                    path: '/',
                    config: {
                        id: 'resource',
                        handler: function (request, reply) {

                            return reply('hello');
                        }
                    }
                });

                server.start(function (err) {

                    var client = new Nes.Client('http://localhost:' + server.info.port);
                    client.connect(function () {

                        client.request('resource', function (err, payload, statusCode, headers) {

                            expect(err).to.not.exist();
                            expect(payload).to.equal('hello');
                            expect(statusCode).to.equal(200);
                            expect(headers).to.contain({ 'content-type': 'text/html; charset=utf-8' });

                            client.disconnect();
                            server.stop(done);
                        });
                    });
                });
            });
        });

        it('errors on unknown route id', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { auth: false } }, function (err) {

                expect(err).to.not.exist();

                server.route({
                    method: 'GET',
                    path: '/',
                    config: {
                        id: 'resource',
                        handler: function (request, reply) {

                            return reply('hello');
                        }
                    }
                });

                server.start(function (err) {

                    var client = new Nes.Client('http://localhost:' + server.info.port);
                    client.connect(function () {

                        client.request('something', function (err, payload, statusCode, headers) {

                            expect(err).to.exist();
                            expect(statusCode).to.equal(404);

                            client.disconnect();
                            server.stop(done);
                        });
                    });
                });
            });
        });

        it('errors on wildcard method route id', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { auth: false } }, function (err) {

                expect(err).to.not.exist();

                server.route({
                    method: '*',
                    path: '/',
                    config: {
                        id: 'resource',
                        handler: function (request, reply) {

                            return reply('hello');
                        }
                    }
                });

                server.start(function (err) {

                    var client = new Nes.Client('http://localhost:' + server.info.port);
                    client.connect(function () {

                        client.request('resource', function (err, payload, statusCode, headers) {

                            expect(err).to.exist();
                            expect(statusCode).to.equal(400);

                            client.disconnect();
                            server.stop(done);
                        });
                    });
                });
            });
        });

        it('errors on invalid request message', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { auth: false } }, function (err) {

                expect(err).to.not.exist();

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply('hello');
                    }
                });

                server.start(function (err) {

                    var client = new Ws('http://localhost:' + server.info.port);

                    client.on('message', function (data, flags) {

                        var message = JSON.parse(data);
                        expect(message.payload).to.deep.equal({
                            statusCode: 400,
                            error: 'Bad Request',
                            message: 'Cannot parse message'
                        });

                        expect(message.statusCode).to.equal(400);

                        client.close();
                        server.stop(done);
                    });

                    client.on('open', function () {

                        client.send('{', function (err) {

                            expect(err).to.not.exist();
                        });
                    });
                });
            });
        });

        it('errors on auth endpoint request', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { auth: { password: 'password' } } }, function (err) {

                expect(err).to.not.exist();

                server.start(function (err) {

                    var client = new Nes.Client('http://localhost:' + server.info.port);
                    client.connect(function (err) {

                        expect(err).to.not.exist();
                        client.request('/nes/auth', function (err, payload, statusCode, headers) {

                            expect(statusCode).to.equal(404);
                            client.disconnect();
                            server.stop(done);
                        });
                    });
                });
            });
        });

        it('errors on missing id', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { auth: false } }, function (err) {

                expect(err).to.not.exist();

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply('hello');
                    }
                });

                server.start(function (err) {

                    var client = new Ws('http://localhost:' + server.info.port);

                    client.on('message', function (data, flags) {

                        var message = JSON.parse(data);
                        expect(message.payload).to.deep.equal({
                            statusCode: 400,
                            error: 'Bad Request',
                            message: 'Message missing id'
                        });

                        expect(message.statusCode).to.equal(400);
                        expect(message.type).to.equal('response');

                        client.close();
                        server.stop(done);
                    });

                    client.on('open', function () {

                        client.send(JSON.stringify({ type: 'request', method: 'GET', path: '/' }), function (err) {

                            expect(err).to.not.exist();
                        });
                    });
                });
            });
        });

        it('errors on uninitialized connection', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { auth: false } }, function (err) {

                expect(err).to.not.exist();

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply('hello');
                    }
                });

                server.start(function (err) {

                    var client = new Ws('http://localhost:' + server.info.port);

                    client.on('message', function (data, flags) {

                        var message = JSON.parse(data);
                        expect(message.error).to.equal('Connection is not initialized');

                        client.close();
                        server.stop(done);
                    });

                    client.on('open', function () {

                        client.send(JSON.stringify({ id: 1, type: 'request', path: '/' }), function (err) {

                            expect(err).to.not.exist();
                        });
                    });
                });
            });
        });

        it('errors on missing method', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { auth: false } }, function (err) {

                expect(err).to.not.exist();

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply('hello');
                    }
                });

                server.start(function (err) {

                    var client = new Ws('http://localhost:' + server.info.port);

                    client.on('message', function (data, flags) {

                        var message = JSON.parse(data);
                        if (message.id !== 2) {
                            return;
                        }

                        expect(message.payload).to.deep.equal({
                            statusCode: 400,
                            error: 'Bad Request',
                            message: 'Message missing method'
                        });

                        expect(message.statusCode).to.equal(400);
                        expect(message.type).to.equal('response');

                        client.close();
                        server.stop(done);
                    });

                    client.on('open', function () {

                        client.send(JSON.stringify({ id: 1, type: 'hello' }), function (err) {

                            expect(err).to.not.exist();
                            client.send(JSON.stringify({ id: 2, type: 'request', path: '/' }), function (err) {

                                expect(err).to.not.exist();
                            });
                        });
                    });
                });
            });
        });

        it('errors on missing path', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { auth: false } }, function (err) {

                expect(err).to.not.exist();

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply('hello');
                    }
                });

                server.start(function (err) {

                    var client = new Ws('http://localhost:' + server.info.port);

                    client.on('message', function (data, flags) {

                        var message = JSON.parse(data);
                        if (message.id !== 2) {
                            return;
                        }

                        expect(message.payload).to.deep.equal({
                            statusCode: 400,
                            error: 'Bad Request',
                            message: 'Message missing path'
                        });

                        expect(message.statusCode).to.equal(400);
                        expect(message.type).to.equal('response');

                        client.close();
                        server.stop(done);
                    });

                    client.on('open', function () {

                        client.send(JSON.stringify({ id: 1, type: 'hello' }), function (err) {

                            expect(err).to.not.exist();
                            client.send(JSON.stringify({ id: 2, type: 'request', method: 'GET' }), function (err) {

                                expect(err).to.not.exist();
                            });
                        });
                    });
                });
            });
        });

        it('errors on unknown type', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { auth: false } }, function (err) {

                expect(err).to.not.exist();

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply('hello');
                    }
                });

                server.start(function (err) {

                    var client = new Ws('http://localhost:' + server.info.port);

                    client.on('message', function (data, flags) {

                        var message = JSON.parse(data);
                        if (message.id !== 2) {
                            return;
                        }

                        expect(message.payload).to.deep.equal({
                            statusCode: 400,
                            error: 'Bad Request',
                            message: 'Unknown message type'
                        });

                        expect(message.statusCode).to.equal(400);
                        expect(message.type).to.equal('response');

                        client.close();
                        server.stop(done);
                    });

                    client.on('open', function () {

                        client.send(JSON.stringify({ id: 1, type: 'hello' }), function (err) {

                            expect(err).to.not.exist();
                            client.send(JSON.stringify({ id: 2, type: 'unknown' }), function (err) {

                                expect(err).to.not.exist();
                            });
                        });
                    });
                });
            });
        });
    });

    describe('_processMessage()', function () {

        it('calls onMessage callback', function (done) {

            var onMessage = function (socket, message, reply) {

                expect(message).to.equal('winning');
                reply('hello');
            };

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { onMessage: onMessage } }, function (err) {

                expect(err).to.not.exist();

                server.start(function (err) {

                    var client = new Nes.Client('http://localhost:' + server.info.port);
                    client.connect(function () {

                        client.message('winning', function (err, response) {

                            expect(err).to.not.exist();
                            expect(response).to.equal('hello');
                            client.disconnect();
                            server.stop(done);
                        });
                    });
                });
            });
        });

        it('it sends errors from callback', function (done) {

            var client;

            var onMessage = function (socket, message, reply) {

                expect(message).to.equal('winning');
                reply(new Error('failed'));
            };

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: { onMessage: onMessage } }, function (err) {

                expect(err).to.not.exist();

                server.start(function (err) {

                    client = new Nes.Client('http://localhost:' + server.info.port);
                    client.connect(function () {

                        client.message('winning', function (err, response) {

                            expect(err).to.exist();
                            expect(err.message).to.equal('failed');
                            expect(response).to.not.exist();
                            client.disconnect();
                            server.stop(done);
                        });
                    });
                });
            });
        });

        it('errors if missing onMessage callback', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Nes, options: {} }, function (err) {

                expect(err).to.not.exist();

                server.start(function (err) {

                    var client = new Nes.Client('http://localhost:' + server.info.port);
                    client.connect(function () {

                        client.message('winning', function (err, response) {

                            expect(err).to.exist();
                            expect(err.message).to.equal('Custom messages are not supported');

                            client.disconnect();
                            server.stop(done);
                        });
                    });
                });
            });
        });
    });
});
