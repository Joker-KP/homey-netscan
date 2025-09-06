/*jslint node: true */
'use strict';

const TcpIpDevice = require('../../lib/device');

module.exports = class tcpDevice extends TcpIpDevice {
    async onInit() {
        console.info("Booting TCP device ", this.getName());
        super.onInit();
    }
}
