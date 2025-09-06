"use strict";

const Homey = require('homey');
const ConnectivityDriver = require('../../lib/driver');

module.exports = class ipDriver extends ConnectivityDriver {
    async onInit() {
        console.info("Booting IP driver");
        super.onInit();
    }
}
