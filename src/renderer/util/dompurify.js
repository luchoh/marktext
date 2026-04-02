import runSanitize from 'muya/lib/utils/dompurify'
export {
  PREVIEW_DOMPURIFY_CONFIG,
  DIAGRAM_DOMPURIFY_CONFIG,
  EXPORT_DOMPURIFY_CONFIG
} from 'common/security/dompurify'

export const sanitize = (html, purifyOptions) => {
  return runSanitize(html, purifyOptions)
}
