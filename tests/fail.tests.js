const { test } = require('..')
const { html } = require('common-tags')

test('no assertions', () => true)

test('parseInt with the wrong base', ({ expect }) => {
  expect(parseInt('2', 2)).toBe(2)
})

test('manual fail', ({ fail }) => fail())

test('manual fail with reason', ({ fail }) => fail('because reasons'))

test('afterEach', ({ fail }) => fail())

test('snapshot fail', ({ expect }) => {
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
  expect(markup).toMatchSnapshot()
})

test('timeout', () => new Promise(() => {}))

test('tags', 'dev', 'qa', ({ expect }) => expect([1, 2]).toContain(3))

test('manual fail inside of try-catch', ({ expect, fail }) => {
  try {
    expect(1).toBe(1)
    fail()
  } catch (err) {
    // console.error(err)
  }
})

test('done.fail', (ctx, done) => setTimeout(done.fail, 300, new Error('DONE')))
