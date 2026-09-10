import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('business detail exposes one truthful accessible save toggle', async () => {
  const source = await read('src/components/common/BusinessDetailPanel.jsx')
  assert.match(source, /type="button"/)
  assert.match(source, /aria-pressed=/)
  assert.match(source, /aria-busy=/)
  assert.match(source, /role="alert"/)
  assert.match(source, /focusable="false"/)
  assert.doesNotMatch(source, /favouritesComingSoon|disabled title=/)
})

test('ServicesPage owns eligibility and protects state from stale requests', async () => {
  const source = await read('src/pages/ServicesPage.jsx')
  assert.match(source, /userProfile\.roles\.includes\('customer'\)/)
  assert.doesNotMatch(source, /accountType.*customer/)
  assert.match(source, /savedBusinessRequestRef/)
  assert.match(source, /requestId !== savedBusinessRequestRef\.current/)
  assert.match(source, /setAuthPromptReason\('save'\)/)
  assert.match(source, /AuthenticationChoiceDialog/)
})

test('authentication choice is shared and carries one complete internal return location', async () => {
  const [dialog, services] = await Promise.all([
    read('src/components/common/AuthenticationChoiceDialog.jsx'),
    read('src/pages/ServicesPage.jsx'),
  ])
  assert.equal((services.match(/<AuthenticationChoiceDialog/g) ?? []).length, 1)
  assert.match(dialog, /to="\/login"/)
  assert.match(dialog, /to="\/register"/)
  assert.match(dialog, /state=\{\{ from: returnLocation \}\}/)
  assert.match(services, /normalizeInternalLocation\(currentLocation\)/)
})

test('the complete authentication chain preserves only normalized internal locations', async () => {
  const paths = [
    'src/pages/auth/LoginPage.jsx',
    'src/pages/auth/RegisterPage.jsx',
    'src/pages/auth/VerificationPendingPage.jsx',
    'src/pages/auth/CompleteProfilePage.jsx',
    'src/pages/auth/LegalConsentPage.jsx',
    'src/pages/auth/OnboardingPage.jsx',
  ]
  const sources = await Promise.all(paths.map(read))
  for (const [index, source] of sources.entries()) {
    assert.match(source, /normalizeInternalLocation|intendedLocation|internalPathFromLocation/, paths[index])
  }
  assert.match(sources[1], /verificationEmailSent[\s\S]*from: normalizeInternalLocation/)
  assert.doesNotMatch(sources.join('\n'), /saveBusiness\(/)
})

test('canonical save styles retain a wrapping 44px target without movement', async () => {
  const css = await read('src/styles/servicesPresentation.css')
  const rule = css.match(/\.business-detail__save \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(css, /\.business-detail__actions \.button \{[\s\S]*?min-height: 2\.75rem/)
  assert.match(rule, /white-space: normal/)
  assert.doesNotMatch(rule, /transform|animation/)
  assert.doesNotMatch(css, /messaging-auth-prompt|messaging-auth-dialog/)
})
