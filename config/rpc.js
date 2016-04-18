'use strict';

const services = {
    Notifier: {
        methods: [ 'sendNotification' ]
    },
    Logger: {
        methods: ['createLog'],
        logs: false
    }
};


exports.default = {
    rpc: api => {
        return {
            services: services,
            namespace: ''
        };
    }
};

exports.test = {
    rpc: api => {
        return {
            services: services,
            namespace: 'test'
        };
    }
};

exports.production = {
    rpc: api => {
        return {};
    }
};
