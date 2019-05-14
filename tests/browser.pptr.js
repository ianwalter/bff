import { test } from '@ianwalter/bff'

test('manual pass', ({ pass }) => pass())

test('arithmetic', ({ expect }) => expect(13 + 8).toBe(21))

test('dom snapshot', ({ expect }) => {
  const anchor = document.createElement('a')
  anchor.setAttribute('href', 'https://iankwalter.com')
  anchor.innerHTML = `Ian's Website`
  expect(anchor).toMatchSnapshot()
})
