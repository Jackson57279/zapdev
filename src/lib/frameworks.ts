import { memoize } from './cache';

export interface FrameworkData {
  slug: string;
  name: string;
  title: string;
  description: string;
  features: string[];
  useCases: string[];
  advantages: string[];
  icon: string;
  color: string;
  popularity: number;
  ecosystem: {
    name: string;
    description: string;
    url: string;
  }[];
  relatedFrameworks: string[];
  metaDescription: string;
  keywords: string[];
}

export const frameworks: Record<string, FrameworkData> = {
  react: {
    slug: 'react',
    name: 'React',
    title: 'Build Interactive UIs with React Development',
    description: 'React is a powerful JavaScript library for building user interfaces. Create dynamic, component-based applications with our AI-powered React development platform.',
    metaDescription: 'Build modern React applications with AI assistance. Create component-based UIs, manage state efficiently, and deploy production-ready React apps faster than ever.',
    features: [
      'Component-Based Architecture',
      'Virtual DOM for Performance',
      'Rich Ecosystem & Libraries',
      'Server-Side Rendering Support',
      'Strong TypeScript Integration',
      'React Native for Mobile'
    ],
    useCases: [
      'Single Page Applications',
      'Progressive Web Apps',
      'E-commerce Platforms',
      'Social Media Applications',
      'Dashboard & Analytics',
      'Real-time Applications'
    ],
    advantages: [
      'Large Community Support',
      'Reusable Components',
      'Fast Development Cycle',
      'SEO-Friendly with Next.js',
      'Excellent Developer Tools',
      'Battle-tested in Production'
    ],
    icon: '⚛️',
    color: '#61DAFB',
    popularity: 95,
    ecosystem: [
      {
        name: 'Next.js',
        description: 'Full-stack React framework with SSR/SSG',
        url: '/frameworks/nextjs'
      },
      {
        name: 'Redux',
        description: 'Predictable state management',
        url: '/frameworks/react/redux'
      },
      {
        name: 'React Router',
        description: 'Declarative routing for React',
        url: '/frameworks/react/routing'
      }
    ],
    relatedFrameworks: ['nextjs', 'vue', 'angular'],
    keywords: [
      'React development',
      'React.js',
      'JavaScript framework',
      'UI library',
      'component-based development',
      'virtual DOM',
      'React hooks',
      'React components',
      'frontend development',
      'web application development'
    ]
  },
  vue: {
    slug: 'vue',
    name: 'Vue.js',
    title: 'Progressive Vue.js Development Made Simple',
    description: 'Vue.js is a progressive JavaScript framework for building user interfaces. Create reactive, performant applications with our AI-enhanced Vue development tools.',
    metaDescription: 'Develop Vue.js applications with AI assistance. Build reactive interfaces, leverage the composition API, and create scalable Vue apps with ease.',
    features: [
      'Reactive Data Binding',
      'Component System',
      'Template-Based Syntax',
      'Composition API',
      'Built-in Transitions',
      'Lightweight Core'
    ],
    useCases: [
      'Interactive Web Interfaces',
      'Single Page Applications',
      'Progressive Enhancement',
      'Embedded Widgets',
      'Full-Stack Applications',
      'Mobile Apps with Ionic'
    ],
    advantages: [
      'Gentle Learning Curve',
      'Excellent Documentation',
      'Flexible Architecture',
      'Small Bundle Size',
      'Great Performance',
      'Strong Ecosystem'
    ],
    icon: '🟢',
    color: '#4FC08D',
    popularity: 85,
    ecosystem: [
      {
        name: 'Nuxt.js',
        description: 'Full-stack Vue framework',
        url: '/frameworks/vue/nuxt'
      },
      {
        name: 'Vuex/Pinia',
        description: 'State management solutions',
        url: '/frameworks/vue/state-management'
      },
      {
        name: 'Vue Router',
        description: 'Official routing library',
        url: '/frameworks/vue/routing'
      }
    ],
    relatedFrameworks: ['react', 'angular', 'svelte'],
    keywords: [
      'Vue.js development',
      'Vue framework',
      'progressive framework',
      'reactive programming',
      'composition API',
      'Vue 3',
      'frontend framework',
      'JavaScript framework',
      'web development',
      'MVVM framework'
    ]
  },
  angular: {
    slug: 'angular',
    name: 'Angular',
    title: 'Enterprise Angular Development Platform',
    description: 'Angular is a comprehensive platform for building web applications. Create scalable, enterprise-grade applications with our AI-powered Angular development tools.',
    metaDescription: 'Build enterprise Angular applications with AI support. Leverage TypeScript, dependency injection, and powerful tooling to create robust web applications.',
    features: [
      'Full Framework Solution',
      'TypeScript by Default',
      'Dependency Injection',
      'Powerful CLI Tools',
      'RxJS Integration',
      'Built-in Testing Tools'
    ],
    useCases: [
      'Enterprise Applications',
      'Complex Web Apps',
      'Progressive Web Apps',
      'Admin Dashboards',
      'E-commerce Platforms',
      'Content Management Systems'
    ],
    advantages: [
      'Complete Solution',
      'Strong Type Safety',
      'Consistent Architecture',
      'Enterprise Support',
      'Comprehensive Testing',
      'Angular Material UI'
    ],
    icon: '🅰️',
    color: '#DD0031',
    popularity: 80,
    ecosystem: [
      {
        name: 'Angular Material',
        description: 'Material Design components',
        url: '/frameworks/angular/material'
      },
      {
        name: 'NgRx',
        description: 'Reactive state management',
        url: '/frameworks/angular/ngrx'
      },
      {
        name: 'Angular Universal',
        description: 'Server-side rendering',
        url: '/frameworks/angular/universal'
      }
    ],
    relatedFrameworks: ['react', 'vue', 'nextjs'],
    keywords: [
      'Angular development',
      'TypeScript framework',
      'enterprise web development',
      'Angular CLI',
      'dependency injection',
      'RxJS',
      'Angular components',
      'full-stack framework',
      'Google framework',
      'MVC framework'
    ]
  },
  svelte: {
    slug: 'svelte',
    name: 'Svelte',
    title: 'Build Fast Apps with Svelte Compilation',
    description: 'Svelte is a radical new approach to building user interfaces. Create incredibly fast web applications with our AI-enhanced Svelte development platform.',
    metaDescription: 'Develop blazing-fast Svelte applications with AI assistance. No virtual DOM, compile-time optimizations, and minimal bundle sizes for superior performance.',
    features: [
      'Compile-time Optimization',
      'No Virtual DOM',
      'Truly Reactive',
      'Small Bundle Sizes',
      'Built-in State Management',
      'CSS Scoping'
    ],
    useCases: [
      'Performance-Critical Apps',
      'Interactive Visualizations',
      'Embedded Widgets',
      'Progressive Web Apps',
      'Static Sites',
      'Mobile Web Apps'
    ],
    advantages: [
      'Superior Performance',
      'Simple Syntax',
      'No Runtime Overhead',
      'Built-in Animations',
      'Smaller Learning Curve',
      'Great Developer Experience'
    ],
    icon: '🔥',
    color: '#FF3E00',
    popularity: 70,
    ecosystem: [
      {
        name: 'SvelteKit',
        description: 'Full-stack Svelte framework',
        url: '/frameworks/svelte/sveltekit'
      },
      {
        name: 'Svelte Stores',
        description: 'Built-in state management',
        url: '/frameworks/svelte/stores'
      },
      {
        name: 'Svelte Native',
        description: 'Mobile app development',
        url: '/frameworks/svelte/native'
      }
    ],
    relatedFrameworks: ['react', 'vue', 'solidjs'],
    keywords: [
      'Svelte development',
      'compile-time framework',
      'reactive framework',
      'no virtual DOM',
      'Svelte components',
      'SvelteKit',
      'performance optimization',
      'modern JavaScript',
      'web components',
      'lightweight framework'
    ]
  },
  nextjs: {
    slug: 'nextjs',
    name: 'Next.js',
    title: 'Full-Stack Next.js Development Platform',
    description: 'Next.js is the React framework for production. Build full-stack web applications with server-side rendering, static generation, and more using our AI-powered tools.',
    metaDescription: 'Create production-ready Next.js applications with AI. Server-side rendering, static generation, API routes, and optimized performance out of the box.',
    features: [
      'Server-Side Rendering',
      'Static Site Generation',
      'API Routes',
      'File-based Routing',
      'Image Optimization',
      'TypeScript Support'
    ],
    useCases: [
      'E-commerce Sites',
      'Marketing Websites',
      'SaaS Applications',
      'Blogs & Content Sites',
      'Enterprise Applications',
      'JAMstack Sites'
    ],
    advantages: [
      'SEO Optimized',
      'Great Performance',
      'Vercel Integration',
      'Incremental Static Regeneration',
      'Built-in Optimizations',
      'Edge Functions'
    ],
    icon: '▲',
    color: '#000000',
    popularity: 90,
    ecosystem: [
      {
        name: 'Vercel',
        description: 'Deployment and hosting platform',
        url: '/frameworks/nextjs/vercel'
      },
      {
        name: 'Tailwind CSS',
        description: 'Utility-first CSS framework',
        url: '/frameworks/nextjs/tailwind'
      },
      {
        name: 'Prisma',
        description: 'Type-safe database ORM',
        url: '/frameworks/nextjs/prisma'
      }
    ],
    relatedFrameworks: ['react', 'gatsby', 'remix'],
    keywords: [
      'Next.js development',
      'React framework',
      'server-side rendering',
      'static site generation',
      'full-stack framework',
      'Vercel',
      'JAMstack',
      'SSR',
      'SSG',
      'production React'
    ]
  },
  expo: {
    slug: 'expo',
    name: 'Expo',
    title: 'Cross-Platform Mobile Development with Expo & React Native',
    description: 'Expo is the easiest way to build iOS, Android, and web apps from a single codebase using React Native. Create production-ready mobile applications with our AI-powered development tools.',
    metaDescription: 'Create mobile apps with Expo and React Native using AI. Multiple preview modes: web, Expo Go, Android emulator, and EAS Build for production iOS/Android apps.',
    features: [
      'Cross-Platform (iOS/Android/Web)',
      'Hot Reload & Fast Refresh',
      'Expo SDK Modules',
      'Multiple Preview Modes',
      'EAS Build Integration',
      'Over-the-Air Updates',
      'TypeScript Support',
      'expo-router Navigation'
    ],
    useCases: [
      'Mobile-First Applications',
      'Social Media Apps',
      'E-commerce Mobile Apps',
      'Fitness & Health Trackers',
      'Photo & Video Apps',
      'Location-Based Services',
      'Progressive Web Apps'
    ],
    advantages: [
      'One Codebase, Three Platforms',
      'Rich Native Module Ecosystem',
      'Fast Development Cycle',
      'Real Device Testing (Expo Go)',
      'Cloud Builds (No Xcode/Android Studio)',
      'Strong Community Support'
    ],
    icon: '📱',
    color: '#000020',
    popularity: 85,
    ecosystem: [
      {
        name: 'Expo Go',
        description: 'Instant preview on real devices',
        url: '/frameworks/expo/expo-go'
      },
      {
        name: 'EAS Build',
        description: 'Cloud-based iOS/Android builds',
        url: '/frameworks/expo/eas-build'
      },
      {
        name: 'expo-router',
        description: 'File-based navigation system',
        url: '/frameworks/expo/router'
      }
    ],
    relatedFrameworks: ['react', 'nextjs'],
    keywords: [
      'Expo development',
      'React Native',
      'cross-platform mobile',
      'iOS development',
      'Android development',
      'mobile app framework',
      'Expo SDK',
      'React Native components',
      'EAS Build',
      'mobile development'
    ]
  }
};

export const getFramework = memoize(
  (slug: string): FrameworkData | undefined => {
    return frameworks[slug];
  }
);

export const getAllFrameworks = memoize(
  (): FrameworkData[] => {
    return Object.values(frameworks);
  }
);

export const getRelatedFrameworks = memoize(
  (slug: string): FrameworkData[] => {
    const framework = getFramework(slug);
    if (!framework) return [];
    
    return framework.relatedFrameworks
      .map(relatedSlug => getFramework(relatedSlug))
      .filter((f): f is FrameworkData => f !== undefined);
  }
);