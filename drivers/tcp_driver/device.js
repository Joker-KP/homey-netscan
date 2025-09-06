/*jslint node: true */
'use strict';

const TcpIpDevice = require('../../lib/device');

module.exports = class TcpDevice extends TcpIpDevice {
    async onInit() {
        this.homey.app.updateLog("Booting TCP device " + this.getName());
        super.onInit();
    }
}
