const { createLogger } = require('@generates/logger')

const logger = createLogger({
  level: 'info',
  namespace: 'bff-webdriver.zalenium'
})

module.exports = class ZaleniumIntegration {
  constructor () {
    logger.debug('Zalenium integration enabled')
  }

  static integrate (context) {
    if (context.webdriver.zalenium) {
      context.webdriver.integrations.push(new ZaleniumIntegration(context))
    }
  }

  enhanceCapability (testContext) {
    // Tell Zalenium the name of the test.
    const options = { 'zal:name': testContext.key }
    testContext.capability = Object.assign(options, testContext.capability)
  }

  async report ({ webdriver, testContext }) {
    try {
      if (testContext.result.failed && webdriver.zalenium.dashboardUrl) {
        // If the test failed, print the Zalenium Dashboard URL for this
        // session to make it easier for the user to debug.
        const { oneLine } = require('common-tags')
        const query = oneLine`
          ${testContext.capability['zal:name']}
          ${testContext.capability['zal:build']}
        `
        const url = `${webdriver.zalenium.dashboardUrl}?q=${encodeURI(query)}`
        logger.info('Zalenium session:', url)
      }
    } catch (err) {
      logger.error(err)
    }
  }
}
