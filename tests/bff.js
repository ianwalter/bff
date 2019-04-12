const { test } = require('..')
const execa = require('execa')

test('bff', async ({ expect }) => {
  const { stdout, stderr } = await execa('./cli.js', { reject: false })
  expect(stdout).toMatchSnapshot()
  expect(stderr).toMatchSnapshot()
})
