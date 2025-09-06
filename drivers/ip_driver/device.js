/*jslint node: true */
'use strict';

const TcpIpDevice = require('../../lib/device');

module.exports = class ipDevice extends TcpIpDevice {
    async onInit() {
        this.homey.app.updateLog("Booting IP device " + this.getName());
        super.onInit();
    }

    async onAdded() {
        this.port = null;
        await this.setSettings({ 'tcp_port': this.port });
    }

}