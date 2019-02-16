import React, {Component} from 'react'
import _ from 'lodash'

class PatternView extends Component {

  render() {
    const { pattern, status } = this.props

    const renderStatusElement = () => {
      if (status === 'running') {
        return <i class="fas fa-play" title="Running now"></i>
      }
      if (status === 'sequenced') {
        return <i class="fas fa-clock" title="In current sequence"></i>
      }
      return (
        <a href="#" onClick={this._handleAddClick}>
          <i class="fas fa-plus" title="Add to sequence"></i>
        </a>
      )
    }

    return (
      <div class="row">
        <div class="col">
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
        <div class="col-1">
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
