import { SERVICE_TAXONOMY_GROUPS } from '@holalocal/firebase-contract'

const SERVICE_CATEGORY_ICONS = Object.freeze({
  'home-property': <><path d="m3 11 9-8 9 8" /><path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" /></>,
  'professional-services': <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7V4.5h7V7M3 12h18M10 12v2h4v-2" /></>,
  'health-beauty-lifestyle': <path d="M20.5 9.5c0 5.6-8.5 11-8.5 11s-8.5-5.4-8.5-11A4.5 4.5 0 0 1 12 7.4a4.5 4.5 0 0 1 8.5 2.1Z" />,
  'learning-family': <><path d="M3.5 5.5c3.4-.7 6.2.1 8.5 2.3v11.7c-2.3-2.2-5.1-3-8.5-2.3V5.5Z" /><path d="M20.5 5.5c-3.4-.7-6.2.1-8.5 2.3v11.7c2.3-2.2 5.1-3 8.5-2.3V5.5Z" /></>,
  pets: <><ellipse cx="6.2" cy="8.2" rx="2" ry="2.5" /><ellipse cx="10.2" cy="5.2" rx="2" ry="2.5" /><ellipse cx="14.8" cy="5.2" rx="2" ry="2.5" /><ellipse cx="18.2" cy="8.8" rx="2" ry="2.5" /><path d="M12.2 10.5c-3.4 0-6.2 3-6.2 6.2 0 2.7 2.3 4.2 4.7 2.8a3 3 0 0 1 3 0c2.4 1.4 4.7-.1 4.7-2.8 0-3.2-2.8-6.2-6.2-6.2Z" /></>,
  'other-local-services': <><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" /><rect x="14" y="14" width="6.5" height="6.5" rx="1.5" /></>,
})

if (Object.keys(SERVICE_CATEGORY_ICONS).length !== SERVICE_TAXONOMY_GROUPS.length) {
  throw new Error('Service category icon map must match the canonical taxonomy groups')
}

function ServiceCategoryIcon({ groupId }) {
  const icon = SERVICE_CATEGORY_ICONS[groupId]
  if (!icon) throw new Error(`Missing service category icon for ${groupId}`)

  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {icon}
    </svg>
  )
}

export default ServiceCategoryIcon
