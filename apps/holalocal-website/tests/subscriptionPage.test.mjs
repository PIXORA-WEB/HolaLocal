import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import i18next from 'i18next'
import { PLAN_DEFINITIONS, PLAN_IDS } from '@holalocal/firebase-contract'

const pageUrl = new URL('../src/pages/business/SubscriptionPage.jsx', import.meta.url)
const englishUrl = new URL('../src/i18n/locales/en.json', import.meta.url)

test('subscription comparison renders the shared stable plan catalogue accessibly', async () => {
  const source = await readFile(pageUrl, 'utf8')

  assert.match(source, /PLAN_DEFINITIONS/)
  const planOrder = source.match(/const PLAN_ORDER = \[([\s\S]*?)\]/)?.[1] ?? ''
  for (const key of ['EARLY_ACCESS', 'STARTER', 'GROWTH', 'PRO']) {
    assert.match(planOrder, new RegExp(`PLAN_IDS\\.${key}`))
  }
  assert.equal((planOrder.match(/PLAN_IDS\./g) ?? []).length, Object.keys(PLAN_IDS).length)
  assert.match(source, /const definition = PLAN_DEFINITIONS\[planId\]/)
  assert.doesNotMatch(source, /limits:\s*\{/)
  for (const planId of Object.values(PLAN_IDS)) {
    assert.equal(
      Object.hasOwn(PLAN_DEFINITIONS[planId].limits, 'additionalManagers'),
      true,
      `${planId} retains the shared additionalManagers entitlement`,
    )
  }
  assert.doesNotMatch(source, /['"]additionalManagers['"]/)
  assert.match(source, /isRecommended = planId === PLAN_IDS\.GROWTH/)
  assert.match(source, /aria-current=\{isCurrentPlan \? 'true' : undefined\}/)
  assert.match(
    source,
    /<article[\s\S]*?<button[\s\S]*?disabled[\s\S]*?subscription\.comingSoon[\s\S]*?<\/button>[\s\S]*?<\/article>\s*<div className="subscription-plan-item__statuses">/,
  )
  assert.match(
    source,
    /<\/article>\s*<div className="subscription-plan-item__statuses">[\s\S]*?subscription\.badges\.current[\s\S]*?subscription\.badges\.recommended[\s\S]*?<\/div>/,
  )
  assert.doesNotMatch(source, /stripe|checkout|paymentIntent|billingInterval|currency|priceId/i)
  assert.doesNotMatch(source, /[$€£]\s*\d|\d\s*[$€£]/)
})

test('important English subscription comparison keys resolve without raw keys', async () => {
  const english = JSON.parse(await readFile(englishUrl, 'utf8'))
  const runtime = i18next.createInstance()
  await runtime.init({
    resources: { en: { translation: english } },
    lng: 'en',
    initImmediate: false,
    interpolation: { escapeValue: false },
  })

  const keys = [
    'subscription.earlyAccess.title',
    'subscription.compareTitle',
    'subscription.badges.current',
    'subscription.badges.recommended',
    'subscription.capabilities.priorityFeatures',
    'subscription.limitLabels.translatedMessagesPerMonth',
    'subscription.limitValues.unlimitedFairUse',
    'subscription.currentPlanAction',
    'subscription.comingSoon',
  ]

  for (const key of keys) {
    const value = runtime.t(key)
    assert.notEqual(value, key, `${key} resolves`)
    assert.notEqual(value.trim(), '', `${key} is non-empty`)
  }

  assert.equal(
    runtime.t('subscription.planDescriptions.early_access'),
    'Full access to all features currently available during Early Access.',
  )
  assert.equal(
    runtime.t('subscription.planDescriptions.starter'),
    'Essential tools for smaller local businesses.',
  )
  assert.equal(
    runtime.t('subscription.planDescriptions.growth'),
    'More visibility, insights and capacity as your business grows.',
  )
  assert.equal(
    runtime.t('subscription.planDescriptions.pro'),
    'Maximum limits and priority tools for established businesses.',
  )
})
