const WebSocket = require('ws');
const _ = require('lodash');
// const fetch = require('node-fetch');

// this is such a dirty hack. why nodejs, why!?!
// new version of node-fetch is ESM only.
// https://redfin.engineering/node-modules-at-war-why-commonjs-and-es-modules-cant-get-along-9617135eeca1
let fetch = () => Promise.reject();
(async () => {
  try {
    let nodefetch = await import('node-fetch');
    fetch = nodefetch.default;
  } catch (err) {
    console.log("Can't load node-fetch " + err)
  }
})();


const FormData = require('form-data');

const PacketType = {
  SAVEPROGRAMSOURCEFILE: 1,
  CODEDATA: 3,
  THUMBNAILJPG: 4,
  PREVIEWFRAME: 5,
  SOURCESDATA: 6,
  PROGRAMLIST: 7,
  PIXELMAP: 8,
};
const PacketFrameFlags = {
  START: 1,
  CONTINUE: 2,
  END: 4
};

const PROPFIELDS = [
  'ver', 'fps', 'exp', 'vmerr', 'mem', 'pixelCount', 'ledType', 'dataSpeed', 'colorOrder', 'buferType', 'sequenceTimer', 'sequencerEnable', 'brightness', 'name'
];

function readAsUtf8(buf, cb) {
  var bb = new Blob([new Uint8Array(buf)]);
  var f = new FileReader();
  f.onload = function(e) {
    cb(e.target.result);
  };
  f.readAsText(bb);
}

module.exports = class PixelblazeController {
  constructor(props, command) {
    this.props = props;
    this.command = _.clone(command || {}); //commands to send
    this.props.programList = [];
    this.partialList = [];
    this.lastSeen = new Date().getTime();

    this.connect = this.connect.bind(this);
    this.handleConnect = this.handleConnect.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handlePong = this.handlePong.bind(this);
    this.setCommand = this.setCommand.bind(this);
  }

  start() {
    this.connect();
  }

  stop() {
    try {
      if (this.ws) {
        console.log("stopping " + this.props.address);
        this.ws.terminate();
      }
    } catch (err) {
      // dont care!
    }
    clearTimeout(this.reconectTimeout);
  }

  connect() {
    if (this.ws && this.ws.readyState === this.ws.CONNECTING)
      return;
    this.stop();
    this.ws = new WebSocket('ws://' + this.props.address + ":81");
    this.ws.binaryType = "arraybuffer";
    this.ws.on('open', this.handleConnect);
    this.ws.on('close', () => this.handleClose);
    this.ws.on('message', this.handleMessage);
    this.ws.on('pong', this.handlePong);
    this.ws.on('error', console.log); //otherwise it crashes :(
  }

  handleConnect() {
    console.log("connected to " + this.props.address);
    this.lastSeen = new Date().getTime();
    clearTimeout(this.reconectTimeout);
    this.sendFrame({getConfig: true, listPrograms: true, sendUpdates: false, ...this.command});
  }

  handleClose() {
    console.log("closing " + this.props.address);
    this.reconectTimeout = setTimeout(this.connect, 1000);
  }

  handleMessage(msg, isBinary) {
    this.lastSeen = new Date().getTime();
    // console.log("data from " + this.props.id + " at " + this.props.address, typeof msg, msg);

    let props = this.props;
    if (!isBinary) {
      try {
        _.assign(this.props, _.pick(JSON.parse(msg), PROPFIELDS));
      } catch (err) {
        console.error("Problem parsing packet", err);
      }
    } else {
      var buf = new Uint8Array(msg);
      if (buf.length < 1)
        return;
      var type = buf[0];
      switch (type) {
        case PacketType.PREVIEWFRAME:
          break;
        case PacketType.THUMBNAILJPG:
          break;
        case PacketType.SOURCESDATA:
          break;
        case PacketType.PROGRAMLIST:
          let data = buf.slice(2);
          let flags = buf[1];

          if (flags & PacketFrameFlags.START) {
            this.partialList = [];
          }

          let text = Buffer.from(data).toString('utf8')
          let lines = text.split("\n");
          let programs = _.map(_.filter(lines), function (line) {
            let bits = line.split("\t");
            return {id: bits[0], name: bits[1]};
          });
          this.partialList = this.partialList.concat(programs);
          if (flags & PacketFrameFlags.END) {
            props.programList = this.partialList;
            // console.log("received programs", props.id, props.programList);
          }
          break;
      }
    }
  }

  ping() {
    const isDisconnected = this.ws && this.ws.readyState !== this.ws.OPEN;
    if (!isDisconnected)
      this.ws.ping();
  }
  isAlive(timeoutMs) {
    let now = new Date().getTime();
    return now - this.lastSeen < timeoutMs && this.ws && this.ws.readyState !== this.ws.CLOSED;
  }
  handlePong() {
    this.lastSeen = new Date().getTime();
  }

  setCommand(command) {
    let {programName, ...rest} = command;
    if (programName) {
      rest = rest || {};
      let program = _.find(this.props.programList, {name: programName});
      if (program) {
        rest.activeProgramId = program.id;
      }
      command = rest; //replace command with fixed version
    }

    //see if those keys values are different
    let keys = _.keys(command);
    if (_.isEqual(_.pick(command, keys), _.pick(this.command, keys)))
      return;
    _.assign(this.command, command);
    this.sendFrame(command);
  }

  reload() {
    this.sendFrame({getConfig: true, listPrograms: true});
  }

  async getProgramBinary(programId, extension = "") {
    let extensionDesc = (extension == ".c") ? " controls" : ""
    console.log("getting program " + programId + extensionDesc + " from " + this.props.address);
    var resp = await fetch('http://' + this.props.address + "/p/" + programId + extension, {
      highWaterMark: 1024 * 1024
    });

    if (resp.ok || resp.status === 404)
      return await resp.buffer();
    else {
      console.log("Got unexpected response ${resp.status} ${resp.statusText}");
      throw new Error(`Unexpected response ${resp.statusText}`);
    }
  }

  async putProgramBinary(programId, binary) {
    console.log("putting program " + programId + " to " + this.props.address);
    const form = new FormData();
    form.append('data', binary, {
      filepath: '/p/' + programId,
      contentType: 'application/octet-stream',
    });

    var url = 'http://' + this.props.address + "/edit"
    return new Promise((resolve, reject) => {
      form.submit(url, function (err, res) {
        if (err)
          reject(err);
        else
          resolve(res);
      });
    })
  }

  async deleteProgram(programId) {
    console.log("deleting " + programId + " from " + this.props.address);
    var resp = await fetch('http://' + this.props.address + "/delete?path=/p/" + programId);
    return resp.ok || resp.status === 404;
  }

  sendFrame(o) {
    const frame = JSON.stringify(o);
    const isDisconnected = this.ws && this.ws.readyState !== this.ws.OPEN;
    console.log(isDisconnected ? "wanted to send" : "sending to " + this.props.id + " at " + this.props.address, frame);
    if (isDisconnected)
      return;
    this.ws.send(frame);
  }
}
