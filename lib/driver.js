"use strict";

// The IP driver works by connecting to a port and checking which error response one gets.
// We have to assume a port is closed, this assumption is corrected if a device appears to have the port open anyway.

// https://www.tutorialspoint.com/nodejs/nodejs_net_module.htm

const Homey = require('homey');

module.exports = class ConnectivityDriver extends Homey.Driver
{
    async onInit()
    {
        this.deviceStateChangedTrigger = this.homey.flow.getDeviceTriggerCard('device_state_changed');
    }

    deviceCameOnline(device)
    {
        let tokens = {
            value: true
        };
        this.deviceStateChangedTrigger
            .trigger(device, tokens)
            .catch(this.error);
    }

    deviceWentOffline(device)
    {
        let tokens = {
            value: true
        };
        this.deviceStateChangedTrigger
            .trigger(device, tokens)
            .catch(this.error);
    }

    // the `pair` method is called when a user start pairing
    async onPairListDevices()
    {
        this.homey.app.updateLog("Pairing started");
    }

}
