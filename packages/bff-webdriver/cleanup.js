const execa = require('execa')
const pSettle = require('p-settle')

module.exports = async function cleanup () {
  const names = [
    'selenium',
    'webdriver',
    'chromedriver',
    'geckodriver',
    'marionette'
  ]
  await pSettle(names.map(async name => execa('pkill', ['-f', name])))
}
