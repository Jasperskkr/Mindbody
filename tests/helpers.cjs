const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vue = require('vue')
const { parse, compileScript } = require('vue/compiler-sfc')
const root = path.resolve(__dirname, '..')

// 只在内存里模拟 uni；不会连接任何浏览器或用户数据。
function memoryStorage() {
  const data = new Map()
  const reads = [], deletes = []
  const state = { readFailure: false, getFailure: false, writeFailure: false, deleteFailure: '', silentDelete: false, throwDelete: false }
  const uni = {
    getStorageInfo({ success, fail }) { state.readFailure ? fail({}) : success({ keys: [...data.keys()] }) },
    getStorage({ key, success, fail }) {
      reads.push(key)
      state.getFailure || !data.has(key) ? fail({}) : success({ data: data.get(key) })
    },
    setStorage({ key, data: value, success, fail }) {
      if (state.writeFailure) return fail({})
      data.set(key, value); success({})
    },
    removeStorage({ key, success, fail }) {
      if (state.throwDelete) throw new Error('synthetic remove exception')
      if (state.deleteFailure === key) return fail({})
      deletes.push(key)
      if (!state.silentDelete) data.delete(key)
      success({})
    },
    clearStorage() { throw new Error('clearStorage must never be called') },
    navigateTo() {}, reLaunch() {}, showToast() {},
  }
  return { data, state, reads, deletes, uni }
}

function createRuntime(uni, overrides = {}, globals = {}) {
  const cache = new Map()
  function evaluate(source, filename, hooks = {}) {
    const module = { exports: {} }
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    })
    const localRequire = (specifier) => {
      if (specifier === 'vue') return vue
      if (specifier === '@dcloudio/uni-app') return {
        onShow(fn) { hooks.show = fn }, onLoad(fn) { hooks.load = fn }, onHide(fn) { hooks.hide = fn },
      }
      if (specifier.endsWith('.vue')) return {}
      const resolved = path.resolve(path.dirname(filename), specifier.endsWith('.json') ? specifier : `${specifier}.ts`)
      return load(resolved)
    }
    new Function('require', 'module', 'exports', 'uni', 'document', 'URL', 'Blob', outputText)(
      localRequire, module, module.exports, uni, globals.document, globals.URL ?? URL, globals.Blob ?? Blob,
    )
    return module.exports
  }
  function load(relative) {
    const filename = path.resolve(root, relative)
    const key = path.relative(root, filename).replaceAll('\\', '/')
    if (overrides[key]) return overrides[key]
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'))
    if (!cache.has(filename)) cache.set(filename, evaluate(fs.readFileSync(filename, 'utf8'), filename))
    return cache.get(filename)
  }
  function page(relative) {
    const filename = path.resolve(root, relative)
    const descriptor = parse(fs.readFileSync(filename, 'utf8'), { filename }).descriptor
    const script = compileScript(descriptor, { id: relative }).content
    const hooks = {}
    const component = evaluate(script, filename, hooks).default
    return { state: component.setup({}, { expose() {} }), hide() { hooks.hide?.() }, async show() {
      if (hooks.show) hooks.show()
      else if (hooks.load) hooks.load()
      await new Promise(setImmediate)
      await vue.nextTick()
    } }
  }
  return { load, page }
}

const keyFor = (date) => `mindbody:daily-record:v1:${date}`
module.exports = { memoryStorage, createRuntime, keyFor, vue }
