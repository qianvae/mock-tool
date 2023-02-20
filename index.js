/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs')
const path = require('path')

const DEFAULT_METHOD = 'GET'

const VALID_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
]

function parseApi(api) {
  const spliced = api.split(/\s+/)
  const len = spliced.length

  if (len === 1) {
    return { method: DEFAULT_METHOD, path: api }
  } else {
    const [method, path] = spliced
    const upperCaseMethod = method.toUpperCase()

    if (!VALID_METHODS.includes(upperCaseMethod)) {
      console.error(`method ${method} is not supported`)
      return {}
    }

    if (!path) {
      console.error('path is undefined')
      return {}
    }

    return { method: upperCaseMethod, path }
  }
}

function getMock(key, obj) {
  const { method, path } = parseApi(key)
  if (!method || !path) {
    return null
  }

  const handler = obj[key]

  return { method, path, handler }
}

const resolvePaths = (...paths) => {
  return path.join(process.cwd(), ...paths)
}

function getMockData() {
  const exists = fs.existsSync(resolvePaths('./mocks'))
  const filesContent = exists
    ? fs.readdirSync(resolvePaths('./mocks')).map((x) => {
        delete require.cache[resolvePaths(`./mocks/${x}`)]
        return require(resolvePaths(`./mocks/${x}`))
      })
    : []

  const res = filesContent.reduce(
    (acc, item) => {
      const res_ = Object.keys(item).reduce(
        (acc, x) => {
          const mock = getMock(x, item)

          return mock
            ? {
                apis_: [...acc.apis_, mock.path],
                apiConf_: { ...acc.apiConf_, [mock.path]: mock },
              }
            : acc
        },
        { apis_: [], apiConf_: {} }
      )
      return {
        apis: [...acc.apis, ...res_.apis_],
        apiConf: { ...acc.apiConf, ...res_.apiConf_ },
      }
    },
    { apis: [], apiConf: {} }
  )

  return {
    apis: res.apis,
    apiConf: res.apiConf,
  }
}

/**
 * 从proxyRes获取body数据，返回json对象
 */
function getBody(proxyRes) {
  let result = {}
  return new Promise((resolve) => {
    let body = []
    proxyRes.on('data', function(chunk) {
      body.push(chunk)
    })
    proxyRes.on('end', function() {
      body = Buffer.concat(body).toString()
      try {
        result = JSON.parse(body)
      } catch (err) {
        console.error(`pnlProxy getBody error, body=${body}`)
      }
      resolve(result)
    })
  })
}

function setProxy(targets, keys, proxyConfig) {
  return keys.reduce((acc, key, index) => {
    return {
      ...acc,
      [key]: {
        target: targets[index],
        changeOrigin: true,
        selfHandleResponse: true,
        onProxyRes: async (proxyRes, req, res) => {
          const { apis, apiConf } = getMockData()

          const tmp = apis.filter((api) => req.path.match(api))

          let body = {}

          if (tmp.length !== 0) {
            const handler = apiConf[tmp[0]].handler

            if (typeof handler === 'function') {
              handler(proxyRes, req, res)
            } else {
              res.status(200).json(handler)
            }
          } else {
            const responseBody = await getBody(proxyRes)
            if (responseBody) body = responseBody
            res.json(body)
          }
        },
        ...proxyConfig,
      },
    }
  }, {})
}

module.exports = setProxy
