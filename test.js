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

