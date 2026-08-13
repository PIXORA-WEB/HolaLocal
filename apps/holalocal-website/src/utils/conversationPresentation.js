import { deletedUserTombstoneFor } from '@holalocal/firebase-contract'

export function conversationParticipantPresentation(conversation, currentUserId, labels = {}) {
  const deletedCustomer = deletedUserTombstoneFor(conversation, conversation?.customerId)
  const viewingAsBusiness = Boolean(
    deletedCustomer
    && currentUserId
    && currentUserId !== conversation.customerId
    && conversation.participantIds?.includes(currentUserId),
  )
  return viewingAsBusiness
    ? { deleted: true, label: labels.deletedUser ?? 'Deleted user', avatarUrl: null }
    : { deleted: false, label: null, avatarUrl: null }
}
