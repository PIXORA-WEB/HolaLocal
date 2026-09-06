import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pageUrl = new URL('../src/pages/customer/ProfilePage.jsx', import.meta.url)
const avatarUrl = new URL('../src/components/common/PublicBusinessCard.jsx', import.meta.url)
const stylesUrl = new URL('../src/styles/global.css', import.meta.url)

test('profile avatar preserves upload behaviour with an icon-only control', async () => {
  const [page, avatar] = await Promise.all([readFile(pageUrl, 'utf8'), readFile(avatarUrl, 'utf8')])

  assert.match(page, /<EditableImageAvatar[\s\S]*?iconOnly[\s\S]*?onChange=\{handleProfilePhotoChange\}/)
  assert.match(avatar, /iconOnly = false/)
  assert.match(avatar, /editable-image-avatar--icon-only/)
  assert.match(avatar, /\{!iconOnly && <span>/)
  assert.match(avatar, /aria-label=\{inputLabel \?\? t\('common\.changeImage'\)\}/)
  assert.match(avatar, /onChange=\{onChange\}/)
})

test('profile layout keeps logical DOM order and scoped responsive placement', async () => {
  const [page, styles] = await Promise.all([readFile(pageUrl, 'utf8'), readFile(stylesUrl, 'utf8')])
  const personal = page.indexOf('profile-dashboard__card--personal')
  const account = page.indexOf('profile-dashboard__card--account')
  const preferences = page.indexOf('profile-dashboard__card--preferences')
  const business = page.indexOf('business-tools-card--active')
  const danger = page.indexOf('profile-dashboard__card--danger')

  assert.ok(personal < account && account < preferences && preferences < business && business < danger)
  assert.match(styles, /\.profile-card \{[\s\S]*?width: min\(100% - 2rem, 72rem\);[\s\S]*?min-width: 0;/)
  assert.match(styles, /\.profile-summary \.image-avatar--profile \{[\s\S]*?width: 6rem;[\s\S]*?height: 6rem;/)
  assert.match(styles, /@media \(min-width: 48rem\)[\s\S]*?\.profile-summary \.image-avatar--profile,[\s\S]*?width: 7rem;/)
  assert.match(styles, /grid-template-areas:[\s\S]*?"personal preferences"[\s\S]*?"account business"[\s\S]*?"danger danger"/)
  assert.match(styles, /\.profile-dashboard__card--danger \{[\s\S]*?--profile-card-accent: #b74435;/)
  assert.match(styles, /\.business-tools-card--active \.business-tools-card__actions \{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/)
})

test('profile actions and conditional behaviour remain unchanged', async () => {
  const page = await readFile(pageUrl, 'utf8')

  assert.match(page, /onClick=\{startEditing\}/)
  assert.match(page, /to="\/business\/dashboard"/)
  assert.match(page, /to="\/business\/edit"/)
  assert.match(page, /onClick=\{handleLogout\}/)
  assert.match(page, /onClick=\{\(\) => setDeletionDialogOpen\(true\)\}/)
  assert.match(page, /onSubmit=\{handleDeletionRequest\}/)
  assert.match(page, /hasBusinessAccess \? \(/)
})
