const { test } = require('..')
const execa = require('execa')

test('bff', async ({ expect, fail }) => {
  const { stdout, stderr } = await execa('./cli.js', { reject: false })
  fail('TODO: figure out how to assert test results.')
})
