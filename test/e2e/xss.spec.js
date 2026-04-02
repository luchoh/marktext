const { expect, test } = require('@playwright/test')
const { closeElectron, launchElectron } = require('./helpers')

const waitForEditorPreview = async page => {
  await page.waitForSelector('#ag-editor-id', { state: 'attached', timeout: 15000 })
  await page.waitForTimeout(1500)
}

const getPreviewAudit = async page => {
  return page.evaluate(() => {
    const editor = document.querySelector('#ag-editor-id') || document.body
    const previews = Array.from(editor.querySelectorAll('.ag-html-preview, .ag-container-preview'))
    const dangerousSelector = [
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
      'template',
      '[onload]',
      '[onclick]',
      '[onerror]',
      '[onmouseover]',
      '[onfocus]',
      '[onmouseenter]',
      '[onpointerenter]',
      '[onanimationstart]'
    ].join(',')

    const dangerousNodeCount = previews.reduce((count, node) => {
      return count + node.querySelectorAll(dangerousSelector).length
    }, 0)

    const dangerousUriCount = previews.reduce((count, node) => {
      const elements = Array.from(node.querySelectorAll('[href], [src], [xlink\\:href]'))
      const suspicious = elements.filter(element => {
        return ['href', 'src', 'xlink:href'].some(attribute => {
          const value = element.getAttribute(attribute)
          return value && /^(?:javascript:|data:text\/html)/i.test(value)
        })
      })
      return count + suspicious.length
    }, 0)

    return {
      hasEditor: !!document.querySelector('#ag-editor-id'),
      previewCount: previews.length,
      dangerousNodeCount,
      dangerousUriCount,
      svgCount: editor.querySelectorAll('.ag-container-preview svg').length,
      title: document.title,
      bodySnippet: document.body.innerHTML.slice(0, 400)
    }
  })
}

const expectNoCrash = async app => {
  const { isVisible, isCrashed } = await app.evaluate(async process => {
    const mainWindow = process.BrowserWindow.getAllWindows()[0]
    return {
      isVisible: mainWindow.isVisible(),
      isCrashed: mainWindow.webContents.isCrashed()
    }
  })

  expect(isVisible).toBeTruthy()
  expect(isCrashed).toBeFalsy()
}

const runFixtureAudit = async fixturePath => {
  const { app, page } = await launchElectron([fixturePath])

  try {
    await waitForEditorPreview(page)
    await expectNoCrash(app)
    return await getPreviewAudit(page)
  } finally {
    await closeElectron(app)
  }
}

test.describe('Test XSS Vulnerabilities', async () => {
  test('Load malicious raw HTML document without leaving active preview content', async () => {
    test.setTimeout(120000)
    const audit = await runFixtureAudit('test/e2e/data/xss.md')

    expect(audit.dangerousNodeCount, JSON.stringify(audit)).toBe(0)
    expect(audit.dangerousUriCount, JSON.stringify(audit)).toBe(0)
  })

  test('Load malicious diagram document without leaving active preview content', async () => {
    test.setTimeout(120000)
    const audit = await runFixtureAudit('test/e2e/data/xss-diagrams.md')

    expect(audit.previewCount, JSON.stringify(audit)).toBeGreaterThan(0)
    expect(audit.svgCount, JSON.stringify(audit)).toBeGreaterThan(0)
    expect(audit.dangerousNodeCount, JSON.stringify(audit)).toBe(0)
    expect(audit.dangerousUriCount, JSON.stringify(audit)).toBe(0)
  })
})
