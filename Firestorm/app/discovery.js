const PixelblazeController = require('./controller');
const _ = require('lodash');

let timeoutMs = 5000;
let expireMs = 300000; //5 minutes

var discoveries = {};
exports.discoveries = discoveries;

setInterval(() => {
  let now = new Date().getTime();
  _.each(discoveries, (d, id) => { 
    d.controller && d.controller.ping();
    if ((now - d.lastSeen) > expireMs) {
      console.log("expired", d.address);
      d.controller.stop();
      delete discoveries[id];
    } else if (!d.controller.isAlive()) {
      // console.log("ws not alive", d.address);
      d.controller.start(); //try kicking it
    }
  });
}, 1000);

const PacketTypes = {
  BEACONPACKET: 42,
  TIMESYNC: 43
};

module.exports.start = function (options) {
  var host = options.host || '0.0.0.0';
  var port = options.port || 1889;

  var dgram = require('dgram');
  var server = dgram.createSocket('udp4');

  server.on('listening', function () {
    var address = server.address();
    console.log('Pixelblaze Discovery Server listening on ' + address.address + ": " + address.port);
  });

  server.on('message', function (message, remote) {
    if (message.length < 12)
      return;

    let header = {
      packetType: message.readUInt32LE(0),
      senderId: message.readUInt32LE(4),
      senderTime: message.readUInt32LE(8),
    };

    let now = new Date().getTime();
    let now32 = (now) % 0xffffffff; //32 bits of milliseconds

    switch (header.packetType) {
      case PacketTypes.BEACONPACKET:
        // console.log("BEACONPACKET from " + remote.address + ':' + remote.port + " id: " + header.senderId + " senderTime: " + header.senderTime + " delta: " + (now32 - header.senderTime));

        //record this discovery and fire up a controller
        let record = discoveries[header.senderId] = discoveries[header.senderId] || {};
        record.lastSeen = now;
        record.address = remote.address;
        record.port = remote.port;

        if (!record.controller) {
          record.controller = new PixelblazeController({
            id: header.senderId,
            address: remote.address
          });
          record.controller.start();
        }

        //reply with a timesync packet
        let sync = Buffer.alloc(20);
        sync.writeUInt32LE(PacketTypes.TIMESYNC, 0);
        sync.writeUInt32LE(889, 4); //sender ID,
        sync.writeUInt32LE(now32, 8);

        sync.writeUInt32LE(header.senderId, 12);
        sync.writeUInt32LE(header.senderTime, 16);

        server.send(sync, 0, sync.length, remote.port, remote.address, (err, res) => {
          // console.log(err, res);
        });
        break;
      case PacketTypes.TIMESYNC:
        console.log("TIMESYNC");
        break;
      default:
        console.warn("unknown packet type " + header.packetType);
    }
  });

  server.bind(port, host);

}