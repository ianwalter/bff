const playwright = require('playwright')
const { createPrint } = require('@ianwalter/print')

const print = createPrint({ level: 'info', namespace: 'bff.playwright' })
const availableBrowsers = ['chromium', 'firefox', 'webkit']

module.exports = {
  async beforeEach (file, context) {
    print.debug(file.relativePath, '•', context.testContext.name)
    context.testContext.playwright = playwright
    context.testContext.browsers = availableBrowsers

    // Produce the configuration that will be used.
    // let { browsers = ['chromium'] } = context.playwright || {}

    // Map the browsers into Objects in case they are specified as strings.
    // browsers = browsers.map(b => typeof b === 'string' ? { name: b } : b)

    // for (const browser of browsers) {
    //   if (context.testContext.playwright.browsers.includes(browser.name)) {
    //     const { name, ...options } = browser
    //   } else {
    //     print.warn('Browser not available in Playwright:', browser.name)
    //   }
    // }

    for (const name of availableBrowsers) {
      print.debug('Adding browser', name)
      context.testContext[name] = async options => {
        print.debug('Launching browser', name)
        this.instance = await playwright[name].launch(options)
        const browserContext = await this.instance.newContext()
        const page = await browserContext.newPage()
        return { browser: this.instance, browserContext, page }
      }
    }
  },
  async afterEach (_, context) {
    for (const name of availableBrowsers) {
      const browser = context.testContext[name]
      if (browser.instance) {
        print.debug('Closing browser', name)
        await browser.instance.close()
      }
    }
  }
}
