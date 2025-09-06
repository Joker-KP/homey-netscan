"use strict";

const ConnectivityDriver = require('../../lib/driver');

module.exports = class IpDriver extends ConnectivityDriver {
    async onInit() {
        console.info("Booting IP driver");
        super.onInit();
    }
}
