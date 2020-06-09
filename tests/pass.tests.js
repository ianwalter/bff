const { test } = require('..')
const { html } = require('common-tags')
const createTimer = require('@ianwalter/timer')

test(`
  A
  test
  with
  a
  multiline
  name
`)(t => {
  t.expect('ok').toBeTruthy()
})

test('strict equality', t => {
  const thing = 1
  t.expect(thing).toBe(1)
})

test('parseInt after a 1 second timeout', t => {
  const one = '1'
  return new Promise(resolve => {
    setTimeout(() => {
      t.expect(parseInt(one, 10)).toBe(1)
      resolve()
    }, 1000)
  })
})

test('manual pass', t => t.pass())

test('beforeEach', t => t.pass())

test('registration', t => t.pass())

test('snapshot pass', t => {
  const source = html`
    <html>
      <head>
        <title>Demo</title>
      </head>
      <body>
        <main>
          <h1>Demo</h1>
        </main>
      </body>
    </html>
  `
  t.expect(source).toMatchSnapshot()
})

test('second snapshot pass', t => {
  const source = html`
    export default () => {
      console.log('Hello World!')
    }
  `
  t.expect(source).toMatchSnapshot()
  t.expect(source.replace('World', 'Universe')).toMatchSnapshot()
})

test(
  'tags second call',
  'qa'
)(t => {
  t.expect(['one', 'two', 'three']).toContain('two')
})

test('sleep', t => {
  const timer = createTimer()
  t.sleep(1000)
  const ms = timer.stop()
  t.expect(ms).toBeGreaterThan(999)
  t.expect(ms).toBeLessThan(2000)
})

test('asleep', async t => {
  const timer = createTimer()
  await t.asleep(1000)
  const ms = timer.stop()
  t.expect(ms).toBeGreaterThan(999)
  t.expect(ms).toBeLessThan(2000)
})

test('done', (t, done) => {
  setTimeout(() => {
    t.expect('truth').toContain('ruth')
    done()
  }, 500)
})

test('done.pass', (t, done) => setTimeout(done.pass, 400))
