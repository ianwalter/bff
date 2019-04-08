const test = require('../test')

exports[test`that a test with no assertions fails`] = () => true

exports[test`parseInt with the wrong base fails`] = ({ expect }) => {
  const two = '2'
  expect(parseInt(two, 2)).toBe(2)
}
