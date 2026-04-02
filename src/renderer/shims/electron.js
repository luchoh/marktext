const listeners = new Map()

const createEvent = channel => ({
  channel,
  sender: window.mt
})

const getChannelListeners = channel => {
  if (!listeners.has(channel)) {
    listeners.set(channel, new Set())
  }
  return listeners.get(channel)
}

const dispatch = (channel, args = []) => {
  const channelListeners = listeners.get(channel)
  if (!channelListeners || channelListeners.size === 0) {
    return false
  }

  for (const listener of channelListeners) {
    listener(...args)
  }
  return true
}

window.addEventListener('__mt-ipc__', event => {
  const { channel, args } = event.detail
  dispatch(channel, [createEvent(channel), ...args])
})

export const ipcRenderer = {
  on (channel, listener) {
    getChannelListeners(channel).add(listener)
    return this
  },
  once (channel, listener) {
    const wrappedListener = (...args) => {
      this.off(channel, wrappedListener)
      listener(...args)
    }
    return this.on(channel, wrappedListener)
  },
  off (channel, listener) {
    const channelListeners = listeners.get(channel)
    if (channelListeners) {
      channelListeners.delete(listener)
      if (channelListeners.size === 0) {
        listeners.delete(channel)
      }
    }
    return this
  },
  removeListener (channel, listener) {
    return this.off(channel, listener)
  },
  removeAllListeners (channel) {
    if (channel) {
      listeners.delete(channel)
    } else {
      listeners.clear()
    }
    return this
  },
  emit (channel, ...args) {
    return dispatch(channel, args)
  },
  send (channel, ...args) {
    window.mt.ipc.send(channel, ...args)
  },
  invoke (channel, ...args) {
    return window.mt.ipc.invoke(channel, ...args)
  }
}

export const shell = window.mt.shell
export const clipboard = window.mt.clipboard
export const webFrame = window.mt.webFrame
