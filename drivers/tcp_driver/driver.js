"use strict";

const Homey = require('homey');
const ConnectivityDriver = require('../../lib/driver');

module.exports = class tcpDriver extends ConnectivityDriver {
    async onInit() {
        console.info("Booting TCP driver");
        super.onInit();
    }
}
