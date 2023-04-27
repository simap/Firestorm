const playlistDbRoutes = require('../controllers/playlist')

// Create router
module.exports = function (app) {
    app.get('/playlist/getPatterns', playlistDbRoutes.getAllPlaylistPatterns)
    app.post('/playlist/addPattern', playlistDbRoutes.addPatternToPlaylist)
    app.put('/playlist/removePattern', playlistDbRoutes.removePatternFromPlaylist)
    app.put('/playlist/newPlaylist', playlistDbRoutes.newPlaylist)
}
