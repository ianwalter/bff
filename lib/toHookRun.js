const path = require('path')

module.exports = function toHookRun (hookName, ...args) {
  return file => async () => {
    let plugin
    try {
      plugin = require(file)
    } catch (err) {
      // Don't need to handle this error.
    }
    plugin = plugin || require(path.resolve(file))
    const hook = plugin[hookName]
    if (hook) {
      await hook(...args)
    }
  }
}
