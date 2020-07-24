require('dotenv').config()

module.exports = {
  before (context) {
    const standalone = process.env.SELENIUM_STANDALONE
    const hostname = process.env.SELENIUM_HUB_HOST
    const appium = process.env.APPIUM
    if (standalone) {
      context.webdriver.standalone = standalone
    } else if (appium) {
      context.webdriver.appium = true
    } else if (hostname) {
      context.webdriver.hostname = hostname
    }
  }
}
