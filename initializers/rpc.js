'use strict';

const Client = require('yarpc').Client;
const uuid   = require('node-uuid');

module.exports = {
    loadPriority:  101,
    startPriority: 101,

    _clients: {},
    _clientsResolvers: {},

    _getHandler: function(api, service, method) {
        return data => {
            let description = `${service.name}.${method}()`;
            let logger = service.logs === false ?
                {notice: () => {}, emerg: () => {}}
                : api.logger;

            logger.notice(`RPC call - ${description}`);

            return this._clients[ service.name ]
            .then(client => client.call(method, data))
            .then(response => {
                if (response.status === 1) {
                    logger.notice(`RPC response of ${description} - OK`);

                    return response.data;
                }

                if (response.status === 0 && response.error) {
                    logger.notice(`RPC response of ${description} - ERROR`, response.error);
                    throw new api.Error(response.error);
                }

                logger.emerg(`RPC response of ${description} - FAIL`, response);
                throw response.error || response;
            });
        };
    },

    _getQueueName: function() {
        return Object.keys(arguments)
        .map(key => arguments[key])
        .filter(value => !!value)
        .join(':');
    },

    initialize: function(api, next) {
        let config   = api.config.rpc;
        let services = Object.keys(config.services).map(service => Object.assign(
            {name: service},
            config.services[service]
        ));

        services.forEach(service => {
            let promise = new Promise(resolve => {
                this._clientsResolvers[ service.name ] = resolve;
            });

            this._clients[ service.name ] = promise;
        });

        let rpc = {};

        services.forEach(service => {
            let methods = {};

            service.methods.forEach(method => {
                methods[ method ] = this._getHandler(api, service, method);
            });

            rpc[ service.name ] = methods;
        });

        api.rpc = rpc;

        next();
    },
    start: function(api, next) {
        let config   = api.config.rpc;
        let services = Object.keys(config.services).map(service => Object.assign(
            {name: service},
            config.services[service]
        ));

        let promises = services.map(service => {
            let inputQueue = Object.assign(
                {name: this._getQueueName(service.name, config.namespace, 'input')},
                {durable: true, autoDelete: false},
                service.inputQueue
            );

            let outputQueue = Object.assign(
                {name: this._getQueueName(service.name, config.namespace, 'output', uuid.v1())},
                {durable: false, autoDelete: true},
                service.outputQueue
            );

            return Client.init({
                url:         api.config.rabbitmq.url,
                inputQueue:  inputQueue,
                outputQueue: outputQueue
            })
            .then(client => this._clientsResolvers[ service.name ](client));
        });

        Promise.all(promises)
            .then(() => next())
            .catch(error => next(error));
    },
    stop: (api, next) => {
        next();
    }
};
