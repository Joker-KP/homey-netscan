/*jslint node: true */
'use strict';

const Homey = require('homey');
var net = require("net");

class TcpIpDevice extends Homey.Device {
    async onInit() {
        this.fixCapabilities();
        this.initVariables();

        const fewSeconds = 2
        const startupDelay = this.withJitter(fewSeconds * 1000)
        this.timer = this.homey.setTimeout(this.periodicAction, startupDelay);
    }

    fixCapabilities() {
        if (this.hasCapability('ip_present')) {
            this.removeCapability('ip_present');
        }
        if (this.hasCapability('alarm_offline')) {
            this.removeCapability('alarm_offline');
        }
        if (!this.hasCapability('alarm_connectivity')) {
            this.addCapability('alarm_connectivity');
        }
        if (this.getCapabilityValue('alarm_connectivity') === null) {
            this.setCapabilityValue('alarm_connectivity', true).catch(this.error);
        }
        if (!this.hasCapability('onoff')) {
            this.addCapability('onoff');
            this.setCapabilityValue('onoff', !this.getCapabilityValue('alarm_connectivity'));
        }
    }

    initVariables() {
        let options = this.getCapabilityOptions('onoff');
        options.setable = false;
        options.getable = true;
        options.preventInsights = true;
        options.uiComponent = null;
        this.setCapabilityOptions('onoff', options);

        this.unreachableCount = 0;
        this.timer = null;

        this.wasOnline = !this.getCapabilityValue('alarm_connectivity');

        this.host = this.getSetting('host');
        this.port = this.getSetting('tcp_port');
        this.actionInterval = this.getSetting('host_check_interval');
        this.hostTimeout = this.getSetting('host_timeout');
        this.maxUnreachableAttempts = this.getSetting('host_unreachable_checks');
    }

    devicceName() {
        return this.getName() + " - " + this.host + (this.hasPortDefined() ? (": " + this.port) : "")
    }

    hasPortDefined() {
        return this.getSetting('tcp_port') !== null
    }

    allAttemptsExhuusted() {
        return this.unreachableCount > this.maxUnreachableAttempts;
    }

    // to avoid hammering many devices at once
    withJitter(baseValue, jitterFraction = 0.1) {
        const jitter = baseValue * jitterFraction;
        // random between -jitter and +jitter
        const delta = (Math.random() * 2 - 1) * jitter;
        return Math.max(0, Math.round(baseValue + delta));
    }

    cleanTimer() {
        if (this.timer) {
            this.homey.clearTimeout(this.timer);
            this.timer = null;
        }
    }

    tcpPing(host, port, timeoutSec = 3) {
        return new Promise((resolve) => {
            const start = Date.now();
            const socket = new net.Socket();

            const done = (alive, reason) => {
                try { socket.destroy(); } catch (_) { }
                resolve({ online: alive, time: alive ? Date.now() - start : null, reason });
            };
            socket.setTimeout(timeoutSec * 1000);

            socket.once('connect', () => done(true, 'connected'));
            // socket.on('data', (data) => {/* consume all incoming data to prevent memory leaks */});
            // socket.once('close', () => done(true, 'close'));
            socket.once('timeout', () => done(false, 'timeout'));
            socket.once('error', (error) => {
                if (error && error.code) {
                    if (error.code == "ECONNREFUSED") {
                        done(false, 'refused')
                    } else if (error.code == "EHOSTUNREACH") {
                        done(false, 'unreach')
                    } else if (error.code == "ENOTFOUND") {
                        done(false, 'notfound')
                    } else if (error.code == "EALREADY") {
                        done(true, 'ready')
                    } else {
                        done(false, 'uknown code: ' + error.code)
                    }
                }
                else {
                    done(false, 'uknown error: ' + this.homey.app.varToString(error))
                }
            });

            socket.connect(port, host);
        });
    }

    processPingResult(res) {
        let isOnline = res.online

        if (res.reason === "refused" && !this.hasPortDefined()) {
            isOnline = true;  // this is expected behaviour for devices without any open port
        }
        if (res.reason === "timeout") {
            this.homey.app.updateLog(`Device Timeout ${this.devicceName()}`);
        }
        if (res.reason.startsWith("uknown code") || res.reason.startsWith("uknown error")) {
            this.homey.app.updateLog(`Response with ${res.reason} (device ${this.devicceName()} )`)
        }

        if (isOnline) {
            this.handleOnline();
        } else {
            this.completeAnotherAttempt();
        }
    }

    periodicAction = async () => {
        const prefix = this.hasPortDefined() ? "IP" : "TCP";
        this.homey.app.updateLog(`Checking ${prefix} device ${this.devicceName()}`);

        const default_port = 1
        const res = await this.tcpPing(this.host, this.port || default_port, this.hostTimeout);
        this.processPingResult(res)

        let delay = this.withJitter(this.actionInterval * 1000)
        this.timer = this.homey.setTimeout(this.periodicAction, delay);
    }

    completeAnotherAttempt() {
        if (this.allAttemptsExhuusted()) {
            this.handleOffline();
        }
        else {
            let leftCounter = this.maxUnreachableAttempts - this.unreachableCount + 1
            this.homey.app.updateLog(`${this.devicceName()} offline postponed for ${leftCounter} more checks`);
            this.unreachableCount++;
        }
    }

    handleAvaiabilityChange(isOnline) {
        let state = isOnline ? "Online" : "Offline"

        if ((this.wasOnline === null) || this.wasOnline != isOnline) {
            this.homey.app.updateLog(`**** Device is now ${state} ${this.devicceName()}`);
            this.setCapabilityValue('alarm_connectivity', !isOnline);
            this.setCapabilityValue('onoff', isOnline);
            this.wasOnline = isOnline;

            // trigger the action
            if (isOnline)
                this.driver.device_came_online(this);
            else
                this.driver.device_went_offline(this);
        }
        else {
            this.homey.app.updateLog(`Device still ${state} ${this.devicceName()}`);
        }
    }

    handleOnline() {
        this.unreachableCount = 0
        this.handleAvaiabilityChange(true);
    }

    handleOffline() {
        this.handleAvaiabilityChange(false);
    }

    // the `added` method is called is when pairing is done and a device has been added
    async onAdded() { }

    // the `delete` method is called when a device has been deleted by a user
    async onDeleted() {
        this.host = null;
        this.cleanTimer();
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        if (changedKeys.indexOf("host") >= 0) {
            this.host = newSettings.host;
        }

        if (changedKeys.indexOf("tcp_port") >= 0) {
            this.port = newSettings.tcp_port;
        }

        if (changedKeys.indexOf("host_check_interval") >= 0) {
            this.actionInterval = parseInt(this.actionInterval);
        }

        if (changedKeys.indexOf("host_timeout") >= 0) {
            this.hostTimeout = parseInt(this.hostTimeout);
        }

        if (changedKeys.indexOf("host_unreachable_checks") >= 0) {
            this.maxUnreachableAttempts = parseInt(newSettings.host_unreachable_checks);
        }

        if (this.timer) {
            // cancel next planned action and start the scan immediately
            this.cleanTimer();
            this.periodicAction();
        }
    }

    async slowDown() {
        this.actionInterval *= 2;
        this.homey.app.updateLog(`Device slow down ${this.actionInterval}`);
    }

}
module.exports = TcpIpDevice;