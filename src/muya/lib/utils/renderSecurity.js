import runSanitize from './dompurify'
import { DIAGRAM_DOMPURIFY_CONFIG } from '../config'

export const sanitizeRenderedDiagramHtml = html => {
  return runSanitize(html, DIAGRAM_DOMPURIFY_CONFIG)
}

export const sanitizeRenderedDiagramElement = element => {
  const sanitized = sanitizeRenderedDiagramHtml(element.innerHTML)
  element.innerHTML = sanitized
  return sanitized
}
