import execa from 'execa'
import pSettle from 'p-settle'

export default async function cleanup () {
  const names = [
    'selenium',
    'webdriver',
    'chromedriver',
    'geckodriver',
    'marionette'
  ]
  await pSettle(names.map(async name => execa('pkill', ['-f', name])))
}
