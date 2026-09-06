import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pageUrl = new URL('../src/pages/MessagesPage.jsx', import.meta.url)
const stylesUrl = new URL('../src/styles/global.css', import.meta.url)

test('ready empty inbox renders one compact state and one retained home action', async () => {
  const source = await readFile(pageUrl, 'utf8')

  assert.match(source, /const isEmptyInbox = inboxStatus === 'ready' && conversations\.length === 0/)
  assert.match(source, /isEmptyInbox \? \([\s\S]*className="messages-empty-state"/)
  assert.equal((source.match(/t\('messages\.returnHome'\)/g) ?? []).length, 1)
  assert.doesNotMatch(source, /aria-hidden="true">✦/)
})

test('messages retain routed selection and existing back, send, unread, and removal behavior', async () => {
  const source = await readFile(pageUrl, 'utf8')

  assert.match(source, /const \{ conversationId \} = useParams\(\)/)
  assert.match(source, /to=\{`\/messages\/\$\{item\.conversationId\}`\}/)
  assert.match(source, /onClick=\{\(\) => navigate\('\/messages'\)\}/)
  assert.match(source, /isConversationUnreadForUser\(item, user\.uid\)/)
  assert.match(source, /onSubmit=\{handleSend\}/)
  assert.match(source, /hideConversationForUser\(conversationId, user\.uid\)/)
})

test('responsive inbox uses one visible panel below the established desktop breakpoint', async () => {
  const styles = await readFile(stylesUrl, 'utf8')

  assert.match(styles, /@media \(min-width: 64rem\) \{[\s\S]*?\.messages-layout \{[\s\S]*?grid-template-columns: clamp\(18rem, 27vw, 22rem\) minmax\(0, 1fr\)/)
  assert.match(styles, /@media \(max-width: 63\.999rem\) \{[\s\S]*?\.messages-page\.has-conversation \.conversation-list,[\s\S]*?\.messages-page:not\(\.has-conversation\) \.conversation-view[\s\S]*?display: none/)
  assert.match(styles, /\.conversation-view \{[\s\S]*?min-width: 0;[\s\S]*?grid-template-rows: auto auto minmax\(0, 1fr\) auto/)
  assert.match(styles, /\.message-bubble\.is-own \{[\s\S]*?background: var\(--brand-blue\)/)
  assert.match(styles, /\.message-bubble p \{[\s\S]*?overflow-wrap: anywhere/)
})

test('mobile back control remains translated, visible, and tied to route selection', async () => {
  const [source, styles] = await Promise.all([readFile(pageUrl, 'utf8'), readFile(stylesUrl, 'utf8')])

  assert.match(source, /className="conversation-view__back"[\s\S]*?aria-label=\{t\('messages\.back'\)\}[\s\S]*?navigate\('\/messages'\)[\s\S]*?<span>\{t\('messages\.back'\)\}<\/span>/)
  assert.match(source, /conversationId \? mobileBackRef\.current : conversationListHeadingRef\.current/)
  assert.match(source, /prefers-reduced-motion: reduce/)
  assert.match(styles, /@media \(max-width: 47\.999rem\) \{[\s\S]*?\.conversation-view__back \{[\s\S]*?grid-column: 1 \/ -1/)
})
