const { test } = require('..')
const { html } = require('common-tags')

test('no assertions', () => true)

test('parseInt with the wrong base', t => {
  const two = '2'
  t.expect(parseInt(two, 2)).toBe(2)
})

test('manual fail', t => t.fail())

test('manual fail with reason', t => t.fail('because reasons'))

test('afterEach', t => t.fail())

test('snapshot fail', t => {
  const markup = html`
    <html>
      <head>
        <title>Dema</title>
      </head>
      <body>
        <main>
          <h1>Demo</h1>
        </main>
      </body>
    </html>
  `
  t.expect(markup).toMatchSnapshot()
})

test('timeout', () => new Promise(() => {}))

test('tags', 'dev', 'qa', t => t.expect([1, 2]).toContain(3))

test('manual fail inside of try-catch', t => {
  try {
    t.expect(1).toBe(1)
    t.fail()
  } catch (err) {
    // console.error(err)
  }
})

test('done.fail', (t, done) => setTimeout(done.fail, 300, new Error('DONE')))
