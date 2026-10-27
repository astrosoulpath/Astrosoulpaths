import { HOROSCOPE_LOCALES } from '../subscription/horoscope-localization';
export const SMART_CATEGORIES = [
  {id:'love', label:'Love & Relationships', planet:'Venus'},
  {id:'career', label:'Career & Success', planet:'Saturn'},
  {id:'prosperity', label:'Prosperity & Financial Reflection', planet:'Jupiter'},
  {id:'marriage', label:'Marriage & Partnership', planet:'Venus'},
  {id:'yoga', label:'Traditional Planetary Alignments', planet:null},
  {id:'education', label:'Education & Learning', planet:'Mercury'},
  {id:'growth', label:'Personal Growth & Spirituality', planet:'Moon'},
  {id:'daily', label:'Daily, Weekly & Monthly Astrology', planet:null},
  {id:'family', label:'Family & Social Connections', planet:'Moon'},
  {id:'cosmic', label:'Verified Cosmic Events', planet:null},
] as const;
export type SmartCategory = typeof SMART_CATEGORIES[number]['id'];
export function notificationCatalog() {
  return {success:true, data:{version:'smart-catalog-v2',
    automaticDeliveryEnabled:false, policyStatus:'APPROVAL_REQUIRED',
    existingHoroscopeLocales:HOROSCOPE_LOCALES,smartPreviewLocales:HOROSCOPE_LOCALES,
    categories:SMART_CATEGORIES.map(category=>({...category,
      automaticStatus:category.planet || category.id==='yoga' ? 'CALCULATION_PREVIEW_ONLY':'EXISTING_DAILY_OR_EVENT_VALIDATION_REQUIRED',
      template:`Explore ${category.label.toLowerCase()}.`,
      provenance:'ADMIN_EDITORIAL', personalized:false,
    })),
    supportedYogas:['Budha-Aditya Yoga','Chandra-Mangala Yoga','Gajakesari Yoga'],
    unsupportedYogas:['Mahalakshmi Yoga','Raj Yoga','Dhana Yoga'],
    missingCapabilities:['approved category entitlement/consent/retention policy','separately approved additive schema rollout','qualified linguistic review for all localized templates','verified cosmic-event and additional yoga rules','real Android/iOS delivery and Admin browser verification','engagement analytics privacy approval'],
  }};
}
