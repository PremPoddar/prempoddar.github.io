export const resume = {
  intro:
    'Computer Science student (BSc, graduating 2027) with three paid software roles behind me: iOS and Android apps around a C++ ECG engine for a medical education company, a healthcare website for a physicians\' college in Spain, and testing underwater communication systems for a research client. I also build and publish my own apps for Android and Mac.',
  experience: [
    {
      when: 'June to August 2026',
      role: 'Cross-platform engineer, iOS and Android',
      org: 'Medical education platform (contract)',
      note: 'Independent contractor for Marco Cebrián Muiño and Francisco Javier Miana, Zaragoza, Spain (remote)',
      href: '/work/ecg-engine/',
      points: [
        'Creating a new proprietary C++ ECG engine from scratch, running as a single shared core on both iOS and Android.',
        'Building the native Swift and Kotlin apps around it, covering three product modules: Simulate, Practice and Learn.',
        'Implemented English and Spanish localisation with automatic device language selection, and prepared App Store and Google Play publication assets plus the product landing site.',
      ],
    },
    {
      when: 'November 2025',
      role: 'Full-stack web developer',
      org: 'Official College of Physicians of Zaragoza',
      note: 'Zaragoza, Spain',
      href: '/work/ejercicioysalud/',
      points: [
        'Designed and shipped ejercicioysalud.org, the college\'s public platform for clinical exercise prescription guidance for cardiovascular patients, production ready in a two week engagement.',
        'Structured the site architecture and content model around multilingual educational material, clinical guides and embedded video training modules.',
        'Built a responsive, accessible front end to institutional standards and handed over a maintainable codebase for the college\'s ongoing use.',
      ],
    },
    {
      when: 'August 2025',
      role: 'Embedded systems research engineer',
      org: 'Pablo Gómez Ochoa',
      note: 'Spain',
      href: '/work/underwater-acoustics/',
      points: [
        'Evaluated commercial underwater acoustic communication systems against operating conditions, range and reliability requirements for an integration decision.',
        'Wrote structured test methodologies characterising signal behaviour, environmental sensitivity and system reliability across configurations.',
        'Consolidated results into a feasibility and cost comparison that drove the client\'s vendor selection and deployment strategy.',
      ],
    },
  ],
  skills: [
    ['Languages', 'Java, C++, C, C#, Swift, JavaScript, Kotlin, Python, Rust, PHP, R'],
    ['Web', 'HTML, CSS, React, Vue, Next.js, Spring Boot, .NET, REST APIs, responsive and accessible front end'],
    ['Mobile', 'Jetpack Compose, ExoPlayer, Bluetooth LE, Wi-Fi Aware, WebRTC, Ktor'],
    ['Platforms', 'AWS and cloud, macOS, Windows, Linux'],
    ['Data', 'SQL, MySQL, Oracle DB, MongoDB, NumPy, pandas'],
    ['Hardware', 'Electronics programming, circuit building, embedded system testing'],
    ['Process', 'Requirements gathering, system integration, test methodology, app store release, maintenance handover'],
    ['Speaks', 'English, Spanish, Hindi'],
  ],
  howIWork: [
    'Talk directly with clients about requirements, scope and progress, whether they are managers, doctors or engineers.',
    'Turn what a client asks for into a clear plan both sides agree on. If the budget, deadline or technical limits change, I explain the options and what each one costs.',
    'Have built complete products on my own, and am comfortable leading a small team towards a release.',
    'Consider cost, licensing and delivery when making recommendations, not only the technical side. The underwater systems project was a purchasing decision as much as a technical one.',
    'Stay involved after launch: deployment, App Store and Google Play releases, and ongoing maintenance of software and hardware.',
  ],
  education: {
    degree: 'BSc Computer Science',
    school: 'Mithibai College, Mumbai',
    year: '2027',
    notes: ['CGPA 8.62 / 10', 'Took part in Smart India Hackathon'],
  },
};
