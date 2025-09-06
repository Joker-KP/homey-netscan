/*jslint node: true */
'use strict';

const Homey = require('homey');
const utils = require('./utils')
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
        if (this.hasCapability('ip_present'))
            this.removeCapability('ip_present');
        if (this.hasCapability('alarm_offline'))
            this.removeCapability('alarm_offline');
        if (!this.hasCapability('alarm_connectivity'))
            this.addCapability('alarm_connectivity');
        if (this.getCapabilityValue('alarm_connectivity') === null)
            this.setCapabilityValue('alarm_connectivity', true).catch(this.error);
        if (!this.hasCapability('onoff')) {
            this.addCapability('onoff');
            const value = !this.getCapabilityValue('alarm_connectivity')
            this.setCapabilityValue('onoff', value).catch(this.error);
        }
        let options = this.getCapabilityOptions('onoff');
        options.setable = false;
        options.getable = true;
        options.preventInsights = true;
        options.uiComponent = null;
        this.setCapabilityOptions('onoff', options).catch(this.error);
    }

    initVariables() {
        this.unreachableCount = 0;
        this.timer = null;
        this.wasOnline = !this.getCapabilityValue('alarm_connectivity');
        this.host = this.getSetting('host');
        this.port = this.getSetting('tcp_port');
        this.actionInterval = this.getSetting('host_check_interval');
        this.hostTimeout = this.getSetting('host_timeout');
        this.maxUnreachableAttempts = this.getSetting('host_unreachable_checks');

        // guards for critical settings
        if (!this.host || typeof this.host !== 'string' || this.host.trim() === '') {
            this.homey.app.updateLog(`Invalid host setting for device ${this.getName()}`, 0);
            this.host = '0.0.0.0'; // fallback
        }
        if (this.port !== null && (typeof this.port !== 'number' || this.port < 1 || this.port > 65535)) {
            this.homey.app.updateLog(`Invalid port setting for device ${this.getName()}`, 0);
            this.port = null;
        }
        if (typeof this.actionInterval !== 'number' || this.actionInterval < 5) {
            this.actionInterval = 15; // default
        }
        if (typeof this.hostTimeout !== 'number' || this.hostTimeout < 2) {
            this.hostTimeout = 10; // default
        }
        if (typeof this.maxUnreachableAttempts !== 'number' || this.maxUnreachableAttempts < 1) {
            this.maxUnreachableAttempts = 1; // default
        }
    }

    deviceName() {
        return this.getName() + " - " + this.host + (this.hasValidPort() ? (": " + this.port) : "")
    }

    hasValidPort() {
        return this.port !== null
    }

    allAttemptsExhausted() {
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
            const map = { ECONNREFUSED: 'refused', EHOSTUNREACH: 'unreach', ENOTFOUND: 'notfound', EALREADY: 'ready' };

            const done = (alive, reason) => {
                try { socket.destroy(); } catch (_) { }
                resolve({ online: alive, time: alive ? Date.now() - start : null, reason });
            };
            socket.setTimeout(timeoutSec * 1000);

            // use only "once", skip on(data) and on(connect) -> limit resources
            socket.once('connect', () => done(true, 'connected'));
            socket.once('timeout', () => done(false, 'timeout'));
            socket.once('error', (error) => {
                const reason = error?.code
                    ? (map[error.code] || `unknown code: ${error.code}`)
                    : `unknown error: ${utils.varToString(error)}`;
                // EALREADY => treat as online
                done(reason === 'ready', reason);
            });

            socket.connect(port, host);
        });
    }

    processPingResult(res) {
        let isOnline = res.online
        if (res.reason === "refused" && !this.hasValidPort())
            isOnline = true;  // this is expected behaviour for devices without any open port
        if (res.reason === "timeout")
            this.homey.app.updateLog(`Device Timeout ${this.deviceName()}`);
        if (res.reason.startsWith("unknown code") || res.reason.startsWith("unknown error"))
            this.homey.app.updateLog(`Response with ${res.reason} (device ${this.deviceName()} )`)
        if (isOnline)
            this.handleOnline();
        else
            this.completeAnotherAttempt();
    }

    periodicAction = async () => {
        if (!this.host || this.host === '0.0.0.0') {
            this.homey.app.updateLog(`Skipping check for device ${this.getName()}: invalid host`, 0);
            return;
        }
        const prefix = this.hasValidPort() ? "IP" : "TCP";
        this.homey.app.updateLog(`Checking ${prefix} device ${this.deviceName()}`);

        const defaultPort = 1
        const res = await this.tcpPing(this.host, this.port || defaultPort, this.hostTimeout);
        this.processPingResult(res)

        let delay = this.withJitter(this.actionInterval * 1000)
        this.timer = this.homey.setTimeout(this.periodicAction, delay);
    }

    completeAnotherAttempt() {
        if (this.allAttemptsExhausted()) {
            this.handleOffline();
        }
        else {
            let leftCounter = this.maxUnreachableAttempts - this.unreachableCount + 1
            this.homey.app.updateLog(`${this.deviceName()} offline postponed for ${leftCounter} more checks`);
            this.unreachableCount++;
        }
    }

    handleAvaiabilityChange(isOnline) {
        let state = isOnline ? "Online" : "Offline"

        if ((this.wasOnline === null) || this.wasOnline != isOnline) {
            this.homey.app.updateLog(`**** Device is now ${state} ${this.deviceName()}`);
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
            this.homey.app.updateLog(`Device still ${state} ${this.deviceName()}`);
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
        if (changedKeys.indexOf("host") >= 0)
            this.host = newSettings.host;
        if (changedKeys.indexOf("tcp_port") >= 0)
            this.port = newSettings.tcp_port;
        if (changedKeys.indexOf("host_check_interval") >= 0)
            this.actionInterval = newSettings.host_check_interval;
        if (changedKeys.indexOf("host_timeout") >= 0)
            this.hostTimeout = newSettings.host_timeout;
        if (changedKeys.indexOf("host_unreachable_checks") >= 0)
            this.maxUnreachableAttempts = newSettings.host_unreachable_checks;
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