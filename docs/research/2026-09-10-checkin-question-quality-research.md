# Wellbeing check-in — question content & coverage research

**Date:** 2026-09-10
**Author:** research pass (no code changed, no existing files modified)
**Scope:** *What the five questions ask*, and whether that is the right set of domains for a 16-18 year old in a combined academy + college environment. Detection thresholds, alert routing, access control and cadence are **out of scope** — they are covered in [`2026-09-09-checkin-safeguarding-research.md`](./2026-09-09-checkin-safeguarding-research.md) and are referenced here only where they change a question-design decision.

> Research document. Nothing here has been implemented. Where this report and the
> 2026-09-09 report disagree on sequencing, the 2026-09-09 Tier 0 items win — see §6.4.

---

## 1. Executive summary

- **Recommendation: add exactly one new scored item (social connection), one non-scored one-tap "what's on your mind" router, and one conditional free-text box — then rotate everything else through a single weekly slot.** That takes the survey from 5 scored items to 6 fixed + 1 rotating (7 maximum in any given week), from ~60 seconds to an estimated ~85-95 seconds, and gives population coverage of eleven domains at the per-student cost of one extra question. Details and exact wording in §5.

- **The single biggest content gap is not a missing feeling — it is missing *context*.** All five current items measure an internal state (mood, sleep, energy, stress, enjoyment) and none of them capture *what is causing it*. A `stress = 2` is indistinguishable between a coursework deadline, a deselection conversation, a bereavement at home, and having no money for the bus. For this population that distinction is the whole job: the dual-career literature identifies four qualitatively distinct stress profiles in adolescent footballers — balance adaptation, academic overload, athletic core stress and dual-track impairment ([Frontiers in Psychology 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13002566/)) — and the current instrument collapses all four into one number. A one-tap chip picker fixes this in about five seconds of student time.

- **The second biggest gap is social connection / belonging, and it is a genuine zero.** Nothing in the current five items touches relationships, loneliness or feeling settled. Every general adolescent instrument covers it (the Good Childhood Index has *friends*, *family*, *home* and *school* among its ten domains; the SDQ has a whole peer-problems subscale), and it is the domain the academy-specific literature flags hardest: relocated and migrant players report loneliness and absent belonging as the defining experience, with teammates as the only substitute ([Loneliness and lack of belonging, *Sport Management Review*-adjacent, ScienceDirect 2023](https://www.sciencedirect.com/science/article/pii/S2666518223000293)), and school/peer connectedness is one of the best-evidenced protective factors against adolescent internalising symptoms and suicide risk ([Development and Psychopathology 2024](https://pubmed.ncbi.nlm.nih.gov/39506487/); [Frontiers in Psychology 2025](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1547759/full)).

- **The five items you already have are, individually, the *right* five to have picked.** This is worth saying plainly. The systematic review of single-item wellbeing measures in team sport (21 studies, ~500 athletes) found the five dominant constructs across the literature are muscle soreness (20 studies), fatigue (20), sleep quality (19), stress (14) and mood (6), on 3-8 item questionnaires ([IJSPP/PMC7534939](https://pmc.ncbi.nlm.nih.gov/articles/PMC7534939/)). You have four of those five. The one you are missing from the sports-science canon is **muscle soreness**; the one you have that the canon does not is **football enjoyment**, which is defensible on burnout grounds (loss of enjoyment is sport devaluation, an Athlete Burnout Questionnaire dimension) and on buy-in grounds.

- **Do not add a validated clinical scale.** WEMWBS/SWEMWBS is licensed, not public domain — Warwick operates NHS / Commercial / Non-Commercial licence tiers and a college would need to register ([Warwick WEMWBS](https://warwick.ac.uk/services/innovations/wemwbs)) — and at 7 or 14 items on a 5-point weekly frame it would double the survey on its own. PHQ-9/GAD-7 are worse: at PHQ-9 > 10 the positive predictive value for adolescent major depression is about **15%**, i.e. roughly five false positives per true case ([Manhattan Institute critical assessment](https://manhattan.institute/article/universal-mental-health-screening-in-schools-a-critical-assessment)), and GAD-7 at ≥9 gives ~73% sensitivity / ~70% specificity ([PMC8794093](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8794093/)). Repeating a clinical screen weekly, in a school with no clinician attached, manufactures a caseload nobody can absorb. Use them, if at all, as a *second-stage* instrument administered by a named adult after a flag — never in the weekly loop.

- **A direct self-harm question is a policy decision, not an engineering one — and the evidence does not settle it for you.** The "asking makes it worse" fear is not supported: Gould's randomised trial of youth suicide screening found no iatrogenic effect and lower distress in high-risk subgroups ([JAMA 2005](https://pubmed.ncbi.nlm.nih.gov/15811983/)), and DeCou & Schumann's 13-study meta-analysis found no significant iatrogenic effect ([*Suicide and Life-Threatening Behavior* 2018](https://onlinelibrary.wiley.com/doi/abs/10.1111/sltb.12368)). But *safe to ask* is not the same as *safe to ask weekly, in-app, non-anonymously, with a push alert as the response*. OxWell — the largest UK school survey doing this — uses a gateway design, collects no names, and notifies safeguarding leads only in aggregate weeks later ([OxWell FAQs](https://www.psych.ox.ac.uk/research/schoolmentalhealth/faqs)). See §7, question 1: **this one needs Paul's decision, not mine.**

- **The strongest argument against everything above is that the current pipeline cannot yet use the answers it already collects.** The free-text note has been gathered for months and is rendered to no human; the `stress` item's polarity is broken; a flag broadcasts to every staff member. Adding items to that pipeline multiplies noise, not signal — and every added item is more special-category data on a child, which the ICO's minimisation position ("if you can achieve your aim without special category data, don't collect it") and Children's Code Standard 8 both push back on. **Sequence: 2026-09-09 Tier 0 first, question changes second.** §6 makes this case properly rather than as a footnote.

---

## 2. Current state — the five questions and what each covers

From `lib/wellbeing/wellbeingUtils.ts:1-7`:

| # | Key | Wording | Emoji | Domain it covers | Canon it maps to |
|---|---|---|---|---|---|
| 1 | `mood` | "How is your mood today?" | 😊 | Affect / general emotional state | Hooper *mood*; single-item review (6/21 studies); loosely SWEMWBS hedonic |
| 2 | `sleep` | "How well did you sleep?" | 😴 | Sleep **quality** (not duration) | Hooper *sleep*; single-item review (19/21) — the most-used item in the field |
| 3 | `energy` | "How are your energy levels?" | ⚡ | Fatigue (inverted framing) | Hooper *fatigue*; single-item review (20/21) |
| 4 | `stress` | "How stressed are you feeling?" | 😰 | Perceived stress — **source unspecified** | Hooper *stress*; single-item review (14/21) |
| 5 | `football_enjoyment` | "How much did you enjoy football?" | ⚽ | Sport enjoyment / devaluation | Athlete Burnout Questionnaire *sport devaluation* dimension; not in the wellness-monitoring canon |

Structural facts that constrain any redesign:

- 1-5 scale, one question per screen, progress bar, optional free-text box **per question** (`app/(student)/wellbeing/page.tsx:104-147`).
- All five are mandatory; no partial submit (`validateSurveyAnswers`).
- Header promises **"Takes about 60 seconds · Every week"** (`page.tsx:88`).
- Four items are "higher = better"; `stress` is the sole reverse-worded item and the app does not handle that. This is the 2026-09-09 report's #1 finding and it is a **prerequisite** for anything here — see §6.4.
- Only `mood` and `stress` are flag-eligible (`RED_FLAG_KEYS`). `sleep`, `energy` and `football_enjoyment` can be 1/5 forever and nothing happens.

**Domains with literally zero coverage today:** social connection, belonging/settledness, home and family circumstances, academic/coursework load, physical soreness, appetite/eating, money and material need, safety, self-harm/risk, and any notion of *what is driving* a low score.

---

## 3. External evidence

### 3.1 General adolescent wellbeing instruments (UK school/college context)

**WEMWBS / SWEMWBS** — [Warwick Medical School](https://warwick.ac.uk/services/innovations/wemwbs). 14 items (WEMWBS) or 7 (SWEMWBS), all positively worded, 5-point frequency response ("none of the time" → "all of the time"), 2-week recall. Validated for ages **11+** (explicitly not recommended below 11), with dedicated adolescent validation in English and Scottish school students ([BMC/PMC3141456](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3141456/)), Norwegian adolescents (SWEMWBS α = .88, [PubMed 29017402](https://pubmed.ncbi.nlm.nih.gov/29017402/)) and Czech 15-18 year olds via IRT ([PMC11331616](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11331616/)).

Domains: hedonic (feeling good) **and** eudaimonic (functioning well) — optimism, usefulness, relaxation, dealing with problems, thinking clearly, **feeling close to other people**, and making up one's own mind. Two of those seven are relational/agentic and have no analogue in the current five.

*Constraints for this project:* it is **licensed**, not free-to-copy. Warwick runs NHS / Commercial / Non-Commercial tiers; a college or registered charity qualifies for the non-commercial tier but must still register. Its 2-week recall also fights a weekly cadence, and its 7 items on top of the existing 5 would roughly double the instrument. **Verdict: not suitable as the weekly instrument. Potentially suitable as a once-a-term "proper" measure administered separately** — see §5.4.

**Strengths and Difficulties Questionnaire (SDQ)** — [sdqinfo.org](https://www.sdqinfo.org/a0.html), [CORC directory entry](https://www.corc.uk.net/outcome-measures-guidance/directory-of-outcome-measures/strengths-and-difficulties-questionnaire-sdq/). 25 items, self-report version for **11-17**, three-point response (Not true / Somewhat true / Certainly true), five subscales: emotional symptoms, conduct problems, hyperactivity/inattention, **peer relationship problems**, prosocial behaviour. Free for non-commercial clinical/educational/research use.

Relevant here for two reasons. First, it makes **peer relationships a first-class domain**, on par with emotional symptoms — a design judgement built into the most widely used child mental-health screen in the UK. Second, its own documentation is explicit that it is a **first-stage screening instrument** and not a basis for diagnosis, and its screening accuracy varies with population prevalence, so universal cut-offs are inappropriate ([systematic review of SDQ reliability/validity issues](https://www.tandfonline.com/doi/full/10.1080/26408066.2020.1788477)). That is the same caution that applies to anything you build here.

**Good Childhood Index (The Children's Society)** — [overview](https://www.childrenssociety.org.uk/information/professionals/good-childhood-index), [Good Childhood Report 2024 summary](https://www.childrenssociety.org.uk/sites/default/files/2024-08/Good%20Childhood%20Report-Summary-Report.pdf). Designed *with* children, for ages 10-17. Ten single-item domain measures of "happiness with…" plus a multi-item overall life satisfaction measure. The ten domains:

> **family · friends · home · health · time use · money and things · the future · choice · appearance · school**

This is the most directly transferable artefact in this report, because it is a **domain map chosen by young people**, in the UK, in single-item form — exactly the format your survey already uses. Score the current five against it: `mood` and `energy` sit loosely under *health*; `football_enjoyment` sits under *time use*; **`family`, `friends`, `home`, `money and things`, `the future`, `choice`, `appearance` and `school` are all uncovered.** Seven or eight of ten domains missing. Any rotating-slot pool should be drawn largely from this list.

**ONS4 personal wellbeing** — [ONS user guidance](https://www.ons.gov.uk/peoplepopulationandcommunity/wellbeing/methodologies/personalwellbeingsurveyuserguide), [CORC CYP entry](https://www.corc.uk.net/outcome-measures-guidance/directory-of-outcome-measures/office-of-national-statistics-personal-wellbeing-domain-for-children-young-people/). Four 0-10 items: life satisfaction, worthwhileness, happiness yesterday, anxiety yesterday. Two design lessons rather than items to copy: (a) the ONS **explicitly does not combine the four into a single score** — the same anti-composite lesson the 2026-09-09 report drew from the sports-science side; and (b) a *worthwhileness/purpose* item is treated as non-negotiable in the UK national standard, and has no analogue in your five.

**ONS loneliness national indicators** — [ONS guidance](https://www.ons.gov.uk/peoplepopulationandcommunity/wellbeing/methodologies/measuringlonelinessguidanceforuseofthenationalindicatorsonsurveys). Where survey space is constrained, ONS recommends the **single direct question** on its own: *"How often do you feel lonely?"* (Often/always · Some of the time · Occasionally · Hardly ever · Never). The indirect UCLA-3 set, adapted for 10-15 year olds, is: *"How often do you feel that you have no one to talk to?"*, *"How often do you feel left out?"*, *"How often do you feel alone?"*

Note the tension: a single direct loneliness item has good retest properties (r ≈ .74, higher than some multi-item subscales — [validity comparison, ScienceDirect 2025](https://www.sciencedirect.com/science/article/pii/S2666518225000154)) but **loneliness is stigmatised and is under-reported when asked directly**, particularly by adolescent boys. The same literature notes that those who *do* self-report loneliness directly show the strongest associations with health outcomes — i.e. direct-question positives are high-precision, low-recall. For an academy dressing room, indirect positive framing ("how connected have you felt") is likely to recover more of the true signal than "how lonely are you".

**Anna Freud / CORC school measurement guidance** — [Measuring and monitoring CYP mental wellbeing toolkit](https://www.annafreud.org/resources/schools-and-colleges/measuring-and-monitoring-children-and-young-peoples-mental-wellbeing/), [Wellbeing Measurement for Schools modular resources](https://www.annafreud.org/resources/schools-and-colleges/wellbeing-measurement-framework-for-schools/), with a dedicated college/sixth-form strand. The framing worth stealing: a good school instrument pairs a wellbeing measure with **protective-factor measures — support at school, at home, and in the community** — rather than measuring distress alone. Your five items measure distress-adjacent states and zero protective factors.

### 3.2 Why clinical scales do not belong in a weekly non-clinical check-in

- **Base rates destroy precision.** PHQ-9 > 10 in adolescents: sensitivity ~89.5%, specificity ~77.5%, **PPV ~15.2%** ([Manhattan Institute review of the school-screening evidence](https://manhattan.institute/article/universal-mental-health-screening-in-schools-a-critical-assessment)). GAD-7 ≥ 9: ~73% sensitivity, ~70% specificity ([PMC8794093](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8794093/)). Both are characterised in that validation literature as having low specificity and being appropriate **only as first-stage screens with a later comprehensive assessment**.
- **Screening without follow-up capacity is the failure mode, not the screen itself.** Ethical safeguards described for school screening programmes assume adolescent assent, parental consent, an established suicide-risk management protocol, and a **follow-up clinical interview that distinguishes transient stress from disorder**. The SHIELD trial exists precisely because universal-vs-targeted screening in high schools is an open question ([NCBI Bookshelf, SHIELD](https://www.ncbi.nlm.nih.gov/books/NBK616004/)).
- **Repetition is the specific problem.** A screen designed for a 2-week recall administered once is not the same instrument when fired weekly at the same 66 students. Repeated suicidal-ideation screening has been studied specifically for iatrogenic effect and did not show one ([staggered sequential study, *J Affect Disord*](https://www.sciencedirect.com/science/article/abs/pii/S0165032717322012)) — but the *operational* cost of weekly clinical-threshold positives on a college with no attached clinician is not addressed anywhere in that literature, and is the binding constraint here.

**Practical conclusion:** if a clinical instrument is wanted, it belongs at **stage two** — administered by the DSL or a pastoral lead in a conversation triggered by a check-in flag — not as check-in items. That also keeps the weekly instrument free of the special-category-data escalation the ICO cautions against.

### 3.3 Youth-sport wellness questionnaires — what they track that you don't

**Hooper & Mackinnon index** — the field standard. Four items: **sleep, stress, fatigue, muscle soreness**, 1-7, with consistent negative polarity throughout (1 = very good, 7 = very bad). Applied widely in football, including alongside HRV in professional soccer for match-fatigue time-course ([Frontiers in Physiology / PMC6390199](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6390199/)); [Barça Innovation Hub's practitioner overview](https://barcainnovationhub.com/the-use-of-wellness-questionnaires-in-football/) describes the same four-to-five parameter set (sleep quality, fatigue, muscle soreness, stress, mood) as the default in football. **Muscle soreness is the one canonical item you are missing.**

**Single-item measures in team sport — systematic review** ([PMC7534939](https://pmc.ncbi.nlm.nih.gov/articles/PMC7534939/)). 21 studies, ~500 athletes. Frequency of use: soreness 20, fatigue 20, sleep quality 19, stress 14, mood 6. Questionnaires ranged **3 to 8 items**; 5-, 7- or 10-point Likert. Two findings that constrain your design directly:

1. *"Selectively combining scales or items from multiple empirical measures negates their established psychometric properties."* — i.e. lifting two items from SWEMWBS and one from the Good Childhood Index does **not** inherit their validation. Any custom set is a custom set, and should be described honestly as one.
2. Associations with training load were heterogeneous, "from no association to a very large association", and predominantly trivial-to-moderate in the largest-sample studies. Single items are best justified as **communication facilitation and information disclosure** — a structured way to get a student to say something — rather than as measurement.

**Modified 7-item wellness questionnaire, elite athletes, 5-point scale** ([Frontiers in Sports and Active Living, PMC13529514](https://pmc.ncbi.nlm.nih.gov/articles/PMC13529514/)). Items: sleep quality, physical recovery, mental recovery, upper-body fatigue, lower-body fatigue, mental fatigue, stress. **ICC(2,1) 0.04-0.35 per item; SEM 0.59-0.61; MDC₉₅ 1.64-1.69 on a 5-point scale.** The authors' own words: large MDC values mean small day-to-day changes "should be interpreted cautiously at the individual level", and they concede the deliberate brevity raises "construct coverage" concerns. This cuts both ways for this report and I am flagging it as such: it is simultaneously the best argument that **more coverage is needed** and the best argument that **each individual item is too noisy to hang an alert on**.

**LEAM-Q (low energy availability in male athletes)** ([PMC9101736](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9101736/)). Built from clinical markers of low energy availability in male athletes: dizziness, thermoregulation, gastrointestinal symptoms, injury, illness, wellbeing, recovery, sleep and sex drive. Directly relevant because adolescent athletes reach low energy availability **without** disordered eating or compulsive exercise — i.e. by unintentional underfuelling ([PMC12401541](https://pmc.ncbi.nlm.nih.gov/articles/PMC12401541/)). A 16-18 year old who is training hard and eating badly is not a mental-health case; he is a nutrition case that shows up as fatigue and low mood in your survey with no way to tell the two apart. A single appetite/eating item disambiguates. Note also that eating-disorder screening tools have limited validation in young athletes specifically ([scoping review, IJSPT](https://ijspt.scholasticahq.com/article/126965-examination-of-the-clinical-utility-of-eating-disorder-and-disordered-eating-screening-tools-in-young-athletes-a-scoping-review)) — which argues for a plain "how well have you been eating" item rather than a clipped ED screen.

**Sleep quality vs quantity** — your item asks "How well did you sleep?", which is **quality**. That is the better choice on the evidence: athletes with higher sleep quality were less likely to suffer injury/illness with a stronger protective effect than duration, and poor sleep quality carried an OR ≈ 3.98 for sleep-deficit risk in soccer players across age groups ([PMC12513668](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12513668/); see also [Sleep: A Game Changer for Youth Athlete Wellbeing](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12237935/) and [sleep quantity/quality and academic + wellness outcomes in youth athletes](https://www.sciencedirect.com/science/article/pii/S2211266926000058)). **Keep it as quality. Do not split it into two items.**

**Motivation to train / enjoyment as a burnout precursor** — high-risk characteristics for burnout in talent-development settings include **high subjective stress outside of sport** and **lack of sleep**, alongside training environment factors ([Frontiers in Sports and Active Living 2023](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2023.1190453/full)); the Athlete Burnout Questionnaire's three dimensions (exhaustion, reduced accomplishment, sport devaluation) are validated in youth athletes ([ABQ youth validation](https://www.researchgate.net/publication/229431443_Validation_of_the_Athlete_Burnout_Questionnaire_with_youth_athletes)). Two things follow: your `football_enjoyment` item is a reasonable one-item proxy for **sport devaluation** and is worth keeping; and "stress outside of sport" is an explicitly named risk factor that your instrument has no way to see.

### 3.4 Domains the academy + college population specifically needs

- **Loneliness, belonging, homesickness.** Migrant and relocated professional footballers describe loneliness and absent belonging as the central experience, with teammates as the only substitute for family and close friends ([ScienceDirect 2023](https://www.sciencedirect.com/science/article/pii/S2666518223000293)). The worldwide youth-to-senior transition survey names **social isolation, loneliness, non-selection and lack of playing time** as barriers to progression ([*International Journal of Sports Science & Coaching*, 2024](https://journals.sagepub.com/doi/10.1177/17479541221135626)). A systematic review of educational transitions and loneliness confirms transition points as elevated-risk windows generally ([*Journal of Youth Studies* 2024](https://www.tandfonline.com/doi/full/10.1080/02673843.2024.2373278)). Lower-quality but directionally consistent: a homesickness study of elite footballers reports sleep disturbance ~76%, loneliness ~73%, social withdrawal ~71% and self-doubt ~68% among relocated players ([academia.edu — treat as indicative, not peer-reviewed evidence](https://www.academia.edu/88622540/The_Impact_of_Homesickness_on_Elite_Footballers)).
- **Deselection and injury fear.** 26% of professional players experience anxiety and/or depression during their career, rising to ~35% in retirement; released academy players show elevated anxiety, fear, depression, anger and loss of self-worth ([Wilkinson, *Counselling and Psychotherapy Research* 2021](https://onlinelibrary.wiley.com/doi/full/10.1002/capr.12417)). The PFA's 2024 wellbeing survey found **68% of players said fear of injury negatively affected their mental wellbeing** — the most prevalent football-related issue ([PFA](https://www.thepfa.com/news/2024/10/10/world-mental-health-day-2024)). Also documented: players **mask injuries** to protect their position ([Exploring the mental health and wellbeing of professional academy footballers in England, *Soccer & Society* 2021](https://www.tandfonline.com/doi/full/10.1080/14660970.2021.1952693)). That last point is a direct warning about `football_enjoyment` and any soreness item: both are answered in the shadow of selection.
- **Dual-career academic load.** Four distinct adolescent-footballer stress profiles — balance adaptation, academic overload, athletic core stress, dual-track impairment ([PMC13002566](https://pmc.ncbi.nlm.nih.gov/articles/PMC13002566/)). A scoping review across 25 studies, 3,000+ student-athletes, 23 countries, 88.5% European, finds recurring barriers of inflexible educational programmes, insufficient financial aid and limited facility access, with **social support and mentorship the key protective mechanism against isolation** ([Frontiers in Sports and Active Living 2025](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2025.1566208/full)). One generic `stress` item cannot separate any of these four profiles.
- **Home circumstances and material need.** #beeWell (~100,000 young people, Greater Manchester) reports **one in ten young people saying food didn't last in their home**, published alongside the headline wellbeing figures rather than buried ([University of Manchester](https://www.manchester.ac.uk/about/news/beewell-survey-highlights-wellbeing-priorities/)); food insecurity's association with wellbeing in a large English CYP sample is documented in [JCPP Advances / PMC13260701](https://pmc.ncbi.nlm.nih.gov/articles/PMC13260701/). "Money and things" and "home" are two of the Good Childhood Index's ten domains for the same reason.
- **School/peer connectedness as a protective factor**, not just distress as a risk factor. School connectedness at 11 predicted fewer internalising and externalising problems at 14 in children with adversity histories ([*Development and Psychopathology*](https://pubmed.ncbi.nlm.nih.gov/39506487/)); school, family and peer connectedness are jointly protective against depression and suicide risk in adolescents ([Frontiers in Psychology 2025](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1547759/full)).

### 3.5 Self-harm / risk items — the evidence on both sides

**For asking directly:**
- Gould et al., randomised controlled trial of youth suicide screening in schools: adolescents asked about suicidal ideation were **not** more likely to report ideation at follow-up; high-risk subgroups (higher depression, prior attempt) reported **lower** distress after being asked ([*JAMA* 2005](https://pubmed.ncbi.nlm.nih.gov/15811983/)).
- DeCou & Schumann meta-analysis, 13 studies: no significant iatrogenic effect of assessing suicidality ([*Suicide and Life-Threatening Behavior* 2018](https://onlinelibrary.wiley.com/doi/abs/10.1111/sltb.12368)); corroborated by [Blades et al., *Clinical Psychology Review* 2018](https://www.sciencedirect.com/science/article/abs/pii/S0272735818301351).
- Repeated screening specifically: no iatrogenic escalation found ([*J Affect Disord*](https://www.sciencedirect.com/science/article/abs/pii/S0165032717322012)).

**Against putting it in *this* survey, in *this* form:**
- The largest UK school survey that does ask (OxWell, years 8-13) does it under conditions this app cannot currently meet: **gateway questions** that only open follow-ups when the pupil indicates experience; **no names, addresses or dates of birth collected**, explicitly to encourage honest answering on self-harm and abuse; Childline signposting at the end; and school safeguarding leads notified of **aggregate counts weeks later**, with immediate-danger responses escalated only at year-group granularity ([OxWell parent FAQs](https://www.psych.ox.ac.uk/research/schoolmentalhealth/faqs), [OxWell parents/carers](https://oxwell.org/parents-carers/), [school experiences and self-harm findings, *JCPP Advances* 2026](https://acamh.onlinelibrary.wiley.com/doi/10.1002/jcv2.70025)). Your survey is **identified**, and its current response to a flag is an immediate push to every member of staff.
- Asking is safe *when a competent response follows*. The 2026-09-09 report established that a wellbeing flag today produces no case record, no owner, and no acknowledgement. Adding a self-harm item to that pipeline is the one change in this document that could plausibly make a student worse off.

**My read, offered as input not decision:** a *routine weekly Likert self-harm item* is the wrong instrument. A **persistent, always-available, non-scored disclosure route** ("I need to talk to someone" — a button, not a question, present whether or not a survey is open) plus staff training plus the free-text box actually being read, achieves the disclosure goal without the weekly false-positive load. If Paul wants a direct risk question, the defensible form is an **infrequent (termly), gateway-designed, supported administration** with a named responder and a same-day SLA. See §7.

### 3.6 Survey length, satisficing and rotating designs

- **Satisficing is real, measurable, and worse in younger respondents.** Straightlining — giving the same answer down a column of same-scale items — is more common among younger respondents, attributed to survey fatigue, shortcut-taking and impatience with long or repetitive instruments ([LifeOnSoMe straightlining study, *Scientific Reports* 2025](https://www.nature.com/articles/s41598-025-14276-6)); unmotivated responding measurably degrades data quality in student samples ([Vriesema & Gehlbach, *Educational Researcher* 2021](https://journals.sagepub.com/doi/pdf/10.3102/0013189X211040054)). Respondent fatigue produces skipped questions, unread response options and increased "don't know" selection ([*Encyclopedia of Survey Research Methods*](https://methods.sagepub.com/reference/encyclopedia-of-survey-research-methods/n480.xml)).
- **Where the cliff is.** Satisficing rises noticeably after the **15-20 minute** mark in general survey research, and straightlining in student samples rises again in the **final intervals** of a long instrument. Shortening a survey cut drop-off from 65.7% to 20.2% in one trial ([PMC2891795](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2891795/)). **Important caveat for this report: none of that literature is about a 5-item, 60-second, weekly mobile check-in.** A 5→7 item change is nowhere near the documented fatigue cliff. The honest statement is that the length literature does **not** forbid going to 7 items; the sports-science implementation literature (the "too extensive" complaint, and compliance decay) is the tighter constraint, and it puts the practical ceiling at **7-8 items / under two minutes** ([single-item review: 3-8 items](https://pmc.ncbi.nlm.nih.gov/articles/PMC7534939/); practitioner guidance converges on 1-5 ratings in under a minute — [SimpliFaster](https://simplifaster.com/articles/athlete-wellness-questionnaires-dos-donts/), [Global Performance Insights](https://www.globalperformanceinsights.com/post/wellness-questionnaires-for-athlete-monitoring)).
- **Rotating items are a real, validated technique, not a cop-out.** Planned missing data designs (PMDD) / matrix sampling deliberately give each respondent a subset of items. The **three-form design** is the best-studied: simulation work shows it "efficiently collects high quality data while reducing participant burden", producing **unbiased parameter estimates with slightly higher standard errors** ([three-form PMDD, *Psychology of Sport and Exercise* / ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1469029219306193); [item-allocation procedure, PMC7327835](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7327835/)). In experience-sampling specifically — the closest analogue to a repeated weekly check-in — Monte Carlo work found the payoff is exactly "space: fewer items can be asked at each beep", with **anchor**, **matrix** and **random** allocation variants ([*Behavior Research Methods* 2014](https://link.springer.com/article/10.3758/s13428-013-0353-y)).
  **The critical limitation, stated plainly:** rotating an item means each student answers it roughly once every N weeks. That is enough for **cohort-level coverage and conversation-starting**; it is **not** enough to build an individual rolling baseline for that domain. Anything you want to trend per-student must live in the fixed core.

---

## 4. Domain gap analysis

Legend — **Covered:** ✅ fully · 🟡 partial/indirect · ❌ not at all.

| Domain | Covered now? | Evidence it matters for *this* population | Recommended action |
|---|---|---|---|
| **Affect / mood** | ✅ `mood` | Core of every instrument; Hooper *mood*; 6/21 single-item studies | **Keep unchanged.** |
| **Sleep quality** | ✅ `sleep` | 19/21 single-item studies; quality outperforms duration for injury/illness risk (OR ≈ 3.98 for sleep-deficit risk) | **Keep unchanged. Do not add a duration item.** |
| **Fatigue / energy** | ✅ `energy` | 20/21 single-item studies; Hooper *fatigue* | **Keep unchanged.** |
| **Perceived stress (level)** | 🟡 `stress` | 14/21 studies; Hooper *stress* — but reverse-worded and mishandled in code | **Keep the construct, fix the polarity** (2026-09-09 Tier 0 item 1). Reword to positive framing so all items share a direction. |
| **Stress *source* / context** | ❌ | Four distinct dual-career stress profiles in adolescent footballers; "high subjective stress outside of sport" is a named burnout risk factor; a bare `2` is unroutable | **ADD — highest priority.** One-tap chip picker, not a Likert item. ~5 seconds. |
| **Social connection / loneliness** | ❌ | Loneliness + absent belonging central to relocated/migrant player experience; connectedness among the best-evidenced protective factors; SDQ has a whole peer subscale; GCI has *friends* | **ADD to the fixed core.** Positive-indirect framing to dodge loneliness stigma. |
| **Belonging / feeling settled** | ❌ | Homesickness and adjustment dominate the 16-18 academy transition; educational transitions are elevated-risk windows | **ADD to rotating pool.** Overlaps connection; not worth two fixed items. |
| **Home / family circumstances** | ❌ | GCI *family* + *home*; young carers; food insecurity | **ADD to rotating pool.** Sensitive — see §6.3 on data minimisation. |
| **Academic / coursework load** | ❌ | Academic overload is one of four dual-career profiles; inflexible education named as top barrier across 25 studies | **ADD to rotating pool.** Partly served by the context router in the interim. |
| **Muscle soreness** | ❌ | **20/21 single-item studies — the most-used item in the field, and the one canonical gap** | **ADD to rotating pool** (or a training-day-only item). Deliberately *not* fixed-core — see note below. |
| **Appetite / eating** | ❌ | Adolescent athletes reach low energy availability by unintentional underfuelling, without disordered eating; LEAM-Q domain | **ADD to rotating pool.** Plain wording, not a clipped ED screen. |
| **Money / material need** | ❌ | GCI *money and things*; #beeWell: 1 in 10 report food not lasting at home; dual-career reviews name insufficient financial aid | **ADD to rotating pool.** |
| **Sport enjoyment / devaluation** | ✅ `football_enjoyment` | ABQ *sport devaluation*; buy-in value of a football-relevant item | **Keep.** Note it is answered in the shadow of selection. |
| **Injury fear / physical confidence** | ❌ | 68% of PFA respondents: fear of injury harms wellbeing — the top football-related issue; academy players mask injuries | **Rotating pool candidate**, low priority — partly caught by the router's "Health / injury" chip. |
| **Purpose / worthwhileness** | ❌ | ONS4 treats it as non-negotiable; SWEMWBS eudaimonic items | **Rotating pool candidate**, low priority. |
| **Self-harm / safety** | ❌ | Asking is not iatrogenic (Gould; DeCou & Schumann) — but identified weekly asking with an all-staff push response is not what that evidence licenses | **DO NOT add as a scored weekly item.** Surface as a policy decision (§7 Q1) + always-on disclosure route. |
| **Free-text "anything else"** | 🟡 collected, never displayed | Highest-signal field in the survey; also an ICO minimisation failure to collect and not use | **Restructure**: one conditional end-of-survey box instead of five per-question boxes, and actually render it (2026-09-09 Tier 0 item 2). |
| **Protective factors / support** | ❌ | Anna Freud framing: pair wellbeing with support at school, home, community; mentorship the key dual-career protective mechanism | Partly addressed by the connection item; full coverage belongs to the support-chooser already proposed as 2026-09-09 item 9. |

**Why muscle soreness is rotating, not fixed, despite being the field's most-used item.** It is the most-used item in *training-load monitoring*, where the consumer is a sports scientist adjusting tomorrow's session. That is a different product from a safeguarding-adjacent pastoral check-in, and it is answered under selection pressure by players who are documented to mask injuries. Putting it in the fixed core also invites a fifth flag-eligible item that generates load-management noise into a pastoral queue. If the S&C side wants daily soreness, that is a separate, non-safeguarding instrument with a different audience — which would also be the correct answer to the access-control problem in §3.3 of the 2026-09-09 report.

---

## 5. Concrete proposal

### 5.1 Recommended: 6 fixed + 1 rotating + 1 router + 1 conditional free-text

**Fixed core — asked every week, flag-eligible, trendable per student.**

```ts
export const SURVEY_QUESTIONS = [
  { key: 'mood',               label: 'How is your mood today?',                          emoji: '😊' },  // unchanged
  { key: 'sleep',              label: 'How well did you sleep?',                          emoji: '😴' },  // unchanged
  { key: 'energy',             label: 'How are your energy levels?',                      emoji: '⚡' },  // unchanged
  { key: 'calm',               label: 'How calm have you felt?',                          emoji: '😌' },  // REPLACES `stress`
  { key: 'connection',         label: 'How connected have you felt to people around you?', emoji: '🤝' }, // NEW
  { key: 'football_enjoyment', label: 'How much did you enjoy football?',                 emoji: '⚽' },  // unchanged
]
```

Per-item 1-5 labels (replacing the single shared `GENERIC_SCORE_LABELS` array — the 2026-09-09 report already requires per-item labels for the polarity fix):

| Key | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| `mood` | Very low | Low | Okay | Good | Great |
| `sleep` | Very badly | Badly | Okay | Well | Really well |
| `energy` | Running on empty | Low | Okay | Good | Full of it |
| `calm` | Not at all | A little | Fairly | Very | Completely |
| `connection` | Not at all | A little | Fairly | Very | Completely |
| `football_enjoyment` | Not at all | A little | It was alright | A lot | Loved it |

**Rotating slot — one item per week, drawn from a pool, same 1-5 scale.**

```ts
export const ROTATING_QUESTIONS = [
  { key: 'body',       label: 'How does your body feel?',                                  emoji: '🦵' },
  { key: 'coursework', label: 'How on top of your college work do you feel?',              emoji: '📚' },
  { key: 'home',       label: 'How are things at home?',                                   emoji: '🏠' },
  { key: 'eating',     label: 'How well have you been eating?',                            emoji: '🍽️' },
  { key: 'settled',    label: 'How settled do you feel where you are living?',             emoji: '🛏️' },
  { key: 'essentials', label: 'Have you had what you need this week — food, kit, travel?', emoji: '🎒' },
]
```

Rotating-slot 1-5 labels:

| Key | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| `body` | Really sore | Sore | Okay | Good | Fresh |
| `coursework` | Not at all | A little | Fairly | Very | Completely |
| `home` | Really tough | Tough | Okay | Good | Really good |
| `eating` | Very badly | Badly | Okay | Well | Really well |
| `settled` | Not at all | A little | Fairly | Very | Completely |
| `essentials` | Not at all | Mostly not | Some of it | Mostly | Everything I needed |

Rotation rule: cycle the pool in fixed order across weeks so every student sees each domain roughly every six weeks and the cohort is on the same item each week (an **anchor design** — fixed core for everyone, one shared rotating item — which is simpler than three-form matrix allocation and keeps week-to-week cohort comparisons clean).

**Context router — one screen, no score, one or two taps.**

> **What's been on your mind most this week?** *(pick up to two — or skip)*
> `⚽ Football` · `📚 College work` · `🏠 Home` · `👥 Friends` · `💷 Money` · `🩹 Health or injury` · `🤔 Something else` · `🙂 Nothing much`

Not scored, not averaged, never flag-eligible on its own. Its job is to make a low score **routable** — coursework goes to a tutor, home goes to the DSL, health goes to the physio — which is the precondition for the two-tier routing already proposed as 2026-09-09 item 12.

**Conditional free-text — replaces the five per-question boxes.**

Shown once, at the end, if any score ≤ 2 **or** the router is anything other than "Nothing much":

> **Anything you want to tell us about that?** *(optional)*
> A real person reads this. If you'd rather talk to someone, tap here instead.

This is a **net reduction** in visible fields (five boxes → one), and it raises the odds the text is read, because it arrives as one item on the flag rather than five scattered per-question notes. It also fixes the "we collect it and never look at it" ICO problem the 2026-09-09 report raised.

### 5.2 What changes vs today

| | Today | Proposed |
|---|---|---|
| Scored items | 5 | 6 fixed + 1 rotating = **7 max in any week** |
| Flag-eligible items | 2 (`mood`, `stress`) | 3 (`mood`, `calm`, `connection`) + free-text — **new items observation-only for one term**, see §6.2 |
| Reverse-worded items | 1 (`stress`, mishandled) | **0** — `calm` restores a single consistent direction |
| Free-text fields shown | 5 (one per question, never read) | **1**, conditional, and rendered to staff |
| Context / attribution | none | one-tap router, ≤2 selections |
| Domains touched (Good Childhood Index terms) | ~2 of 10 | ~7 of 10 across the rotation |
| Estimated completion time | ~60 s | **~85-95 s** (see below) |
| Header copy | "Takes about 60 seconds" | **"Takes about 90 seconds"** — must change, or the app lies to students in the first line it shows them |

**Time estimate, stated as an estimate.** At the current one-question-per-screen pace, a scored item costs roughly 8-12 seconds (read → tap → tap Next). Two added scored items ≈ +16-24 s. The router ≈ 5-8 s. The conditional free-text is skipped by most students in most weeks and costs 0 s when not shown, ~20-40 s when engaged with — and that engagement is the point, not a cost. So: **~85-95 seconds typical, ~2 minutes for a student who writes something.** That is at the practitioner ceiling ("under two minutes", 1-5 ratings) and inside the 3-8 item range the single-item review found across 21 studies — but it is not comfortably inside either, and that is a real cost, not a rounding error. **These numbers are inferred from the existing UI, not measured. Time three students on the current build before committing.**

### 5.3 Minimum viable alternative — if the 60-second promise is non-negotiable

If Paul wants to hold the current length, the two highest value-per-second changes are both **near-free in student time**:

1. **The context router** (~5-8 s) — converts every existing low score from uninterpretable to routable. Highest single return in this document.
2. **The conditional free-text consolidation** (net −4 visible fields) — *reduces* the form while making the highest-signal field usable.

Do those two, fix `stress` polarity, add nothing else, and the survey stays at ~65-70 seconds while gaining most of the practical value. This is a genuinely defensible endpoint, not a consolation prize. It leaves social connection uncovered, which is the one thing I would push back on — but "router + free-text now, connection item next term" is a sound sequencing decision.

### 5.4 What to do with the validated instruments

Do not put them in the weekly loop. Two viable homes:

- **SWEMWBS once a term** (7 items, ~2 minutes, 2-week recall), administered as a separate one-off, licensed under Warwick's non-commercial tier, to give a benchmarkable cohort figure the college can report and compare against national data. This is what the Anna Freud/CORC school guidance is designed around.
- **PHQ-A / GAD-7 as stage two only** — administered by a named pastoral lead in a conversation after a flag, never self-serve in the app, never weekly.

---

## 6. The case against adding anything

This section is deliberately adversarial to §5. If any of it lands harder than the arguments above, the right answer is §5.3 or nothing.

### 6.1 The measurement argument: more items on a noisy instrument mostly buys noise

MDC₉₅ on a 5-point wellness item is **1.64-1.69** and per-item ICC ran **0.04-0.35** in the closest published analogue ([PMC13529514](https://pmc.ncbi.nlm.nih.gov/articles/PMC13529514/)). That means a single-week move from 4 to 3 on any item is within measurement error. Every item you add is another independent chance for noise to cross a threshold. If ~5-8% of item-weeks land at ≤2 by noise alone, going from 2 flag-eligible items to 7 flag-eligible items roughly triples the spurious-alert rate on a cohort of 66 students — and the 2026-09-09 report already established that alert acceptance falls ~30% per additional alert per encounter. **More questions, on the current alert design, is a straightforwardly negative-value change.** §6.2 is the mitigation.

### 6.2 The mitigation, stated as a hard condition

**New items must not be flag-eligible on a single low score.** Run them observation-only for a full term. Only `mood`, `calm` and the free-text should trigger anything in the first term; `connection` joins the flag set only after there is enough data to baseline it, and rotating items should **never** be single-score flag-eligible, because a once-in-six-weeks item has no baseline and cannot be trended. Rotating items feed the DSL's chronology and the cohort picture; they do not fire pushes. If this condition is not accepted, do not add the items.

### 6.3 The regulatory argument

`home`, `essentials`, `eating` and `settled` are more sensitive than mood. They are special-category-adjacent data about children, and the ICO's position is blunt: *if you can achieve your aim without special category data, don't collect it.* Children's Code Standard 8 (data minimisation) and Standard 13 (nudge techniques — no design that "leads or encourages children to give unnecessary personal data") both bear on a rotating pool whose whole purpose is to widen collection. The counter-argument is that these are exactly the domains a college has a safeguarding duty to know about and #beeWell publishes precisely because the headline wellbeing number hides them — but that argument only holds **if the data changes what someone does.** It cannot be justified as "nice to have in the chart".

Also: a DPIA covers this. The 2026-09-09 report already flagged that none exists. Adding home/money/eating items without one is the wrong order of operations.

### 6.4 The sequencing argument — the strongest one

Everything in §5 assumes the answers get used. Today:

- the `stress` item's polarity is broken, so one of the two flag-eligible items is either inverted or backwards;
- the free-text note is written to the database and shown to no human;
- a flag creates no record, has no owner and no closure;
- it broadcasts to every admin, coach and teacher;
- an unrelated open attendance case silently suppresses the wellbeing suggestion entirely.

Adding a connection item to that pipeline produces a third broken flag. **Fix 2026-09-09 Tier 0 items 1-5 first.** Then the question changes here become worth building — and several of them (the router, the free-text consolidation) are natural companions to that work rather than separate projects.

### 6.5 The honesty argument

Half the athletes in the implementation interviews admitted withholding the truth, specifically to avoid looking unprofessional or unmotivated, with "faking good" driven by selection concerns. Academy players are documented masking injuries for exactly this reason. Every added item is another item answered under that pressure — and `body`, `eating` and `football_enjoyment` are the three most exposed to it. More questions do not produce more truth; a credible answer to "who sees this and what does it change" does. If the access-control fix (2026-09-09 item 4) and the "this will not affect selection" statement (item 14) are not shipped, **adding items measurably degrades the data you already have.**

### 6.6 Where the pro-addition case still wins

Against all of the above, three things hold:

1. **The coverage gap is genuinely large.** Seven or eight of the Good Childhood Index's ten child-chosen domains are absent. That is not a marginal shortfall.
2. **The router is not a survey item.** It adds no scored variable, no threshold, no alert surface, and costs seconds. Nothing in §6.1-6.5 argues against it. It should be built regardless of what happens to the rest.
3. **The rotating design is specifically the answer to §6.1 and §6.3.** It buys breadth without a permanent per-student burden, without a permanent alert surface, and with a smaller standing data footprint than fixed items. Planned-missing designs exist because this exact trade-off is a known, solved problem.

---

## 7. Open questions for the product owner

1. **Does a direct self-harm / safety question belong in this check-in at all?** This is a clinical and safeguarding-policy decision, and I am deliberately not making it. The evidence says asking does not increase risk ([Gould 2005](https://pubmed.ncbi.nlm.nih.gov/15811983/); [DeCou & Schumann 2018](https://onlinelibrary.wiley.com/doi/abs/10.1111/sltb.12368)). The evidence also says the UK school programme that does ask (OxWell) does so **anonymously, with gateway questions, and notifies safeguarding leads in aggregate weeks later** — none of which describes this app. Three options, in ascending order of commitment: **(a)** no direct item; rely on free-text + an always-visible "I need to talk to someone" route + staff training; **(b)** a gateway item shown only when scores are already low, with a same-day named responder; **(c)** a direct item on a termly supported administration, not weekly. **This should be decided by the DSL with the college's safeguarding policy in hand, not by the product backlog.** If the answer to "can we guarantee a named human responds the same day" is no, the answer to this question is (a).
2. **Are you willing to change the "60 seconds" line?** The recommended set is ~90 seconds. If that copy is load-bearing for completion rates, take §5.3 instead. Do not ship the longer survey under the shorter promise.
3. **How many students actually live away from home?** `settled` and `home` are premised on the relocation/homesickness literature. If almost every student is a local day student living with family, `settled` drops out of the pool and the belonging case rests entirely on `connection`. I could not determine this from the schema.
4. **Is there a sports-science consumer for soreness/load data?** If yes, that is a separate daily instrument with a coach/S&C audience and a different access model — and pulling it out of the pastoral survey resolves part of the "coaches shouldn't see raw wellbeing scores" tension. If no, `body` stays in the rotating pool as a general physical-state item.
5. **Do you want the rotating item to be the same for everyone each week, or randomised per student?** Same-for-everyone (anchor design) gives clean weekly cohort snapshots and simpler ops. Randomised gives every domain a continuous cohort read but no clean weekly comparison. Recommend same-for-everyone.
6. **Who owns the router's routing?** The router only pays off if "College work" reaches someone different from "Home". That requires the named-tutor relationship the 2026-09-09 report noted is absent from the schema (open question 4 there). Without it the router is still useful as context on the flag, but half its value is unrealised.
7. **What happens to historical `stress` data if it becomes `calm`?** Same issue the 2026-09-09 report raised for the polarity fix. Recommend a `scale_version` and treating pre-change `stress` as a separate series, not back-filling `6 - score`, since you cannot know how students were reading the item.
8. **Is the college already running SWEMWBS, the Anna Freud/CORC framework, or a #beeWell-style survey?** If so, the termly instrument in §5.4 already exists and this app should feed or align with it rather than duplicate it. (This repeats open question 9 from 2026-09-09 because it is still unanswered and it changes §5.4 entirely.)
9. **Will you commit to running new items observation-only for a term (§6.2)?** If not, do not add them — the alert-volume arithmetic in §6.1 makes the change net-negative.
10. **Has a DPIA been done?** Adding `home`, `eating` and `essentials` items materially widens the special-category footprint on children. That needs the DPIA in place first, not retrofitted.

---

## Appendix A — files referenced

```
lib/wellbeing/wellbeingUtils.ts            SURVEY_QUESTIONS, score labels, validation
app/(student)/wellbeing/page.tsx           student form; "60 seconds" copy; per-question notes
app/(admin)/admin/wellbeing/page.tsx       staff view (note never rendered)
docs/research/2026-09-09-checkin-safeguarding-research.md   prior report — thresholds, alerts, access
```

## Appendix B — primary sources

**Adolescent wellbeing instruments**
[WEMWBS/SWEMWBS (Warwick)](https://warwick.ac.uk/services/innovations/wemwbs) ·
[WEMWBS adolescent validation, England & Scotland](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3141456/) ·
[SWEMWBS Norwegian adolescents](https://pubmed.ncbi.nlm.nih.gov/29017402/) ·
[SWEMWBS Czech 15-18 IRT](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11331616/) ·
[SDQ](https://www.sdqinfo.org/a0.html) ·
[SDQ — CORC entry](https://www.corc.uk.net/outcome-measures-guidance/directory-of-outcome-measures/strengths-and-difficulties-questionnaire-sdq/) ·
[SDQ reliability/validity systematic review](https://www.tandfonline.com/doi/full/10.1080/26408066.2020.1788477) ·
[Good Childhood Index](https://www.childrenssociety.org.uk/information/professionals/good-childhood-index) ·
[Good Childhood Report 2024 summary](https://www.childrenssociety.org.uk/sites/default/files/2024-08/Good%20Childhood%20Report-Summary-Report.pdf) ·
[ONS4 user guidance](https://www.ons.gov.uk/peoplepopulationandcommunity/wellbeing/methodologies/personalwellbeingsurveyuserguide) ·
[ONS personal wellbeing for CYP (CORC)](https://www.corc.uk.net/outcome-measures-guidance/directory-of-outcome-measures/office-of-national-statistics-personal-wellbeing-domain-for-children-young-people/) ·
[ONS loneliness indicators guidance](https://www.ons.gov.uk/peoplepopulationandcommunity/wellbeing/methodologies/measuringlonelinessguidanceforuseofthenationalindicatorsonsurveys) ·
[Single-item loneliness validity](https://www.sciencedirect.com/science/article/pii/S2666518225000154) ·
[ULS-8 in adolescents](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6160081/) ·
[Anna Freud measurement toolkit](https://www.annafreud.org/resources/schools-and-colleges/measuring-and-monitoring-children-and-young-peoples-mental-wellbeing/) ·
[Wellbeing Measurement for Schools](https://www.annafreud.org/resources/schools-and-colleges/wellbeing-measurement-framework-for-schools/)

**Clinical screening in schools**
[Universal school screening — critical assessment (PHQ-9 PPV)](https://manhattan.institute/article/universal-mental-health-screening-in-schools-a-critical-assessment) ·
[PHQ-9 / GAD-7 validation in students](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8794093/) ·
[SHIELD trial — universal vs focused depression screening](https://www.ncbi.nlm.nih.gov/books/NBK616004/)

**Sport wellness questionnaires**
[Single-item measures in team sport — systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC7534939/) ·
[Hooper index + HRV in professional soccer](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6390199/) ·
[Wellness questionnaires in football (Barça Innovation Hub)](https://barcainnovationhub.com/the-use-of-wellness-questionnaires-in-football/) ·
[7-item wellness questionnaire — SEM/MDC on a 5-point scale](https://pmc.ncbi.nlm.nih.gov/articles/PMC13529514/) ·
[Well-being fluctuations in elite young soccer players](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8156560/) ·
[Intra/inter-week wellbeing variation, elite youth soccer](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8062971/) ·
[Practitioner dos and don'ts](https://simplifaster.com/articles/athlete-wellness-questionnaires-dos-donts/) ·
[Wellness questionnaires for athlete monitoring](https://www.globalperformanceinsights.com/post/wellness-questionnaires-for-athlete-monitoring)

**Sleep, fuelling, burnout**
[Sleep: a game changer for youth athlete wellbeing](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12237935/) ·
[Sleep quantity/quality and youth athlete outcomes](https://www.sciencedirect.com/science/article/pii/S2211266926000058) ·
[Poor sleep quality prevalence in soccer players](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12513668/) ·
[LEAM-Q — low energy availability in male athletes](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9101736/) ·
[Energy availability and disordered eating in adolescent athletes](https://pmc.ncbi.nlm.nih.gov/articles/PMC12401541/) ·
[ED screening tools in young athletes — scoping review](https://ijspt.scholasticahq.com/article/126965-examination-of-the-clinical-utility-of-eating-disorder-and-disordered-eating-screening-tools-in-young-athletes-a-scoping-review) ·
[Burnout and dropout in talent development](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2023.1190453/full) ·
[Athlete Burnout Questionnaire — youth validation](https://www.researchgate.net/publication/229431443_Validation_of_the_Athlete_Burnout_Questionnaire_with_youth_athletes)

**Academy / dual-career population**
[Loneliness and lack of belonging — migrant professional footballers](https://www.sciencedirect.com/science/article/pii/S2666518223000293) ·
[Youth-to-senior transition — worldwide survey](https://journals.sagepub.com/doi/10.1177/17479541221135626) ·
[Mental health of professional academy footballers in England](https://www.tandfonline.com/doi/full/10.1080/14660970.2021.1952693) ·
[Deselection and career termination — literature review](https://onlinelibrary.wiley.com/doi/full/10.1002/capr.12417) ·
[PFA wellbeing survey 2024 — injury fear](https://www.thepfa.com/news/2024/10/10/world-mental-health-day-2024) ·
[Educational transitions and loneliness — systematic review](https://www.tandfonline.com/doi/full/10.1080/02673843.2024.2373278) ·
[Dual-career stress profiles in adolescent footballers](https://pmc.ncbi.nlm.nih.gov/articles/PMC13002566/) ·
[Dual career policies — scoping review](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2025.1566208/full) ·
[Homesickness in elite footballers (indicative only, not peer-reviewed)](https://www.academia.edu/88622540/The_Impact_of_Homesickness_on_Elite_Footballers)

**Connectedness, home circumstances**
[School connectedness as protective factor](https://pubmed.ncbi.nlm.nih.gov/39506487/) ·
[School, family and peer connectedness vs depression/suicide risk](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1547759/full) ·
[#beeWell 2025 findings — food insecurity](https://www.manchester.ac.uk/about/news/beewell-survey-highlights-wellbeing-priorities/) ·
[Food insecurity and wellbeing in CYP in England](https://pmc.ncbi.nlm.nih.gov/articles/PMC13260701/)

**Self-harm / risk questions**
[Gould et al. — iatrogenic risk of youth suicide screening, RCT](https://pubmed.ncbi.nlm.nih.gov/15811983/) ·
[DeCou & Schumann meta-analysis](https://onlinelibrary.wiley.com/doi/abs/10.1111/sltb.12368) ·
[Blades et al. — benefits and risks of asking about suicide](https://www.sciencedirect.com/science/article/abs/pii/S0272735818301351) ·
[Repeated suicidal-ideation screening](https://www.sciencedirect.com/science/article/abs/pii/S0165032717322012) ·
[OxWell FAQs — gateway questions and safeguarding response](https://www.psych.ox.ac.uk/research/schoolmentalhealth/faqs) ·
[OxWell parents/carers](https://oxwell.org/parents-carers/) ·
[School experiences and self-harm, OxWell](https://acamh.onlinelibrary.wiley.com/doi/10.1002/jcv2.70025)

**Survey length, satisficing, rotating designs**
[Vriesema & Gehlbach — assessing survey satisficing](https://journals.sagepub.com/doi/pdf/10.3102/0013189X211040054) ·
[Straightlining prevalence and internal consistency](https://www.nature.com/articles/s41598-025-14276-6) ·
[Respondent fatigue — Encyclopedia of Survey Research Methods](https://methods.sagepub.com/reference/encyclopedia-of-survey-research-methods/n480.xml) ·
[Shortening a survey — drop-off effects](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2891795/) ·
[Three-form planned missing data design](https://www.sciencedirect.com/science/article/abs/pii/S1469029219306193) ·
[Planned missing designs in experience sampling](https://link.springer.com/article/10.3758/s13428-013-0353-y) ·
[Item allocation for three-form designs](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7327835/)
