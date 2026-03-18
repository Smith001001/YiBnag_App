export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '历史记录' })
  : { navigationBarTitleText: '历史记录' }
