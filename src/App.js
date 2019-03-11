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
      patternSequenceIndex: 0
    }
    this.poll = this.poll.bind(this);

    this._sequenceInterval = null
  }

  async poll() {
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
      console.log(groups);

      this.setState({discoveries, groups})
    } catch (err) {
      this.setState({err})
    }
    if (!this.unmounting)
      this.interval = setTimeout(this.poll, 1000)
  }

  componentDidMount() {
    this.poll();
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
    console.log('launching pattern', pattern)
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
        console.log(`adding pattern ${pattern.name} to sequence`)
        const newPatternNameSequence = patternNameSequence.slice()
        newPatternNameSequence.push(pattern.name)
        this.setState({ patternNameSequence: newPatternNameSequence })
      }
    } else {
      console.warn('pattern already in sequence, ignoring')
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

  render() {
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
                <h3>Controllers</h3>
                <ul className="list-group col-lg-8" id="list">
                  {this.state.discoveries.map(d =>
                      <li className="list-group-item">
                        <a className="btn btn-primary float-right" href={"http://" + d.address} target="_blank">Open</a>
                        <h5>{d.name || "Pixelblaze_" + d.id} v{d.ver} @ {d.address}</h5>
                      </li>
                  )}
                </ul>
              </div>
            </div>
            <hr/>

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
            <p>&copy; Ben Hencke 2018</p>
          </footer>

        </div>
    );
  }
}

export default App;
