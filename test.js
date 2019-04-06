exports['some functionality'] = ({ expect }) => {
  const thing = 1
  expect(thing).toBe(1)
}

exports[`
  test some other functionality when something is happening and some other thing
  is false
`] = ({ expect }) => {
  const ok = 'OK'
  expect(ok).toBeTruthy()
}

exports[`parsing the ints... slowly`] = ({ expect }) => {
  const ok = '1'
  return new Promise(resolve => {
    setTimeout(() => {
      expect(parseInt(ok, 10)).toBe(1)
      resolve()
    }, 1000)
  })
}
