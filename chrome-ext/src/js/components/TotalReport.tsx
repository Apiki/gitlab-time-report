import * as React from 'react'

import { firebaseDb, dbCollections } from '../firebase'
import { IReportBoxState,
         ITimeNote,
         IProject,
         IReportMeta } from '../types'
import CommonUtil from '../utils/common-util'
import DateUtil from '../utils/date-util'
import FlashMessage from './FlashMessage'
import ReportTable from './ReportTable'
require('../../css/TotalReport.scss')

const ALL = 'all'
const DEF_PROJECT: IProject = {id: 0, name: 'all'}

const ONE_DAY_MILI_SECONDS = 24 * 60 * 60 * 1000

export default class TotalReport extends React.Component<{}, IReportBoxState> {
  private unsubscribe: () => void

  constructor(props: {}) {
    super(props)
    this.state = {
      enableDomains: {},
      projects: [DEF_PROJECT],
      users: [ALL],

      selectedDomain: '', // TODO
      selectedUser: ALL,
      selectedProjectId: 0,

      dateFrom: '',
      dateTo: '',

      aggreReport: {},
      message: 'loading...',
      showBtns: false,
    }
    this.unsubscribe = null
  }

  componentDidMount() {
    this.initData()
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe()
  }

  initData = () => {
    this.loadDomains()
      .then((domain: string) => Promise.all([this.loadProjects(domain), this.loadUsers(domain)]))
      .then(() => this.setState({message: '', showBtns: true}))
      .catch((err: any) => {
        this.setState({message: CommonUtil.formatFirebaseError(err)})
      })
  }

  loadDomains = () => {
    return firebaseDb.collection(dbCollections.DOMAINS)
      .doc('enables')
      .get()
      .then((snapshot: any) => {
        if (snapshot.exists) {
          const enableDomains = snapshot.data()
          const key = Object.keys(enableDomains)[0]
          const selectedDomain = enableDomains[key]
          this.setState({enableDomains, selectedDomain})
          return selectedDomain
        } else {
          throw new Error('has no enabled domain')
        }
      })
  }

  loadProjects = (domain: string) => {
    return firebaseDb.collection(dbCollections.DOMAINS)
      .doc(domain)
      .collection(dbCollections.PROJECTS)
      .orderBy('name')
      .get()
      .then((querySnapshot: any) => {
        let projects: IProject[] = [DEF_PROJECT]
        querySnapshot.forEach((snapshot: any) => projects.push(snapshot.data()))
        this.setState({projects})
      })
  }

  loadUsers = (domain: string) => {
    return firebaseDb.collection(dbCollections.DOMAINS)
      .doc(domain)
      .collection(dbCollections.USERS)
      .orderBy('username')
      .get()
      .then((querySnapshot: any) => {
        let users: string[] = [ALL]
        querySnapshot.forEach((snapshot: any)=>users.push(snapshot.data().username))
        this.setState({users})
      })
  }

  inputChange = (event: any) => {
    const target  = event.target
    let value = target.type === 'checkbox' ? target.checked : target.value
    const name = target.name

    if (name === 'selectedProjectId') {
      value = parseInt(value)
    }

    this.setState({
      [name]: value
    })
  }

  chooseToday = () => {
    const todayDate = DateUtil.getTodayDate()
    this.setState({
      dateFrom: todayDate,
      dateTo: todayDate,
    })
  }

  chooseThisWeek = () => {
    const thisWeekRange = DateUtil.getThisWeekRange()
    this.setState({
      dateFrom: thisWeekRange[0],
      dateTo: thisWeekRange[1]
    })
  }

  chooseLastWeek = () => {
    const lastWeekRange = DateUtil.getLastWeekRange()
    this.setState({
      dateFrom: lastWeekRange[0],
      dateTo: lastWeekRange[1]
    })
  }

  chooseThisMonth = () => {
    const thisMonthRange = DateUtil.getThisMonthRange()
    this.setState({
      dateFrom: thisMonthRange[0],
      dateTo: thisMonthRange[1]
    })
  }

  queryTimeLogs = () => {
    this.unsubscribe && this.unsubscribe()

    this.setState({message: 'applying...', aggreReport: {}, showBtns: false})

    const { selectedDomain, selectedProjectId, selectedUser, dateFrom, dateTo } = this.state

    let query = firebaseDb.collection(dbCollections.DOMAINS)
      .doc(selectedDomain)
      .collection(dbCollections.TIME_LOGS)

    if (dateFrom !== '') {
      query = query.where('spentDate', '>=', dateFrom)
    } else {
      query = query.limit(1000)
    }
    if (dateTo !== '') {
      query = query.where('spentDate', '<=', dateTo)
    } else {
      query = query.where('spentDate', '<=', DateUtil.getDateFormat(new Date()))
    }
    if (selectedProjectId !== 0) {
      query = query.where('project_id', '==', selectedProjectId)
    }
    if (selectedUser !== ALL) {
      query = query.where('author', '==', selectedUser)
    }
    query = query.orderBy('spentDate', 'desc')

    this.unsubscribe = query.onSnapshot((snapshot: any) => {
        let timeLogs: Array<ITimeNote> = []
        snapshot.forEach((s: any) => timeLogs.push(s.data()))
        this.aggregateTimeLogs(timeLogs)
      }, (err: any) => {
        this.setState({message: CommonUtil.formatFirebaseError(err), showBtns: true})
      })
  }

  aggregateTimeLogs(timeLogs: Array<ITimeNote>) {
    let aggreReport: any = {}
    timeLogs.forEach(timeLog => {
      const project = timeLog.project_id
      const user = timeLog.author
      const spentAt = timeLog.spentDate
      const spentTime = timeLog.spentTime

      aggreReport[project] = aggreReport[project] || {}
      aggreReport[project][user] = aggreReport[project][user] || {}
      aggreReport[project][user][spentAt] = aggreReport[project][user][spentAt] || 0
      aggreReport[project][user][spentAt] += spentTime

      // a virtual 'total' date for every user
      aggreReport[project][user]['total'] = aggreReport[project][user]['total'] || 0
      aggreReport[project][user]['total'] += spentTime

      // a virtual 'total' user for every project
      aggreReport[project]['total'] = aggreReport[project]['total'] || {}
      aggreReport[project]['total'][spentAt] = aggreReport[project]['total'][spentAt] || 0
      aggreReport[project]['total'][spentAt] += spentTime

      // a virtual 'total' date for every project's 'total' user
      aggreReport[project]['total']['total'] = aggreReport[project]['total']['total'] || 0
      aggreReport[project]['total']['total'] += spentTime

      // aggregate users
      aggreReport[project]['users'] = aggreReport[project]['users'] || []
      if (!aggreReport[project]['users'].includes(user)) {
        aggreReport[project]['users'].push(user)
      }

      // aggregate dates
      aggreReport[project]['dates'] = aggreReport[project]['dates'] || []
      if (!aggreReport[project]['dates'].includes(spentAt)) {
        aggreReport[project]['dates'].push(spentAt)
      }
    })
    this.setState({message: '', aggreReport, showBtns: true})
  }

  renderProjectSelector() {
    const { projects, selectedProjectId } = this.state
    return (
      <select name='selectedProjectId'
              value={selectedProjectId}
              onChange={this.inputChange}>
        {
          projects.map(project =>
            <option value={project.id}
                    key={project.id}>
              {project.name}
            </option>
          )
        }
      </select>
    )
  }

  renderUserSelector() {
    const { users, selectedUser } = this.state
    return (
      <select name='selectedUser'
              value={selectedUser}
              onChange={this.inputChange}>
        {
          users.map(user =>
            <option value={user}
                    key={user}>
              {user}
            </option>
          )
        }
      </select>
    )
  }

  renderReports() {
    const { projects, aggreReport } = this.state
    return projects.map(project => {
      const projectAggreResult = (aggreReport as any)[project.id]
      const projectInfo: IReportMeta = {
        type: 'project',
        id: project.id,
        name: project.name,
        link: ''
      }
      return <ReportTable aggreReport={projectAggreResult} reportFor={projectInfo}/>
    })
  }

  render() {
    return (
      <div className='report-box-container'>
        <div className='report-filters'>
          <div className='filters-container'>
            { this.renderProjectSelector() }
            { this.renderUserSelector() }
          </div>
          <div className='filters-container'>
            <input type='date'
                   name='dateFrom'
                   value={this.state.dateFrom}
                   onChange={this.inputChange}/>
            <input type='date'
                   name='dateTo'
                   value={this.state.dateTo}
                   onChange={this.inputChange}/>
            <button onClick={this.chooseToday}>Today</button>
            <button onClick={this.chooseThisWeek}>This Week</button>
            <button onClick={this.chooseLastWeek}>Last Week</button>
            <button onClick={this.chooseThisMonth}>This Month</button>
          </div>
          {
            this.state.showBtns &&
            <button onClick={this.queryTimeLogs} className='btn btn-default'>Apply</button>
          }
        </div>
        <div className='report-result'>
          { this.renderReports() }
          <FlashMessage message={this.state.message}/>
        </div>
      </div>
    )
  }
}
