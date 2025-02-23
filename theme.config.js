export default {
  logo: <span>公式ドキュメント翻訳集</span>,
  project: {
    link: 'https://github.com/Kawatan1927/translated-docs-collection',
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – 公式ドキュメント翻訳集',
    }
  },
  sidebar:{
    defaultMenuCollapseLevel: 1
  },
  feedback: {
    content: null
  },
  editLink: {
    text: null
  }
}
