const discoveries = require('./discovery').discoveries;
const _ = require('lodash');

module.exports = function (app) {

  app.get("/discover", function (req, res) {
    res.send(_.map(discoveries, function (v, k) {
      let res = _.pick(v, ['lastSeen', 'address']);
      _.assign(res, v.controller.props);
      return res;
    }));
  })

  app.post("/command", function (req, res) {
    if (req.body && req.body.ids && req.body.command) {
      _.each(req.body.ids, id => {
        let controller = discoveries[id] && discoveries[id].controller;
        if (controller) {
          controller.setCommand(req.body.command);
        }
      })
      res.send("ok");
    } else {
      res.status(400).send("missing ids or command");
    }
  })
}
