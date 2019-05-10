const path = require('path')

function toHookExec (hookName, context) {
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
      await hook(context)
    }
  }
}

module.exports = { toHookExec }
