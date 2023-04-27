const _ = require("lodash");
const {updateBrightness, getCurrentBrightness} = require("../db/controllers/brightness");
const {discoverPixelBlazes, sendCommand} = require("./pixelBlazeUtils");

let currentBrightness
let pixelBlazeData    = []
let pixelBlazeIds     = []
init = async () => {
    getCurrentBrightness()
        .then((brightness) => {
            try {
                currentBrightness = brightness[0].value
            } catch (err) {
                console.warn(`Error: ${err}`)
            }
        })
    pixelBlazeData = discoverPixelBlazes()
    pixelBlazeIds  = _.map(pixelBlazeData, 'id')
}

initInterval = setInterval(init, 100)

class Brightness {
    constructor(utils) {
        this.utils = utils ? utils : null
    }
    adjustBrightness = async (brightness) => {
        await new Promise((resolve) => {
            const tempBrightness = (brightness) ? brightness : currentBrightness
            this.delayedSaveBrightness(resolve, tempBrightness)
        })
    }
    delayedSaveBrightness = _.debounce(async (resolve, brightness) => {
        sendCommand(pixelBlazeIds, null, brightness)
        await this.storeBrightness(brightness);
        currentBrightness = brightness
        await this.sendBrightnessMessage(currentBrightness)
    }, 1000)
    getBrightness = async () =>{
        await this.sendBrightnessMessage(currentBrightness)
    }
    storeBrightness = async (brightness) => {
        const body = {
            value: brightness
        }
        await updateBrightness(body)
    }
    sendBrightnessMessage = async (currentBrightness) => {
        // skipping this if utils is not initialized due to no websocket connections
        if (this.utils) {
            await this.utils.broadcastMessage({currentBrightness: currentBrightness})
        }
    }
}
// Initializing the brightness loop outside the websocket
// because we might not always have a browser open when
// starting/restarting the node-server... it should send
// commands and operate on the brightness w/o the need of an
// active websocket connection
initThis = async () => {
    // halting the brightness message until we get it from the db
    while (currentBrightness === undefined) {
        await new Promise(resolve => {
            setTimeout(resolve, 100)
        })
    }
    let initThe = new Brightness()
    await initThe.adjustBrightness(currentBrightness)
}
initThis().then(()=>{})


module.exports.BrightnessWebsocketMessageHandler = function (utils) {
    const brightness = new Brightness(utils)
    this.utils       = utils

    this.receiveMessage = async function (data) {
        let message
        try {
            message = JSON.parse(data);
        } catch (err) {
            this.utils.sendError(err)
            return
        }
        if (message.type === 'ADJUST_BRIGHTNESS') {
            // console.log('received adjust brightness message!')
            await brightness.adjustBrightness(parseFloat(message.brightness))
        }
        if (message.type === 'GET_CURRENT_BRIGHTNESS') {
            // console.log('received get current brightness message!')
            await brightness.getBrightness()
        }
    }
}
