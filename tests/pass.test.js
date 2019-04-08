const { oneLine: test } = require('common-tags')

exports[test`strict equality`] = ({ expect }) => {
  const thing = 1
  expect(thing).toBe(1)
}

exports[test`parsing an int after a 1 second timeout`] = ({ expect }) => {
  const one = '1'
  return new Promise(resolve => {
    setTimeout(() => {
      expect(parseInt(one, 10)).toBe(1)
      resolve()
    }, 1000)
  })
}
