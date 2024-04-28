import React from 'react'
import { type RenderToPipeableStreamOptions, renderToPipeableStream } from 'react-dom/server'
import App from './App'

export function render(_url: string, _ssrManifest?: string, options?: RenderToPipeableStreamOptions) {
    console.log({ _url, _ssrManifest, options })
  return renderToPipeableStream(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    options
  )
}