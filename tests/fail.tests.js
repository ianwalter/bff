const { oneLine } = require('common-tags')

exports[oneLine`that a test with no assertions fails`] = () => true

exports[oneLine`parseInt with the wrong base fails`] = ({ expect }) => {
  const two = '2'
  expect(parseInt(two, 2)).toBe(2)
}
