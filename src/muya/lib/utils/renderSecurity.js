import runSanitize from './dompurify'
import { DIAGRAM_DOMPURIFY_CONFIG } from '../config'

const BLOCKED_DIAGRAM_SELECTOR = [
  'script',
  'iframe',
  'object',
  'embed',
  'foreignObject',
  'frame',
  'frameset',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'link',
  'meta',
  'template'
].join(',')

const DANGEROUS_URI_REGEXP = /^(?:javascript:|data:text\/html)/i

export const sanitizeRenderedDiagramHtml = html => {
  return runSanitize(html, DIAGRAM_DOMPURIFY_CONFIG)
}

const scrubRenderedDiagramDom = element => {
  element.querySelectorAll(BLOCKED_DIAGRAM_SELECTOR).forEach(node => node.remove())
  element.querySelectorAll('*').forEach(node => {
    Array.from(node.attributes).forEach(attribute => {
      const { name, value } = attribute
      if (/^on/i.test(name)) {
        node.removeAttribute(name)
        return
      }
      if (['href', 'src', 'xlink:href'].includes(name) && DANGEROUS_URI_REGEXP.test(value)) {
        node.removeAttribute(name)
      }
    })
  })
}

export const sanitizeRenderedDiagramElement = element => {
  const sanitized = sanitizeRenderedDiagramHtml(element.innerHTML)
  element.innerHTML = sanitized
  scrubRenderedDiagramDom(element)
  return sanitized
}
