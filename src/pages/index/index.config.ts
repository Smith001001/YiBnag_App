export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '校园互助平台' })
  : { navigationBarTitleText: '校园互助平台' }
