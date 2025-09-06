"use strict";

const ConnectivityDriver = require('../../lib/driver');

module.exports = class TcpDriver extends ConnectivityDriver {
    async onInit() {
        console.info("Booting TCP driver");
        super.onInit();
    }
}
