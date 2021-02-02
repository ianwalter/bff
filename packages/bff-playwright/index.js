import playwright from 'playwright'
import generatesLogger from '@generates/logger'

const { createLogger } = generatesLogger
const logger = createLogger({ level: 'info', namespace: 'bff.playwright' })
const availableBrowsers = ['chromium', 'firefox', 'webkit']

export default {
  async beforeEach (file, context) {
    logger.debug(file.relativePath, '•', context.testContext.name)
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
    //     logger.warn('Browser not available in Playwright:', browser.name)
    //   }
    // }

    for (const name of availableBrowsers) {
      logger.debug('Adding browser', name)
      context.testContext[name] = async options => {
        logger.debug('Launching browser', name)
        const browser = await playwright[name].launch(options)
        const browserContext = await browser.newContext()
        const page = await browserContext.newPage()
        return { browser, browserContext, page }
      }
    }
  },
  async afterEach (_, context) {
    for (const name of availableBrowsers) {
      const browser = context.testContext[name]
      if (browser.instance) {
        logger.debug('Closing browser', name)
        await browser.instance.close()
      }
    }
  }
}
