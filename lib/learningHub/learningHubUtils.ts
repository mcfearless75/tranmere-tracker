export type ResourceCategory =
  | 'study-skills'
  | 'maths'
  | 'english'
  | 'sport-science'
  | 'wellbeing'
  | 'careers'

export interface LearningResource {
  id: string
  title: string
  description: string
  url: string
  category: ResourceCategory
  tags: string[]
  featured: boolean
}

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  'study-skills': 'Study Skills',
  maths: 'Maths',
  english: 'English',
  'sport-science': 'Sport Science',
  wellbeing: 'Wellbeing',
  careers: 'Careers',
}

export const CATEGORY_COLOURS: Record<ResourceCategory, string> = {
  'study-skills': 'bg-violet-100 text-violet-800',
  maths: 'bg-blue-100 text-blue-800',
  english: 'bg-amber-100 text-amber-800',
  'sport-science': 'bg-green-100 text-green-800',
  wellbeing: 'bg-pink-100 text-pink-800',
  careers: 'bg-orange-100 text-orange-800',
}

export const RESOURCES: LearningResource[] = [
  // study-skills
  {
    id: 'ss-01',
    title: 'BBC Bitesize — Revision Techniques',
    description:
      'Evidence-based revision strategies including spaced repetition, retrieval practice and mind mapping to help you retain information more effectively.',
    url: 'https://www.bbc.co.uk/bitesize/articles/znkq7nb',
    category: 'study-skills',
    tags: ['revision', 'memory', 'study tips', 'spaced repetition'],
    featured: true,
  },
  {
    id: 'ss-02',
    title: 'The Pomodoro Technique — StudySmarter',
    description:
      'Learn how 25-minute focused study sessions separated by short breaks can dramatically improve concentration and reduce procrastination.',
    url: 'https://www.studysmarter.co.uk/magazine/pomodoro-technique/',
    category: 'study-skills',
    tags: ['time management', 'focus', 'productivity', 'pomodoro'],
    featured: false,
  },
  {
    id: 'ss-03',
    title: 'Cornell Note-Taking System — Cambridge University',
    description:
      'A structured approach to taking notes in class that makes review and self-testing much easier. Used by top students worldwide.',
    url: 'https://www.cambridgestudents.cam.ac.uk/your-course/examinations/revision-and-study-skills/taking-and-making-notes/cornell-note',
    category: 'study-skills',
    tags: ['notes', 'lecture skills', 'organisation', 'cornell'],
    featured: false,
  },

  // maths
  {
    id: 'ma-01',
    title: 'Khan Academy — GCSE Maths',
    description:
      'Free, world-class maths instruction covering number, algebra, geometry and statistics at GCSE level with interactive exercises and instant feedback.',
    url: 'https://www.khanacademy.org/math',
    category: 'maths',
    tags: ['gcse', 'algebra', 'geometry', 'statistics', 'free'],
    featured: true,
  },
  {
    id: 'ma-02',
    title: 'BBC Bitesize — GCSE Maths',
    description:
      'Comprehensive GCSE Maths revision covering all major exam boards. Includes worked examples, quizzes and past paper questions.',
    url: 'https://www.bbc.co.uk/bitesize/examspecs/z8sg6fr',
    category: 'maths',
    tags: ['gcse', 'revision', 'bbc', 'exam prep'],
    featured: false,
  },
  {
    id: 'ma-03',
    title: 'Corbett Maths — Video Tutorials',
    description:
      'Over 3,000 maths tutorial videos and practice questions for GCSE. Organised by topic so you can find exactly what you need.',
    url: 'https://corbettmaths.com/',
    category: 'maths',
    tags: ['videos', 'practice', 'gcse', 'tutorials'],
    featured: false,
  },

  // english
  {
    id: 'en-01',
    title: 'BBC Bitesize — GCSE English Language',
    description:
      'Full coverage of GCSE English Language including reading skills, writing techniques, and spoken language. With practice questions.',
    url: 'https://www.bbc.co.uk/bitesize/examspecs/zcbchv4',
    category: 'english',
    tags: ['gcse', 'reading', 'writing', 'language'],
    featured: true,
  },
  {
    id: 'en-02',
    title: 'Sparknotes — English Literature Guides',
    description:
      'Detailed study guides for all major GCSE and A-Level literature texts. Includes character analysis, themes and key quotes.',
    url: 'https://www.sparknotes.com/lit/',
    category: 'english',
    tags: ['literature', 'books', 'analysis', 'gcse', 'a-level'],
    featured: false,
  },
  {
    id: 'en-03',
    title: 'Grammarly — Writing Improvement',
    description:
      'Free writing assistant that checks grammar, spelling and clarity in real time. Useful for proofreading essays and coursework.',
    url: 'https://www.grammarly.com/',
    category: 'english',
    tags: ['grammar', 'writing', 'proofreading', 'essays'],
    featured: false,
  },

  // sport-science
  {
    id: 'sp-01',
    title: 'BBC Bitesize — GCSE PE',
    description:
      'Revision content for GCSE Physical Education covering anatomy, physiology, training methods, health and fitness concepts.',
    url: 'https://www.bbc.co.uk/bitesize/examspecs/zxwxmnb',
    category: 'sport-science',
    tags: ['gcse pe', 'anatomy', 'physiology', 'training', 'fitness'],
    featured: true,
  },
  {
    id: 'sp-02',
    title: 'Sports Coach UK — Movement Fundamentals',
    description:
      'Free resources from UK Coaching on movement literacy, athlete development and the physical literacy framework used in professional sport.',
    url: 'https://www.ukcoaching.org/resources/topics/guides/physical-literacy',
    category: 'sport-science',
    tags: ['coaching', 'movement', 'physical literacy', 'development'],
    featured: false,
  },
  {
    id: 'sp-03',
    title: 'Brianmac Sport Coach — Training Theory',
    description:
      'Detailed articles on periodisation, energy systems, strength training and speed development used by performance coaches at all levels.',
    url: 'https://www.brianmac.co.uk/',
    category: 'sport-science',
    tags: ['periodisation', 'energy systems', 'strength', 'speed', 'coaching'],
    featured: false,
  },

  // wellbeing
  {
    id: 'wb-01',
    title: 'NHS — Every Mind Matters',
    description:
      'NHS-backed mental health hub with personalised action plans, sleep tips, stress management techniques and anxiety guides for young people.',
    url: 'https://www.nhs.uk/every-mind-matters/',
    category: 'wellbeing',
    tags: ['mental health', 'anxiety', 'stress', 'nhs', 'sleep'],
    featured: true,
  },
  {
    id: 'wb-02',
    title: 'Childline — Feelings and Emotions',
    description:
      'Safe, confidential support for young people. Resources covering managing emotions, building resilience and knowing when to ask for help.',
    url: 'https://www.childline.org.uk/info-advice/your-feelings/',
    category: 'wellbeing',
    tags: ['emotions', 'resilience', 'support', 'young people'],
    featured: false,
  },
  {
    id: 'wb-03',
    title: 'YoungMinds — Sport and Mental Health',
    description:
      'Guidance specifically for young athletes on managing performance pressure, dealing with injury setbacks and maintaining mental fitness.',
    url: 'https://www.youngminds.org.uk/young-person/mental-health-conditions/',
    category: 'wellbeing',
    tags: ['athletes', 'performance pressure', 'injury', 'mental fitness'],
    featured: false,
  },

  // careers
  {
    id: 'ca-01',
    title: 'National Careers Service',
    description:
      'Official UK government careers service with job profiles, skills assessments, CV builder, and guidance on further education pathways.',
    url: 'https://nationalcareers.service.gov.uk/',
    category: 'careers',
    tags: ['jobs', 'cv', 'further education', 'apprenticeships', 'uk'],
    featured: true,
  },
  {
    id: 'ca-02',
    title: 'Prospects — Graduate & School Leaver Careers',
    description:
      'Comprehensive UK careers guidance including job sector profiles, application tips, and information on degree courses and apprenticeships.',
    url: 'https://www.prospects.ac.uk/',
    category: 'careers',
    tags: ['apprenticeships', 'university', 'graduate', 'job sectors'],
    featured: false,
  },
  {
    id: 'ca-03',
    title: 'Football Careers — PFA Education',
    description:
      "The Professional Footballers' Association education programme supporting players with qualifications, dual careers and life beyond football.",
    url: 'https://www.thepfa.com/players/education',
    category: 'careers',
    tags: ['football', 'dual career', 'pfa', 'qualifications', 'education'],
    featured: false,
  },
]

export function filterByCategory(
  resources: LearningResource[],
  category: ResourceCategory,
): LearningResource[] {
  return resources.filter((r) => r.category === category)
}

export function getFeatured(resources: LearningResource[]): LearningResource[] {
  return resources.filter((r) => r.featured)
}

export function searchResources(
  resources: LearningResource[],
  query: string,
): LearningResource[] {
  const q = query.trim().toLowerCase()
  if (!q) return resources
  return resources.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q)),
  )
}
