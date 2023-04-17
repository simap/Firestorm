import React, {Component} from 'react';
import './App.css';
import _ from 'lodash';

import PatternView from './PatternView'

const PLAYLIST_KEY = "firestorm:playlists:0"

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      discoveries: [],
      groups: [],               // Currently discovered patterns and their controllers
      runningPatternName: null,
      playlist: [],             // Browser-persisted single playlist singleton
      playlistIndex: 0,
      playlistDefaultInterval: 15,
      cloneSource: null,
      cloneDest: {},
      cloneInProgress: false,
      showDevControls: false,
      showCurrentPlaylist: false,
    }
    // The playlist is the only thing currently persisted, and it is per-browser
    this.state.playlist = JSON.parse(localStorage.getItem(PLAYLIST_KEY)) || []

    if (this.state.playlist.length) {
      this.state.playlistDefaultInterval = _(this.state.playlist).last().duration
    }

    this.poll = this.poll.bind(this);

    this._playlistInterval = null

    this.cloneDialogRef = React.createRef();
    this.playlistDialogRef = React.createRef();
  }

  async poll() {
    if (this.interval)
      clearTimeout(this.interval);
    let res = await fetch('./discover')
    try {
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
    if (!this.unmounting)
      this.interval = setTimeout(this.poll, 1000)
  }

  async componentDidMount() {
    document.addEventListener("keydown", this._handleKeyDown);
    await this.poll()
    if (this.state.playlist.length) this._launchPatternAndSetTimeout()
  }

  componentWillUnmount() {
    this.unmounting = true;
    clearInterval(this.interval)
    clearInterval(this._playlistInterval)
  }

  async _launchPattern(pattern) {
    if (this.state.runningPatternName === pattern.name) {
      console.warn(`pattern ${pattern.name} is already running, ignoring launch request`)
      return
    }
    // console.log('launching pattern', pattern)
    return new Promise((resolve) => {
      this.setState({ runningPatternName: pattern.name }, () => {
        const payload = {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            command: {
              programName: pattern.name
            },
            ids: _.map(pattern.pixelblazes, 'id')
          })
        }
        resolve(fetch('./command', payload))
      })
    })
  }

  _handlePatternClick = async (event, pattern) => {
    event.preventDefault()
    await this._startNewPlaylist(pattern)
  }

  storePlaylist = () => {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(this.state.playlist))
  }

  _handleDurationChange = async (event, pattern, newDuration) => {
    event.preventDefault()
    const newValidDuration = parseFloat(newDuration) || 0
    const { playlist } = this.state
    const newPlaylist = playlist.slice()
    _(newPlaylist).find(['name', pattern.name]).duration = newValidDuration

    this.setState({
      playlist: newPlaylist,
      playlistDefaultInterval: newValidDuration
    }, this.storePlaylist)
  }

  _handleAddClick = async (event, pattern) => {
    event.preventDefault()
    const { playlist, playlistIndex, playlistDefaultInterval } = this.state
    const clickedPlaylistIndex = _(playlist).findIndex(['name', pattern.name])
    if (clickedPlaylistIndex === -1) {
      if (!playlist.length) {
        this._startNewPlaylist(pattern)
      } else {
        // console.log(`adding pattern ${pattern.name} to playlist`)
        const newPlaylist = playlist.slice()
        newPlaylist.push({ name: pattern.name, duration: playlistDefaultInterval })
        this.setState({ playlist: newPlaylist }, this.storePlaylist)
      }
    } else {
      if (clickedPlaylistIndex !== playlistIndex) {
        // console.log(`removing pattern ${pattern.name} from playlist`)
        const newPlaylist = playlist.slice()
        newPlaylist.splice(clickedPlaylistIndex, 1)
        this.setState({ playlist: newPlaylist }, this.storePlaylist)
      }
    }
  }

  async _startNewPlaylist(startingPattern) {
    clearInterval(this._playlistInterval)
    this.setState({
      playlist: [{ name: startingPattern.name, duration: this.state.playlistDefaultInterval }],
      playlistIndex: 0
    }, () => {
      this.storePlaylist()
      this._launchPatternAndSetTimeout()
    })
  }

  async _launchPatternAndSetTimeout() {
    await this._launchCurrentPattern()
    const { playlist, playlistIndex } = this.state
    this._playlistInterval = setTimeout(() => {
      const { playlist, playlistIndex } = this.state
      const nextIndex = (playlistIndex + 1) % playlist.length
      this.setState({ playlistIndex: nextIndex }, () => this._launchPatternAndSetTimeout())
    }, playlist[playlistIndex].duration * 1000)
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
        <div className="row" ref={this.playlistDialogRef}>
          <div className="col-lg-8">
            <div className="card" >
              <div className="card-body">
                <h5 className="card-title">Current Playlist</h5>
                <div className="row no-gutters align-items-center">
                  <div className="col-md-7 p-0">
                    <p>Pattern</p>
                  </div>
                  <div className="col-md-1 align-items-center row py-0 pr-0 text-left">
                    <p>Duration(seconds)</p>
                  </div>
                </div>
                {(this.state.playlist).map( (pattern, index) =>
                  <div className="row no-gutters list-group-item py-0 pr-0" key={index}>
                    <div className="row align-items-center">
                      <div className="col-md-6 p-0">
                        <div className="p-2 m-auto">
                          {pattern.name}
                        </div>
                      </div>
                      <div className="col-md-1 py-0 pr-0 row no-gutters text-left">
                        <div className="p-2 m-auto">
                          {pattern.duration}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
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

            <div className="row">
              <div className="col-lg-12">

                <h3>Controllers
                  <button className="btn btn-primary " onClick={this.handleReload} style={{marginLeft:"1em"}}>↻</button>
                </h3>
                <ul className="list-group col-lg-8" id="list">
                  {this.state.discoveries.map(d => {
                    const dName = d.name
                    return (
                      <li className="list-group-item" key={dName}>
                        <a className={"btn btn-secondary float-right " + (!this.state.showDevControls && "d-none")} href={"controllers/" + d.id + "/dump"} download>Dump</a>
                        <button className="btn btn-secondary float-right" onClick={(event)=>this.openCloneDialog(event, d.id)}>Clone</button>
                        <a className="btn btn-primary float-right" href={"http://" + d.address} target="_blank" rel="noopener noreferrer">Open</a>
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
            <h3>
              Patterns
              <button
                  className="btn btn-secondary float-right text-left"
                  onClick={(e) => this.openPlaylistDialog(e)}>
                View Current Playlist
              </button>
            </h3>
            <div className="list-group">
              {this.state.groups.map((pattern) => {
                const getStatus = () => {
                  if (pattern.name === this.state.runningPatternName) {
                    return 'running'
                  } else if (_(this.state.playlist).map('name').includes(pattern.name)) {
                    return 'queued'
                  } else {
                    return 'available'
                  }
                }
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
                    status={getStatus()}
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
