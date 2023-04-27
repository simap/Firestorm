const path = require('path')

const dbPath = path.resolve(__dirname, "./store/database.sqlite")

const knex = require('knex')({
    client: 'sqlite3',
    connection: {
        filename: dbPath,
    },
    useNullAsDefault: true
})

knex.schema
    .hasTable('playlist')
    .then((exists) => {
        if (!exists) {
            return knex.schema.createTable('playlist', (table) => {
                table.increments('id').primary()
                table.string('name')
                table.float('duration')
            })
                .then(() => {
                    console.log('Table \'playlist\' created')
                })
                .catch((error) => {
                    console.error(`There was an error creating the playlist table: ${error}`)
                })
        }
    })
    .catch((error) => {
        console.error(`There was an error setting up the database: ${error}`)
    })

knex.schema
    .hasTable('brightness')
    .then((exists) => {
        if (!exists) {
            return knex.schema.createTable('brightness', (table) => {
                table.increments('id').primary()
                table.float('value')
            })
                .then(function () {
                        return knex("brightness").insert([
                            {value: 0}
                        ]);
                    }
                )
                .then(() => {
                    console.log('Table \'brightness\' created')
                })
                .catch((error) => {
                    console.error(`There was an error creating the brightness table: ${error}`)
                })
        }
    })
    .catch((error) => {
        console.error(`There was an error setting up the database: ${error}`)
    })

module.exports = knex