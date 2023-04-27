const _ = require("lodash");
const {discoveries} = require("./discovery");

module.exports.discoverPixelBlazes = () => {
    return _.map(discoveries, function (v, k) {
        let res = _.pick(v, ['lastSeen', 'address']);
        _.assign(res, v.controller.props);
        return res;
    })
}

module.exports.sendCommand = (pixelBlazeIds, name, brightness) => {
    _.each(pixelBlazeIds, async id => {
        id = String(id);
        let controller = discoveries[id] && discoveries[id].controller;
        if (controller) {
            let command = null
            if(name !== null && name !== undefined) {
                command = {
                    programName: name
                }
            }
            if(brightness !== null && brightness !== undefined){
                command = {
                    brightness: brightness
                }
            }
            if (command) {
                await controller.setCommand(command);
            } else {
                console.log(`No command sent to Pixelblazes command is ${command}`)
            }
        }
    })
}