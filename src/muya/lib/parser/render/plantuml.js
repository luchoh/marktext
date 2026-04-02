import { toHTML, h } from './snabbdom'

export default class Diagram {
  svgUrl = ''

  /**
   * Builds a Diagram object storing the encoded input value
   */
  static parse (input) {
    if (!window.mt || !window.mt.diagram || typeof window.mt.diagram.createPlantUmlSvgUrl !== 'function') {
      throw new Error('PlantUML bridge is unavailable in this renderer context.')
    }
    const diagram = new Diagram()
    diagram.svgUrl = window.mt.diagram.createPlantUmlSvgUrl(input)
    return diagram
  }

  insertImgElement (container) {
    const div = typeof container === 'string'
      ? document.getElementById(container)
      : container
    if (div === null || !div.tagName) {
      throw new Error('Invalid container: ' + container)
    }
    const node = h('img', { attrs: { src: this.svgUrl } })
    div.innerHTML = toHTML(node)
  }
}
