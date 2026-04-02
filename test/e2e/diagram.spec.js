const { expect, test } = require('@playwright/test')
const { closeElectron, launchElectron } = require('./helpers')

test.describe('Diagram Rendering', () => {
  test('Render PlantUML preview through the preload bridge', async () => {
    test.setTimeout(120000)
    const { app, page } = await launchElectron(['test/e2e/data/plantuml.md'])

    try {
      await page.waitForSelector('#ag-editor-id', { state: 'attached', timeout: 15000 })
      await page.waitForTimeout(2000)

      const audit = await page.evaluate(() => {
        const preview = document.querySelector('.ag-container-preview')
        const img = preview && preview.querySelector('img')
        return {
          title: document.title,
          hasPreview: !!preview,
          previewText: preview ? preview.textContent.trim() : '',
          imgSrc: img ? img.getAttribute('src') : '',
          previewHtml: preview ? preview.innerHTML : ''
        }
      })

      expect(audit.hasPreview, JSON.stringify(audit)).toBeTruthy()
      expect(audit.title, JSON.stringify(audit)).toContain('plantuml.md')
      expect(audit.imgSrc, JSON.stringify(audit)).toMatch(/^https:\/\/www\.plantuml\.com\/plantuml\/svg\/~1/)
      expect(audit.previewText, JSON.stringify(audit)).not.toContain('Invalid PlantUML Codes')
      expect(audit.previewHtml, JSON.stringify(audit)).toContain('<img')
    } finally {
      await closeElectron(app)
    }
  })
})
