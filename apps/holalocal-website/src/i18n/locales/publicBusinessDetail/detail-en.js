import { translation } from './createPublicBusinessDetail.js'

const detail = translation([
    'Back to results', 'Category not specified', 'Service area not specified', 'Public profile',
    'Verification coming soon', '{{plan}} plan', '{{count}} review', '{{count}} reviews',
    'No reviews yet', 'Business detail sections', 'Overview', 'Services', 'Photos', 'Reviews',
    'About', 'Opening conversation…', 'Message business',
    'Report business', 'About this business', 'This business has not added a public description yet.',
    'Service area', 'Languages', 'Not specified', 'Services offered',
    'No detailed services have been added yet.', 'Work gallery', '{{name}} work example {{index}}',
    'No work photos have been added yet.', 'Customer feedback',
    'Individual reviews are not available in this first release.',
    'This business has not received any reviews yet.', 'Contact information', 'Phone', 'Email',
    'Website', 'Open WhatsApp', 'Callback',
    'Callback requests are available through HolaLocal messaging.',
    'No public contact details have been added.', 'Unable to open this conversation. Please try again.',
    'Unable to submit this report. Please try again.', 'Business unavailable',
    'This business profile could not be found or is no longer active.',
  ])
detail.profileInformationProvided = 'Profile information is provided by the business.'
export default detail
