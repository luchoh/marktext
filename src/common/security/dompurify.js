const UNTRUSTED_FORBID_ATTR = Object.freeze([
  'style',
  'contenteditable'
])

const UNTRUSTED_FORBID_TAGS = Object.freeze([
  'base',
  'embed',
  'form',
  'frame',
  'frameset',
  'iframe',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'link',
  'meta',
  'object',
  'script',
  'style',
  'template',
  'title'
])

const DIAGRAM_FORBID_TAGS = Object.freeze([
  ...UNTRUSTED_FORBID_TAGS,
  'foreignObject'
])

const HTML_ONLY_PROFILE = Object.freeze({
  html: true,
  svg: false,
  mathMl: false
})

const HTML_AND_SVG_PROFILE = Object.freeze({
  html: true,
  svg: true,
  svgFilters: false,
  mathMl: false
})

export const PREVIEW_DOMPURIFY_CONFIG = Object.freeze({
  FORBID_ATTR: UNTRUSTED_FORBID_ATTR,
  FORBID_TAGS: UNTRUSTED_FORBID_TAGS,
  ALLOW_DATA_ATTR: false,
  USE_PROFILES: HTML_ONLY_PROFILE,
  RETURN_TRUSTED_TYPE: false
})

export const PASTE_DOMPURIFY_CONFIG = Object.freeze({
  FORBID_ATTR: UNTRUSTED_FORBID_ATTR,
  FORBID_TAGS: UNTRUSTED_FORBID_TAGS,
  ALLOW_DATA_ATTR: false,
  USE_PROFILES: HTML_ONLY_PROFILE,
  RETURN_TRUSTED_TYPE: false
})

export const DIAGRAM_DOMPURIFY_CONFIG = Object.freeze({
  FORBID_ATTR: UNTRUSTED_FORBID_ATTR,
  FORBID_TAGS: DIAGRAM_FORBID_TAGS,
  ALLOW_DATA_ATTR: false,
  USE_PROFILES: HTML_AND_SVG_PROFILE,
  RETURN_TRUSTED_TYPE: false
})

export const EXPORT_DOMPURIFY_CONFIG = Object.freeze({
  FORBID_ATTR: ['contenteditable'],
  FORBID_TAGS: DIAGRAM_FORBID_TAGS,
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['data-align'],
  USE_PROFILES: HTML_AND_SVG_PROFILE,
  RETURN_TRUSTED_TYPE: false,
  // Allow "file" protocol to export images on Windows (#1997).
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i // eslint-disable-line no-useless-escape
})
