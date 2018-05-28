import * as React from 'react'

import { firebaseDb } from '../firebase/firebase'
import DateUtil from '../utils/date-util'
import TimeLogItem from './TimeLogItem'
import TimeLogEditor from './TimeLogEditor'
import { ITimeLog,
         ITimeLogDetail,
         ITimeLogDoc,
         ITimeLoggerBoxProps,
         ITimeLoggerBoxState } from '../types'
require('../../css/TimeLoggerBox.scss')

class TimeLoggerBox extends React.Component<ITimeLoggerBoxProps, ITimeLoggerBoxState> {
  private unsubscribe: () => void

  constructor(props: ITimeLoggerBoxProps) {
    super(props)
    this.state = {
      timeLogs: [],
      issueDocRef: null
    }
  }

  componentDidMount() {
    this.findOrCreateIssue()
      .then((issueDocRef: any)=>{
        this.setState({issueDocRef}, ()=>{
          this.loadTimeLogs()
          this.updateIssueDoc()
          this.findOrCreateProject()
        })
      })
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe()
  }

  findOrCreateIssue() {
    const { curIssue } = this.props.issuePageInfo
    return firebaseDb.collection('issues')
      .where('type', '==', curIssue.type)
      .where('num', '==', curIssue.num)
      .where('createdBy', '==', curIssue.createdBy)
      .where('issueCreatedAt', '==', curIssue.issueCreatedAt)
      .limit(1)
      .get()
      .then((snapshot: any) => {
        let issueDocRef
        snapshot.forEach((ref: any)=>issueDocRef=ref)
        if (issueDocRef) {
          return issueDocRef
        } else {
          return firebaseDb.collection('issues')
            .add(curIssue)
        }
      })
      .catch((err: Error)=>console.log(err.message))
  }

  updateIssueDoc() {
    const { curIssue } = this.props.issuePageInfo
    const { issueDocRef } = this.state
    const issueDoc = issueDocRef.data()
    if (issueDoc.title !== curIssue.title ||
        issueDoc.project !== curIssue.project) {
      issueDocRef.update({
        title: curIssue.title,
        proect: curIssue.project
      })
      .then(()=>console.log('update issue ok'))
      .catch((err: Error)=>console.log(err.message))
    }
  }

  findOrCreateProject() {
    const { curIssue } = this.props.issuePageInfo
    firebaseDb.collection('projects')
      .where('name', '==', curIssue.project)
      .limit(1)
      .get()
      .then((snapshot: any) => {
        if (snapshot.empty) {
          return firebaseDb.collection('projects')
            .add({name: curIssue.project})
        } else {
          throw new Error('project existed')
        }
      })
      .then(()=>console.log('save project ok'))
      .catch((err: Error)=>console.log(err.message))
  }

  loadTimeLogs() {
    const { issueDocRef } = this.state
    this.unsubscribe =
      firebaseDb.collection('time-logs')
        .where('issueDocId', '==', issueDocRef.id)
        .orderBy('createdAt')
        .onSnapshot(
          (snapshot: any) => {
            let timeLogs:Array<ITimeLogDoc> = []
            snapshot.forEach((doc: any) => timeLogs.push({
              ...doc.data(),
              createdAt: doc.data().createdAt.toDate(),
              spentAt: doc.data().spentAt.toDate(),
              docId: doc.id,
            }))
            this.setState({timeLogs})
          },
          (err: Error) => {
            console.log(err.message)
          }
        )
  }

  addTimeLog = (timeLog: ITimeLog) => {
    const { issuePageInfo } = this.props
    const { issueDocRef } = this.state
    const timeLogDetail: ITimeLogDetail = {
      ...timeLog,
      gitlabUser: issuePageInfo.curGitlabUser,
      issueDocId: issueDocRef.id,
      project: issuePageInfo.curIssue.project,
      createdAt: new Date(),
    }
    firebaseDb.collection('time-logs')
      .add(timeLogDetail)
      .then((docRef: any) => console.log(docRef.id))
      .catch((err: Error) => console.log(err.message))
  }

  deleteTimeLog = (timeLog: ITimeLogDoc) => {
    firebaseDb.collection('time-logs')
              .doc(timeLog.docId)
              .delete()
              .then(() => console.log('delete ok'))
              .catch((err: Error) => console.log(err.message))
  }

  updateTimeLog = (timeLog: ITimeLogDoc) => {
    firebaseDb.collection('time-logs')
              .doc(timeLog.docId)
              .update({
                spentTime: timeLog.spentTime,
                spentAt: timeLog.spentAt
              })
              .then(() => console.log('update ok'))
              .catch((err: Error) => console.log(err.message))
  }

  renderTimeLogs = () => {
    return this.state.timeLogs.map(item =>
      <TimeLogItem key={item.docId}
                   timeLog={item}
                   onDelete={this.deleteTimeLog}
                   onUpdate={this.updateTimeLog}/>
    )
  }

  render() {
    return (
      <div className='time-logger-container'>
        { this.renderTimeLogs() }
        <br/>
        {
          this.state.issueDocRef &&
          <TimeLogEditor onAdd={this.addTimeLog}/>
        }
      </div>
    )
  }
}

////////////////////////////////

import { IssuePageContext } from '../contexts'
import { IIssuePageInfo } from '../types'

const TimeLoggerBoxWrapper = (props: {}) =>
  <IssuePageContext.Consumer>
    {
      (issuePageInfo: IIssuePageInfo) =>
      <TimeLoggerBox 
        issuePageInfo={issuePageInfo}
        {...props}/>
    }
  </IssuePageContext.Consumer>

export default TimeLoggerBoxWrapper
