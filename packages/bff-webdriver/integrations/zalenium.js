import generatesLogger from '@generates/logger'
import { oneLine } from 'common-tags'

const { createLogger } = generatesLogger
const logger = createLogger({
  level: 'info',
  namespace: 'bff.webdriver.zalenium'
})

export default function zalenium (context) {
  logger.debug('Zalenium integration enabled')

  context.webdriver.integrations.push({
    enhanceCapability (testContext) {
      // Tell Zalenium the name of the test.
      const options = { 'zal:name': testContext.key }
      testContext.capability = Object.assign(options, testContext.capability)
    },
    async report ({ webdriver, testContext }) {
      try {
        if (testContext.result.failed && webdriver.zalenium.dashboardUrl) {
          // If the test failed, log the Zalenium Dashboard URL for this
          // session to make it easier for the user to debug.
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
  })
}
