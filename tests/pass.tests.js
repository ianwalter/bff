const { test } = require('..')
const { html } = require('common-tags')

test(`
  A
  test
  with
  a
  multiline
  name
`)(({ expect }) => {
  expect('ok').toBeTruthy()
})

test('strict equality', ({ expect }) => {
  const thing = 1
  expect(thing).toBe(1)
})

test('parseInt after a 1 second timeout', ({ expect }) => {
  const one = '1'
  return new Promise(resolve => {
    setTimeout(() => {
      expect(parseInt(one, 10)).toBe(1)
      resolve()
    }, 1000)
  })
})

test('manual pass', ({ pass }) => pass())

test('beforeEach', ({ pass }) => pass())

test('registration', ({ pass }) => pass())

test('snapshot pass', ({ expect }) => {
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
  expect(source).toMatchSnapshot()
})

test('second snapshot pass', ({ expect }) => {
  const source = html`
    export default () => {
      console.log('Hello World!')
    }
  `
  expect(source).toMatchSnapshot()
  expect(source.replace('World', 'Universe')).toMatchSnapshot()
})

test(
  'tags second call',
  'qa'
)(({ expect }) => {
  expect(['one', 'two', 'three']).toContain('two')
})

test('sleep', async ({ sleep, expect }) => {
  const before = new Date().getTime()
  await sleep(1000)
  const elapsed = new Date().getTime() - before
  expect(elapsed).toBeGreaterThanOrEqual(1000)
  expect(elapsed).toBeLessThan(2000)
})

test('done', ({ expect }, done) => {
  setTimeout(() => {
    expect('truth').toContain('ruth')
    done()
  }, 500)
})

test('done.pass', (ctx, done) => setTimeout(done.pass, 400))
