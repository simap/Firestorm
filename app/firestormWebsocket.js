const WebSocketServer = require('ws').Server
const {PlaylistWebSocketMessageHandler} = require('./playlist')
const {Utils} = require('./utils')
const {BrightnessWebsocketMessageHandler} = require("./brightness");

// start FireStorm WebSocket server
const address = '0.0.0.0';
const port = 1890;
const firestormServer = new WebSocketServer({host: address , port: port});
console.log(`Firestorm server is running on ${address}:${port}`);

firestormServer.on('connection', function (connection) {
    const utils = new Utils(connection)
    const brightnessWebsocketMessageHandler = new BrightnessWebsocketMessageHandler(utils)
    const playlistWebSocketMessageHandler = new PlaylistWebSocketMessageHandler(utils)
    if(utils.addFirestormClient(connection)) {
        return
    }
    connection.on('message', async function message(data, isBinary) {
        const message = isBinary ? data : data.toString();
        // console.log(`incoming msg from: ${utils.getFirestormClientBySocket(connection)}, message: ${message}`)
        if (await playlistWebSocketMessageHandler.receiveMessage(message)) {
            return
        }
        if (await brightnessWebsocketMessageHandler.receiveMessage(message)) {
            return
        }
    })
    connection.on('close', function() {
        console.log('closed connection')
    })
})