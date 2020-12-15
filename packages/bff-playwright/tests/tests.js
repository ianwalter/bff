import { test } from '@ianwalter/bff'

test('My personal site', async t => {
  const { page } = await t.chromium({ args: ['--no-sandbox'] })
  await page.goto('https://ianwalter.dev')
  t.expect(await page.innerText('body')).toContain('Ian Walter, Dev')
})

test.skip('My GitHub profile', async t => {
  for (const browser of t.browsers) {
    const { page } = await t[browser]({ args: ['--no-sandbox'] })
    await page.goto('https://github.com/ianwalter')
    t.expect(await page.innerText('body')).toContain('Ian Walter')
  }
})
