const {v4: uuidv4} = require("uuid");
const _ = require("lodash");
module.exports.Utils = function (connection) {
    this.connection = connection
    this.firestormClients = new Array()

    this.addFirestormClient = function (connection) {
        const clientId = uuidv4()
        const client = new FirestormClient(`FirestormClient_${clientId}`, connection)
        console.log(`Received a new connection.`);
        this.firestormClients.push(client)
        console.log(`${client} is now connected.`);
    }
    this.broadcastMessage = function (message) {
        const data = JSON.stringify(message);
        let that = this
        this.forEachFirestormClient(function (client, i) {
            that.sendToFirestormClient(client, data)
        })
    }
    this.getFirestormClientBySocket = function (connection) {
        for (let i = this.firestormClients.length - 1; i >= 0; i--) {
            if (this.firestormClients[i].connection === connection) {
                return this.firestormClients[i]
            }
        }
        return null
    }
    this.forEachFirestormClient = function (callBack) {
        for (let i = this.firestormClients.length - 1; i >= 0; i--) {
            if (!this.firestormClients[i]) {
                this.firestormClients.splice(i, 1)
                continue
            }

            callBack(this.firestormClients[i], i)
        }
    }

    this.removeFirestormClient = function (connection, name) {
        const removedClients = new Array()
        for (let i = this.firestormClients.length - 1; i >= 0; i--) {
            if (connection && this.firestormClients[i].connection == connection) {
                removedClients.push(this.firestormClients[i])
                this.firestormClients.splice(i, 1)
            }
            if (name && this.firestormClients[i].name == name) {
                removedClients.push(this.firestormClients[i])
                this.firestormClients.splice(i, 1)
            }
        }
        for (let i = removedClients.length - 1; i >= 0; i--) {
            console.log(`removing  client ${removedClients[i]} since its connection is detected to be closed.`)
        }
    }

    this.sendError = function (message) {
        const messageObject = {
            type: 'ERROR',
            payload: `Wrong format: ${message}`,
        };
        this.connection.send(JSON.stringify(messageObject));
    }
    this.sendToFirestormClient = function (client, message) {
        try {
            client.send(message)
        } catch (error) {
            console.log(`there was an error sending message, removing client, error: ${error}`)
            this.removeFirestormClient(null, client.name)
        }
    }
}
class FirestormClient {
    constructor(name, connection) {
        this.name = name
        this.connection = connection
    }
    send = function (message) {
        this.connection.send(message)
    }
    toString = function (message) {
        return this.name
    }
}

