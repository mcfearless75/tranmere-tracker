import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Assignment templates per unit number.
// Pattern follows BTEC learning aims (A, B, C) — each becoming a real assignment.
// Titles/descriptions adapted from Pearson specification learning aim language.

type AssignmentTemplate = { title: string; description: string; target: 'Pass' | 'Merit' | 'Distinction' }

// Level 2 Sport (Fitness pathway) assignments — maps unit_number to assignment templates
const L2_ASSIGNMENTS: Record<string, AssignmentTemplate[]> = {
  U01: [
    { title: 'Components of Fitness & Principles of Training', description: 'Report explaining the physical and skill-related components of fitness and the FITT/SPORT principles of training.', target: 'Merit' },
    { title: 'Fitness Training Methods Portfolio', description: 'Evidence pack describing different training methods for each component of fitness with advantages and disadvantages.', target: 'Pass' },
    { title: 'Fitness Testing Investigation', description: 'Carry out a battery of fitness tests on a subject, record results, interpret against norms and evaluate the data.', target: 'Distinction' },
  ],
  U02: [
    { title: 'Rules, Regulations & Scoring', description: 'Produce a guide explaining the rules, regulations and scoring systems of two sports.', target: 'Pass' },
    { title: 'Practical Performance Portfolio', description: 'Demonstrate the skills, techniques and tactics required in two sports in both practice and competitive situations.', target: 'Merit' },
    { title: 'Performance Review & Development Plan', description: 'Review your own performance in two sports and produce a development plan to improve.', target: 'Distinction' },
  ],
  U03: [
    { title: 'Designing a Personal Training Programme', description: 'Design a 6-week personal training programme using the principles of training, tailored to your goals.', target: 'Merit' },
    { title: 'Programme Delivery Log', description: 'Implement, record and monitor the 6-week programme including session logs and progression.', target: 'Pass' },
    { title: 'Programme Evaluation', description: 'Review the programme results, evaluate effectiveness and recommend future improvements.', target: 'Distinction' },
  ],
  U04: [
    { title: 'The Mind & Sports Performance', description: 'Investigate how personality, motivation and arousal affect sports performance with real-world examples.', target: 'Merit' },
    { title: 'Psychological Techniques Report', description: 'Describe techniques (imagery, goal setting, self-talk) used by elite athletes to enhance performance.', target: 'Pass' },
  ],
  U05: [
    { title: 'Sports Performer in Action — Analysis', description: 'Film yourself performing and analyse technique, tactics and decision-making.', target: 'Merit' },
    { title: 'Performance Improvement Proposal', description: 'Design a targeted improvement plan based on the analysis findings.', target: 'Pass' },
  ],
  U06: [
    { title: 'Plan a Sports Session', description: 'Plan a safe and effective sports activity session for a target group.', target: 'Pass' },
    { title: 'Lead a Sports Session', description: 'Deliver the planned session and gather feedback from participants and observer.', target: 'Merit' },
    { title: 'Leadership Review', description: 'Reflect on leadership strengths, weaknesses and areas for development.', target: 'Distinction' },
  ],
  U07: [
    { title: 'Anatomy & Physiology Booklet', description: 'Describe the structure and function of the skeletal, muscular, cardiovascular and respiratory systems.', target: 'Pass' },
    { title: 'Body Systems in Sports Performance', description: 'Explain how the body systems respond to exercise and the impact on sports performance.', target: 'Merit' },
  ],
  U08: [
    { title: 'Promotion in Sport', description: 'Analyse how promotion is used in sport, including advertising, PR and sponsorship.', target: 'Merit' },
    { title: 'Sponsorship Proposal', description: 'Design a sponsorship proposal for a local sports club including pitch deck and benefits analysis.', target: 'Pass' },
  ],
  U09: [
    { title: 'Lifestyle Assessment & Plan', description: 'Assess your own lifestyle factors (diet, sleep, activity) and produce an improvement plan.', target: 'Pass' },
    { title: 'Well-being Education Resource', description: 'Create a resource (leaflet/video) educating peers about the importance of well-being.', target: 'Merit' },
  ],
  U10: [
    { title: 'Common Sports Injuries Guide', description: 'Produce a guide explaining common injuries in sport, causes and prevention.', target: 'Pass' },
    { title: 'Injury Response & Rehabilitation', description: 'Describe how to respond to sports injuries and the stages of rehabilitation.', target: 'Merit' },
  ],
  U11: [
    { title: 'Sports Event Proposal', description: 'Plan a sports event including aims, audience, logistics and risk assessment.', target: 'Merit' },
    { title: 'Run a Sports Event', description: 'Deliver the event with your group and produce evidence of your role.', target: 'Distinction' },
  ],
  U12: [
    { title: 'Outdoor Activity Plan', description: 'Plan an outdoor activity session covering safety, equipment and group management.', target: 'Pass' },
    { title: 'Lead Outdoor Activity', description: 'Lead or assist in an outdoor session and reflect on the experience.', target: 'Merit' },
  ],
  U13: [
    { title: 'Profiling a Sports Performer', description: 'Produce a performance profile including physical, technical, tactical and psychological analysis.', target: 'Merit' },
    { title: 'Performance Development Recommendations', description: 'Use the profile to recommend a performance development plan for the athlete.', target: 'Distinction' },
  ],
}

// Level 3 Sports Coaching assignments
const L3_COACHING: Record<string, AssignmentTemplate[]> = {
  U01: [
    { title: 'Anatomy & Physiology Exam Prep', description: 'External exam preparation — complete revision portfolio covering all body systems and energy pathways.', target: 'Merit' },
    { title: 'Case Study: Body in Action', description: 'Case study analysing how the body systems interact during intense sporting performance.', target: 'Distinction' },
  ],
  U02: [
    { title: 'Fitness Training Programme Design', description: 'Design a comprehensive fitness programme for a named individual using all principles of training.', target: 'Merit' },
    { title: 'Programme Evaluation Report', description: 'Implement, review and evaluate the fitness programme with data-driven recommendations.', target: 'Distinction' },
  ],
  U03: [
    { title: 'Career Pathways in Sport', description: 'Research and present career pathways in the sports industry with required qualifications.', target: 'Pass' },
    { title: 'Personal Development Plan', description: 'Produce a 3-year career plan with SMART targets and professional development activities.', target: 'Merit' },
  ],
  U04: [
    { title: 'Leadership Styles in Sport', description: 'Compare leadership styles and their application in different sporting contexts.', target: 'Merit' },
    { title: 'Leading a Sports Session', description: 'Plan, deliver and evaluate a sports leadership session with peer assessment.', target: 'Distinction' },
  ],
  U05: [
    { title: 'Fitness Test Battery', description: 'Administer a battery of fitness tests on multiple subjects with accurate data recording.', target: 'Merit' },
    { title: 'Test Data Analysis & Feedback', description: 'Analyse fitness test results against norms and produce individualised feedback reports.', target: 'Distinction' },
  ],
  U06: [
    { title: 'Sports Psychology Theories', description: 'Explain key theories of arousal, anxiety, personality and motivation in sport.', target: 'Merit' },
    { title: 'Applied Psychology Intervention', description: 'Design and deliver a psychological intervention for an athlete case study.', target: 'Distinction' },
  ],
  U07: [
    { title: 'Skills Analysis Project', description: 'Analyse your performance in a chosen sport using video and performance data.', target: 'Pass' },
    { title: 'Performance Improvement Plan', description: 'Design a detailed improvement plan including training, tactical and psychological elements.', target: 'Merit' },
  ],
  U08: [
    { title: 'Coaching Session Plans (x4)', description: 'Plan four progressive coaching sessions for a chosen sport and age group.', target: 'Merit' },
    { title: 'Coaching Delivery & Reflection', description: 'Deliver sessions, gather feedback and produce a reflective report.', target: 'Distinction' },
  ],
  U09: [
    { title: 'Research Methods Literature Review', description: 'Produce a literature review on a chosen topic in sport using peer-reviewed sources.', target: 'Merit' },
    { title: 'Research Proposal', description: 'Design a research proposal including methodology, ethics and anticipated outcomes.', target: 'Distinction' },
  ],
  U10: [
    { title: 'Event Planning Portfolio', description: 'Plan a sports event including budgets, marketing, health & safety and logistics.', target: 'Merit' },
    { title: 'Event Delivery & Evaluation', description: 'Deliver the event, collect attendee feedback and produce a post-event evaluation.', target: 'Distinction' },
  ],
  U11: [
    { title: 'Independent Research Project', description: 'Conduct an independent research project in sport — data collection through to findings.', target: 'Distinction' },
  ],
  U12: [
    { title: 'Business Plan for Sports Enterprise', description: 'Produce a business plan for a self-employment idea in the sports industry.', target: 'Merit' },
    { title: 'Financial Forecasting', description: 'Produce financial forecasts including start-up costs, pricing and break-even analysis.', target: 'Distinction' },
  ],
  U13: [
    { title: 'Nutrition for Performance Plan', description: 'Design a 7-day nutrition plan for an athlete in a chosen sport.', target: 'Merit' },
    { title: 'Dietary Analysis & Review', description: 'Analyse a current diet, compare to guidelines and recommend evidence-based improvements.', target: 'Distinction' },
  ],
  U14: [
    { title: 'Common Injuries in Sport', description: 'Produce a guide to common injuries, their mechanisms, prevention and immediate response.', target: 'Pass' },
    { title: 'Rehabilitation Programme', description: 'Design a stage-by-stage rehabilitation programme for a chosen injury.', target: 'Merit' },
  ],
  U15: [
    { title: 'Sports Industry Report', description: 'Produce a report exploring sectors of the sports & active leisure industry and career routes.', target: 'Pass' },
  ],
}

// Level 3 Sports Science assignments
const L3_SCIENCE: Record<string, AssignmentTemplate[]> = {
  U01: [
    { title: 'Sport & Exercise Physiology — External Exam', description: 'External exam preparation — complete revision portfolio covering energy systems, acute & chronic responses.', target: 'Merit' },
    { title: 'Physiological Response Case Study', description: 'Analyse physiological responses of an athlete during a specific type of exercise.', target: 'Distinction' },
  ],
  U02: [
    { title: 'Functional Anatomy — External Exam', description: 'External exam preparation covering skeletal, muscular and connective tissue anatomy.', target: 'Merit' },
    { title: 'Movement Analysis Portfolio', description: 'Analyse movements in sporting activities — joints, muscles, planes and axes.', target: 'Distinction' },
  ],
  U03: [
    { title: 'Applied Psychology — External Exam', description: 'External exam preparation covering personality, motivation, arousal and group dynamics.', target: 'Merit' },
    { title: 'Psychology Intervention Case Study', description: 'Design and justify a psychological intervention for a named athlete scenario.', target: 'Distinction' },
  ],
  U04: [
    { title: 'Fitness Testing Lab Report', description: 'Carry out lab and field-based fitness tests with proper protocols. Produce a lab report.', target: 'Merit' },
    { title: 'Testing Data Synoptic Project', description: 'Synoptic project using fitness test data to produce evidence-based recommendations.', target: 'Distinction' },
  ],
  U05: [
    { title: 'Research Project Proposal', description: 'Design a research project proposal including literature review, methodology and ethics.', target: 'Merit' },
    { title: 'Research Delivery & Analysis', description: 'Deliver the research, analyse findings and produce a conference-style presentation.', target: 'Distinction' },
  ],
  U06: [
    { title: 'Coaching Session Plans', description: 'Plan four progressive coaching sessions based on sport-science principles.', target: 'Merit' },
    { title: 'Coaching Delivery & Reflection', description: 'Deliver the sessions, gather feedback and produce a reflective review.', target: 'Distinction' },
  ],
  U07: [
    { title: 'Biomechanical Movement Analysis', description: 'Use biomechanical principles to analyse a sporting technique with video evidence.', target: 'Merit' },
    { title: 'Performance Optimisation Report', description: 'Produce recommendations to optimise performance based on biomechanical analysis.', target: 'Distinction' },
  ],
  U08: [
    { title: 'Advanced Training Programme', description: 'Design a specialised training programme for an elite-level athlete in a chosen sport.', target: 'Merit' },
    { title: 'Programme Evaluation Report', description: 'Implement, monitor and evaluate the programme with physiological data.', target: 'Distinction' },
  ],
  U09: [
    { title: 'Research Project in Sport Science', description: 'Conduct an independent research project — dissertation-style submission.', target: 'Distinction' },
  ],
  U10: [
    { title: 'Athlete Nutrition Plan', description: 'Design a 7-day nutrition plan tailored to an athlete in a chosen sport and phase.', target: 'Merit' },
    { title: 'Nutrition Case Study', description: 'Analyse a case study athlete diet and recommend evidence-based changes.', target: 'Distinction' },
  ],
  U11: [
    { title: 'Sports Massage Case Study', description: 'Case study covering assessment, treatment plan and outcomes for a sports massage client.', target: 'Merit' },
    { title: 'Massage Techniques Demonstration', description: 'Demonstrate massage techniques on a peer and produce a video evidence portfolio.', target: 'Pass' },
  ],
  U12: [
    { title: 'Technology in Sport Report', description: 'Investigate how technology is used to enhance sports performance across different sports.', target: 'Merit' },
    { title: 'Technology Application Proposal', description: 'Propose a technology-based improvement for a specific sporting scenario.', target: 'Distinction' },
  ],
  U13: [
    { title: 'Sociocultural Issues Investigation', description: 'Investigate a current sociocultural issue in sport (equality, ethics, media).', target: 'Merit' },
    { title: 'Policy Recommendation Paper', description: 'Produce a policy recommendation paper addressing the investigated issue.', target: 'Distinction' },
  ],
  U14: [
    { title: 'Injury Assessment Portfolio', description: 'Produce an injury assessment portfolio covering common sports injuries and red flags.', target: 'Merit' },
    { title: 'Rehabilitation Programme', description: 'Design a stage-based rehabilitation programme for a chosen injury.', target: 'Distinction' },
  ],
  U15: [
    { title: 'Work Experience Log & Reflection', description: 'Complete work experience placement with log and reflective review.', target: 'Pass' },
  ],
}

const COURSE_MAP: Record<string, Record<string, AssignmentTemplate[]>> = {
  'Level 2 Public Services / Fitness': L2_ASSIGNMENTS,
  'Level 3 Sports Coaching': L3_COACHING,
  'Level 3 Sports Science': L3_SCIENCE,
}

function dueDateFor(monthsFromNow: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + monthsFromNow)
  d.setDate(15 + Math.floor(Math.random() * 10))  // 15th-24th of that month
  return d.toISOString().slice(0, 10)
}

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { data: units } = await admin
    .from('btec_units')
    .select('id, unit_number, course_id, courses(name)')
    .order('unit_number')

  if (!units || units.length === 0) {
    return NextResponse.json({ error: 'No BTEC units found. Populate units first.' }, { status: 400 })
  }

  let inserted = 0
  let skipped = 0

  for (const u of units) {
    const courseName = (u.courses as any)?.name
    const templates = COURSE_MAP[courseName]?.[u.unit_number]
    if (!templates) continue

    for (let i = 0; i < templates.length; i++) {
      const t = templates[i]
      // Check if an assignment with this title already exists for this unit
      const { data: existing } = await admin
        .from('assignments')
        .select('id')
        .eq('unit_id', u.id)
        .eq('title', t.title)
        .maybeSingle()

      if (existing) { skipped++; continue }

      // Stagger due dates: 1-6 months from now, spread across assignments
      const months = 1 + (i * 2) + Math.floor(Math.random() * 2)

      await admin.from('assignments').insert({
        unit_id: u.id,
        title: t.title,
        description: t.description,
        due_date: dueDateFor(months),
        grade_target: t.target,
      })
      inserted++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Inserted ${inserted} assignments · skipped ${skipped} existing.`,
  })
}
