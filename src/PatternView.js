import React, {Component} from 'react'
import _ from 'lodash'

class PatternView extends Component {
  constructor(props) {
    super(props);
    this._handleDurationChange = this._handleDurationChange.bind(this);
  }

  render() {
    const { pattern, status, duration, showDurations } = this.props

    const renderDurationElement = () => {
      if (showDurations && status !== 'available') {
        return (
          <div className="input-group playlistSec">
            <input
              className="form-control patternDuration"
              type="number"
              min="0"
              step="0.1"
              placeholder="0"
              pattern="[\d\.]+"
              value={duration}
              onChange={this._handleDurationChange} />
            <div className="input-group-append">
              <div className="input-group-text">⏱</div>
            </div>
          </div>
        )
      }
    }

    const renderStatusElement = () => {
      if (status === 'running') {
        return <i className="fas fa-play" title="Running now"></i>
      }
      if (status === 'queued') {
        return <i className="fas fa-clock" title="In current playlist"></i>
      }
      return (
        <i className="fas fa-plus" title="Add to playlist"></i>
      )
    }

    return (
      <div className="row no-gutters list-group-item py-0 pr-3">
        <div className="row align-items-center">
          <div className="col p-0">
            <button 
              className="btn btn-link w-100 p-0 text-left"
              onClick={this._handlePatternClick}>
              <div className="p-3">
                <h5>{pattern.name}</h5>
                <em>
                  <small>{_.map(pattern.pixelblazes, 'name').join(', ')}</small>
                </em>
              </div>
            </button>
          </div>
          <div className="col-2 p-3">
            {renderDurationElement()}
          </div>
          <button
            className="col-1 btn-dark btn-playlist-add"
            disabled={status === "running"}
            onClick={this._handleAddClick}>
            {renderStatusElement()}
          </button>
        </div>
      </div>
    )
  }

  _handlePatternClick = (evt) => {
    this.props.handlePatternClick(evt, this.props.pattern)
  }

  _handleAddClick = (evt) => {
    this.props.handleAddClick(evt, this.props.pattern)
  }

  _handleDurationChange = (evt) => {
    this.props.handleDurationChange(evt, this.props.pattern, evt.target.value)
  }

}

export default PatternView
