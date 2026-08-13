import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const page = await readFile(new URL('../src/pages/admin/AdminAccountDeletionsPage.jsx', import.meta.url), 'utf8')
const service = await readFile(new URL('../src/services/adminAccountDeletionService.js', import.meta.url), 'utf8')
const routes = await readFile(new URL('../src/routes/AppRoutes.jsx', import.meta.url), 'utf8')
const strictRoute = await readFile(new URL('../src/routes/AdminOnlyRoute.jsx', import.meta.url), 'utf8')
const layout = await readFile(new URL('../src/components/layout/AdminLayout.jsx', import.meta.url), 'utf8')
const { adminDeletionTranslations: locales } = await import('../src/i18n/adminDeletionTranslations.js')

test('Stage 5C has a strict admin-only route and hides navigation from moderators', () => { assert.match(routes, /AdminOnlyRoute/); assert.match(strictRoute, /token\.claims\?\.admin === true/); assert.doesNotMatch(strictRoute, /moderator === true/); assert.match(layout, /item\.key !== 'deletions' \|\| adminOnly/) })
test('finalization sends exactly uid and current version after explicit confirmation', () => { assert.match(service, /finalizeAccountDeletionCallable\(\{ uid, expectedRequestVersion \}\)/); assert.match(page, /setConfirming\(true\)/); assert.match(page, /finalizeAccountDeletion\(selected\.uid, selected\.requestVersion\)/); assert.match(page, /disabled=\{submitting\}/); assert.doesNotMatch(service, /checkpoint|businessId|email|storagePath|plan/) })
test('backend-derived eligibility controls finalize and expired-lease recovery', () => { assert.match(page, /selected\?\.canFinalize/); assert.match(page, /expired-finalizer-lease/); assert.match(page, /selected\.state === 'finalizing' && !selected\.canFinalize/); assert.doesNotMatch(page, /leaseExpiresAt|leaseId/); assert.match(page, /await refresh\(\)/); assert.match(page, /stale-request-version/) })
test('operational overflow is explicit and history cannot replace the backend queue', () => { assert.match(page, /operationalHasMore/); assert.match(page, /historyHasMore/); assert.match(page, /operationalOverflow/); assert.match(page, /historyOverflow/); assert.doesNotMatch(page, /\.sort\(|\.filter\(.*state/) })
test('UI uses fixed code maps and excludes profile data', () => { assert.match(page, /safeCode/); for (const value of ['displayName', 'photoURL', 'retainedConsentEvidence', 'mediaPath', 'messageContent', 'reportDetails']) assert.equal(page.includes(value), false) })
test('Stage 5C keys exist for all 17 locales', () => { assert.equal(Object.keys(locales).length, 17); for (const [code, locale] of Object.entries(locales)) { assert.ok(locale.admin.navigation.deletions, code); for (const key of ['title', 'finalize', 'retry', 'resumeAvailable', 'operationalOverflow', 'historyOverflow', 'confirmation', 'historyPreserved']) assert.ok(locale.admin.deletions[key], `${code}:${key}`); for (const state of ['requested', 'finalizing', 'failed_retryable', 'completed', 'cancelled']) assert.ok(locale.admin.deletions.state[state], `${code}:${state}`) } })
