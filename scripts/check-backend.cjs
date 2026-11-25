const { existsSync } = require('node:fs')
const { resolve } = require('node:path')
const { spawnSync } = require('node:child_process')
const root = resolve(__dirname, '..')
const local = resolve(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
if (!existsSync(local)) {
  process.stderr.write('请先按 README 创建 .venv 并安装 backend/requirements-lock.txt，再运行后端检查。\n')
  process.exit(1)
}
const result = spawnSync(local, ['-m', 'unittest', 'discover', '-s', 'backend/tests', '-v'], { cwd: root, stdio: 'inherit' })
if (result.error) process.stderr.write('无法启动项目 Python 虚拟环境。\n')
process.exit(result.status ?? 1)
