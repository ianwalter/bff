workflow "CI" {
  on = "push"
  resolves = ["Lint", "Test"]
}

action "Install" {
  uses = "ianwalter/puppeteer@v1.0.0"
  runs = "yarn"
}

action "Lint" {
  uses = "ianwalter/puppeteer@v1.0.0"
  needs = ["Install"]
  runs = "yarn"
  args = "lint"
}

action "Test" {
  uses = "ianwalter/puppeteer@v1.0.0"
  needs = ["Install"]
  runs = "yarn"
  args = "test"
}
