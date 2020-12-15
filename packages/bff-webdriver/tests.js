import { test } from '@ianwalter/bff'
import { createApp } from '@ianwalter/nrg'
import createUrl from '@ianwalter/url'

test('test server', async t => {
  const app = createApp({ log: false })
  app.use(ctx => {
    ctx.body = `
      <html>
        <head>
          <title>Hello World!</title>
        </head>
        <body>
          <h1>Hello World!</h1>
        </body>
      </html>
    `
  })
  const server = await app.serve()

  const url = createUrl(server.url)
  if (process.env.TEST_HOST) {
    url.host = process.env.TEST_HOST
  }
  t.logger.info('Server URL', url.href)

  try {
    await t.browser.url(url.href)
    t.expect(await t.browser.getTitle()).toBe('Hello World!')
  } finally {
    server.close()
  }
})
