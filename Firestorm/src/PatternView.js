import React, {Component} from 'react'
import _ from 'lodash'

class PatternView extends Component { 

  render() {
    const { pattern, status } = this.props

    const renderStatusElement = () => {
      if (status === 'running') {
        return <i className="fas fa-play" title="Running now"></i>
      }
      if (status === 'sequenced') {
        return <i className="fas fa-clock" title="In current sequence"></i>
      }
      return (
        <a href="#" onClick={this._handleAddClick}>
          <i className="fas fa-plus" title="Add to sequence"></i>
        </a>
      )
    }

    return (
      <div className="row">
        <div className="col">
          <a
            key={pattern.name}
            href="#"
            className="list-group-item"
            onClick={this._handlePatternClick}
          >
            <h5>{pattern.name}</h5>
            <em>
              <small>{_.map(pattern.pixelblazes, 'name').join(', ')}</small>
            </em>
          </a>
        </div>
        <div className="col-1">
          {renderStatusElement()}
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

}

export default PatternView
