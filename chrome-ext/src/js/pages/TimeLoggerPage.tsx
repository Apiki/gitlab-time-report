import * as React from 'react'

import AuthBox from '../components/AuthBox'
import TimeLoggerBox from '../components/TimeLoggerBox'
import IssueReport from '../components/IssueReport'
import { IssuePageContext } from '../contexts'
import { IIssueInfo, IIssuePageInfo } from '../types'

export default class TimeLoggerPage extends React.Component {
  render() {
    return (
      <IssuePageContext.Consumer>
        { (issuePageInfo: IIssuePageInfo) => 
          <AuthBox curGitlabUser={issuePageInfo.curGitlabUser}>
            <IssueReport/>
          </AuthBox>
        }
      </IssuePageContext.Consumer>
    )
  }
}
