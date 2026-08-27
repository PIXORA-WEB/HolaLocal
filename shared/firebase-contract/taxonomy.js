export const SERVICE_TAXONOMY_VERSION = 1
export const MAX_BUSINESS_SERVICE_SELECTIONS = 6
export const MAX_CUSTOM_SERVICE_DESCRIPTION_LENGTH = 80

export const SERVICE_VALUE_RESOLUTIONS = Object.freeze({
  CANONICAL: 'canonical',
  RECOGNIZED_LEGACY: 'recognized-legacy',
  AMBIGUOUS_LEGACY: 'ambiguous-legacy',
  CUSTOM_LEGACY: 'custom-legacy',
  INVALID: 'invalid',
})

export const LEGACY_SERVICE_ALIAS_CONFIDENCES = Object.freeze({
  EXACT: 'exact',
  REASONABLE: 'reasonable',
})

const group = (id, translationKey, defaultLabel) => Object.freeze({
  id, translationKey, defaultLabel,
})

export const SERVICE_TAXONOMY_GROUPS = Object.freeze([
  group('home-property', 'services.taxonomy.groups.homeProperty', 'Home & Property'),
  group('professional-services', 'services.taxonomy.groups.professionalServices', 'Professional Services'),
  group('health-beauty-lifestyle', 'services.taxonomy.groups.healthBeautyLifestyle', 'Health, Beauty & Lifestyle'),
  group('learning-family', 'services.taxonomy.groups.learningFamily', 'Learning & Family'),
  group('pets', 'services.taxonomy.groups.pets', 'Pets'),
  group('other-local-services', 'services.taxonomy.groups.otherLocalServices', 'Other Local Services'),
])

export const SERVICE_TAXONOMY_GROUP_IDS = Object.freeze(
  SERVICE_TAXONOMY_GROUPS.map(({ id }) => id),
)

const service = (
  id,
  groupId,
  translationKey,
  defaultLabel,
  supportsCustomDescription = false,
) => Object.freeze({
  id, groupId, translationKey, defaultLabel, supportsCustomDescription,
})

export const SERVICE_TAXONOMY_SERVICES = Object.freeze([
  service('plumber', 'home-property', 'services.taxonomy.services.plumber', 'Plumber'),
  service('electrician', 'home-property', 'services.taxonomy.services.electrician', 'Electrician'),
  service('cleaner', 'home-property', 'services.taxonomy.services.cleaner', 'Cleaner'),
  service('gardener', 'home-property', 'services.taxonomy.services.gardener', 'Gardener'),
  service('builder-renovation', 'home-property', 'services.taxonomy.services.builderRenovation', 'Builder & Renovation'),
  service('painter-decorator', 'home-property', 'services.taxonomy.services.painterDecorator', 'Painter & Decorator'),
  service('handyman', 'home-property', 'services.taxonomy.services.handyman', 'Handyman'),
  service('air-conditioning', 'home-property', 'services.taxonomy.services.airConditioning', 'Air Conditioning'),
  service('pool-services', 'home-property', 'services.taxonomy.services.poolServices', 'Pool Services'),
  service('pest-control', 'home-property', 'services.taxonomy.services.pestControl', 'Pest Control'),
  service('locksmith', 'home-property', 'services.taxonomy.services.locksmith', 'Locksmith'),
  service('removals', 'home-property', 'services.taxonomy.services.removals', 'Removals'),
  service('lawyer', 'professional-services', 'services.taxonomy.services.lawyer', 'Lawyer'),
  service('accountant', 'professional-services', 'services.taxonomy.services.accountant', 'Accountant'),
  service('translator-interpreter', 'professional-services', 'services.taxonomy.services.translatorInterpreter', 'Translator & Interpreter'),
  service('graphic-designer', 'professional-services', 'services.taxonomy.services.graphicDesigner', 'Graphic Designer'),
  service('web-designer-developer', 'professional-services', 'services.taxonomy.services.webDesignerDeveloper', 'Web Designer & Developer'),
  service('photographer', 'professional-services', 'services.taxonomy.services.photographer', 'Photographer'),
  service('marketing', 'professional-services', 'services.taxonomy.services.marketing', 'Marketing'),
  service('business-consultant', 'professional-services', 'services.taxonomy.services.businessConsultant', 'Business Consultant'),
  service('personal-trainer', 'health-beauty-lifestyle', 'services.taxonomy.services.personalTrainer', 'Personal Trainer'),
  service('hairdresser', 'health-beauty-lifestyle', 'services.taxonomy.services.hairdresser', 'Hairdresser'),
  service('beauty-services', 'health-beauty-lifestyle', 'services.taxonomy.services.beautyServices', 'Beauty Services'),
  service('massage-wellness', 'health-beauty-lifestyle', 'services.taxonomy.services.massageWellness', 'Massage & Wellness'),
  service('nutrition', 'health-beauty-lifestyle', 'services.taxonomy.services.nutrition', 'Nutrition'),
  service('yoga-fitness', 'health-beauty-lifestyle', 'services.taxonomy.services.yogaFitness', 'Yoga & Fitness'),
  service('tutor', 'learning-family', 'services.taxonomy.services.tutor', 'Tutor'),
  service('language-teacher', 'learning-family', 'services.taxonomy.services.languageTeacher', 'Language Teacher'),
  service('music-teacher', 'learning-family', 'services.taxonomy.services.musicTeacher', 'Music Teacher'),
  service('childcare-babysitting', 'learning-family', 'services.taxonomy.services.childcareBabysitting', 'Childcare & Babysitting'),
  service('dog-walker', 'pets', 'services.taxonomy.services.dogWalker', 'Dog Walker'),
  service('pet-sitter', 'pets', 'services.taxonomy.services.petSitter', 'Pet Sitter'),
  service('pet-groomer', 'pets', 'services.taxonomy.services.petGroomer', 'Pet Groomer'),
  service('dog-trainer', 'pets', 'services.taxonomy.services.dogTrainer', 'Dog Trainer'),
  service('other-local-service', 'other-local-services', 'services.taxonomy.services.otherLocalService', 'Other Local Service', true),
])

export const SERVICE_TAXONOMY_SERVICE_IDS = Object.freeze(
  SERVICE_TAXONOMY_SERVICES.map(({ id }) => id),
)

const legacy = (value, serviceId, confidence) => Object.freeze({
  value, serviceId, resolution: SERVICE_VALUE_RESOLUTIONS.RECOGNIZED_LEGACY, confidence,
  compatibleGroupId: null,
})

const ambiguousLegacy = (value, compatibleGroupId = null) => Object.freeze({
  value, serviceId: null, resolution: SERVICE_VALUE_RESOLUTIONS.AMBIGUOUS_LEGACY,
  confidence: null, compatibleGroupId,
})

export const LEGACY_SERVICE_VALUES = Object.freeze([
  legacy('Cleaning', 'cleaner', LEGACY_SERVICE_ALIAS_CONFIDENCES.EXACT),
  legacy('Plumbing', 'plumber', LEGACY_SERVICE_ALIAS_CONFIDENCES.EXACT),
  legacy('Electrical', 'electrician', LEGACY_SERVICE_ALIAS_CONFIDENCES.REASONABLE),
  legacy('Gardening', 'gardener', LEGACY_SERVICE_ALIAS_CONFIDENCES.EXACT),
  legacy('Painting & Decorating', 'painter-decorator', LEGACY_SERVICE_ALIAS_CONFIDENCES.EXACT),
  legacy('Building & Renovation', 'builder-renovation', LEGACY_SERVICE_ALIAS_CONFIDENCES.REASONABLE),
  legacy('Handyman', 'handyman', LEGACY_SERVICE_ALIAS_CONFIDENCES.EXACT),
  legacy('Air Conditioning', 'air-conditioning', LEGACY_SERVICE_ALIAS_CONFIDENCES.EXACT),
  legacy('Locksmith', 'locksmith', LEGACY_SERVICE_ALIAS_CONFIDENCES.EXACT),
  legacy('Pest Control', 'pest-control', LEGACY_SERVICE_ALIAS_CONFIDENCES.EXACT),
  legacy('Pool Maintenance', 'pool-services', LEGACY_SERVICE_ALIAS_CONFIDENCES.REASONABLE),
  ambiguousLegacy('Pet Services', 'pets'),
  ambiguousLegacy('Other'),
])

const groupsById = new Map(SERVICE_TAXONOMY_GROUPS.map((definition) => [definition.id, definition]))
const servicesById = new Map(SERVICE_TAXONOMY_SERVICES.map((definition) => [definition.id, definition]))
const legacyByValue = new Map(LEGACY_SERVICE_VALUES.map((definition) => [definition.value, definition]))

export function isCanonicalServiceId(value) {
  return typeof value === 'string' && servicesById.has(value)
}

export function getServiceTaxonomyGroup(groupId) {
  return groupsById.get(groupId) ?? null
}

export function getServiceTaxonomyService(serviceId) {
  return servicesById.get(serviceId) ?? null
}

export function getServiceGroupId(serviceId) {
  return getServiceTaxonomyService(serviceId)?.groupId ?? null
}

export function getServiceIdsForGroup(groupId) {
  if (!groupsById.has(groupId)) return Object.freeze([])
  return Object.freeze(
    SERVICE_TAXONOMY_SERVICES
      .filter((definition) => definition.groupId === groupId)
      .map(({ id }) => id),
  )
}

export function serviceSupportsCustomDescription(serviceId) {
  return getServiceTaxonomyService(serviceId)?.supportsCustomDescription === true
}

export function resolveServiceValue(rawValue) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return Object.freeze({
      rawValue,
      serviceId: null,
      resolution: SERVICE_VALUE_RESOLUTIONS.INVALID,
      confidence: null,
      compatibleGroupId: null,
    })
  }

  if (isCanonicalServiceId(rawValue)) {
    return Object.freeze({
      rawValue,
      serviceId: rawValue,
      resolution: SERVICE_VALUE_RESOLUTIONS.CANONICAL,
      confidence: null,
      compatibleGroupId: null,
    })
  }

  const value = rawValue.trim()
  const legacyDefinition = legacyByValue.get(value)
  if (legacyDefinition) {
    return Object.freeze({
      rawValue,
      serviceId: legacyDefinition.serviceId,
      resolution: legacyDefinition.resolution,
      confidence: legacyDefinition.confidence,
      compatibleGroupId: legacyDefinition.compatibleGroupId,
    })
  }

  return Object.freeze({
    rawValue,
    serviceId: null,
    resolution: SERVICE_VALUE_RESOLUTIONS.CUSTOM_LEGACY,
    confidence: null,
    compatibleGroupId: null,
  })
}

export function projectBusinessTaxonomy({ primaryCategoryId, categoryIds } = {}) {
  const primaryServiceId = resolveServiceValue(primaryCategoryId).serviceId
  const serviceIds = []
  const seenServiceIds = new Set()

  const addResolvedService = (rawValue) => {
    const serviceId = resolveServiceValue(rawValue).serviceId
    if (!serviceId || seenServiceIds.has(serviceId)) return
    seenServiceIds.add(serviceId)
    serviceIds.push(serviceId)
  }

  if (primaryServiceId) addResolvedService(primaryServiceId)
  if (Array.isArray(categoryIds)) categoryIds.forEach(addResolvedService)

  return Object.freeze({
    primaryServiceId,
    serviceIds: Object.freeze(serviceIds),
  })
}
