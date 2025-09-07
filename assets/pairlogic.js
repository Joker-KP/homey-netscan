// Set window options
var width = 400;
var height = 400;
var left = (screen.width / 2) - (width / 2);
var top = (screen.height / 2) - (height / 2);
var url;

// Set translated items
$("label[for='name']").text(__('pair.configuration.name') + ':')
$("label[for='ip_address']").text(__('pair.configuration.ip_address') + ':')
$("label[for='tcp_port']").text(__('pair.configuration.tcp_port') + ':')

function configure(isPortDefined = true) {
    $('.ip-scan-err-msg').text('');

    var name = $("#name").val();
    var ipAddress = $("#ip_address").val();

    var device = {
        data: { // this data object is saved to- and unique for the device. It is passed on the get and set functions as 1st argument
            id: "PortScan" + new Date().getTime() // something unique, so your driver knows which physical device it is. A MAC address or Node ID, for example. This is required
        },
        name: name, // the name for this device (optional),
        settings: {
            host: ipAddress
        }
    };

    if (isPortDefined) {
        var tcpPort = $("#tcp_port").val();
        if (isNaN(tcpPort) || tcpPort <= 0 || tcpPort > 65535) {
            $('.ip-scan-err-msg').text(__('pair.configuration.tcp_port_invalid'));
            return;
        }
        device.settings["tcp_port"] = parseInt(tcpPort)
    }

    Homey.emit('configure_ip', device, function (err, result) {
        if (err) {
            $('.ip-scan-err-msg').text(err)
        }
        else {
            //Successfully connected
            Homey.addDevice(device, function (err, result) {
                if (err)
                    return console.error(err);
            });

            //Done pairing
            Homey.done();
        }
    });
}