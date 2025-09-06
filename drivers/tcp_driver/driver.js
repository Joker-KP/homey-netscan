"use strict";

const Homey = require('homey');
var net = require("net");

// the `init` method is called when your driver is loaded for the first time
class tcpDriver extends Homey.Driver
{
    async onInit()
    {
        console.info("Booting TCP driver");
        this.device_changed_state_trigger = this.homey.flow.getDeviceTriggerCard('device_state_changed');
    }

    device_came_online(device)
    {
        let tokens = {
            value: true
        };
        this.device_changed_state_trigger
            .trigger(device, tokens)
            .catch(this.error);
    }

    device_went_offline(device)
    {
        let tokens = {
            value: true
        };
        this.device_changed_state_trigger
            .trigger(device, tokens)
            .catch(this.error);
    }

    // the `pair` method is called when a user start pairing
    async onPairListDevices()
    {
        this.homey.app.updateLog("Pairing started");

    }

}
module.exports = tcpDriver;