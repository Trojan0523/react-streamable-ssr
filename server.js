/*
 * @Author: BuXiongYu
 * @Date: 2024-04-28 10:14:54
 * @LastEditors: BuXiongYu
 * @LastEditTime: 2024-04-28 15:28:07
 * @Description: ssr entry
 */
import fs from 'node:fs/promises'
import express from 'express'
import { Transform } from 'node:stream'
import { createServer as createViteServer } from 'vite'


const app = express()

const isProduction = process.env.NODE_ENV === 'production'

// Cached production assets
const templateHtml = isProduction
  ? await fs.readFile('./dist/client/index.html', 'utf-8')
  : ''
const ssrManifest = isProduction
  ? await fs.readFile('./dist/client/.vite/ssr-manifest.json', 'utf-8')
  : undefined

let vite

if (!isProduction) {
    vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'custom',
        base: '/'
    })
    app.use(vite.middlewares)
} else {
    const compression = (await import('compression')).default
    const sirv = (await import('sirv')).default
    app.use(compression())
    app.use('/', sirv('./dist/client', { extensions: [] }))
}


app.use('*', async (req, res, next) => {
        // server index.html. also handle some static assets
        const url = req.originalUrl

        try {
            let template
            let render
            if (!isProduction) {
                // Always read fresh template in development
                template = await fs.readFile('./index.html', 'utf-8')
                template = await vite.transformIndexHtml(url, template)
                // TODO: 机器分离，远端请求模块也是可以的。用 ViteRuntime 创建运行环境
                render = (await vite.ssrLoadModule('/src/entry.server.tsx')).render
            } else {
                template = templateHtml
                render = (await import('./dist/server/entry.server.js')).render
            }
            let didError = false
            // TODO, 假设这里用的 api不是 react renderToPipeableStreamOptions ，直接 return string, 那就简单多了
            const { pipe, abort } = render(url, ssrManifest, {
                onShellError() {
                  res.status(500)
                  res.set({ 'Content-Type': 'text/html' })
                  res.send('<h1>Something went wrong</h1>')
                },
                onShellReady() {
                  res.status(didError ? 500 : 200)
                  res.set({ 'Content-Type': 'text/html' })
          
                  const transformStream = new Transform({
                    transform(chunk, encoding, callback) {
                      res.write(chunk, encoding)
                      callback()
                    }
                  })
          
                  const [htmlStart, htmlEnd] = template.split(`<!--ssr-outlet-->`)
          
                  res.write(htmlStart)
          
                  transformStream.on('finish', () => {
                    res.end(htmlEnd)
                  })
          
                  pipe(transformStream)
                },
                onError(error) {
                  didError = true
                  console.error(error)
                }
              })

            setTimeout(() => {
                abort()
            }, 10000)
        } catch (e) {
            vite?.ssrFixStacktrace(e)
            console.log(e.stack)
            res.status(500).end(e.stack)
            next(e)
        }
        
})

app.listen(5174, () => {
    console.log(`Server started at http://localhost:5174`)
})