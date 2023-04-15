const _ = require("lodash");
const {getPlaylistFromDB, addPatternToPlaylist, removeAllPatterns} = require("../db/controllers/playlist");
const {discoverPixelBlazes, sendCommand} = require("./pixelBlazeUtils");

let currentPlaylist       = []
let currentRunningPattern = null
let initInterval
let pixelBlazeData        = []
let pixelBlazeIds         = []
let playlistLoopTimeout
let playlistTimeout

init = async () => {
    getPlaylistFromDB()
        .then((data) => {
            try {
                currentPlaylist = [] // resetting current playlist so it doesn't grow to infinity
                currentPlaylist.push(...data) // adding new playlist items to list
            } catch (err) {
                console.warn(`Error: ${err}`)
            }
        })
        .catch('there was an error gathering playlist details')

    // gather pixelBlaze data
    pixelBlazeData = discoverPixelBlazes()
    pixelBlazeIds = _.map(pixelBlazeData, 'id')
}

initInterval = setInterval(init, 100)

class Playlist {
    constructor(utils) {
        this.utils = utils ? utils : null
    }

    playlistLoop = async () => {
        while(true) {
            await new Promise(resolve => {
                playlistLoopTimeout = setTimeout(resolve, 100)
            });
            if(pixelBlazeIds.length) {
                await this.iterateOnPlaylist()
            }
            initInterval        = null
            playlistLoopTimeout = null
            playlistTimeout     = null
        }
    }
    iterateOnPlaylist = async () => {
        for (let index = 0; index < currentPlaylist.length; index++) {
            const pattern = currentPlaylist[index]
            await this.delaySendPattern(pattern)
            await new Promise(resolve => {
                playlistTimeout = setTimeout(resolve, pattern.duration * 1000)
            });
        }
    }
    delaySendPattern = async (pattern) => {
        await new Promise((resolve) => {
            resolve(
                this.sendPattern(pattern)
            )
        })
    }
    disableAllPatterns = async () => {
        await removeAllPatterns()
        await this.runPlaylistLoopNow()
    }
    enableAllPatterns = async (duration) => {
        const pixelBlazePatterns = this.gatherPatternData(pixelBlazeData)
        const enableAll = new Promise((resolve) => {
            _.each(pixelBlazePatterns, pattern => {
                pattern['duration'] = duration
                let body = {
                    name: pattern.name,
                    duration: pattern.duration
                }
                addPatternToPlaylist(body)
            })
            resolve();
        });
        enableAll
            .then(() => {
                this.runPlaylistLoopNow()
            })
    }
    gatherPatternData = (pixelBlazeData) => {
        let groupByPatternName = {};
        _.each(pixelBlazeData, d => {
            d.name = d.name || "Pixelblaze_" + d.id // set name if missing
            _.each(d.programList, p => {
                let pb = {
                    id: d.id,
                    name: d.name
                };
                if (groupByPatternName[p.name]) {
                    groupByPatternName[p.name].push(pb);
                } else {
                    groupByPatternName[p.name] = [pb];
                }
            })
        })
        let groups = _.chain(groupByPatternName)
            .map((v, k) => ({name: k}))
            .sortBy('name')
            .value();
        return groups
    }
    getCurrentProgramState = async () => {
        let message = {
            currentRunningPattern: currentRunningPattern,
            currentPlaylist: currentPlaylist
        }
        await this.sendPlaylistMessage(message)
    }
    runPlaylistLoopNow = async () => {
        clearInterval(initInterval)
        clearInterval(playlistTimeout)
        clearInterval(playlistLoopTimeout)

        await this.playlistLoop()
    }
    sendPattern = async (pattern) => {
        const name            = pattern.name
        currentRunningPattern = name
        sendCommand(pixelBlazeIds, name)
        let message = {
            currentRunningPattern: name,
            currentPlaylist: currentPlaylist
        }
        await this.sendPlaylistMessage(message)
    }
    sendPlaylistMessage = async (message) => {
        // skipping this if utils is not initialized due to no websocket connections
        if(this.utils) {
            this.utils.broadcastMessage(message)
        }
    }

}
// Initializing the playlist loop outside the websocket
// because we might not always have a browser open when
// starting/restarting the node-server... it should send
// commands and operate on the playlist w/o the need of an
// active websocket connection
initThe = new Playlist()
initThe.playlistLoop()
    .then(() =>  {})


module.exports.PlaylistWebSocketMessageHandler = function (utils) {
    const playlist = new Playlist(utils)
    this.utils = utils

    this.receiveMessage = async function (data) {
        let message
        try {
            message = JSON.parse(data);
        } catch (err) {
            this.utils.sendError(err)
            return
        }
        if (message.type === 'DISABLE_ALL_PATTERNS') {
            // console.log('received message to disable all patterns!')
            await playlist.disableAllPatterns(message.duration)
        }
        if (message.type === 'ENABLE_ALL_PATTERNS') {
            // console.log('received message to enable all patterns!')
            await playlist.enableAllPatterns(message.duration)
        }
        if (message.type === 'GET_CURRENT_PROGRAM_STATE') {
            // console.log('received get current program state message!')
            await playlist.getCurrentProgramState()
        }
        if (message.type === 'LAUNCH_PLAYLIST_NOW') {
            // console.log('received launch playlist now message!')
            await playlist.runPlaylistLoopNow()
        }
    }
}
