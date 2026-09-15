import { englishAuthenticatedResidual } from '../../englishAuthenticatedResidual.js'
const categoryKeys = [
  'cleaning', 'plumbing', 'electrical', 'gardening', 'paintingDecorating',
  'buildingRenovation', 'handyman', 'airConditioning', 'locksmith', 'pestControl',
  'poolMaintenance', 'petServices',
]

function categories(labels) {
  return Object.fromEntries(categoryKeys.map((key, index) => [key, labels[index]]))
}

function createPack(d) {
  const help = d.help
  const retryError = d.retryError
  return {
    common: {
      save: d.save, cancel: d.cancel, retry: d.retry, requestFailed: retryError,
      skipToContent: d.skip, notSet: d.notSet, done: d.done, optional: d.optional,
      delete: d.delete, uploading: d.uploading, close: d.close, other: d.other,
      change: d.editProfile, changeImage: d.changeImage, loadingAccount: d.loading,
    },
    mediaFeedback: { immediate: d.mediaImmediate, saved: d.saved },
    language: { saveError: retryError },
    profile: {
      title: d.profile, edit: d.editProfile, businessTools: d.businessTools,
      businessDashboard: d.myBusiness, editBusiness: d.editBusiness, yourAccount: d.account,
      changeImage: d.changeImage, imageUpdated: d.saved, imageUploadError: retryError,
      updateSuccess: d.saved, complete: d.complete, incomplete: d.incomplete,
      personalDetails: d.personalDetails, name: d.name, accountDetails: d.accountDetails,
      accountUse: d.accountUse, profileStatus: d.profileStatus, preferences: d.preferences,
      languageLocation: d.languageLocation, preferredLanguage: d.preferredLanguage,
      city: d.city, country: d.country, businessAccess: d.businessAccess,
      businessBothDescription: help, businessDescription: help,
      businessProfileStatus: d.businessProfileStatus, forProfessionals: d.forProfessionals,
      becomeBusiness: d.becomeBusiness, becomeBusinessDescription: help,
      businessAssurance: d.businessAssurance, preparingBusiness: d.preparing,
      startBusiness: d.startBusiness, closeEditor: d.close, firstName: d.firstName,
      lastName: d.lastName,
      accountTypes: { customer: d.customer, business: d.business, both: d.both },
      completion: { eyebrow: d.finalStep, title: d.completeProfile, description: help },
    },
    business: {
      edit: d.editBusiness, subscription: d.subscription, save: d.saveProfile,
      saving: d.saving, primaryLanguage: d.primaryLanguage,
      categories: categories(d.categories),
      control: {
        ...(d.statusExplanation ? { statusExplanation: d.statusExplanation } : {}),
        status: {
          draft: d.statuses[0], pending_review: d.statuses[1], rejected: d.rejectedStatus,
          active: d.statuses[2], suspended: d.statuses[3], archived: d.statuses[4],
          deleted: d.statuses[5],
        },
      },
      form: {
        eyebrow: d.businessProfile, editTitle: d.editBusiness, setupTitle: d.setupBusiness,
        description: help, selectCategory: d.selectCategory, selectProvince: d.selectProvince,
        mediaSavedImmediately: d.mediaImmediate, unsavedWarning: d.unsavedWarning,
        unsavedDialogTitle: d.leaveTitle, keepEditing: d.keepEditing, leave: d.leave,
        unsavedTitle: d.unsaved, unsavedDescription: d.unsavedHelp,
        savedTitle: d.saved, savedDescription: help,
        saveSuccess: d.saved,
        media: {
          eyebrow: d.publicMedia, title: d.logoImages, description: d.imageHelp,
          changeLogo: d.changeLogo, uploadLogo: d.uploadLogo, logoAlt: '{{name}}',
          logoTitle: d.logo, logoDescription: help, logoHelp: d.imageHelp,
          galleryTitle: d.gallery, galleryDescription: help, uploading: d.uploading,
          addImages: d.addImages, workImageAlt: d.workImage, deleting: d.deleting,
          emptyTitle: d.noImages, emptyDescription: help, saveFirst: d.saveFirst,
        },
        identity: { title: d.identity, description: help, name: d.businessName, tagline: d.tagline, businessDescription: d.description },
        services: { title: d.services, description: help, mainCategory: d.mainCategory, subcategories: d.subcategories, customSubcategory: d.customValue },
        contact: {
          title: d.contact, description: help, phone: d.phone, showPhone: d.showPhone,
          showWhatsapp: d.showWhatsapp, email: d.businessEmail, emailLabel: d.email,
          showEmail: d.showEmail, website: d.website, showWebsite: d.showWebsite,
          preferred: d.preferredContact,
          holalocal: 'HolaLocal', messagingHelp: d.messagingHelp, callback: d.callback,
        },
        location: {
          title: d.locationCoverage, description: help, province: d.province,
          countryCode: d.country, country: d.country, serviceAreas: d.serviceAreas,
          customArea: d.customArea, radius: d.radius,
        },
        languages: { title: d.languages, description: help, spoken: d.spokenLanguages, custom: d.customLanguage },
        errors: {
          logoUpload: retryError, galleryLimit: d.galleryLimit,
          galleryRemaining_one: d.oneImage, galleryRemaining_other: d.manyImages,
          galleryUpload: retryError, galleryDelete: retryError,
        },
      },
    },
    subscription: {
      loading: d.loading, eyebrow: d.businessAccount, description: help,
      currentPlan: d.currentPlan,
      plans: {
        free: d.free,
        early_access: 'Early Access',
        starter: 'Starter',
        growth: 'Growth',
        pro: 'Pro',
      },
      summary: d.planSummary,
      features: { manage: d.manageBusiness, marketplace: d.marketplace, future: d.futurePlans },
      comingSoon: d.comingSoon, emptyTitle: d.setupFirst, emptyDescription: help,
    },
    validation: {
      email: d.validEmail, passwordRequired: d.required, passwordLength: d.passwordLength,
      firstName: d.required, lastName: d.required, language: d.chooseLanguage,
      city: d.required, businessName: d.required, businessDescription: d.required,
      category: d.selectCategory, customSubcategory: d.customValue,
      customServiceArea: d.customValue, customLanguage: d.customValue,
      languages: d.chooseLanguage, website: d.validWebsite,
    },
    locations: {
      groups: { malaga: d.malagaGroup, cadiz: d.cadizGroup, gibraltar: 'Gibraltar', other: d.other },
      provinces: { malaga: d.malagaProvince, cadiz: d.cadizProvince, gibraltar: 'Gibraltar', other: d.other },
      countries: { ES: d.spain, GI: 'Gibraltar' },
    },
  }
}


export const englishDictionary = { profile:'My profile',editProfile:englishAuthenticatedResidual.common.change,businessTools:'Business tools',myBusiness:'My business',editBusiness:'Edit business',account:'Your account',changeImage:englishAuthenticatedResidual.common.changeImage,saved:'Saved successfully.',complete:'Complete',incomplete:'Incomplete',personalDetails:'Personal details',name:'Name',accountDetails:'Account details',accountUse:'Account type',profileStatus:'Profile status',preferences:'Preferences',languageLocation:'Language and location',preferredLanguage:'Preferred language',city:'City',country:'Country',businessAccess:'Business access',businessProfileStatus:'Business profile status',forProfessionals:'For professionals',becomeBusiness:'Become a business',businessAssurance:'You can also continue as a customer.',preparing:'Preparing…',startBusiness:'Set up your business',firstName:'First name',lastName:'Last name',customer:'Customer',business:'Business',both:'Customer and business',finalStep:'Final step',completeProfile:'Complete your profile',help:'Complete this information carefully.',retryError:englishAuthenticatedResidual.language.saveError,save:'Save',cancel:'Cancel',retry:'Retry',skip:'Skip to main content',notSet:'Not set',done:'Done',optional:'optional',delete:'Delete',uploading:'Uploading…',close:'Close',other:'Other',subscription:'Subscription',saveProfile:'Save business profile',saving:'Saving…',primaryLanguage:'Primary language',businessProfile:'Business profile',setupBusiness:'Set up your business',selectCategory:'Select a category',selectProvince:'Select a province',mediaImmediate:'Media changes save immediately. Other changes use Save.',unsavedWarning:'You have unsaved changes. Leave without saving?',leaveTitle:'Leave without saving?',keepEditing:'Keep editing',leave:'Leave without saving',unsaved:'Unsaved changes',unsavedHelp:'Save before leaving this page.',publicMedia:'Public media',logoImages:'Logo and work images',imageHelp:'JPG, PNG or WebP, maximum 5 MB.',changeLogo:'Change logo',uploadLogo:'Upload logo',logo:'Business logo',gallery:'Work gallery',addImages:'Add images',workImage:'Work example',deleting:'Deleting…',noImages:'No work images yet.',saveFirst:'Save the profile before adding media.',identity:'Business identity',businessName:'Business name',tagline:'Tagline',description:'Description',services:'Services',mainCategory:'Main category',subcategories:'Subcategories',customValue:'Enter the custom value.',contact:'Contact details',phone:'Phone',showPhone:'Show phone number on my public profile',showWhatsapp:'Show WhatsApp on my public profile',businessEmail:'Business email',email:'Email',showEmail:'Show email on my public profile',website:'Website',showWebsite:'Show website on my public profile',preferredContact:'Preferred contact method',messagingHelp:'HolaLocal messaging is always available.',callback:'Allow callback requests',locationCoverage:'Location and coverage',province:'Province',serviceAreas:'Service areas',customArea:'Add another area',radius:'Service radius (km)',languages:'Languages',spokenLanguages:'Languages spoken',customLanguage:'Add another language',galleryLimit:'Maximum 8 images.',oneImage:'Only {{count}} more image can be added.',manyImages:'Only {{count}} more images can be added.',loading:englishAuthenticatedResidual.common.loadingAccount,businessAccount:'Business account',currentPlan:'Current plan',free:'Free',planSummary:'Your current plan is {{plan}}. Paid upgrades are not available yet.',manageBusiness:'Manage business information',marketplace:'Marketplace listing when eligible',futurePlans:'Future plan options',comingSoon:'Coming soon',setupFirst:'Set up your business first',validEmail:'Enter a valid email address.',required:'This field is required.',passwordLength:'Use at least eight characters.',chooseLanguage:'Choose at least one language.',validWebsite:'Enter a valid website including https://.',malagaGroup:'Málaga province / Costa del Sol',cadizGroup:'Cádiz province / Campo de Gibraltar',malagaProvince:'Málaga province',cadizProvince:'Cádiz province',spain:'Spain',statuses:['Draft','Pending review','Active','Suspended','Archived','Deleted'],categories:['Cleaning','Plumbing','Electrical','Gardening','Painting and decorating','Building and renovation','Handyman','Air conditioning','Locksmith','Pest control','Pool maintenance','Pet services'] }

export function createAuthenticatedPack(locale, dictionary, resources, publicDetail) {
  const { locationUiTranslations, locationSelectionTranslations, blockedAccountTranslations, profileUnavailableDescriptions, mediaErrorTranslations, workflowErrorTranslations, workflowActionTranslations, saveErrorTranslations, ownershipConflictTranslations, homepageHeroTranslations, countNeutralSelectedAreaTranslations, sharedResidualTranslations, fullerLocaleResidualTranslations, rejectedStatusTranslations, subscriptionAccessStatusTranslations } = resources
      const pack = createPack({
        ...englishDictionary,
        ...dictionary,
        rejectedStatus: rejectedStatusTranslations[locale],
      })
      if (locale === 'en') {
        Object.assign(pack.common, englishAuthenticatedResidual.common)
        Object.assign(pack.language, englishAuthenticatedResidual.language)
      }
      const { saveSuccess, ...locationTranslations } = locationUiTranslations[locale]
      pack.business.form.location = {
        ...pack.business.form.location,
        ...locationTranslations,
        ...locationSelectionTranslations[locale],
      }
      if (countNeutralSelectedAreaTranslations[locale]) {
        pack.business.form.location.totalSelected = countNeutralSelectedAreaTranslations[locale]
      }
      if (sharedResidualTranslations[locale]) {
        pack.business.form.media.logoAlt = sharedResidualTranslations[locale].logoAlt
        pack.business.form.contact.holalocal = sharedResidualTranslations[locale].holalocal
      }
      if (fullerLocaleResidualTranslations[locale]) {
        const residual = fullerLocaleResidualTranslations[locale]
        Object.assign(pack.business.form.media, residual.media)
        pack.business.form.mediaSavedImmediately = residual.mediaSavedImmediately
        pack.business.form.unsavedDescription = residual.unsavedDescription
        pack.business.form.contact.messagingHelp = residual.messagingHelp
        pack.business.form.errors.galleryLimit = residual.galleryLimit
        Object.assign(pack.subscription.features, residual.subscriptionFeatures)
      }
      pack.subscription.status = subscriptionAccessStatusTranslations[locale]
      pack.business.form.saveSuccess = saveSuccess
      pack.business.compatibility = {
        ownershipConflict: ownershipConflictTranslations[locale],
      }
      pack.marketing = {
        hero: homepageHeroTranslations[locale],
      }
      pack.publicBusinessDetail = publicDetail
      const blocked = blockedAccountTranslations[locale]
      pack.account = {
        blocked: {
          title: blocked.title,
          status: {
            suspended: blocked.suspended,
            deletion_pending: blocked.deletion_pending,
            deleted: blocked.deleted,
            unavailable: blocked.unavailable,
          },
          help: blocked.help,
        },
        profileUnavailable: {
          description: profileUnavailableDescriptions[locale],
        },
      }
      pack.media = {
        errors: mediaErrorTranslations[locale],
      }
      pack.workflow = {
        actions: workflowActionTranslations[locale],
        errors: workflowErrorTranslations[locale],
      }
      const saveErrors = saveErrorTranslations[locale]
      pack.profile.errors = {
        savePermissionDenied: saveErrors.profilePermission,
        saveNetworkUnavailable: saveErrors.profileNetwork,
        saveFailed: saveErrors.profileFailed,
      }
      Object.assign(pack.business.form.errors, {
        savePermissionDenied: saveErrors.businessPermission,
        saveNetworkUnavailable: saveErrors.businessNetwork,
        saveFailed: saveErrors.businessFailed,
        savedRefreshFailed: saveErrors.businessRefresh,
      })
      return pack
}
