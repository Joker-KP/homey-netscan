"use strict";
// if (process.env.DEBUG === '1') {
//     require('inspector').open(9221, '0.0.0.0', true);
// }

const Homey = require('homey');
const nodemailer = require("nodemailer");

class netScanApp extends Homey.App {
    async onInit() {
        this.diagLog = '';
        this.logLevel = this.homey.settings.get('logLevel') ?? 0;
        this.homey.settings.set('logLevel', this.logLevel);

        // helper to register simple online/offline conditions
        const registerDeviceCondition = (cardId, expectOnline) => {
            this.homey.flow
                .getConditionCard(cardId)
                .registerRunListener(async (args, state) => {
                    return expectOnline ? !!args.device.wasOnline : !args.device.wasOnline
                });
        };
        registerDeviceCondition('device_is_online', true);
        registerDeviceCondition('device_is_offline', false);

        // on CPU warning: ask all devices to slow down if they expose slowDown()
        this.homey.on('cpuwarn', () => {
            const drivers = this.homey.drivers.getDrivers();
            for (const driver in drivers) {
                let devices = this.homey.drivers.getDriver(driver).getDevices();
                for (let i = 0; i < devices.length; i++) {
                    let device = devices[i];
                    device.slowDown?.();
                }
            }
            this.homey.app.updateLog('cpuwarn!');
        });

        // callback for app settings changed
        this.homey.settings.on('set', (setting) => {
            this.homey.app.updateLog(`Setting ${setting} has changed.`);
            if (setting === 'logLevel') {
                this.homey.app.logLevel = this.homey.settings.get('logLevel') ?? 0;
            }
        });
    }

    circularReplacer = () => {
        const seen = new WeakSet();
        return (_key, value) => {
            if (value && typeof value === 'object') {
                if (seen.has(value)) return '[Circular]';
                seen.add(value);
            }
            return value;
        };
    }

    varToString(source) {
        try {
            // null or undefined
            if (source == null) return String(source);

            // Error objects
            if (source instanceof Error) {
                const stack = String(source.stack || '').replace(/\r?\n/g, '\n');
                return `${source.name}: ${source.message}${stack ? `\n${stack}` : ''}`;
            }

            // strings pass through
            if (typeof source === 'string') return source;

            // objects (pretty JSON, circular-safe)
            if (typeof source === 'object') {
                return JSON.stringify(source, this.circularReplacer(), 2);
            }

            // numbers, booleans, bigint, symbol, function
            return String(source);
        } catch (err) {
            this.homey.app.updateLog("varToString failed: " + this.homey.app.varToString(err), 0);
        }
    }

    updateLog(newMessage, errorLevel = 1) {
        if (errorLevel > this.homey.app.logLevel) return;

        try { console.log(newMessage); } catch { }

        const pad = (n, w) => String(n).padStart(w, '0');
        const now = new Date();
        const ts =
            `${pad(now.getHours(), 2)}:` +
            `${pad(now.getMinutes(), 2)}:` +
            `${pad(now.getSeconds(), 2)}.` +
            `${pad(now.getMilliseconds(), 3)}`;

        const marker = errorLevel === 0 ? '!!!!!! ' : '* ';
        const line = `${ts}: ${marker}${newMessage}\r\n`;

        // append and cap to the last 60k chars
        this.diagLog = ((this.diagLog || '') + line).slice(-60000);

        this.homey.api.realtime('com.netscan.logupdated', { log: this.diagLog });
    }

    async sendLog(logType) {
        let tries = 5;
        console.log("Send Log");
        while (tries-- > 0) {
            try {
                let subject = "";
                let text = "";
                if (logType === 'infoLog') {
                    subject = "Netscan Information log";
                    text = this.diagLog;
                }
                else {
                    subject = "Netscan device log";
                    text = this.detectedDevices;
                }

                subject += "(" + this.homeyHash + " : " + Homey.manifest.version + ")";

                // create reusable transporter object using the default SMTP transport
                let transporter = nodemailer.createTransport(
                    {
                        host: Homey.env.MAIL_HOST, //Homey.env.MAIL_HOST,
                        port: 465,
                        ignoreTLS: false,
                        secure: true, // true for 465, false for other ports
                        auth:
                        {
                            user: Homey.env.MAIL_USER, // generated ethereal user
                            pass: Homey.env.MAIL_SECRET // generated ethereal password
                        },
                        tls:
                        {
                            // do not fail on invalid certs
                            rejectUnauthorized: false
                        }
                    });
                // send mail with defined transport object
                const response = await transporter.sendMail(
                    {
                        from: '"Homey User" <' + Homey.env.MAIL_USER + '>', // sender address
                        to: Homey.env.MAIL_RECIPIENT, // list of receivers
                        subject: subject, // Subject line
                        text: text // plain text body
                    });
                return {
                    error: response.err,
                    message: response.err ? null : "OK"
                };
            }
            catch (err) {
                this.logInformation("Send log error", err);
                return {
                    error: err,
                    message: null
                };
            }
        }
    }
}
module.exports = netScanApp;