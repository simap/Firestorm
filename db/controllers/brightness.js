const knex = require('../db')
const _ = require("lodash");
const brightness_table = 'brightness'
exports.doesBrightnessExistInTable = async (req) => {
    return await knex
        .select('*')
        .from(brightness_table)
        .where('id', "!=", null)
        .then((res) => {
            if (res.length === 0) return false
            if (res.length !== 0) return true
        })
}

exports.getCurrentBrightness = async (req, res) => {
    return await knex
        .select('*')
        .from(brightness_table)
        .then((data) => {
            if(res) {
                res.status(200)
                    .json(data);
            } else {
                return data
            }
        })
        .catch(err => {
            console.log(`There was an error retrieving brightness: ${err}`)
        })
}

exports.updateBrightness = async (req, res) => {
    let brightnessValue = ''
    try {
        brightnessValue = req.body.value
    } catch(err) {
        brightnessValue = req.value
    }
    await knex.transaction(async trx => {
        //clear table first
        await knex
            .into(brightness_table)
            .where('id','!=', 'null')
            .del()
            .transacting(trx);
        // insert new pattern
        await knex
            .insert({
                value: brightnessValue,
            })
            .into(brightness_table)
            .transacting(trx);
    })
    .then( () => {
        if(res) {
            res.status(200)
                .json({message: `Creating a new brightness with level '${brightnessValue}'.`})
        } else {
            return JSON.stringify({message: 'ok'})
        }
    })
    .catch(err => {
        if(res) {
            res.status(500)
                .json({
                    message: `There was an error creating a new brightness with level '${brightnessValue}', error: ${err}`
                })
        } else {
            return JSON.stringify({
                code: 500,
                message: `There was an error creating a new brightness with level '${brightnessValue}', error: ${err}`
            })
        }
    })
}