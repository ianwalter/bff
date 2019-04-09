const { oneLine } = require('common-tags')

module.exports = function test (name, fn) {
  // Prevent caching of this module so module.parent is always accurate. Thanks
  // sindresorhus/meow.
  delete require.cache[__filename]

  if (fn) {
    module.parent.exports[oneLine(name)] = fn
  } else {
    return fn => {
      module.parent.exports[oneLine(name)] = fn
    }
  }
}
