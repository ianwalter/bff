import 'dotenv/config.js'

export default {
  before (context) {
    const { SELENIUM_HUB_HOST, APPIUM } = process.env
    if (APPIUM) {
      context.webdriver.appium = true
    } else if (SELENIUM_HUB_HOST) {
      context.webdriver.hostname = SELENIUM_HUB_HOST
    }
  }
}
