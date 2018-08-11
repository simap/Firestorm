import React, {Component} from 'react';

export default class PixelblazeContainer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      name: "~~~ Loading ~~~",
      programList: []
    }

    this.handleConnect.bind(this);
    this.handleClose.bind(this);
    this.handleMessage.bind(this);
  }

  componentDidMount() {
    this.connect();
  }

  componentWillUnmount() {
    this.ws && this.ws.close();
    clearTimeout(this.reconectTimeout);
  }

  connect() {
    if (this.ws)
      this.ws.close();
    this.ws = new WebSocket('ws://' + this.props.address + ":81");
    this.ws.binaryType = "arraybuffer";
    this.ws.onopen = this.handleConnect;
    this.ws.onclose = this.handleClose;
    this.ws.onmessage = this.handleMessage;
  }

  handleConnect() {
    console.log("connected to " + this.address);
    clearTimeout(this.reconectTimeout);
    this.sendFrame({getConfig: true, listPrograms: true, sendUpdates: false});
  }

  handleClose() {
    console.log("closing " + this.address);
    this.reconectTimeout = setTimeout(this.connect, 1000);
  }

  handleMessage(data) {
    console.log("data from " + this.address, data);
  }

  sendFrame(o) {
    const frame = JSON.stringify(o);
    const isDisconnected = this.ws && this.ws.readyState !== this.ws.OPEN;
    console.log(isDisconnected ? "wanted to send" : "sending", frame);
    if (isDisconnected)
      return;
    this.ws.send(frame);
  }

  render() {
    return (
        <p>state: {JSON.stringify(this.state, null, 2)} props: {JSON.stringify(this.props, null, 2)}</p>
    )
  }

}