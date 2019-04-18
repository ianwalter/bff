const { test } = require('..')
const { html } = require('common-tags')

test('no assertions', () => true)

test('parseInt with the wrong base', ({ expect }) => {
  const two = '2'
  expect(parseInt(two, 2)).toBe(2)
})

test('manual fail', ({ fail }) => fail())

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
