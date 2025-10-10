export default defineAppConfig({
  ui: {
    colors: {
      primary: 'primary',
      secondary: 'secondary',
      tertiary: 'tertiary',
      neutral: 'neutral'
    }
  },
  header: {
    title: '',
    to: '/',
    logo: {
      alt: '',
      light: '',
      dark: ''
    },
    search: true,
    colorMode: true,
    links: []
  },
  toc: {
    title: 'Table of Contents',
    bottom: {
      title: 'Contribute',
      edit: 'https://github.com/newtheatre/rooms/edit/main/content',
      links: [{
        icon: 'i-lucide-star',
        label: 'Star on GitHub',
        to: 'https://github.com/newtheatre/rooms',
        target: '_blank'
      }]
    }
  }
})
