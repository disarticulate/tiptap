import { Node, Plugin } from 'tiptap'
const base64js = require('base64-js')

function Base64Encode(str, encoding = 'utf-8') {
    var bytes = new (typeof TextEncoder === "undefined" ? TextEncoderLite : TextEncoder)(encoding).encode(str);        
    return base64js.fromByteArray(bytes);
}

function Base64Decode(str, encoding = 'utf-8') {
    var bytes = base64js.toByteArray(str);
    return new (typeof TextDecoder === "undefined" ? TextDecoderLite : TextDecoder)(encoding).decode(bytes);
}

function imagePlaceholder (text, width, height) {
  let placeholder = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" version="1.1">
      <rect width="${width}" height="${height}" stroke="black" stroke-width="6" fill="#cccc"/>
      <text x="${width / 2}" y="${height / 2}">
        ${text}
      </text>
    </svg>
  `
  placeholder = Base64Encode(placeholder)
  return `data:image/svg+xml;charset=utf-8;base64,${placeholder}`
}

export default class ImageOffline extends Node {

  constructor (offlineStore) {
    super() // call the super class constructor and pass in the name parameter
    this.setOfflineStore(offlineStore)
  }

  offlineStore (store) {
    if (!(store.clear instanceof Function)) throw Error('OfflineStoreIncompatible:clear')
    if (!(store.getItem instanceof Function)) throw Error('OfflineStoreIncompatible:getItem')
    if (!(store.setItem instanceof Function)) throw Error('OfflineStoreIncompatible:setItem')
    if (!(store.deleteItem instanceof Function)) throw Error('OfflineStoreIncompatible:deleteItem')
    this.store = store
  }

  get name() {
    return 'imageOffline'
  }

  get schema() {
    let self = this
    return {
      inline: true,
      attrs: {
        src: {},
        'data-sha512': {
          default: null
        },
        alt: {
          default: null,
        },
        title: {
          default: null,
        },
      },
      group: 'inline',
      draggable: true,
      parseDOM: [
        {
          tag: 'img[data-sha512]',
          getAttrs: dom => ({
            src: imagePlaceholder('text', 100, 100), // dom.getAttribute('src'),
            'data-sha512': dom.getAttribute('data-sha512'),
            title: dom.getAttribute('title'),
            alt: dom.getAttribute('alt'),
          }),
        },
      ],
      toDOM (node) {
        let img = document.createElement('img')
        let attrs = Object.keys(node.attrs)
        for (const a of attrs) {
          img.setAttribute(a, node.attrs[a])
        }
        img.onload = (e) => {
          console.log(this, e, self)
        }
        return img
      },
    }
  }

  commands({ type }) {
    return attrs => (state, dispatch) => {
      const { selection } = state
      const position = selection.$cursor ? selection.$cursor.pos : selection.$to.pos
      const node = type.create(attrs)
      const transaction = state.tr.insert(position, node)
      dispatch(transaction)
    }
  }

  get plugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            drop(view, event) {
              const hasFiles = event.dataTransfer
              && event.dataTransfer.files
              && event.dataTransfer.files.length

              if (!hasFiles) {
                return
              }

              const images = Array
                .from(event.dataTransfer.files)
                .filter(file => (/image/i).test(file.type))

              if (images.length === 0) {
                return
              }

              event.preventDefault()

              const { schema } = view.state
              const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })

              images.forEach(image => {
                const reader = new FileReader()

                reader.onload = readerEvent => {
                  const node = schema.nodes.image.create({
                    src: readerEvent.target.result,
                  })
                  const transaction = view.state.tr.insert(coordinates.pos, node)
                  view.dispatch(transaction)
                }
                reader.readAsDataURL(image)
              })
            },
          },
        },
      }),
    ]
  }

}
