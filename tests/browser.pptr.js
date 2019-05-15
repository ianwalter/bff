import { test } from '@ianwalter/bff'

test('manual pass', ({ pass }) => pass())

test('arithmetic', ({ expect }) => expect(13 + 8).toBe(21))

test('dom snapshot', ({ expect }) => {
  const anchor = document.createElement('a')
  anchor.setAttribute('href', 'https://iankwalter.com')
  anchor.innerHTML = `Ian's Website`
  expect(anchor).toMatchSnapshot()
})

test('deep equal failure', ({ expect }) => {
  expect({ name: 'Joe' }).toBe({ name: 'Joe' })
})

test('property of undefined failure', ({ expect }) => {
  expect(window.thing.that.does.not.exist).tobeDefined()
})
