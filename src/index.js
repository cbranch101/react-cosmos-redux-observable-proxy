import React, { Component } from 'react'
import PropTypes from 'prop-types'

export default ({
  createStore,
  http: baseHttp,
  fixtureKey = 'reduxState',
  observable: Observable,
  alwaysCreateStore = false,
  disableLocalState = true
}) => {
  const createMockHttp = (fetchMocks, delay) => {
    if (!fetchMocks) return
    return Object.keys(fetchMocks).reduce((http, mockName) => {
      const mock = fetchMocks[mockName]
      return {
        ...http,
        [mockName]: (...args) => {
          const returnValue = typeof mock === 'function' ? mock(...args) : mock
          const error = returnValue['COSMOS_ERROR']
          const observable = error
            ? Observable.of({}).map(() => {
              throw new Error(error)
            })
            : Observable.of({ response: returnValue })
          return delay ? observable.delay(delay) : observable
        }
      }
    }, baseHttp)
  }

  class ReduxProxy extends Component {
    static childContextTypes = {
      store: PropTypes.object
    }

    store = null

    storeUnsubscribe = null

    state = {
      storeId: 0
    }

    constructor(props) {
      super(props)
      this.rebuildStore(props)
    }

    getChildContext() {
      return {
        store: this.store
      }
    }

    componentWillReceiveProps(nextProps) {
      const oldReduxState = this.props.fixture[fixtureKey]
      const newReduxState = nextProps.fixture[fixtureKey]
      if (oldReduxState !== newReduxState) {
        this.reloadStore(nextProps)
      }
    }

    componentDidMount() {
      this.subscribeToStore()
    }

    componentWillUnmount() {
      this.unsubscribeFromStore()
    }

    rebuildStore(props) {
      const fixtureReduxState = props.fixture[fixtureKey]
      const { fetchMocks, delay } = props.fixture
      const http = createMockHttp(fetchMocks, delay)
      if (alwaysCreateStore || fixtureReduxState) {
        this.store = createStore(fixtureReduxState, http)
      }
    }

    reloadStore(props) {
      this.unsubscribeFromStore()
      this.rebuildStore(props)
      this.subscribeToStore()
      this.setState({ storeId: this.state.storeId + 1 })
    }

    subscribeToStore() {
      const { store, onStoreChange } = this
      if (store) {
        this.storeUnsubscribe = store.subscribe(onStoreChange)
      }
    }

    unsubscribeFromStore() {
      if (this.storeUnsubscribe) {
        this.storeUnsubscribe()
      }
    }

    onStoreChange = () => {
      const { onFixtureUpdate } = this.props
      const updatedState = this.store.getState()

      onFixtureUpdate({
        [fixtureKey]: updatedState
      })
    }

    render() {
      const { nextProxy, ...rest } = this.props
      const { value: NextProxy, next } = nextProxy

      return (
        <NextProxy
          {...rest}
          key={this.state.storeId}
          nextProxy={next()}
          disableLocalState={
            // Disable StateProxy when Redux state is available, otherwise the entire
            // Redux store would be duplicated from the connect() component's state
            disableLocalState && Boolean(this.store)
          }
        />
      )
    }
  }

  return ReduxProxy
}
