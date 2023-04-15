const knex = require('../db')
const _ = require("lodash");
const playlist_table = 'playlist'

exports.doesPatternExistInPlaylist = async (name) => {
    return await knex
        .select('*')
        .from(playlist_table)
        .where('name', "=", name)
        .then((res) => {
            if (res.length === 0) return false
            if (res.length !== 0) return true
        })
}
exports.getPlaylistFromDB = async () => {
    return await knex
        .select('*')
        .from(playlist_table)
        .then((data) => {
            return data
        })
        .catch(err => {
            console.log(`There was an error retrieving playlist items: ${err}`)
        })
}
exports.getAllPlaylistPatterns = async (req, res) => {
    this.getPlaylistFromDB().then(playlistData => {
        res.status(200)
            .json(playlistData);
    })
        .catch(err => {
            res.status(500)
                .json({message: `There was an error retrieving playlist items: ${err}`})
        })
}

exports.addPatternToPlaylist = async (req, res) => {
    let duration = ''
    let name = ''
    try {
        duration = req.body.duration
        name = req.body.name
    } catch(err) {
        duration = req.duration
        name =  req.name
    }
    const doesPatternExistInPlaylist = await this.doesPatternExistInPlaylist(name)
        .then((condition) => {
            return condition
        })
    // update existing pattern in playlist
    if(doesPatternExistInPlaylist) {
        await knex
            .update({
                duration: duration
            })
            .into(playlist_table)
            .where(
                'name', '=', name
            )
            .then(() => {
                if (res) {
                    res.status(200).json({message: `Pattern \'${name}\' with a duration of ${duration} created.`})
                } else {
                    return JSON.stringify({message: 'ok'})
                }
            })
            .catch(err => {
                if (res) {
                    res.status(500).json({message: `There was an error adding the ${name} pattern: ${err}`})
                } else {
                    return JSON.stringify({code: 500, message: `There was an error adding the ${name} pattern: ${err}`})
                }
            })
    }
    // insert new pattern into playlist
    if(!doesPatternExistInPlaylist) {
        await knex
            .insert({
                name: name,
                duration: duration,
            })
            .into(playlist_table)
            .then(() => {
                if (res) {
                    res.status(200)
                        .json({message: `Pattern \'${name}\' with a duration of ${duration} created.`})
                } else {
                    return JSON.stringify({message: 'ok'})
                }

            })
            .catch(err => {
                if (res) {
                    res.status(500)
                        .json({message: `There was an error adding the ${name} pattern: ${err}`})
                } else {
                    return JSON.stringify({code: 500, message: `There was an error adding the ${name} pattern: ${err}`})
                }

            })
    }
}

exports.removePatternFromPlaylist = async (req, res) => {
    await knex
        .into(playlist_table)
        .where('name', req.body.name)
        .del()
        .then( () => {
                res.status(200)
                    .json({ message: `Removed pattern '${req.body.name}' from playlist.`});
            }
        )
        .catch(err => {
            res.status(500)
                .json({
                    message: `There was an error removing the pattern '${req.body.name}', error: ${err}`
                })
        })
}

exports.newPlaylist = async (req, res) => {
    await knex.transaction(async trx => {
        //clear table first
        await knex
            .into(playlist_table)
            .where('id','!=', 'null')
            .del()
            .transacting(trx);
        // insert new pattern
        await knex
            .insert({
                name: req.body.name,
                duration: req.body.duration,
            })
            .into(playlist_table)
            .transacting(trx);
    })
        .then( () => {
                res.status(200)
                    .json({ message: `Creating a new playlist with pattern '${req.body.name}' from playlist.`});
            }
        )
        .catch(err => {
            res.status(500)
                .json({
                    message: `There was an error creating a new playlist with pattern '${req.body.name}', error: ${err}`
                })
        })
}

exports.removeAllPatterns = async (req, res) => {
    await knex
        .into(playlist_table)
        .where('id','!=', 'null')
        .del()
        .then( () => {
            return JSON.stringify({ message: `Removing all patterns from playlist.`})
            }
        )
        .catch(err => {
            return JSON.stringify({code: 500, message: `There was an error while removing all patterns from the playlist. Error: ${err}`})
        })
}