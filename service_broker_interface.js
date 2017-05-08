var express = require('express'),
    moment = require('moment'),
    ServiceBroker = require('./service_broker'),
    KeyValueStore = require('./key_value_store');

class ServiceBrokerInterface {

    constructor() {
        this.serviceBroker = new ServiceBroker();
        this.keyValueStore = new KeyValueStore();
        this.serviceInstances = {};
        this.lastRequest = {};
        this.lastResponse = {};
    }

    init(callback) {
        // Initialise key value store
        this.keyValueStore.createStore(this.serviceBroker.getStorageKey(), function(success) {
            if (!success) {
                console.error('Error creating key value store; state will not be persistent');
            }
            callback();
        });
    }

    loadData(callback) {
        this.keyValueStore.loadData(function(data) {
            if (!data) {
                console.warn('Could not load state - data will be set to default');
                return;
            }
            this.serviceInstances = data;
        });
    }

    saveData(callback) {
        this.keyValueStore.saveData(this.serviceInstances, function(success) {
            if (!success) {
                console.error('Error saving data to key value store');
            }
        });
    }

    getCatalog(request, response) {
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var data = {
            services: [
                {
                    name: this.serviceBroker.getName(),
                    description: this.serviceBroker.getDescription(),
                    id: this.serviceBroker.getID(),
                    tags: this.serviceBroker.getTags(),
                    bindable: this.serviceBroker.getBindable(),
                    plan_updateable: true,
                    plans: this.serviceBroker.getPlans()
                }
            ]
        };
        response.json(data);
        this.saveRequest(request);
        this.saveResponse(data);
        this.saveData();
    }

    createServiceInstance(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        request.checkBody('organization_guid', 'Missing organization_guid').notEmpty();
        request.checkBody('space_guid', 'Missing space_guid').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceId = request.params.service_id;
        console.log('Creating service %s', serviceId);
        this.serviceInstances[serviceId] = {
            timestamp: moment().toString(),
            api_version: request.header('X-Broker-Api-Version'),
            serviceId: request.body.service_id,
            planId: request.body.plan_id,
            parameters: request.body.parameters,
            accepts_incomplete: request.body.requests_incomplete,
            organization_guid: request.body.organization_guid,
            space_guid: request.body.space_guid,
            context: request.body.context,
            bindings: {},
        };
        response.json({});
        this.saveRequest(request);
        this.saveResponse({});
        this.saveData();
    }

    updateServiceInstance(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceId = request.params.service_id;
        console.log('Updating service %s', serviceId);
        this.serviceInstances[serviceId].api_version = request.header('X-Broker-Api-Version'),
        this.serviceInstances[serviceId].serviceId = request.body.service_id;
        this.serviceInstances[serviceId].plan_id = request.body.plan_id;
        this.serviceInstances[serviceId].parameters = request.body.parameters;
        this.serviceInstances[serviceId].context = request.body.context;
        response.json({});
        this.saveRequest(request);
        this.saveResponse({});
        this.saveData();
    }

    deleteServiceInstance(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkQuery('service_id', 'Missing service_id').notEmpty();
        request.checkQuery('plan_id', 'Missing plan_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceId = request.params.service_id;
        console.log('Deleting service %s', serviceId);
        delete this.serviceInstances[serviceId];
        response.json({});
        this.saveRequest(request);
        this.saveResponse({});
        this.saveData();
    }

    createServiceBinding(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceId = request.params.service_id;
        var bindingID = request.params.binding_id;
        console.log('Creating service binding %s for service %s', serviceId, bindingID);
        this.serviceInstances[serviceId]['bindings'][bindingID] = {
            api_version: request.header('X-Broker-Api-Version'),
            service_id: request.body.service_id,
            plan_id: request.body.plan_id,
            app_guid: request.body.app_guid,
            bind_resource: request.body.bind_resource,
            parameters: request.body.parameters
        };
        response.json({});
        this.saveRequest(request);
        this.saveResponse({});
        this.saveData();
    }

    deleteServiceBinding(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceId = request.params.service_id;
        var bindingID = request.params.binding_id;
        console.log('Deleting service binding %s for service %s', serviceId, bindingID);
        try {
            delete this.serviceInstances[serviceId]['bindings'][bindingID];
        }
        catch (e) {
            // We must have lost this state
        }
        response.json({});
        this.saveRequest(request);
        this.saveResponse({});
        this.saveData();
    }

    showDashboard(request, response) {
        var data = {
            title: 'Service Broker Overview',
            status: 'running',
            api_version: request.header('X-Broker-Api-Version'),
            serviceInstances: this.serviceInstances,
            lastRequest: this.lastRequest,
            lastResponse: this.lastResponse
        };
        response.render('dashboard', data);
    }

    saveRequest(request) {
        this.lastRequest = {
            url: request.url,
            method: request.method,
            body: request.body
        };
    }

    saveResponse(data) {
        this.lastResponse = data;
    }

}

module.exports = ServiceBrokerInterface;
