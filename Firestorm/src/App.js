import React, {Component} from 'react';
import './App.css';
import _ from 'lodash';

import PatternView from './PatternView'

const SEQUENCE_SHUFFLE_MS = 15000  // TODO: Make this user-controllable

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      discoveries: [],
      groups: [],
      runningPatternName: null,
      patternNameSequence: [],
      patternSequenceIndex: 0,
      cloneSource: null,
      cloneDest: {},
      cloneInProgress: false,
      showDevControls: false,
      letters: "LOVE"
    }
    this.poll = this.poll.bind(this);

    this._sequenceInterval = null

    this.cloneDialogRef = React.createRef();
  }

  async poll() {
    if (this.interval)
      clearTimeout(this.interval);
    let res = await fetch('./discover')
    try {
      let discoveries = await res.json();

      let groupByName = {};
      _.each(discoveries, d => {
        _.each(d.programList, p => {
          let pb = {
            id: d.id,
            name: d.name || 'Pixelblaze_' + d.id
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

      this.setState({discoveries, groups})
    } catch (err) {
      this.setState({err})
    }
    if (!this.unmounting)
      this.interval = setTimeout(this.poll, 1000)
  }

  componentDidMount() {
    this.poll();
    document.addEventListener("keydown", this._handleKeyDown);
  }

  componentWillUnmount() {
    this.unmounting = true;
    clearInterval(this.interval);
    clearInterval(this._sequenceInterval)
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
    await this._startNewSequence(pattern)
  }

  _handleAddClick = async (event, pattern) => {
    event.preventDefault()
    const { patternNameSequence } = this.state
    if (patternNameSequence.indexOf(pattern.name) === -1) {
      if (!patternNameSequence.length) {
        this._startNewSequence(pattern)
      } else {
        // console.log(`adding pattern ${pattern.name} to sequence`)
        const newPatternNameSequence = patternNameSequence.slice()
        newPatternNameSequence.push(pattern.name)
        this.setState({ patternNameSequence: newPatternNameSequence })
      }
    } else {
      console.warn('pattern already in sequence, ignoring')
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
    let res = await fetch('./clonePrograms', payload)

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

  async _startNewSequence(startingPattern) {
    clearInterval(this._sequenceInterval)
    this.setState({
      patternNameSequence: [startingPattern.name],
      patternSequenceIndex: 0
    }, () => {
      this._launchPatternAndSetTimeout()
    })
  }

  async _launchPatternAndSetTimeout() {
    await this._launchCurrentPattern()
    this._sequenceInterval = setTimeout(() => {
      const { patternNameSequence, patternSequenceIndex } = this.state
      const nextIndex = (patternSequenceIndex + 1) % patternNameSequence.length
      this.setState({ patternSequenceIndex: nextIndex }, () => this._launchPatternAndSetTimeout())
    }, SEQUENCE_SHUFFLE_MS)
  }

  async _launchCurrentPattern() {
    const { patternNameSequence, patternSequenceIndex } = this.state
    const currentPatternName = patternNameSequence[patternSequenceIndex]
    const currentPattern = this.state.groups.find((pattern) => {
      return pattern.name === currentPatternName
    })
    if (currentPattern) {
      await this._launchPattern(currentPattern)
    } else {
      console.warn(`pattern with name ${currentPatternName} not found`)
    }
  }

  handleLettersChange = (event) => {
    //TODO: validation - correct number of chars, valid chars
  }

  handleLettersSubmit = (event) => {
    this.setState({letters: event.target.letters});
    event.preventDefault();
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
                            {d.name || "Pixelblaze_" + d.id} v{d.ver} @ {d.address}</label>
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
                  {!this.state.cloneInProgress && (<>
                    <a className="card-link btn btn-primary" onClick={this.closeCloneDialog}>Cancel</a>
                    <a className="card-link btn btn-danger" onClick={this.handleClone}>Clone</a>
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
                  <a className="btn btn-primary " onClick={this.handleReload} style={{marginLeft:"1em"}}>↻</a>
                </h3>
                <ul className="list-group col-lg-8" id="list">
                  {this.state.discoveries.map(d =>
                      <li className="list-group-item">
                        <a className={"btn btn-secondary float-right " + (!this.state.showDevControls && "d-none")} href={"controllers/" + d.id + "/dump"} download>Dump</a>
                        <a className="btn btn-secondary float-right" onClick={(event)=>this.openCloneDialog(event, d.id)}>Clone</a>
                        <a className="btn btn-primary float-right" href={"http://" + d.address} target="_blank">Open</a>
                        <h5>{d.name || "Pixelblaze_" + d.id} v{d.ver} @ {d.address}</h5>
                      </li>
                  )}
                </ul>
                <hr/>

                <h4>Letters</h4>
                <form onSubmit={this.handleLettersSubmit}>
                  <label>
                    <input type="text" value={this.state.value} onChange={this.handleLettersChange} />
                  </label>
                  <input type="submit" value="Submit" />
                </form>
                <div>
                  Currently displaying: {this.state.letters}
                </div>
              </div>
            </div>
            <hr/>

            {cloneDialog}

            <h3>Patterns</h3>
            <div className="list-group">
              {this.state.groups.map((pattern) => {
                const getStatus = () => {
                  if (pattern.name === this.state.runningPatternName) {
                    return 'running'
                  } else if (this.state.patternNameSequence.indexOf(pattern.name) !== -1) {
                    return 'sequenced'
                  } else {
                    return 'available'
                  }
                }

                return (
                  <PatternView
                    pattern={pattern}
                    handlePatternClick={this._handlePatternClick}
                    handleAddClick={this._handleAddClick}
                    status={getStatus()}
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
