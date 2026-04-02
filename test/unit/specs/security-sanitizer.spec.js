import ContentState from '../../../src/muya/lib/contentState'
import EventCenter from '../../../src/muya/lib/eventHandler/event'
import { getSanitizeHtml } from '../../../src/muya/lib/utils/exportHtml'
import { sanitize } from '../../../src/muya/lib/utils'
import { MUYA_DEFAULT_OPTION, PREVIEW_DOMPURIFY_CONFIG, PASTE_DOMPURIFY_CONFIG, EXPORT_DOMPURIFY_CONFIG } from '../../../src/muya/lib/config'
import { sanitizeRenderedDiagramElement, sanitizeRenderedDiagramHtml } from '../../../src/muya/lib/utils/renderSecurity'

const createMuyaContext = options => {
  const ctx = {}
  ctx.options = Object.assign({}, MUYA_DEFAULT_OPTION, options)
  ctx.eventCenter = new EventCenter()
  ctx.contentState = new ContentState(ctx, ctx.options)
  return ctx
}

const expectNoActiveContent = output => {
  expect(output).to.not.include('<script')
  expect(output).to.not.include('<iframe')
  expect(output).to.not.include('<foreignObject')
  expect(output).to.not.match(/\son\w+=/i)
  expect(output).to.not.include('javascript:')
}

describe('Security sanitizer regression suite', () => {
  it('sanitizes raw HTML preview payloads', () => {
    const payload = `
<div contenteditable="true" style="color:red">
  <img src="x" onerror="window.__marktextXss = 1">
  <iframe src="javascript:window.__marktextXss = 1"></iframe>
  <svg><script>window.__marktextXss = 1</script></svg>
</div>`

    const sanitized = sanitize(payload, PREVIEW_DOMPURIFY_CONFIG, false)

    expectNoActiveContent(sanitized)
    expect(sanitized).to.not.include('contenteditable')
    expect(sanitized).to.not.include('style=')
    expect(sanitized).to.include('<img')
  })

  it('sanitizes pasted HTML payloads before standardization', async () => {
    const ctx = createMuyaContext()
    const payload = `
<table>
  <tr><td><p style="color:red" onclick="window.__marktextXss = 1">cell<br></p></td></tr>
</table>
<img src="x" onerror="window.__marktextXss = 1">
<script>window.__marktextXss = 1</script>`

    const standardized = await ctx.contentState.standardizeHTML(payload)

    expectNoActiveContent(standardized)
    expect(standardized).to.include('<span>cell')
    expect(standardized).to.not.include('<p')
    expect(standardized).to.not.include('style=')
  })

  it('sanitizes rendered diagram output as untrusted SVG/HTML', () => {
    const payload = `
<svg onload="window.__marktextXss = 1">
  <script>window.__marktextXss = 1</script>
  <foreignObject><div onclick="window.__marktextXss = 1">owned</div></foreignObject>
  <g><circle cx="1" cy="1" r="1"></circle></g>
</svg>`

    const sanitized = sanitizeRenderedDiagramHtml(payload)

    expectNoActiveContent(sanitized)
    expect(sanitized).to.include('<svg')
    expect(sanitized).to.include('<circle')
  })

  it('keeps export file URIs while stripping active content', () => {
    const payload = '![safe](file:///tmp/marktext-safe.png)\n\n<script>window.__marktextXss = 1</script>\n<img src="x" onerror="window.__marktextXss = 1">'

    const sanitized = getSanitizeHtml(payload, {})

    expectNoActiveContent(sanitized)
    expect(sanitized).to.include('file:///tmp/marktext-safe.png')
  })

  it('ignores prototype-polluted sanitizer options', () => {
    const pollutedOptions = Object.assign(Object.create({
      ADD_TAGS: ['script']
    }), PASTE_DOMPURIFY_CONFIG)
    const sanitized = sanitize('<script>window.__marktextXss = 1</script>', pollutedOptions, false)
    expect(sanitized).to.not.include('<script')
  })

  it('sanitizes export rendering after attacker-controlled diagram generation', () => {
    const container = document.createElement('div')
    const diagram = document.createElement('div')
    diagram.className = 'mermaid'
    diagram.innerHTML = '<svg onload="window.__marktextXss = 1"><script>window.__marktextXss = 1</script><rect width="10" height="10"></rect></svg>'
    container.appendChild(diagram)

    container.querySelectorAll('div.mermaid').forEach(node => {
      const sanitized = sanitize(node.innerHTML, EXPORT_DOMPURIFY_CONFIG, false)
      node.innerHTML = sanitized
      sanitizeRenderedDiagramElement(node)
    })

    expectNoActiveContent(container.innerHTML)
    expect(container.innerHTML).to.include('<svg')
    expect(container.innerHTML).to.include('<rect')
  })
})
