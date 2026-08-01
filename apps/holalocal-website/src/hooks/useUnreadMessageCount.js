import { useEffect, useState } from 'react'
import { isConversationUnreadForUser } from '@holalocal/firebase-contract'

function useUnreadMessageCount(userId) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    let unsubscribe = () => undefined

    import('../services/conversationService.js')
      .then(({ subscribeToConversationsForUser }) => {
        if (!active) return
        unsubscribe = subscribeToConversationsForUser(
          userId,
          (conversations) => {
            setUnreadCount(conversations.filter((conversation) => (
              isConversationUnreadForUser(conversation, userId)
            )).length)
          },
          () => setUnreadCount(0),
        )
      })
      .catch(() => {
        if (active) setUnreadCount(0)
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [userId])

  return userId ? unreadCount : 0
}

export default useUnreadMessageCount
