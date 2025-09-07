"use strict";

// The IP driver works by connecting to a port and checking which error response one gets.
// We have to assume a port is closed, this assumption is corrected if a device appears to have the port open anyway.

// https://www.tutorialspoint.com/nodejs/nodejs_net_module.htm

const Homey = require('homey');

module.exports = class ConnectivityDriver extends Homey.Driver {
    async onInit() {
        this.deviceStateChangedTrigger = this.homey.flow.getDeviceTriggerCard('device_state_changed');

        // the ones below are deprecated
        this.device_came_online_trigger = this.homey.flow.getDeviceTriggerCard('device_came_online');
        this.device_went_offline_trigger = this.homey.flow.getDeviceTriggerCard('device_went_offline');
        this.device_changed_state_trigger = this.homey.flow.getDeviceTriggerCard('device_change');
        this.ip_device_came_online_trigger = this.homey.flow.getDeviceTriggerCard('ip_device_came_online');
        this.ip_device_went_offline_trigger = this.homey.flow.getDeviceTriggerCard('ip_device_went_offline');
        this.ip_device_changed_state_trigger = this.homey.flow.getDeviceTriggerCard('ip_device_change');
    }

    deviceCameOnline(device) {
        let tokens = { value: true };
        this.deviceStateChangedTrigger.trigger(device, tokens).catch(this.error);

        // deprecated
        if (device.driver.id === "ip_driver") {
            this.ip_device_came_online_trigger.trigger(device).catch(this.error);
            this.ip_device_changed_state_trigger.trigger(device, tokens).catch(this.error);
        } else {
            this.device_came_online_trigger.trigger(device).catch(this.error);
            this.device_changed_state_trigger.trigger(device, tokens).catch(this.error);
        }
    }

    deviceWentOffline(device) {
        let tokens = { value: false };
        this.deviceStateChangedTrigger.trigger(device, tokens).catch(this.error);

        // deprecated
        if (device.driver.id === "ip_driver") {
            this.ip_device_went_offline_trigger.trigger(device).catch(this.error);
            this.ip_device_changed_state_trigger.trigger(device, tokens).catch(this.error);
        } else {
            this.device_went_offline_trigger.trigger(device).catch(this.error);
            this.device_changed_state_trigger.trigger(device, tokens).catch(this.error);
        }
    }

    // the `pair` method is called when a user start pairing
    async onPairListDevices() {
        this.homey.app.updateLog("Pairing started");
    }
}
