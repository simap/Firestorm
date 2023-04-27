import React, {Component} from 'react';
import './App.css';
import _ from 'lodash';
import {check, connect, sendMessage, ws} from "./utils";

import PatternView from './PatternView'

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      brightness: 0,
      deactivateDisableAllButton: true,
      deactivateEnableAllButton: false,
      discoveries: [],
      downloadingDumpArchive: false,
      isProcessing: false,
      groups: [],               // Currently discovered patterns and their controllers
      runningPatternName: null,
      message: [],
      newPlaylist: [],
      playlist: [],             // Browser-persisted single playlist singleton
      playlistIndex: 0,
      playlistDefaultInterval: 15,
      cloneSource: null,
      cloneDest: {},
      cloneInProgress: false,
      showDevControls: false,
      showCurrentPlaylist: false,
      ws: null
    }

    if (this.state.playlist.length) {
      this.state.playlistDefaultInterval = _(this.state.playlist).last().duration
    }

    this.poll = this.poll.bind(this);

    this.cloneDialogRef = React.createRef();
    this.playlistDialogRef = React.createRef();
  };

  filterMessage(){
    const message = this.state.message
    if(message) {
      message.filter((item) => {
        if ( item.currentRunningPattern && item.currentPlaylist ){
          this.setState({
            runningPatternName: (this.state.runningPatternName === item.currentRunningPattern) ? this.state.runningPatternName : item.currentRunningPattern,
            playlist: JSON.parse((JSON.stringify(this.state.playlist) === JSON.stringify(item.currentPlaylist)) ? JSON.stringify(this.state.playlist) : JSON.stringify(item.currentPlaylist)),
          })
        }
        if ( item.currentBrightness){
          this.setState({
            brightness:  (this.state.brightness === item.currentBrightness) ? this.state.brightness : item.currentBrightness,
          })
        }
        return this
      })
    }
  }
  receiveMessage(message) {
    if (message) {
      this.setState({
        message: [JSON.parse(message.data)]
      })
    }
    this.filterMessage()
  }
  async apiRequest(method, body?, route) {
    const payload = {
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
    if (method !== 'GET') payload['body'] = body
    try {
      const result = await fetch(route, payload)
          .then((res) => {
            return res.json();
          })
      return result
    } catch(err) {
      console.warn(`unable to fetch request for some reason ${err}`)
    }
  }
  async poll() {
    if (this.interval)
      clearTimeout(this.interval);
    try {
      let res = await fetch('./discover')
      let discoveries = await res.json();

      let groupByName = {};
      _.each(discoveries, d => {
        d.name = d.name || "Pixelblaze_" + d.id // set name if missing
        _.each(d.programList, p => {
          let pb = {
            id: d.id,
            name: d.name
          };
          if (groupByName[p.name]) {
            groupByName[p.name].push(pb);
          } else {
            groupByName[p.name] = [pb];
          }
        })
      })
      let groups = _.chain(groupByName)
          .map((v, k) => ({name: k, pixelblazes: v}))
          .sortBy('name')
          .value();
      // console.log("groups", groups);
      discoveries = _.sortBy(discoveries, "name")
      this.setState({discoveries, groups})
    } catch (err) {
      this.setState({err})
    }
    check()
    if (!this.unmounting)
      this.interval = setTimeout(this.poll, 1000)
    this._getCurrentProgramState()
  }


  async componentDidMount() {
    document.addEventListener("keydown", this._handleKeyDown);
    await this.poll()
    // connecting to playlist websocket server
    connect();
    // attaching websocket event listener to receive messages
    ws.addEventListener('message', (event) => {this.receiveMessage(event)});
    // using setState chain to control timing of these two functions.
    this.setState({}, () =>  {
      // kicking off playlist event loops on page load
      this._getCurrentProgramState();
      this.setState({}, () => {
        setTimeout(() =>{
          // ensuring this runs after the above _launchPlaylistNow fires and completes.
          // looking at playlist length configure bulk playlist buttons
          if(this.state.playlist.length === this.state.groups.length){
            this.setState({
              deactivateEnableAllButton: true,
              deactivateDisableAllButton:  false
            })
          }
        }, 1000)
      })
    })
    this._getBrightnessNow();
  }

  componentWillUnmount() {
    this.unmounting = true;
    clearInterval(this.interval)
    ws.close()
    ws.removeEventListener('message', (event) => {this.receiveMessage(event)});
  }

  changeBrightness = async (event) => {
    event.preventDefault()
    this.setState({
      brightness: event.target.value
    })
    const message = {
      type: 'ADJUST_BRIGHTNESS',
      brightness: event.target.value
    }
    await sendMessage(message)

  }

  downloadPatternArchive = async (event, deviceId) => {
    event.preventDefault()
    this.setState({
      downloadingDumpArchive: true
    })
    await fetch(`./controllers/${deviceId}/dump`)
        .then(async res => {
          let filename = ''
          for (const header of res.headers) {
            if (header[1].includes('filename')) {
              const dispositionHeader = header[1]
              // ignoring warning for `_`
              // eslint-disable-next-line no-unused-vars
              const [_, rawFilename] = dispositionHeader.split('=')
              // removing double quotes
              filename = rawFilename.replace(/^"(.+(?="$))"$/, '$1')
            }
          }
          const url = URL.createObjectURL(await res.blob())
          const element = document.createElement("a");
          element.setAttribute("href", url);
          element.setAttribute("download", filename);
          element.style.display = "none";
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);
          URL.revokeObjectURL(url);
          this.setState({
            downloadingDumpArchive: false
          })
        })
        .catch(err => console.error(err));
  }

  async _launchPattern(pattern) {
    if (this.state.runningPatternName === pattern.name) {
      console.warn(`pattern ${pattern.name} is already running, ignoring launch request`)
      return
    }
    this._launchPlaylistNow()
  }

  openPlaylistDialog = async (event) => {
    event.preventDefault();
    this.setState({
      showCurrentPlaylist: true
    });
    setTimeout(() => {
      this.playlistDialogRef.current && this.playlistDialogRef.current.scrollIntoView(true);
    }, 100)
    if( this.state.showCurrentPlaylist === true ) {
      this.setState({
        showCurrentPlaylist: false
      });
    }
  }

  _handlePatternClick = async (event, pattern) => {
    event.preventDefault()
    await this._startNewPlaylist(pattern)
  }

  storePlaylist = (patternNameToBeRemoved?: string, addNewPlaylist?: Object, mode) => {
    if (patternNameToBeRemoved === null && mode === "update") {
      console.log('trying to add to existing playlist')
      // add pattern name to existing playlist
      this.state.newPlaylist.map((pattern) => {
        const body = JSON.stringify({
          name: pattern.name,
          duration: pattern.duration
        })
        return this.apiRequest('POST',body, './playlist/addPattern')
            .then((playlistResults) => {
              return playlistResults;
            })
      })
    }
    if (patternNameToBeRemoved && mode === "remove") {
      // remove pattern name from playlist
      const body = JSON.stringify({
        name: patternNameToBeRemoved
      })
      return this.apiRequest('PUT', body, './playlist/removePattern')
          .then((playlistResults) => {
            return playlistResults;
          })
    }
    if (addNewPlaylist && mode === "create") {
      // create a new playlist with a new pattern
      const body = JSON.stringify({
        name: addNewPlaylist.name,
        duration: addNewPlaylist.duration
      })
      this.apiRequest('PUT', body, './playlist/newPlaylist')
          .then((playlistResults) => {
            return playlistResults;
          })
      this._launchPlaylistNow()
    }
  }

  _handleDurationChange = async (event, pattern, newDuration) => {
    event.preventDefault()
    const newValidDuration = parseFloat(newDuration) || 0
    const { playlist } = this.state
    const newTempPlaylist = playlist.slice()
    _(newTempPlaylist).find(['name', pattern.name]).duration = newValidDuration

    this.setState({
      newPlaylist: newTempPlaylist,
      playlistDefaultInterval: newValidDuration
    }, () => {
      setTimeout(() => {
        this.storePlaylist(null, null, "update")
      }, 10)
    })
  }

  addNewPatternToPlaylist = async (pattern, playlist, interval) => {
    console.log(`adding pattern ${pattern.name} to playlist`)
    playlist.push({ name: pattern.name, duration: interval })
    this.setState(
        { newPlaylist: playlist }, () => {
          setTimeout(() => {
            this.storePlaylist(null, null, "update")
          }, 10)
        })
    this._launchPlaylistNow()
  }

  removePatternFromPlaylist = async (pattern, clickedPlaylistIndex, playlistIndex) => {
    console.log(`removing pattern ${pattern.name} from playlist`)
    const newTempPlaylist = this.state.playlist.slice()
    newTempPlaylist.splice(clickedPlaylistIndex, 1)
    setTimeout(() => {
      const name = pattern.name
      this.storePlaylist(name, null, "remove")
    }, 100)
    this._launchPlaylistNow()
  }

  _handleAddClick = async (event, pattern) => {
    event.preventDefault()
    const {playlist, playlistIndex, playlistDefaultInterval} = this.state
    const clickedPlaylistIndex = _(playlist).findIndex(['name', pattern.name])
    if (clickedPlaylistIndex === -1) {
      if (!playlist.length) {
        await this._startNewPlaylist(pattern)
      } else {
        const newTempPlaylist = playlist.slice()
        await this.addNewPatternToPlaylist(pattern, newTempPlaylist, playlistDefaultInterval)
      }
    } else {
      await this.removePatternFromPlaylist(pattern, clickedPlaylistIndex, playlistIndex)
    }
  }

  async _startNewPlaylist(startingPattern) {
    const newTempPlaylist = { name: startingPattern.name, duration: this.state.playlistDefaultInterval }
    this.setState({
      playlist: newTempPlaylist,
      playlistIndex: 0
    }, () => {
      setTimeout(() => {
        this.storePlaylist(null, newTempPlaylist, "create");
      }, 100)
    })
  }
  _launchPlaylistNow() {
    const message = {
      type: 'LAUNCH_PLAYLIST_NOW'
    }
    sendMessage(message)
  }
  _getBrightnessNow() {
    const message = {
      type: 'GET_CURRENT_BRIGHTNESS'
    }
    sendMessage(message)
  }
  _getCurrentProgramState() {
    const message = {
      type: 'GET_CURRENT_PROGRAM_STATE'
    }
    sendMessage(message)
  }
  async _launchPatternAndSetTimeout() {
    await this._launchCurrentPattern()
  }

  async _launchCurrentPattern() {
    const { playlist, playlistIndex } = this.state
    const currentPatternName = playlist[playlistIndex].name
    const currentPattern = this.state.groups.find((pattern) => {
      return pattern.name === currentPatternName
    })
    if (currentPattern) {
      await this._launchPattern(currentPattern)
    } else {
      console.warn(`pattern with name ${currentPatternName} not found`)
    }
  }

  enableAllPatterns = (event) => {

    if (this.state.deactivateEnableAllButton) {
      return;
    }
    const message = {
      type: 'ENABLE_ALL_PATTERNS',
      duration: this.state.playlistDefaultInterval
    }
    sendMessage(message)
    // react processes state updates in batches and its
    // lifecycles make presenting this spinner awfully weird
    // this is a cruel hack to show a loader while processing all the patterns
    this.setState({ isProcessing: true }, () => {
      // const newPlaylist = this.state.playlist.slice();
      // await (this.state.groups).forEach((pattern) => {
      for (const pattern of this.state.groups) {
        // await (this.state.groups).forEach((pattern) => {
        if (((this.state.playlist).some(item => item.name !== pattern.name)) || (!(this.state.playlist.length))) {
          // this.addNewPatternToPlaylist(pattern, newPlaylist, this.state.playlistDefaultInterval)
        };
      }
      setTimeout(  () => {
        this.setState({
          isProcessing: false,
          deactivateEnableAllButton: true,
          deactivateDisableAllButton: false
        });
      }, 100)
    })
  }

  disableAllPatterns = () => {
    // for some reason we still have one enabled here... must remove them all
    if (this.state.deactivateDisableAllButton) {
      return;
    }

    const message = {
      type: 'DISABLE_ALL_PATTERNS'
    }
    sendMessage(message)
    // resetting playlist state to force UI to rerender
    this.setState({
      playlist: []
    })
    this.setState({
      deactivateEnableAllButton: false,
      deactivateDisableAllButton: true,
    });
  }

  handleReload = async (event) => {
    event.preventDefault();
    await fetch("/reload", {method:"POST"});
    //hasten a poll
    if (this.interval)
      clearTimeout((this.interval));
    this.interval = setTimeout(this.poll, 200);
  }

  openCloneDialog = async (event, sourceId) => {
    event.preventDefault();
    this.setState({
      cloneSource: sourceId
    });
    setTimeout(() => {
      this.cloneDialogRef.current && this.cloneDialogRef.current.scrollIntoView(true);
    }, 100)
  }

  closeCloneDialog = async (event) => {
    event.preventDefault();
    this.setState({
      cloneSource: null,
      cloneDest: {}
    });
  }
  setCloneDest = (id, checked) => {
    this.setState((state, props) => {
      let cloneDest = Object.assign({}, state.cloneDest);
      cloneDest[id] = checked;
      // console.log("cloneDest", cloneDest);
      return {cloneDest};
    });
  }

  handleClone = async (event) => {
    event.preventDefault();

    this.setState({
      cloneInProgress: true
    });

    let to = Object.keys(this.state.cloneDest).filter(k => this.state.cloneDest[k]);
    let from = this.state.cloneSource;
    const payload = {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({from, to})
    }
    await fetch('./clonePrograms', payload)

    this.setState({
      cloneSource: null,
      cloneDest: {},
      cloneInProgress: false
    });
  }

  _handleKeyDown = (event) => {
    if(event.key === '/') {
      // Toggle developer controls
      this.setState({
        showDevControls: !this.state.showDevControls
      });
    }
  }


  render() {
  const getStatus = (name) => {
      if (name === this.state.runningPatternName) {
        return 'running'
      } else if (_(this.state.playlist).map('name').includes(name)) {
        return 'queued'
      } else {
        return 'available'
      }
    }
    let cloneDialog = null;
    if (this.state.cloneSource) {
      // console.log("discoveries", this.state.discoveries);
      let source = this.state.discoveries.find((e) => e.id === this.state.cloneSource);
      cloneDialog = (
          <div className="row" ref={this.cloneDialogRef}>
            <div className="col-lg-12">

              <div className="card" >
                <div className="card-body">
                  <h5 className="card-title">Clone {source.name}</h5>
                  <h6 className="card-subtitle mb-2 text-danger">Overwrite all patterns on these controllers:</h6>

                  <form className="card-text">
                    {this.state.discoveries.filter(d => d.id !== source.id).map(d =>
                        <div className="form-group form-check">
                          <label className="form-check-label">
                            <input type="checkbox" className="form-check-input" checked={!!this.state.cloneDest[d.id]} onChange={(event) => this.setCloneDest(d.id, event.target.checked)}/>
                            {d.name} v{d.ver} @ {d.address}</label>
                        </div>
                    )}
                  </form>

                  {this.state.cloneInProgress && (
                      <h3>Cloning in progress, please wait...
                        <div
                            style={{marginLeft:"1em"}}
                            className="spinner-border" role="status">
                          <span className="sr-only">Loading...</span>
                        </div>
                      </h3>
                  )}
                  {!this.state.cloneInProgress && (
                      <>
                        <button className="card-link btn btn-primary" onClick={this.closeCloneDialog}>Cancel</button>
                        <button className="card-link btn btn-danger" onClick={this.handleClone}>Clone</button>
                        <div className="alert alert-danger" role="alert" style={{marginTop:"1em"}}>
                          Cloning is destructive and cannot be undone! After cloning, the destination controllers will exactly match the source.
                        </div>
                      </>
                  )}
                </div>
              </div>
            </div>
          </div>
      )
    }
    let playlistDialog = null
    if (this.state.showCurrentPlaylist) {
      playlistDialog = (
        <>
          <div className="row mx-xl-n4 mx-lg-n4 mx-md-n4 mx-n4" ref={this.playlistDialogRef}>
            <div className="py-1 col-xl-12 px-xl-4 col-lg-12 px-lg-4 col-md-12 col-12 px-4">
              <div className="row px-xl-2 pr-lg-2 px-md-2 px-2">
                <div className="col-xl-3 px-xl-1 mr-xl-auto col-lg-3 px-lg-1 mr-lg-auto col-md-4 px-md-1 mr-md-auto col-12 px-1">
                  <h3 className="">Current Playlist</h3>
                </div>
              </div>
            </div>
            <div className="py-1 col-xl-12 px-xl-4 col-lg-12 px-lg-4 col-md-12 col-12">
              <div className="row rows-cols-3">
                <div className="py-2 col-xl-auto px-xl-1 col-lg-auto px-lg-1 col-md-auto px-md-1 col-3 text-nowrap ml-3">
                  <button
                      className="btn btn-secondary text-left playlist btn-playlist-bulk"
                      disabled={this.state.deactivateEnableAllButton}
                      onClick={this.enableAllPatterns}>
                    Enable All
                  </button>
                </div>
                <div className="py-2 col-xl-auto px-xl-1 col-lg-auto px-lg-1 col-md-auto px-md-1 col-3 text-nowrap mr-1">
                  <button
                      className="btn btn-secondary text-left playlist btn-playlist-bulk"
                      disabled={this.state.deactivateDisableAllButton}
                      onClick={this.disableAllPatterns}>
                    Disable All
                  </button>
                </div>
                <div className="py-2 col-xl-auto px-xl-1 col-lg-auto px-lg-1 col-md-auto px-md-1 col-3 text-nowrap mr-1">
                  <button
                      className="btn btn-secondary text-left btn-playlist-bulk"
                      onClick={(e) => this.openPlaylistDialog(e)}>
                    Current Playlist
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <div className="card" >
                <div className="card-body">
                  <div className="border border-secondary row rows-cols-3">
                    <div className="col-5 p-1 mr-auto">
                      <p>Pattern</p>
                    </div>
                    <div className="col-3 p-1 col-auto">
                      <p>Duration</p>
                    </div>
                    <div className="col-3 p-1 col-auto">
                      <p>Status</p>
                    </div>
                  </div>
                  {Array.isArray(this.state.playlist) && (this.state.playlist).map( (pattern, index) =>
                    <div className="border border-secondary row rows-cols-3" key={index} >
                      <div className="col-5 p-1 mr-auto" >
                        {pattern.name}
                      </div>
                      <div className="col-3 p-1 col-auto">
                        {pattern.duration}
                      </div>
                      {(getStatus(pattern.name) === 'running') ? (
                          <div className="alert alert-success col-3 p-1 col-auto py-0 mb-0" role="alert">
                            running
                          </div>
                      ) : (
                          <div  className="alert alert-dark col-3 p-1 col-auto py-0 mb-0" role="alert">
                            queued
                          </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )
    }

    return (
        <div className="container">
          <header className="header clearfix">
            <nav>
              <ul className="nav nav-pills float-right">
                <li className="nav-item">
                  <a className="nav-link" href="https://www.bhencke.com/pixelblaze">About Pixelblaze</a>
                </li>
              </ul>
            </nav>
            <h3 className="text-muted">Pixelblaze Firestorm</h3>
          </header>

          <main role="main">
            <hr/>

            <div className="row mx-xl-n2 mx-lg-n3 mx-md-n3 mx-n3">
              <div className="py-1 col-xl-10 px-xl-2 col-lg-9 px-lg-3 col-md-8 px-md-3 col-6 px-1">
                <div className="row px-xl-1 px-lg-1 px-md-1 px-3">
                  <div className="col-xl-2 px-xl-1 col-lg-2 px-lg-1 col-md-4 col-10 px-2">
                    <h3>Controllers</h3>
                  </div>
                  <div className="col-xl-2 px-xl-2 col-lg-1 px-lg-5 col-md-2 col-2 px-2">
                    <button className="btn btn-primary " onClick={this.handleReload} style={{marginLeft:"6px"}}>↻</button>
                  </div>
                </div>
              </div>
              <div className="py-1 col-xl-1 px-xl-1 col-lg-3 px-lg-5 col-md-4 px-md-5 col-2 px-1">
                <div className="navbrightness no-learning-ui row no-gutters pull-right">
                  <label>
                    <span role="img" aria-label="light bulb emoji for pixelblaze brightness">💡</span>
                    <input
                        id="brightness"
                        type="range"
                        className="form-control"
                        onChange={async (e) => {
                          await this.changeBrightness(e)
                        }}
                        min="0"
                        max="1"
                        step=".005"
                        title={`Brightness ${Math.round(this.state.brightness * 100)  }%`}
                        value={(this.state.brightness !== null) && this.state.brightness}
                    />
                  </label>
                </div>
              </div>
            </div>
            {(this.state.downloadingDumpArchive) &&
              <div className="alert alert-danger" role="alert">
                WARNING: Do not navigate from or refresh this page.
                <br /> Currently downloading patterns from PixelBlaze.
                <br />Please wait until finished for browser to download archive. It should complete in a few seconds.
              </div>
            }
            <div className="row mx-xl-n2 mx-lg-n3 mx-md-n3 mx-n3">
              <div className="col-xl-12 px-xl-2 col-lg-12">
                <ul className="list-group" id="list">
                  {this.state.discoveries.map(d => {
                    const dName = d.name
                    return (
                        <li className="list-group-item" key={dName}>
                          <button className={"clone-btn btn btn-secondary float-right " + (!this.state.showDevControls && "d-none")}
                                  onClick={async (event) => await this.downloadPatternArchive(event, d.id)}>
                            Dump
                          </button>
                          <button className="clone-btn btn btn-secondary float-right" onClick={(event)=>this.openCloneDialog(event, d.id)}>Clone</button>
                          <a className="clone-btn btn btn-primary float-right" href={"http://" + d.address} target="_blank" rel="noopener noreferrer">Open</a>
                          <h5>{dName} v{d.ver} @ {d.address}</h5>
                        </li>
                    )
                  })}
                </ul>
              </div>
            </div>
            <hr/>

            {cloneDialog}
            {playlistDialog}
            <div className="row mx-xl-n4 mx-lg-n4 mx-md-n4 mx-n4">
              <div className="py-1 col-xl-12 px-xl-4 col-lg-12 px-lg-4 col-md-12 col-12 px-4">
                <div className="row px-xl-2 pr-lg-2 px-md-2 px-2">
                  <div className="col-xl-1 px-xl-1 mr-xl-auto col-lg-1 px-lg-1 mr-lg-auto col-md-1 px-md-1 mr-md-auto col-12 px-1">
                    <h3>
                      Patterns
                    </h3>
                  </div>
                </div>
              </div>
              <div className="py-1 col-xl-12 px-xl-4 col-lg-12 px-lg-4 col-md-12 col-12">
                <div className="row rows-cols-3">
                  <div className="py-2 col-xl-auto px-xl-1 col-lg-auto px-lg-1 col-md-auto px-md-1 col-3 text-nowrap ml-3">
                    <button
                        className="btn btn-secondary text-left playlist btn-playlist-bulk"
                        disabled={this.state.deactivateEnableAllButton}
                        onClick={this.enableAllPatterns}>
                      Enable All
                    </button>
                  </div>
                  <div className="py-2 col-xl-auto px-xl-1 col-lg-auto px-lg-1 col-md-auto px-md-1 col-3 text-nowrap mr-1">
                    <button
                        className="btn btn-secondary text-left playlist btn-playlist-bulk"
                        disabled={this.state.deactivateDisableAllButton}
                        onClick={this.disableAllPatterns}>
                      Disable All
                    </button>
                  </div>
                  <div className="py-2 col-xl-auto px-xl-1 col-lg-auto px-lg-1 col-md-auto px-md-1 col-3 text-nowrap mr-1">
                    <button
                        className="btn btn-secondary text-left btn-playlist-bulk"
                        onClick={(e) => this.openPlaylistDialog(e)}>
                      Current Playlist
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="list-group">
              {(this.state.isProcessing) &&
                  <div className="loader-container" role="status">
                    <div className="row no-gutters">
                      <p>Adding patterns to playlist, please wait</p>
                      <div className="spinner-border" style={{marginLeft:"1em"}}>
                        <span className="sr-only">Loading...</span>
                      </div>
                    </div>
                  </div>
              }
              {this.state.groups.map((pattern) => {
                const getDuration = () => {
                  const playlistIndex = _(this.state.playlist).findIndex(['name', pattern.name])
                  if (playlistIndex === -1) return ''
                  return this.state.playlist[playlistIndex].duration
                }

                return (
                    <PatternView
                        key={pattern.name}
                        pattern={pattern}
                        handlePatternClick={this._handlePatternClick}
                        handleDurationChange={this._handleDurationChange}
                        handleAddClick={this._handleAddClick}
                        status={getStatus(pattern.name)}
                        showDurations={(this.state.playlist.length > 1)}
                        duration={getDuration()}
                    />
                )
              })}
            </div>

          </main>

          <footer className="footer">
            <p>&copy; Ben Hencke {new Date().getFullYear()}</p>
          </footer>

        </div>
    );
  }
}

export default App;
