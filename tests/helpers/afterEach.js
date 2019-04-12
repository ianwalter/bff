const { print } = require('@ianwalter/print')

module.exports = function afterEach (context) {
  if (context.name === 'afterEach') {
    print.log('afterEach executed')
  }
}
