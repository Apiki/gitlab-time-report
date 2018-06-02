import * as React from 'react'
import { firebaseAuth } from '../firebase/firebase'
import { IAuthBoxState } from '../types/interfaces'
import TimeLoggerBox from './TimeLoggerBox'
require('../../css/AuthBox.scss')

export default class AuthBox extends React.Component<{}, IAuthBoxState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      user: null,
      email: '',
      password: '',
      loading: true,
      message: 'loading...'
    }
  }

  componentDidMount() {
    this.loadAuthState()
  }

  loadAuthState() {
    firebaseAuth.onAuthStateChanged((user: any) => {
      this.setState({user, loading: false, message: ''})
    })
  }

  signOut = () => {
    firebaseAuth.signOut()
  }

  logIn = () => {
    const { email, password } = this.state
    firebaseAuth.signInWithEmailAndPassword(email, password)
      .catch((err: Error) => this.setState({message: err.message}))
  }

  register = () => {
    const { email, password } = this.state
    firebaseAuth.createUserWithEmailAndPassword(email, password)
      .catch((err: Error) => this.setState({message: err.message}))
  }

  resetPwd = () => {
    const { email } = this.state
    firebaseAuth.sendPasswordResetEmail(email)
      .then(() => this.setState({message: 'email sent!'}))
      .catch((err: Error) => this.setState({message: err.message}))
  }

  inputChange = (event: any) => {
    const target = event.target
    const value = target.type === 'checkbox' ? target.checked : target.value
    const name = target.name

    this.setState({
      [name]: value.trim()
    })
  }

  renderLoggedInStatus() {
    const { user } = this.state
    return (
      <div>
        <span>{user.displayName || user.email} has logged in.</span>
        <button onClick={this.signOut}>Sign Out</button>
        <TimeLoggerBox/>
      </div>
    )
  }

  renderSignedOutStatus() {
    return (
      <div>
        <input type='text' name='email' onChange={this.inputChange}/>
        <input type='password' name='password' onChange={this.inputChange}/>
        <button onClick={this.logIn}>Log In</button>
        <button onClick={this.register}>Register</button>
        <button onClick={this.resetPwd}>Reset Password</button>
      </div>
    )
  }

  render() {
    const { user, loading, message } = this.state
    return (
      <div className='auth-box-container'>
        <p className='msg'>{message}</p>
        {
          !loading && user &&
          this.renderLoggedInStatus()
        }
        {
          !loading && !user &&
          this.renderSignedOutStatus()
        }
      </div>
    )
  }
}
