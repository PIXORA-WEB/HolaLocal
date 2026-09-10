import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getServiceIdsForGroup,
  getServiceTaxonomyService,
  MAX_BUSINESS_SERVICE_SELECTIONS,
  MAX_CUSTOM_SERVICE_DESCRIPTION_LENGTH,
  SERVICE_TAXONOMY_GROUPS,
  SERVICE_TAXONOMY_SERVICES,
} from '@holalocal/firebase-contract'
import SelectField from '../../components/common/SelectField.jsx'
import LocationCombobox from '../../components/business/LocationCombobox.jsx'
import ServiceAreaSelector from '../../components/business/ServiceAreaSelector.jsx'
import AccessibleDialog from '../../components/common/AccessibleDialog.jsx'
import LoadingScreen from '../../components/common/LoadingScreen.jsx'
import RecoveryMessage from '../../components/common/RecoveryMessage.jsx'
import { EditableImageAvatar } from '../../components/common/PublicBusinessCard.jsx'
import FormFieldError from '../../components/common/FormFieldError.jsx'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import {
  deleteBusinessGalleryImage,
  ensureBusinessProfile,
  getBusinessById,
  uploadBusinessGalleryImages,
  uploadBusinessLogo,
  updateBusinessProfile,
} from '../../services/businessService.js'
import {
  businessLanguageOptions,
  isOwnerEditableBusinessStatus,
  normalizeCustomValues,
  serviceAreaOptions,
} from '../../utils/business.js'
import { getLanguageNameFromCode, normalizeLanguageCode } from '../../utils/languages.js'
import { getBusinessProfileCompletion } from '../../utils/businessCompletion.js'
import {
  classifyFrontendError,
  getRecoveryActionTranslationKey,
} from '../../utils/frontendErrors.js'
import { createMediaSubmissionGuard } from '../../utils/mediaSubmissionGuard.js'
import {
  getServiceAreaGroupLabel,
  locationDisplayLabel,
  normalizeCountryCode,
  normalizeProvinceId,
  normalizeServiceAreaId,
  primaryLocationInputState,
  primaryLocationSelectionState,
  resolveLaunchLocation,
  toggleServiceAreaSelection,
  validateBusinessLocation,
} from '../../utils/locations.js'
import {
  beginCanonicalTaxonomyEdit,
  deriveBusinessTaxonomyForm,
  prepareBusinessTaxonomyUpdate,
  selectPrimaryService,
  selectTaxonomyGroup,
  toggleAdditionalService,
} from '../../utils/businessTaxonomyForm.js'

const emptyForm = {
  name: '',
  tagline: '',
  description: '',
  phone: '',
  phoneVisible: false,
  whatsappNumber: '',
  whatsappVisible: false,
  email: '',
  emailVisible: false,
  website: '',
  websiteVisible: false,
  preferredContactMethod: 'holalocal',
  allowCallbackRequests: false,
  city: '',
  primaryLocationId: '',
  province: '',
  country: 'ES',
  serviceAreas: [],
  serviceRadiusKm: 20,
  languages: ['en'],
  primaryLanguage: 'en',
}

function prepareCustomSelection(values = [], options) {
  const optionValues = options.map((option) => typeof option === 'string' ? option : option.value)
  const customValue = values.find((value) => value !== 'Other' && value !== 'other' && !optionValues.includes(value)) ?? ''
  const selectedValues = values.filter((value) => value !== 'Other' && value !== 'other' && optionValues.includes(value))

  if (customValue) selectedValues.push(optionValues.includes('other') ? 'other' : 'Other')

  return { customValue, selectedValues }
}

function draftSignature(form, customLanguage, taxonomy, taxonomyDirty) {
  return JSON.stringify({ form, customLanguage, taxonomy, taxonomyDirty })
}

function CheckboxGroup({ error, id, isOptionDisabled, legend, name, options, selectedValues, onToggle }) {
  const groups = options.reduce((result, option) => {
    const group = typeof option === 'string' ? '' : option.group ?? ''
    if (!result.has(group)) result.set(group, [])
    result.get(group).push(option)
    return result
  }, new Map())

  return (
    <fieldset
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={Boolean(error)}
      className="checkbox-group"
      id={id}
      tabIndex={error ? -1 : undefined}
    >
      <legend>{legend}</legend>
      {[...groups.entries()].map(([group, groupOptions]) => (
        <div className="checkbox-group__section" key={group || 'options'}>
          {group && <p>{groupOptions[0].groupLabel}</p>}
          <div className="checkbox-group__options">
            {groupOptions.map((option) => {
              const optionValue = typeof option === 'string' ? option : option.value
              const optionLabel = typeof option === 'string' ? option : option.label
              return (
                <label key={optionValue}>
                  <input
                    checked={selectedValues.includes(optionValue)}
                    disabled={isOptionDisabled?.(optionValue) === true}
                    name={name}
                    onChange={() => onToggle(optionValue)}
                    type="checkbox"
                    value={optionValue}
                  />
                  <span>{optionLabel}</span>
                </label>
              )
            })}
          </div>
        </div>
      ))}
      <FormFieldError id={`${id}-error`} message={error} />
    </fieldset>
  )
}

function EditBusinessPage() {
  const { t } = useTranslation()
  const { refreshUserProfile, signOutUser, user, userProfile } = useAuthentication()
  const navigate = useNavigate()
  const [businessProfile, setBusinessProfile] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [workflowError, setWorkflowError] = useState(null)
  const [taxonomy, setTaxonomy] = useState(() => deriveBusinessTaxonomyForm())
  const [taxonomyDirty, setTaxonomyDirty] = useState(false)
  const [customLanguage, setCustomLanguage] = useState('')
  const [mediaError, setMediaError] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [deletingImage, setDeletingImage] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [fieldErrors, setFieldErrors] = useState({})
  const [historyRestoring, setHistoryRestoring] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const [mediaRetryAvailable, setMediaRetryAvailable] = useState(false)
  const mediaRetryRef = useRef(null)
  const [logoSubmissionGuard] = useState(createMediaSubmissionGuard)
  const [gallerySubmissionGuard] = useState(createMediaSubmissionGuard)
  const [initialDraftSignature, setInitialDraftSignature] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const attemptedProfileRefreshBusinessIdRef = useRef(null)
  const historyIndexRef = useRef(null)
  const historyNavigationRef = useRef({
    allowNext: false,
    pending: null,
    restoring: false,
  })
  const pendingNavigationRef = useRef(null)
  const userId = user.uid
  const userBusinessId = userProfile?.businessId ?? null
  const hasBusinessRole = userProfile?.roles?.includes('business') === true
  const userEmail = userProfile?.email ?? ''
  const userCity = userProfile?.city ?? ''
  const userPreferredLocale = userProfile?.preferredLocale ?? 'en'
  const serviceGroupOptions = [
    { label: t('business.form.services.chooseGroup'), value: '' },
    ...SERVICE_TAXONOMY_GROUPS.map((group) => ({
      label: t(group.translationKey, { defaultValue: group.defaultLabel }), value: group.id,
    })),
  ]
  const mainServiceOptions = [
    { label: t('business.form.services.chooseMain'), value: '' },
    ...getServiceIdsForGroup(taxonomy.groupId).map((serviceId) => {
      const service = getServiceTaxonomyService(serviceId)
      return { label: t(service.translationKey, { defaultValue: service.defaultLabel }), value: service.id }
    }),
  ]
  const additionalServiceOptions = SERVICE_TAXONOMY_SERVICES
    .filter(({ id }) => id !== taxonomy.primaryServiceId)
    .map((service) => {
      const group = SERVICE_TAXONOMY_GROUPS.find(({ id }) => id === service.groupId)
      return {
        value: service.id,
        label: t(service.translationKey, { defaultValue: service.defaultLabel }),
        group: service.groupId,
        groupLabel: t(group.translationKey, { defaultValue: group.defaultLabel }),
      }
    })
  const localizedServiceAreaOptions = serviceAreaOptions.map((area) => {
    return {
      ...area,
      groupLabel: getServiceAreaGroupLabel(area.group, t),
      label: locationDisplayLabel(area.location),
    }
  })
  const localizedLanguageOptions = businessLanguageOptions.map((language) => ({
    ...language,
    label: language.value === 'other' ? t('common.other', { defaultValue: 'Other' }) : language.label,
  }))
  const galleryImages = businessProfile?.galleryEntries ?? []
  const galleryLimit = Math.max(Number(businessProfile?.entitlements?.limits?.galleryImages) || 0, 0)
  const currentDraftSignature = useMemo(
    () => draftSignature(form, customLanguage, taxonomy, taxonomyDirty),
    [customLanguage, form, taxonomy, taxonomyDirty],
  )
  const isDirty = initialDraftSignature !== null && initialDraftSignature !== currentDraftSignature
  const contactMethodOptions = [
    { label: t('business.form.contact.holalocal'), value: 'holalocal' },
    { label: t('business.form.contact.phone'), value: 'phone' },
    { label: t('business.form.contact.emailLabel'), value: 'email' },
    { label: 'WhatsApp', value: 'whatsapp' },
  ]
  const completionBusiness = {
    ...businessProfile,
    ...form,
    primaryCategoryId: taxonomy.primaryServiceId || businessProfile?.primaryCategoryId,
    categoryIds: taxonomy.primaryServiceId
      ? [taxonomy.primaryServiceId, ...taxonomy.additionalServiceIds]
      : businessProfile?.categoryIds,
    contact: { ...(businessProfile?.contact ?? {}), preferredContactMethod: form.preferredContactMethod },
    galleryImages: businessProfile?.galleryImages,
    galleryImageURLs: businessProfile?.galleryImageURLs,
    languages: normalizeCustomValues(form.languages, customLanguage),
    location: {
      locality: form.city,
      region: form.province,
      countryCode: form.country,
    },
    profilePhoto: businessProfile?.profilePhoto,
    serviceAreas: form.serviceAreas,
  }
  const completion = getBusinessProfileCompletion(completionBusiness, {
    selectedPrimaryLocationId: form.primaryLocationId,
  })

  useEffect(() => {
    let active = true

    async function loadBusinessProfile() {
      setError('')
      setWorkflowError(null)
      setLoading(true)
      try {
        const profile = await ensureBusinessProfile(userId, {
          businessId: userBusinessId,
          roles: hasBusinessRole ? ['business'] : [],
        })
        if (!active) return

        const loadedLanguages = (profile?.languages ?? [userPreferredLocale])
          .map(normalizeLanguageCode)
        const loadedTaxonomy = deriveBusinessTaxonomyForm(profile)
        const preparedServiceAreas = [...new Set(
          (profile?.serviceAreas ?? []).map(normalizeServiceAreaId),
        )]
        const preparedLanguages = prepareCustomSelection(
          loadedLanguages,
          businessLanguageOptions,
        )

        const savedPrimaryLocation = resolveLaunchLocation(
          profile?.location?.locality ?? userCity,
        )
        const nextForm = {
          ...emptyForm,
          email: profile?.contact?.email ?? userEmail,
          phone: profile?.contact?.phone ?? '',
          phoneVisible: profile?.contact?.phoneVisible === true,
          whatsappNumber: profile?.contact?.whatsappNumber ?? '',
          whatsappVisible: profile?.contact?.whatsappVisible === true,
          emailVisible: profile?.contact?.emailVisible === true,
          website: profile?.contact?.website ?? '',
          websiteVisible: profile?.contact?.websiteVisible === true,
          preferredContactMethod: profile?.contact?.preferredContactMethod ?? 'holalocal',
          allowCallbackRequests: profile?.contact?.allowCallbackRequests === true,
          city: savedPrimaryLocation?.locality ?? profile?.location?.locality ?? userCity,
          primaryLocationId: savedPrimaryLocation?.id ?? '',
          province: savedPrimaryLocation?.regionCode
            ?? normalizeProvinceId(profile?.location?.region ?? ''),
          country: savedPrimaryLocation?.countryCode
            ?? normalizeCountryCode(profile?.location?.countryCode ?? 'ES'),
          primaryLanguage: profile?.primaryLanguage ?? loadedLanguages[0] ?? 'en',
          ...(profile ?? {}),
          serviceAreas: preparedServiceAreas,
          languages: preparedLanguages.selectedValues,
        }

        setBusinessProfile(profile)
        setTaxonomy(loadedTaxonomy)
        setTaxonomyDirty(false)
        setCustomLanguage(preparedLanguages.customValue)
        setForm(nextForm)
        setInitialDraftSignature(draftSignature(
          nextForm,
          preparedLanguages.customValue,
          loadedTaxonomy,
          false,
        ))
        if (
          profile?.businessId
          && profile.businessId !== userBusinessId
          && attemptedProfileRefreshBusinessIdRef.current !== profile.businessId
        ) {
          attemptedProfileRefreshBusinessIdRef.current = profile.businessId
          await refreshUserProfile({ uid: userId }, { background: true }).catch(() => undefined)
        }
      } catch (loadError) {
        if (active) {
          setWorkflowError(classifyFrontendError(loadError, {
            domain: 'workflow',
            fallbackType: 'BUSINESS_CREATE_FAILED',
          }))
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadBusinessProfile()

    return () => {
      active = false
    }
  }, [
    hasBusinessRole,
    loadAttempt,
    refreshUserProfile,
    t,
    userBusinessId,
    userCity,
    userEmail,
    userId,
    userPreferredLocale,
  ])

  useEffect(() => {
    if (!isDirty) return undefined

    const historyNavigation = historyNavigationRef.current
    historyIndexRef.current = Number.isInteger(window.history.state?.idx)
      ? window.history.state.idx
      : null

    function warnBeforeUnload(event) {
      event.preventDefault()
      event.returnValue = ''
    }

    function warnBeforeInternalNavigation(event) {
      const link = event.target.closest?.('a[href]')
      const signOutButton = event.target.closest?.(
        '.account-menu nav button, .mobile-navigation nav button',
      )
      if (!link && !signOutButton) return
      if (link) {
        if (link.target === '_blank' || link.origin !== window.location.origin) return
        const destination = new URL(link.href)
        if (destination.pathname === window.location.pathname && destination.search === window.location.search) return
      }
      event.preventDefault()
      event.stopPropagation()
      const action = signOutButton ? { type: 'signOut' } : {
        type: 'navigate',
        to: `${link.pathname}${link.search}${link.hash}`,
      }
      pendingNavigationRef.current = action
      setPendingNavigation(action)
    }

    function warnBeforeHistoryNavigation(event) {
      const targetIndex = Number.isInteger(event.state?.idx) ? event.state.idx : null
      const currentIndex = historyIndexRef.current

      if (historyNavigation.allowNext) {
        historyNavigation.allowNext = false
        historyIndexRef.current = targetIndex
        return
      }
      if (historyNavigation.restoring && targetIndex === currentIndex) {
        historyNavigation.restoring = false
        setHistoryRestoring(false)
        return
      }
      if (targetIndex === null || currentIndex === null || targetIndex === currentIndex) return

      event.stopImmediatePropagation()
      const action = {
        delta: targetIndex - currentIndex,
        type: 'history',
      }
      if (!pendingNavigationRef.current) {
        historyNavigation.pending = action
        pendingNavigationRef.current = action
        setPendingNavigation(action)
      }
      historyNavigation.restoring = true
      setHistoryRestoring(true)
      window.history.go(currentIndex - targetIndex)
    }

    window.addEventListener('beforeunload', warnBeforeUnload)
    window.addEventListener('popstate', warnBeforeHistoryNavigation, true)
    document.addEventListener('click', warnBeforeInternalNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload)
      window.removeEventListener('popstate', warnBeforeHistoryNavigation, true)
      document.removeEventListener('click', warnBeforeInternalNavigation, true)
      historyNavigation.pending = null
      historyNavigation.restoring = false
      pendingNavigationRef.current = null
    }
  }, [isDirty])

  useEffect(() => {
    if (!saveSuccess) return undefined
    const timeout = window.setTimeout(() => setSaveSuccess(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [saveSuccess])

  function cancelPendingNavigation() {
    historyNavigationRef.current.pending = null
    pendingNavigationRef.current = null
    setPendingNavigation(null)
  }

  async function leaveWithoutSaving() {
    const action = pendingNavigationRef.current ?? pendingNavigation
    cancelPendingNavigation()
    if (action?.type === 'signOut') {
      try {
        await signOutUser()
      } catch (signOutError) {
        setError(getAuthenticationErrorMessage(signOutError, t))
      }
    } else if (action?.type === 'history') {
      setInitialDraftSignature(currentDraftSignature)
      historyNavigationRef.current.allowNext = true
      window.history.go(action.delta)
    } else if (action?.to) {
      setInitialDraftSignature(currentDraftSignature)
      navigate(action.to)
    }
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: '' }))
  }

  function toggleArrayValue(field, value) {
    setFieldErrors((current) => ({ ...current, [field]: '' }))
    setForm((current) => {
      const values = current[field]
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value]

      if (field === 'languages') {
        const availableLanguages = normalizeCustomValues(nextValues, customLanguage)
        const currentPrimaryIsAvailable = availableLanguages.some(
          (language) => language.toLowerCase() === current.primaryLanguage.toLowerCase(),
        )

        return {
          ...current,
          languages: nextValues,
          primaryLanguage: currentPrimaryIsAvailable
            ? current.primaryLanguage
            : (availableLanguages[0] ?? ''),
        }
      }

      return {
        ...current,
        [field]: nextValues,
      }
    })
  }

  function handleCustomLanguageChange(value) {
    setCustomLanguage(value)
    setFieldErrors((current) => ({ ...current, customLanguage: '', languages: '' }))
    setForm((current) => {
      if (!current.languages.includes('other')) return current

      const availableLanguages = normalizeCustomValues(current.languages, value)
      const primaryIsAvailable = availableLanguages.some(
        (language) => language.toLowerCase() === current.primaryLanguage.toLowerCase(),
      )

      return {
        ...current,
        primaryLanguage: primaryIsAvailable
          ? current.primaryLanguage
          : (availableLanguages[0] ?? ''),
      }
    })
  }

  function editTaxonomy(update) {
    setTaxonomyDirty(true)
    setTaxonomy((current) => update(current))
    setFieldErrors((current) => ({
      ...current, primaryCategoryId: '', categoryIds: '', customServiceDescription: '',
    }))
  }

  async function uploadLogoFile(file) {
    if (!businessProfile?.businessId) return
    const submission = logoSubmissionGuard
    if (!submission.tryAcquire()) return
    mediaRetryRef.current = null
    setMediaRetryAvailable(false)
    setMediaError(null)
    setLogoUploading(true)

    try {
      const [pendingFile] = await submission.pendingFiles([file])
      if (!pendingFile) return
      setBusinessProfile(await uploadBusinessLogo(businessProfile.businessId, pendingFile, {
        onCommitted: () => submission.markSuccessful(pendingFile),
      }))
      mediaRetryRef.current = null
      setMediaRetryAvailable(false)
    } catch (uploadError) {
      await getBusinessById(businessProfile.businessId)
        .then((latestBusiness) => latestBusiness && setBusinessProfile(latestBusiness))
        .catch(() => undefined)
      const classifiedError = classifyFrontendError(uploadError, {
        domain: 'media',
        fallbackType: 'MEDIA_UPLOAD_FAILED',
      })
      mediaRetryRef.current = classifiedError.recovery === 'retry'
        ? () => void uploadLogoFile(file)
        : null
      setMediaRetryAvailable(classifiedError.recovery === 'retry')
      setMediaError(classifiedError)
    } finally {
      submission.release()
      setLogoUploading(false)
    }
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void uploadLogoFile(file)
  }

  async function uploadGalleryFiles(selectedFiles) {
    if (selectedFiles.length === 0 || !businessProfile?.businessId) return
    const submission = gallerySubmissionGuard
    if (!submission.tryAcquire()) return
    mediaRetryRef.current = null
    setMediaRetryAvailable(false)
    setGalleryUploading(true)

    try {
      const pendingFiles = await submission.pendingFiles(selectedFiles)
      if (pendingFiles.length === 0) return
      const remainingSlots = Math.max(galleryLimit - galleryImages.length, 0)
      if (remainingSlots === 0) {
        mediaRetryRef.current = null
        setMediaRetryAvailable(false)
        setMediaError({
          translationKey: 'business.form.errors.galleryLimit',
          recovery: 'choose-file',
        })
        return
      }

      mediaRetryRef.current = null
      setMediaRetryAvailable(false)
      setMediaError(pendingFiles.length > remainingSlots
        ? {
            translationKey: 'business.form.errors.galleryRemaining',
            interpolation: { count: remainingSlots },
            recovery: 'choose-file',
          }
        : null)
      setBusinessProfile(
        await uploadBusinessGalleryImages(
          businessProfile.businessId,
          pendingFiles.slice(0, remainingSlots),
          { onCommitted: (file) => submission.markSuccessful(file) },
        ),
      )
      mediaRetryRef.current = null
      setMediaRetryAvailable(false)
    } catch (uploadError) {
      await getBusinessById(businessProfile.businessId)
        .then((latestBusiness) => latestBusiness && setBusinessProfile(latestBusiness))
        .catch(() => undefined)
      const classifiedError = classifyFrontendError(uploadError, {
        domain: 'media',
        fallbackType: 'MEDIA_UPLOAD_FAILED',
      })
      mediaRetryRef.current = classifiedError.recovery === 'retry'
        ? () => void uploadGalleryFiles(selectedFiles)
        : null
      setMediaRetryAvailable(classifiedError.recovery === 'retry')
      setMediaError(classifiedError)
    } finally {
      submission.release()
      setGalleryUploading(false)
    }
  }

  function handleGalleryUpload(event) {
    const selectedFiles = [...(event.target.files ?? [])]
    event.target.value = ''
    void uploadGalleryFiles(selectedFiles)
  }

  async function handleGalleryDelete(image) {
    if (!businessProfile?.businessId) return
    setMediaError(null)
    setDeletingImage(image.storagePath || image.downloadUrl)

    try {
      setBusinessProfile(await deleteBusinessGalleryImage(businessProfile.businessId, image))
      mediaRetryRef.current = null
      setMediaRetryAvailable(false)
    } catch (deleteError) {
      const classifiedError = classifyFrontendError(deleteError, {
        domain: 'media',
        fallbackType: 'MEDIA_DELETE_FAILED',
      })
      mediaRetryRef.current = classifiedError.recovery === 'retry'
        ? () => void handleGalleryDelete(image)
        : null
      setMediaRetryAvailable(classifiedError.recovery === 'retry')
      setMediaError(classifiedError)
    } finally {
      setDeletingImage('')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaveSuccess(false)
    setFieldErrors({})
    if (submitting) return

    const name = form.name.trim()
    const description = form.description.trim()
    const city = form.city.trim()
    const usesCustomLanguage = form.languages.includes('other')

    const serviceAreas = form.serviceAreas
    const languages = normalizeCustomValues(form.languages, customLanguage)
    const existingTaxonomyIsEmpty = !businessProfile?.primaryCategoryId
      && (!Array.isArray(businessProfile?.categoryIds) || businessProfile.categoryIds.length === 0)
    const taxonomyUpdate = prepareBusinessTaxonomyUpdate(
      taxonomy,
      taxonomyDirty || existingTaxonomyIsEmpty,
    )

    const nextErrors = {}
    if (!name) nextErrors.name = t('validation.businessName')
    if (!description) nextErrors.description = t('validation.businessDescription')
    if (!taxonomyUpdate.valid) {
      for (const validationIssue of taxonomyUpdate.issues) {
        const field = validationIssue.field
        if (field === 'customServiceDescription') {
          nextErrors.customServiceDescription = t('business.form.services.customDescriptionError')
        } else if (field === 'categoryIds') {
          nextErrors.categoryIds = t('business.form.services.selectionError')
        } else {
          nextErrors.primaryCategoryId = t('business.form.services.mainServiceError')
        }
      }
    }
    const locationValidation = validateBusinessLocation({
      location: {
        locality: city,
        region: form.province,
        countryCode: form.country,
      },
      serviceAreas,
    }, {
      selectedPrimaryLocationId: form.primaryLocationId,
    })
    if (!locationValidation.primarySelected) {
      nextErrors.city = city.includes(',')
        ? t('business.form.location.chooseOnePrimary')
        : t('business.form.location.selectPrimary')
    }
    if (!locationValidation.serviceAreasValid) {
      nextErrors.serviceAreas = locationValidation.unresolvedServiceAreas.length > 0
        ? t('business.form.location.resolveServiceAreas')
        : t('business.form.location.selectServiceArea')
    }
    if (usesCustomLanguage && !customLanguage.trim()) nextErrors.customLanguage = t('validation.customLanguage')
    if (languages.length === 0) nextErrors.languages = t('validation.languages')
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = t('validation.email')
    if (form.website && !URL.canParse(form.website)) nextErrors.website = t('validation.website')
    setFieldErrors(nextErrors)
    const fieldIds = {
      name: 'business-name', description: 'business-description', primaryCategoryId: 'business-main-category',
      categoryIds: 'business-additional-services', customServiceDescription: 'custom-service-description',
      city: 'business-primary-location',
      serviceAreas: 'business-service-areas',
      customLanguage: 'custom-language', languages: 'business-languages-group', email: 'business-email',
      website: 'business-website',
    }
    const firstInvalidField = Object.keys(fieldIds).find((field) => nextErrors[field])
    if (firstInvalidField) {
      requestAnimationFrame(() => {
        const field = document.getElementById(fieldIds[firstInvalidField])
        field?.focus()
        field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
      return
    }

    const primaryLanguage =
      languages.find(
        (language) => language.toLowerCase() === form.primaryLanguage.trim().toLowerCase(),
      ) ?? languages[0]

    setSubmitting(true)

    const businessData = {
      name,
      tagline: form.tagline.trim(),
      description,
      ...(taxonomyUpdate.updates ?? {}),
      contact: {
        phone: form.phone.trim(),
        phoneVisible: form.phoneVisible,
        whatsappNumber: form.whatsappNumber.trim(),
        whatsappVisible: form.whatsappVisible,
        email: form.email.trim(),
        emailVisible: form.emailVisible,
        website: form.website.trim(),
        websiteVisible: form.websiteVisible,
        preferredContactMethod: form.preferredContactMethod,
        allowCallbackRequests: form.allowCallbackRequests,
      },
      location: {
        locality: locationValidation.primary.locality,
        region: form.province,
        countryCode: form.country.trim() || 'ES',
      },
      serviceAreas,
      serviceRadiusKm: Number(form.serviceRadiusKm),
      languages,
      primaryLanguage,
    }

    try {
      const editableBusiness = businessProfile ?? await ensureBusinessProfile(userId, {
        businessId: userBusinessId,
        roles: hasBusinessRole ? ['business'] : [],
      })
      const savedBusiness = await updateBusinessProfile(editableBusiness.businessId, businessData)

      setBusinessProfile(savedBusiness)
      const savedTaxonomy = deriveBusinessTaxonomyForm(savedBusiness)
      setTaxonomy(savedTaxonomy)
      setTaxonomyDirty(false)
      setInitialDraftSignature(draftSignature(form, customLanguage, savedTaxonomy, false))
      setSaveSuccess(true)
    } catch (saveError) {
      if (saveError.reason === 'business-save-refresh-failed') {
        setInitialDraftSignature(draftSignature(form, customLanguage, taxonomy, taxonomyDirty))
        setError(t('business.form.errors.savedRefreshFailed'))
        return
      }
      const classifiedError = classifyFrontendError(saveError, {
        domain: 'business-save',
        fallbackType: 'BUSINESS_SAVE_FAILED',
      })
      setError(t(classifiedError.translationKey))
    } finally {
      setSubmitting(false)
    }
  }

  const mediaErrorAction = mediaError?.recovery === 'sign-in'
    ? () => navigate('/login')
    : mediaError?.recovery === 'refresh'
      ? () => {
          setMediaError(null)
          setLoadAttempt((attempt) => attempt + 1)
        }
      : mediaRetryAvailable
        ? () => mediaRetryRef.current?.()
        : undefined
  const mediaErrorMessage = mediaError?.translationKey === 'business.form.errors.galleryRemaining'
    ? t('business.form.errors.galleryRemaining', { count: mediaError.interpolation.count })
    : mediaError
      ? t(mediaError.translationKey, mediaError.interpolation)
      : ''
  const workflowErrorAction = workflowError?.recovery === 'sign-in'
    ? () => navigate('/login')
    : workflowError?.recovery === 'verify-email'
      ? () => navigate('/verify-email')
      : workflowError?.recovery === 'complete-profile'
        ? () => navigate('/complete-profile')
        : workflowError?.recovery === 'contact-support'
          ? () => navigate('/contact')
          : workflowError?.recovery === 'sign-out'
            ? () => void signOutUser().catch((signOutError) => {
                setWorkflowError(classifyFrontendError(signOutError, {
                  domain: 'workflow',
                  fallbackType: 'ACCOUNT_TRANSITION_FAILED',
                }))
              })
            : workflowError?.recovery === 'refresh-account'
              ? () => void refreshUserProfile({ uid: userId }, { background: true })
                  .then(() => {
                    setWorkflowError(null)
                    setLoadAttempt((attempt) => attempt + 1)
                  })
                  .catch((refreshError) => setWorkflowError(classifyFrontendError(refreshError, {
                    domain: 'workflow',
                    fallbackType: 'BUSINESS_CREATE_FAILED',
                  })))
          : () => {
              setLoading(true)
              setWorkflowError(null)
              setLoadAttempt((attempt) => attempt + 1)
            }

  if (loading) return <LoadingScreen message={t('business.control.loading')} />

  if (workflowError && !businessProfile) {
    return (
      <RecoveryMessage
        actionLabel={t(getRecoveryActionTranslationKey(workflowError.recovery) ?? 'common.retry')}
        message={t(workflowError.translationKey)}
        onAction={workflowErrorAction}
      />
    )
  }

  if (businessProfile && !isOwnerEditableBusinessStatus(businessProfile.status)) {
    return (
      <section className="services-state" aria-labelledby="business-edit-unavailable-title">
        <span aria-hidden="true">✦</span>
        <h1 id="business-edit-unavailable-title">
          {t(`business.control.status.${businessProfile.status}`)}
        </h1>
        <p>{t(`business.control.visibility.${businessProfile.status}`)}</p>
        <Link className="button button--primary" to="/business/dashboard">
          {t('profile.businessDashboard')}
        </Link>
      </section>
    )
  }

  return (
    <section className="business-form-page">
      <div className="business-form-page__heading">
        <Link className="business-form-page__back" to="/business/dashboard">← {t('account.business')}</Link>
        <h1>{t(businessProfile?.profileCompleted ? 'business.form.editTitle' : 'business.form.setupTitle')}</h1>
        <p>{t('business.form.description')}</p>
        <div className="business-profile-completion">
          <div>
            <strong>{t('business.completion', { percent: completion.percentage })}</strong>
          </div>
          <progress max="100" value={completion.percentage}>{completion.percentage}%</progress>
        </div>
      </div>

      {error && (
        <RecoveryMessage
          message={error}
        />
      )}

      {saveSuccess && (
        <div className="business-form__success" role="status">
          <span>{t('business.form.saveSuccess')}</span>
          <button aria-label={t('common.close')} onClick={() => setSaveSuccess(false)} type="button">×</button>
        </div>
      )}

      <section className="account-card business-media-manager" aria-labelledby="business-media-title">
        <header className="account-card__header business-media-manager__heading">
          <p className="account-card__eyebrow">{t('business.form.media.eyebrow')}</p>
          <h2 id="business-media-title">{t('business.form.media.title')}</h2>
          <p>{t('business.form.media.description')}</p>
          <p>{t('business.form.mediaSavedImmediately')}</p>
        </header>

        {mediaError && (
          <RecoveryMessage
            actionPending={logoUploading || galleryUploading || Boolean(deletingImage)}
            actionLabel={mediaError.recovery === 'sign-in' ? t('account.signIn') : undefined}
            message={mediaErrorMessage}
            onRetry={mediaErrorAction}
          />
        )}

        {businessProfile?.businessId ? (
          <>
            <div className="business-logo-editor">
              <EditableImageAvatar
                actionLabel={t(businessProfile.logoUrl ? 'business.form.media.changeLogo' : 'business.form.media.uploadLogo')}
                className="image-avatar--business-logo"
                disabled={logoUploading}
                imageAlt={t('business.form.media.logoAlt', { name: form.name || t('business.control.yourBusiness') })}
                inputLabel={t(businessProfile.logoUrl ? 'business.form.media.changeLogo' : 'business.form.media.uploadLogo')}
                name={form.name || t('business.control.yourBusiness')}
                onChange={handleLogoUpload}
                src={businessProfile.logoUrl}
                uploading={logoUploading}
              />
              <div className="business-logo-editor__content">
                <h3>{t('business.form.media.logoTitle')}</h3>
                <p>{t('business.form.media.logoDescription')}</p>
                <span>{t('business.form.media.logoHelp')}</span>
              </div>
            </div>

            <div className="business-gallery-editor">
              <div className="business-gallery-editor__heading">
                <div>
                  <h3>{t('business.form.media.galleryTitle')}</h3>
                  <p>{t('business.form.media.galleryDescription')}</p>
                </div>
                <label className="media-upload-button">
                  <span>{galleryUploading ? t('business.form.media.uploading') : t('business.form.media.addImages')}</span>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    disabled={galleryUploading || galleryImages.length >= galleryLimit}
                    multiple
                    onChange={handleGalleryUpload}
                    type="file"
                  />
                </label>
              </div>

              {galleryImages.length > 0 ? (
                <div className="business-gallery-grid">
                  {galleryImages.map((image) => (
                    <figure key={image.storagePath || image.downloadUrl}>
                      <img
                        alt={t('business.form.media.workImageAlt')}
                        decoding="async"
                        loading="lazy"
                        onError={(event) => { event.currentTarget.hidden = true }}
                        src={image.downloadUrl}
                      />
                      <button
                        disabled={deletingImage === (image.storagePath || image.downloadUrl)}
                        onClick={() => void handleGalleryDelete(image)}
                        type="button"
                      >
                        {deletingImage === (image.storagePath || image.downloadUrl) ? t('business.form.media.deleting') : t('common.delete')}
                      </button>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="business-gallery-empty">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6.5h16v12H4z" />
                    <path d="m7 15 3-3 2.5 2.5 2-2L18 16" />
                    <circle cx="16.5" cy="9.5" r="1.25" />
                  </svg>
                  <p>{t('business.form.media.emptyTitle')}</p>
                  <span>{t('business.form.media.emptyDescription')}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="business-gallery-empty">
            {t('business.form.media.saveFirst')}
          </p>
        )}
      </section>

      <form className="auth-form business-form" id="business-profile-form" noValidate onSubmit={handleSubmit}>
        <section className="business-form__section" aria-labelledby="business-identity-title">
          <header>
            <h2 id="business-identity-title">{t('business.form.identity.title')}</h2>
            <p>{t('business.form.identity.description')}</p>
          </header>

          <label htmlFor="business-name">{t('business.form.identity.name')} *</label>
          <input
            aria-describedby={fieldErrors.name ? 'business-name-error' : undefined}
            aria-invalid={Boolean(fieldErrors.name)}
            id="business-name"
            maxLength={120}
            onChange={(event) => setField('name', event.target.value)}
            required
            type="text"
            value={form.name}
          />
          <FormFieldError id="business-name-error" message={fieldErrors.name} />

          <label htmlFor="business-tagline">{t('business.form.identity.tagline')}</label>
          <input
            id="business-tagline"
            maxLength={160}
            onChange={(event) => setField('tagline', event.target.value)}
            type="text"
            value={form.tagline}
          />

          <label htmlFor="business-description">{t('business.form.identity.businessDescription')} *</label>
          <textarea
            aria-describedby={fieldErrors.description ? 'business-description-error' : undefined}
            aria-invalid={Boolean(fieldErrors.description)}
            id="business-description"
            maxLength={2000}
            onChange={(event) => setField('description', event.target.value)}
            required
            rows={6}
            value={form.description}
          />
          <FormFieldError id="business-description-error" message={fieldErrors.description} />
        </section>

        <section className="business-form__section" aria-labelledby="business-services-title">
          <header>
            <h2 id="business-services-title">{t('business.form.services.title')}</h2>
            <p>{t('business.form.services.description')}</p>
          </header>

          {taxonomy.hasLegacyValues && (
            <div className="business-taxonomy-legacy" role="status">
              <strong>{t('business.form.services.legacyTitle')}</strong>
              <p>{t('business.form.services.legacyDescription')}</p>
              {taxonomy.unresolvedValues.length > 0 && (
                <p>{t('business.form.services.currentLegacyValues')}: {taxonomy.unresolvedValues.join(', ')}</p>
              )}
              {!taxonomy.editing && (
                <button
                  className="button button--secondary"
                  onClick={() => editTaxonomy(beginCanonicalTaxonomyEdit)}
                  type="button"
                >
                  {t('business.form.services.updateServices')}
                </button>
              )}
            </div>
          )}

          <label htmlFor="business-service-group">{t('business.form.services.serviceGroup')} *</label>
          <SelectField
            ariaLabel={t('business.form.services.serviceGroup')}
            className="select-field--form"
            id="business-service-group"
            onChange={(value) => editTaxonomy((current) => selectTaxonomyGroup(current, value))}
            options={serviceGroupOptions}
            showLeadingIcon={false}
            value={taxonomy.groupId}
            disabled={!taxonomy.editing}
          />

          <label htmlFor="business-main-category">{t('business.form.services.mainService')} *</label>
          <SelectField
            ariaDescribedBy={fieldErrors.primaryCategoryId ? 'business-main-category-error' : undefined}
            ariaInvalid={Boolean(fieldErrors.primaryCategoryId)}
            ariaLabel={t('business.form.services.mainService')}
            className="select-field--form"
            id="business-main-category"
            onChange={(value) => editTaxonomy((current) => selectPrimaryService(current, value))}
            options={mainServiceOptions}
            showLeadingIcon={false}
            value={taxonomy.primaryServiceId}
            disabled={!taxonomy.editing || !taxonomy.groupId}
          />
          <FormFieldError id="business-main-category-error" message={fieldErrors.primaryCategoryId} />

          <CheckboxGroup
            error={fieldErrors.categoryIds}
            id="business-additional-services"
            isOptionDisabled={(serviceId) => !taxonomy.editing || (
              taxonomy.additionalServiceIds.length >= MAX_BUSINESS_SERVICE_SELECTIONS - 1
              && !taxonomy.additionalServiceIds.includes(serviceId)
            )}
            legend={t('business.form.services.additionalServices')}
            name="additionalServiceIds"
            onToggle={(value) => editTaxonomy((current) => toggleAdditionalService(current, value))}
            options={additionalServiceOptions}
            selectedValues={taxonomy.additionalServiceIds}
          />
          <p className="business-taxonomy-limit">
            {t('business.form.services.additionalLimit', {
              count: MAX_BUSINESS_SERVICE_SELECTIONS - 1,
              selected: taxonomy.additionalServiceIds.length,
            })}
          </p>

          {(
            taxonomy.primaryServiceId === 'other-local-service'
            || taxonomy.additionalServiceIds.includes('other-local-service')
          ) && (
            <div className="custom-option-field">
              <label htmlFor="custom-service-description">{t('business.form.services.customDescription')} *</label>
              <input
                aria-describedby={`custom-service-description-help${fieldErrors.customServiceDescription ? ' custom-service-description-error' : ''}`}
                aria-invalid={Boolean(fieldErrors.customServiceDescription)}
                disabled={!taxonomy.editing}
                id="custom-service-description"
                maxLength={MAX_CUSTOM_SERVICE_DESCRIPTION_LENGTH}
                onChange={(event) => editTaxonomy((current) => ({
                  ...current, customServiceDescription: event.target.value,
                }))}
                required
                type="text"
                value={taxonomy.customServiceDescription}
              />
              <small id="custom-service-description-help">
                {t('business.form.services.customDescriptionLimit', { count: MAX_CUSTOM_SERVICE_DESCRIPTION_LENGTH })}
              </small>
              <FormFieldError id="custom-service-description-error" message={fieldErrors.customServiceDescription} />
            </div>
          )}
        </section>

        <section className="business-form__section" aria-labelledby="business-contact-title">
          <header>
            <h2 id="business-contact-title">{t('business.form.contact.title')}</h2>
            <p>{t('business.form.contact.description')}</p>
          </header>

          <div className="business-form__columns">
            <div>
              <label htmlFor="business-phone">{t('business.form.contact.phone')}</label>
              <input
                autoComplete="tel"
                id="business-phone"
                onChange={(event) => setField('phone', event.target.value)}
                type="tel"
                value={form.phone}
              />
              <label className="auth-form__check">
                <input
                  checked={form.phoneVisible}
                  onChange={(event) => setField('phoneVisible', event.target.checked)}
                  type="checkbox"
                />
                <span>{t('business.form.contact.showPhone')}</span>
              </label>
            </div>
            <div>
              <label htmlFor="business-whatsapp">WhatsApp</label>
              <input
                autoComplete="tel"
                id="business-whatsapp"
                onChange={(event) => setField('whatsappNumber', event.target.value)}
                type="tel"
                value={form.whatsappNumber}
              />
              <label className="auth-form__check">
                <input
                  checked={form.whatsappVisible}
                  onChange={(event) => setField('whatsappVisible', event.target.checked)}
                  type="checkbox"
                />
                <span>{t('business.form.contact.showWhatsapp')}</span>
              </label>
            </div>
          </div>

          <label htmlFor="business-email">{t('business.form.contact.email')}</label>
          <input
            autoComplete="email"
            aria-describedby={fieldErrors.email ? 'business-email-error' : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            id="business-email"
            onChange={(event) => setField('email', event.target.value)}
            type="email"
            value={form.email}
          />
          <FormFieldError id="business-email-error" message={fieldErrors.email} />
          <label className="auth-form__check">
            <input
              checked={form.emailVisible}
              onChange={(event) => setField('emailVisible', event.target.checked)}
              type="checkbox"
            />
            <span>{t('business.form.contact.showEmail')}</span>
          </label>

          <label htmlFor="business-website">{t('business.form.contact.website')}</label>
          <input
            autoComplete="url"
            aria-describedby={fieldErrors.website ? 'business-website-error' : undefined}
            aria-invalid={Boolean(fieldErrors.website)}
            id="business-website"
            onChange={(event) => setField('website', event.target.value)}
            placeholder="https://"
            type="url"
            value={form.website}
          />
          <FormFieldError id="business-website-error" message={fieldErrors.website} />
          <label className="auth-form__check">
            <input
              checked={form.websiteVisible}
              onChange={(event) => setField('websiteVisible', event.target.checked)}
              type="checkbox"
            />
            <span>{t('business.form.contact.showWebsite')}</span>
          </label>

          <label htmlFor="preferred-contact-method">{t('business.form.contact.preferred')}</label>
          <SelectField
            ariaLabel={t('business.form.contact.preferred')}
            className="select-field--form"
            id="preferred-contact-method"
            onChange={(value) => setField('preferredContactMethod', value)}
            options={contactMethodOptions}
            value={form.preferredContactMethod}
          />
          <p className="auth-form__hint">{t('business.form.contact.messagingHelp')}</p>

          <label className="auth-form__check">
            <input
              checked={form.allowCallbackRequests}
              onChange={(event) => setField('allowCallbackRequests', event.target.checked)}
              type="checkbox"
            />
            <span>{t('business.form.contact.callback')}</span>
          </label>
        </section>

        <section className="business-form__section" aria-labelledby="business-location-title">
          <header>
            <h2 id="business-location-title">{t('business.form.location.title')}</h2>
            <p>{t('business.form.location.description')}</p>
          </header>

          <section className="business-location-subsection" aria-labelledby="business-base-title">
            <header className="business-location-subsection__heading">
              <div>
                <h3 id="business-base-title">{t('business.form.location.baseTitle')}</h3>
                <p>{t('business.form.location.baseDescription')}</p>
              </div>
            </header>
            <div className="business-form__location-grid" id="business-primary-location" tabIndex={-1}>
              <LocationCombobox
                error={fieldErrors.city}
                inputValue={form.city}
                label={`${t('business.form.location.primaryLocation')} *`}
                onInputChange={(value) => {
                  setForm((current) => ({
                    ...current,
                    ...primaryLocationInputState(value),
                  }))
                  setFieldErrors((current) => ({ ...current, city: '' }))
                }}
                onSelect={(location) => {
                  setForm((current) => ({
                    ...current,
                    ...primaryLocationSelectionState(location),
                  }))
                  setFieldErrors((current) => ({ ...current, city: '' }))
                }}
                selectedLocationId={form.primaryLocationId}
              />
              {form.primaryLocationId ? (
                <p className="business-form__location-context">
                  {locationDisplayLabel(resolveLaunchLocation(form.primaryLocationId))}
                </p>
              ) : form.city ? (
                <p className="business-form__location-unresolved" role="status">
                  {t('business.form.location.unresolvedPrimary')}
                </p>
              ) : null}
            </div>
          </section>

          <ServiceAreaSelector
            error={fieldErrors.serviceAreas}
            onRadiusChange={(value) => setField('serviceRadiusKm', value)}
            onToggle={(value) => {
              setForm((current) => ({
                ...current,
                serviceAreas: toggleServiceAreaSelection(current.serviceAreas, value),
              }))
              setFieldErrors((current) => ({ ...current, serviceAreas: '' }))
            }}
            options={localizedServiceAreaOptions}
            province={form.province}
            radius={form.serviceRadiusKm}
            selectedValues={form.serviceAreas}
          />
        </section>

        <section className="business-form__section" aria-labelledby="business-languages-title">
          <header>
            <h2 id="business-languages-title">{t('business.form.languages.title')}</h2>
            <p>{t('business.form.languages.description')}</p>
          </header>

          <CheckboxGroup
            error={fieldErrors.languages}
            id="business-languages-group"
            legend={`${t('business.form.languages.spoken')} *`}
            name="languages"
            onToggle={(value) => toggleArrayValue('languages', value)}
            options={localizedLanguageOptions}
            selectedValues={form.languages}
          />

          {form.languages.includes('other') && (
            <div className="custom-option-field">
              <label htmlFor="custom-language">{t('business.form.languages.custom')}</label>
              <input
                aria-describedby={fieldErrors.customLanguage ? 'custom-language-error' : undefined}
                aria-invalid={Boolean(fieldErrors.customLanguage)}
                id="custom-language"
                maxLength={100}
                onChange={(event) => handleCustomLanguageChange(event.target.value)}
                required
                type="text"
                value={customLanguage}
              />
              <FormFieldError id="custom-language-error" message={fieldErrors.customLanguage} />
            </div>
          )}

          <label htmlFor="primary-language">{t('business.primaryLanguage')} *</label>
          <SelectField
            ariaLabel={t('business.primaryLanguage')}
            className="select-field--form"
            disabled={normalizeCustomValues(form.languages, customLanguage).length === 0}
            id="primary-language"
            onChange={(value) => setField('primaryLanguage', value)}
            options={normalizeCustomValues(form.languages, customLanguage).map((language) => ({
              label: getLanguageNameFromCode(language),
              value: language,
            }))}
            value={form.primaryLanguage}
          />
        </section>

        <footer className={`business-form__save${isDirty ? ' is-dirty' : ''}`}>
          <div>
            <strong role="status">{submitting ? t('business.saving') : saveSuccess && !isDirty
              ? t('business.form.saveSuccess')
              : isDirty ? t('business.form.unsavedTitle') : t('business.form.savedTitle')}</strong>
            {error && <p role="alert">{error}</p>}
            {isDirty && <p>{t('business.form.unsavedDescription')}</p>}
          </div>
          <button className="button button--primary" disabled={submitting || !isDirty} type="submit">
            {submitting ? t('business.saving') : t('business.save')}
          </button>
        </footer>
      </form>
      <AccessibleDialog
        ariaDescribedBy="unsaved-business-description"
        ariaLabelledBy="unsaved-business-title"
        className="profile-edit-dialog confirmation-dialog"
        onClose={cancelPendingNavigation}
        open={Boolean(pendingNavigation)}
      >
        <section className="profile-edit-dialog__panel">
          <header className="profile-edit-dialog__header">
            <h2 id="unsaved-business-title">{t('business.form.unsavedDialogTitle')}</h2>
            <button aria-label={t('common.close')} onClick={cancelPendingNavigation} type="button">×</button>
          </header>
          <p className="confirmation-dialog__description" id="unsaved-business-description">{t('business.form.unsavedWarning')}</p>
          <div className="confirmation-dialog__actions">
            <button className="button button--primary" onClick={cancelPendingNavigation} type="button">{t('business.form.keepEditing')}</button>
            <button
              aria-busy={historyRestoring || undefined}
              className="button button--secondary"
              disabled={historyRestoring}
              onClick={() => void leaveWithoutSaving()}
              type="button"
            >
              {t('business.form.leave')}
            </button>
          </div>
        </section>
      </AccessibleDialog>
    </section>
  )
}

export default EditBusinessPage
