import PublicBusinessCard, { ImageAvatar, EditableImageAvatar } from '../../../src/components/common/PublicBusinessCard.jsx'
export default function Variants() {
  return <main><PublicBusinessCard business={window.h.business} variant="hero" to="/services/synthetic-business" />
    <ImageAvatar alt="Synthetic avatar" name="Synthetic Person" /><EditableImageAvatar name="Synthetic Owner" disabled inputLabel="Synthetic upload" />
  </main>
}
