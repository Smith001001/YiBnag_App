export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/my-orders/index',
    'pages/profile/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#3B82F6',
    navigationBarTitleText: '校园互助平台',
    navigationBarTextStyle: 'white',
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#3B82F6',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '订单大厅',
        iconPath: './assets/tabbar/home.png',
        selectedIconPath: './assets/tabbar/home-active.png',
      },
      {
        pagePath: 'pages/my-orders/index',
        text: '我的订单',
        iconPath: './assets/tabbar/briefcase.png',
        selectedIconPath: './assets/tabbar/briefcase-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '个人中心',
        iconPath: './assets/tabbar/user.png',
        selectedIconPath: './assets/tabbar/user-active.png',
      },
    ],
  },
})
