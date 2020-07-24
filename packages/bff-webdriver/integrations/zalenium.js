const { Print } = require('@ianwalter/print')

module.exports = class ZaleniumIntegration {
  constructor (context) {
    // Set up a print instance on the integration instance so it can be reused.
    this.print = new Print(context.log)
    this.print.debug('Zalenium integration enabled')
  }

  static integrate (context) {
    if (context.webdriver.zalenium) {
      context.webdriver.integrations.push(new ZaleniumIntegration(context))
    }
  }

  enhanceCapability (testContext) {
    const options = {
      // Tell Zalenium the name of the test.
      'zal:name': testContext.key
    }
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
        this.print.info('Zalenium session:', url)
      }
    } catch (err) {
      this.print.error(err)
    }
  }
}
