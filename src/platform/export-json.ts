/** 只有适配层使用浏览器下载 API；其他平台编译时移除此段。 */
export async function downloadJsonFile(filename: string, content: string): Promise<void> {
  // #ifdef H5
  let objectUrl: string | undefined
  let link: HTMLAnchorElement | undefined
  try {
    if (typeof document === 'undefined') throw new Error()
    JSON.parse(content)
    objectUrl = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }))
    link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    // 延迟释放，让浏览器有机会接管下载；不声称已写入用户磁盘。
    const urlToRelease = objectUrl
    setTimeout(() => URL.revokeObjectURL(urlToRelease), 1000)
    objectUrl = undefined
    return
  } catch {
    throw new Error('导出失败，浏览器未能发起 JSON 下载。请检查下载权限后重试。')
  } finally {
    link?.remove()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
  // #endif
  // #ifndef H5
  throw new Error('当前平台暂未实现 JSON 文件导出，请使用 Web 版本。')
  // #endif
}
