'use strict';
const pptxgen = require('pptxgenjs');

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10" x 5.625"
pres.title = 'Tranmere Tracker — Academy Management Platform';
pres.author = 'Tranmere Rovers FC';

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  navyDk: '0F1E3D',
  navy:   '1E3A6E',
  gold:   'C9A027',
  white:  'FFFFFF',
  offWht: 'F4F6FA',
  slate:  '64748B',
  dark:   '1A2B4A',
  border: 'E2E8F0',
  cardBg: '162A52',
  cardBd: '243A6E',
  subTxt: 'A8BBDB',
  mutedB: '8FADD4',
};

const CREST = 'https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png';

const mkShadow = () => ({ type: 'outer', color: '000000', blur: 8, offset: 3, angle: 135, opacity: 0.12 });

// ── Shared header builder ─────────────────────────────────────────────────────
function addHeader(s, title, sub) {
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.navy }, line: { color: C.navy } });
  s.addImage({ path: CREST, x: 0.25, y: 0.1, w: 0.75, h: 0.75 });
  s.addText(title, { x: 1.2, y: 0.08, w: 8.5, h: 0.48, fontSize: 18, fontFace: 'Arial Black', color: C.white, bold: true, align: 'left', margin: 0 });
  s.addText(sub, { x: 1.2, y: 0.57, w: 8.5, h: 0.35, fontSize: 11, fontFace: 'Arial', color: C.subTxt, align: 'left', margin: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navyDk };

  // Top & bottom gold bars
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0,     w: 10, h: 0.06, fill: { color: C.gold }, line: { color: C.gold } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.565, w: 10, h: 0.06, fill: { color: C.gold }, line: { color: C.gold } });

  // Crest (left)
  s.addImage({ path: CREST, x: 0.9, y: 1.0, w: 2.0, h: 2.0 });

  // Title text (right of crest)
  s.addText('TRANMERE TRACKER', {
    x: 3.3, y: 1.0, w: 6.3, h: 0.9,
    fontSize: 36, fontFace: 'Arial Black', color: C.white, bold: true, align: 'left', margin: 0,
  });

  // Gold divider line
  s.addShape(pres.shapes.RECTANGLE, { x: 3.3, y: 1.98, w: 5.5, h: 0.05, fill: { color: C.gold }, line: { color: C.gold } });

  s.addText('Academy Management Platform', {
    x: 3.3, y: 2.1, w: 6.3, h: 0.55,
    fontSize: 18, fontFace: 'Arial', color: C.subTxt, italic: true, align: 'left', margin: 0,
  });

  s.addText('Student Tracking  ·  AI Coaching  ·  GPS Analytics  ·  BTEC Management', {
    x: 3.3, y: 2.75, w: 6.3, h: 0.4,
    fontSize: 11, fontFace: 'Arial', color: '4A6A9A', align: 'left', margin: 0,
  });

  s.addText('Tranmere Rovers FC  ·  2025 Platform Overview', {
    x: 3.3, y: 5.1, w: 6.3, h: 0.3,
    fontSize: 9, fontFace: 'Arial', color: '4A6A9A', align: 'left', margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Platform Overview
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.offWht };
  addHeader(s, 'PLATFORM OVERVIEW', 'One platform. Complete academy management for players, coaches, and teachers.');

  // 4 stat boxes
  const stats = [
    { val: '3',    lbl: 'User Roles',     sub: 'Students · Coaches · Teachers', col: C.navy },
    { val: '7',    lbl: 'AI Features',    sub: 'Powered by Claude AI',           col: '0D7A5F' },
    { val: '14+',  lbl: 'Admin Modules',  sub: 'Full academy toolset',           col: '1D4ED8' },
    { val: '100%', lbl: 'Mobile Ready',   sub: 'PWA + Push Notifications',       col: '7C3AED' },
  ];

  stats.forEach((st, i) => {
    const bx = 0.3 + i * 2.35;
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: 1.15, w: 2.2, h: 1.5, fill: { color: C.white }, line: { color: C.border }, shadow: mkShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: 1.15, w: 2.2, h: 0.06, fill: { color: st.col }, line: { color: st.col } });
    s.addText(st.val,  { x: bx, y: 1.25, w: 2.2, h: 0.7, fontSize: 34, fontFace: 'Arial Black', color: st.col, bold: true, align: 'center', margin: 0 });
    s.addText(st.lbl,  { x: bx, y: 1.95, w: 2.2, h: 0.3, fontSize: 11, fontFace: 'Arial', color: C.dark, bold: true, align: 'center', margin: 0 });
    s.addText(st.sub,  { x: bx, y: 2.25, w: 2.2, h: 0.28, fontSize: 8.5, fontFace: 'Arial', color: C.slate, align: 'center', margin: 0 });
  });

  // Description block
  s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 2.85, w: 9.4, h: 2.55, fill: { color: C.white }, line: { color: C.border }, shadow: mkShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 2.85, w: 0.06, h: 2.55, fill: { color: C.gold }, line: { color: C.gold } });

  s.addText('What is Tranmere Tracker?', { x: 0.55, y: 2.95, w: 9.0, h: 0.38, fontSize: 13, fontFace: 'Arial', color: C.dark, bold: true, margin: 0 });
  s.addText(
    'Tranmere Tracker is a full-stack academy management platform built specifically for Tranmere Rovers FC. ' +
    'It connects students (players), coaches, and administrators in a single mobile-first progressive web app — ' +
    'accessible on any device, from any location.\n\n' +
    'Every feature is designed around real academy workflow: managing match squads and tracking GPS performance, ' +
    'grading BTEC coursework, running broadcast communications, and delivering personalised AI coaching — all in one place.',
    { x: 0.55, y: 3.38, w: 9.0, h: 1.85, fontSize: 11, fontFace: 'Arial', color: C.slate, margin: 0 }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Student App
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.offWht };
  addHeader(s, 'STUDENT APP', 'Everything a player needs — available on mobile, every day.');

  const features = [
    {
      title: 'Dashboard',
      icon: '🏠',
      desc: 'Personalised home screen showing upcoming matches, deadlines, calorie count, last training session, and quick-access links to training, nutrition, and GPS.',
    },
    {
      title: 'Match Invitations',
      icon: '⚽',
      desc: 'Players receive squad call-ups, accept or decline, and view upcoming fixtures with date, opponent, and venue. Status updates sync live.',
    },
    {
      title: 'Training Log',
      icon: '🏋',
      desc: 'Log sessions with type (gym, pitch, recovery), date, duration, and notes. Build a personal fitness history with full session history view.',
    },
    {
      title: 'Nutrition Tracker',
      icon: '🥗',
      desc: 'Daily calorie and meal logging. AI-powered photo analysis — photograph a meal and Claude estimates nutritional content automatically.',
    },
    {
      title: 'My GPS',
      icon: '📡',
      desc: 'View personal GPS performance metrics — top speed, total distance, sprint count. Session trends visualised over time.',
    },
    {
      title: 'Profile & Chat',
      icon: '💬',
      desc: 'Personal profile with avatar, course info, and role. Full messaging system: direct messages, squad channels, and the AI Coach bot.',
    },
  ];

  features.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx  = 0.25 + col * 3.2;
    const by  = 1.15 + row * 2.15;

    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: by, w: 3.0, h: 1.95, fill: { color: C.white }, line: { color: C.border }, shadow: mkShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: by, w: 3.0, h: 0.06, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText(f.icon + '  ' + f.title, { x: bx + 0.15, y: by + 0.1, w: 2.7, h: 0.36, fontSize: 12, fontFace: 'Arial', color: C.dark, bold: true, margin: 0 });
    s.addText(f.desc, { x: bx + 0.15, y: by + 0.52, w: 2.7, h: 1.3, fontSize: 9.5, fontFace: 'Arial', color: C.slate, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Admin & Coach Tools
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.offWht };
  addHeader(s, 'ADMIN & COACH TOOLS', 'Full academy management for admins and coaches — desktop sidebar + mobile drawer.');

  const tools = [
    {
      title: 'Admin Dashboard',
      color: C.navy,
      desc: 'Central overview with quick-access cards for users, courses, GPS data, assignments, and grades. Role-filtered navigation — teachers see a trimmed menu.',
    },
    {
      title: 'Match Squad Management',
      color: '1D4ED8',
      desc: 'Create fixtures, invite players, and track accept / decline responses. Mark matches complete, assign positions, and rate each player 1–10 after the game.',
    },
    {
      title: 'Formation Builder',
      color: '0D7A5F',
      desc: 'Visual 11-a-side football pitch. Click on-pitch zones to assign players. Set shirt numbers and positions. Stored per match event.',
    },
    {
      title: 'Squad GPS Dashboard',
      color: '7C3AED',
      desc: 'Upload GPS session data for the whole squad. View distance, speed, and sprint metrics per player. AI-powered performance analysis via Claude.',
    },
    {
      title: 'Reports & User Management',
      color: 'B45309',
      desc: 'Full user management: add, edit, assign roles and courses. Admin reports for attendance, grades, and performance trends. GPS data import tool.',
    },
  ];

  tools.forEach((t, i) => {
    const bx = 0.2 + i * 1.93;
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: 1.1, w: 1.78, h: 4.2, fill: { color: C.white }, line: { color: C.border }, shadow: mkShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: 1.1, w: 1.78, h: 0.38, fill: { color: t.color }, line: { color: t.color } });
    s.addText(t.title, { x: bx + 0.08, y: 1.12, w: 1.62, h: 0.34, fontSize: 9, fontFace: 'Arial', color: C.white, bold: true, margin: 0 });
    s.addText(t.desc,  { x: bx + 0.08, y: 1.56, w: 1.62, h: 3.6,  fontSize: 8.5, fontFace: 'Arial', color: C.slate, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — AI Features (dark)
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navyDk };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0,     w: 10, h: 0.06, fill: { color: C.gold }, line: { color: C.gold } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.565, w: 10, h: 0.06, fill: { color: C.gold }, line: { color: C.gold } });

  s.addText('AI-POWERED FEATURES', { x: 0.4, y: 0.18, w: 9, h: 0.55, fontSize: 22, fontFace: 'Arial Black', color: C.white, bold: true, margin: 0 });
  s.addText('Powered by Anthropic Claude — built into every key workflow', { x: 0.4, y: 0.74, w: 9, h: 0.33, fontSize: 12, fontFace: 'Arial', color: C.subTxt, italic: true, margin: 0 });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.08, w: 1.6, h: 0.04, fill: { color: C.gold }, line: { color: C.gold } });

  const aiFeatures = [
    { num: '01', title: 'Student Insights',    desc: 'Personalised AI analysis from grades, GPS, attendance & notes. Identifies strengths and flags at-risk players.' },
    { num: '02', title: 'Match Report',         desc: 'Auto-generates post-match reports from squad data, positions and ratings. One click — professional output.' },
    { num: '03', title: 'GPS Analysis',         desc: 'Squad GPS session analysis. Identifies underperformers, recovery concerns and high training loads.' },
    { num: '04', title: 'Broadcast Drafter',    desc: 'Input a topic — Claude writes the announcement in academy voice. Saves coaches time on every message.' },
    { num: '05', title: 'AI Coach Chat Bot',    desc: 'Dedicated AI bot room. Players ask about tactics, training advice, and academy matters 24/7.' },
    { num: '06', title: 'Meal Photo Analysis',  desc: 'Students photograph meals — Claude analyses nutritional content and logs estimated calories automatically.' },
    { num: '07', title: 'Assignment Feedback',  desc: 'AI-assisted feedback for grade submissions. Suggests improvement points aligned to BTEC criteria.' },
  ];

  // 4 cols, rows of 4 then 3
  aiFeatures.forEach((f, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const bx  = 0.25 + col * 2.38;
    const by  = 1.22 + row * 2.1;

    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: by, w: 2.2, h: 1.85, fill: { color: C.cardBg }, line: { color: C.cardBd }, shadow: mkShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: by, w: 2.2, h: 0.05, fill: { color: C.gold },  line: { color: C.gold } });
    s.addText(f.num,   { x: bx + 0.12, y: by + 0.1,  w: 0.45, h: 0.28, fontSize: 9,  fontFace: 'Arial', color: C.gold,  bold: true, margin: 0 });
    s.addText(f.title, { x: bx + 0.12, y: by + 0.38, w: 2.0,  h: 0.38, fontSize: 10, fontFace: 'Arial', color: C.white, bold: true, margin: 0 });
    s.addText(f.desc,  { x: bx + 0.12, y: by + 0.78, w: 2.0,  h: 1.0,  fontSize: 8.5,fontFace: 'Arial', color: C.mutedB,margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Communication Hub
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.offWht };
  addHeader(s, 'COMMUNICATION HUB', 'Real-time messaging · Broadcast · Push Notifications · AI Coach bot');

  // Left: Chat system
  s.addShape(pres.shapes.RECTANGLE, { x: 0.25, y: 1.1, w: 5.5, h: 4.25, fill: { color: C.white }, line: { color: C.border }, shadow: mkShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.25, y: 1.1, w: 5.5, h: 0.42, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText('Chat System', { x: 0.42, y: 1.12, w: 5.1, h: 0.36, fontSize: 13, fontFace: 'Arial', color: C.white, bold: true, margin: 0 });

  const chatRows = [
    { lbl: 'Direct Messages',   desc: 'Private 1-to-1 messaging between students and coaches. Real-time Supabase subscriptions — no refresh needed.' },
    { lbl: 'Squad Channels',    desc: 'Group rooms by squad or team. All players and coaching staff in one thread per channel.' },
    { lbl: 'AI Coach Room',     desc: 'Dedicated bot room powered by Claude. Players ask tactics, training, or academy questions any time.' },
    { lbl: 'Broadcast System',  desc: 'Admin composes broadcast messages — AI drafts the copy. Sent to all users; appears in notification centre.' },
  ];

  chatRows.forEach((row, i) => {
    const by = 1.66 + i * 0.88;
    s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: by, w: 0.06, h: 0.62, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText(row.lbl,  { x: 0.57, y: by + 0.02, w: 5.0, h: 0.26, fontSize: 11, fontFace: 'Arial', color: C.dark,  bold: true, margin: 0 });
    s.addText(row.desc, { x: 0.57, y: by + 0.3,  w: 5.0, h: 0.28, fontSize: 9.5,fontFace: 'Arial', color: C.slate, margin: 0 });
  });

  // Right: Push Notifications
  s.addShape(pres.shapes.RECTANGLE, { x: 6.0, y: 1.1, w: 3.75, h: 4.25, fill: { color: C.white }, line: { color: C.border }, shadow: mkShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 6.0, y: 1.1, w: 3.75, h: 0.42, fill: { color: '7C3AED' }, line: { color: '7C3AED' } });
  s.addText('Push Notifications', { x: 6.17, y: 1.12, w: 3.4, h: 0.36, fontSize: 13, fontFace: 'Arial', color: C.white, bold: true, margin: 0 });

  const pushPts = [
    'Web Push via VAPID keys — works on iOS & Android',
    'Students opt-in from the dashboard with one tap',
    'Admin targets all subscribed users from one screen',
    'Shows live recipient count before sending',
    'Broadcast includes title, body & deep-link URL',
    'Delivered even when the app is closed',
    'Service worker handles delivery in the background',
  ];

  pushPts.forEach((pt, i) => {
    s.addText([{ text: pt, options: { bullet: true } }], {
      x: 6.17, y: 1.65 + i * 0.53, w: 3.4, h: 0.46,
      fontSize: 9.5, fontFace: 'Arial', color: C.slate, margin: 0,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — BTEC & Coursework
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.offWht };
  addHeader(s, 'BTEC & COURSEWORK', 'Full academic management for sport & education programmes — with Moodle / LTI integration.');

  const cards = [
    {
      title: 'Assignments',
      color: C.navy,
      icon: '📚',
      pts: [
        'Create with title, description & due date',
        'Linked to specific courses',
        'Students see deadlines on their dashboard',
        'Teacher and admin managed',
      ],
    },
    {
      title: 'Grade Submissions',
      color: '0D7A5F',
      icon: '⭐',
      pts: [
        'Students submit work and evidence',
        'Coach or teacher grades each submission',
        'Pass / Merit / Distinction outcome',
        'AI feedback helper for written comments',
      ],
    },
    {
      title: 'BTEC Unit Progress',
      color: '1D4ED8',
      icon: '📊',
      pts: [
        'Track completion across all BTEC units',
        'Per-student progress view for coaches',
        'Course completion percentage visible',
        'Linked directly to assignment outcomes',
      ],
    },
    {
      title: 'Moodle / LTI',
      color: '7C3AED',
      icon: '🔌',
      pts: [
        'LTI 1.3 launch support built in',
        'Single sign-on from existing Moodle site',
        'Auto-creates user accounts on first login',
        'Role mapping from Moodle to Tracker',
      ],
    },
  ];

  cards.forEach((card, i) => {
    const bx = 0.25 + i * 2.38;
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: 1.1, w: 2.2, h: 4.2, fill: { color: C.white }, line: { color: C.border }, shadow: mkShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: 1.1, w: 2.2, h: 0.46, fill: { color: card.color }, line: { color: card.color } });
    s.addText(card.icon + '  ' + card.title, { x: bx + 0.1, y: 1.12, w: 2.0, h: 0.4, fontSize: 11, fontFace: 'Arial', color: C.white, bold: true, margin: 0 });

    card.pts.forEach((pt, j) => {
      s.addText([{ text: pt, options: { bullet: true } }], {
        x: bx + 0.1, y: 1.68 + j * 0.67, w: 2.0, h: 0.6,
        fontSize: 9.5, fontFace: 'Arial', color: C.slate, margin: 0,
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Future Enhancements (dark)
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navyDk };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0,     w: 10, h: 0.06, fill: { color: C.gold }, line: { color: C.gold } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.565, w: 10, h: 0.06, fill: { color: C.gold }, line: { color: C.gold } });

  s.addText('WHERE NEXT?', { x: 0.4, y: 0.15, w: 8, h: 0.56, fontSize: 26, fontFace: 'Arial Black', color: C.white, bold: true, margin: 0 });
  s.addText('High-value enhancements — features players and coaches will love, costly on any other platform', {
    x: 0.4, y: 0.73, w: 9.2, h: 0.32, fontSize: 12, fontFace: 'Arial', color: C.subTxt, italic: true, margin: 0,
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.06, w: 1.6, h: 0.04, fill: { color: C.gold }, line: { color: C.gold } });

  const tagColors = {
    'HIGH VALUE':   C.gold,
    'ESSENTIAL':    '22C55E',
    'ENGAGEMENT':   '3B82F6',
    'CULTURE':      'EC4899',
    'SAFEGUARDING': 'F97316',
    'PREMIUM':      '7C3AED',
  };

  const enhancements = [
    {
      title: 'Weekly AI Performance Reports',
      tag: 'HIGH VALUE',
      desc: 'Auto-sent Monday morning. Summarises GPS trends, grades, attendance & match performance. Players and parents receive a personalised PDF digest.',
    },
    {
      title: 'Injury & Availability Log',
      tag: 'ESSENTIAL',
      desc: 'Physio-style injury tracker. Players log knocks; coaches mark unavailability before squad selection. Full history view per player.',
    },
    {
      title: 'Player Leaderboards',
      tag: 'ENGAGEMENT',
      desc: 'Weekly squad rankings for GPS distance, training attendance, nutrition compliance, and grade scores. Trophy icons visible to the whole squad.',
    },
    {
      title: 'Player of the Week',
      tag: 'CULTURE',
      desc: 'Coach-nominated or AI-suggested award based on combined performance metrics. Push notification announces the winner to the full squad.',
    },
    {
      title: 'Welfare Check-ins',
      tag: 'SAFEGUARDING',
      desc: 'Weekly mood & wellbeing survey for students. AI flags patterns — coach is notified if a player is consistently low. Replaces paper welfare forms.',
    },
    {
      title: 'Video & Clip Uploads',
      tag: 'PREMIUM',
      desc: 'Players upload short training clips. AI tags key moments. Coach can annotate and share. Linked to match events and GPS sessions.',
    },
  ];

  enhancements.forEach((e, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx  = 0.25 + col * 3.2;
    const by  = 1.2  + row * 2.12;
    const tc  = tagColors[e.tag] || C.gold;

    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: by, w: 3.0, h: 1.95, fill: { color: C.cardBg }, line: { color: C.cardBd }, shadow: mkShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: by, w: 3.0, h: 0.05, fill: { color: tc }, line: { color: tc } });

    // Tag pill
    s.addShape(pres.shapes.RECTANGLE, { x: bx + 0.1, y: by + 0.1, w: 1.0, h: 0.22, fill: { color: tc }, line: { color: tc } });
    s.addText(e.tag, { x: bx + 0.1, y: by + 0.1, w: 1.0, h: 0.22, fontSize: 7, fontFace: 'Arial', color: C.white, bold: true, align: 'center', margin: 0 });

    s.addText(e.title, { x: bx + 0.1, y: by + 0.38, w: 2.8, h: 0.4, fontSize: 11, fontFace: 'Arial', color: C.white, bold: true, margin: 0 });
    s.addText(e.desc,  { x: bx + 0.1, y: by + 0.8,  w: 2.8, h: 1.0, fontSize: 9,  fontFace: 'Arial', color: C.mutedB, margin: 0 });
  });
}

// ── Write ─────────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: 'Tranmere-Tracker-Platform-Overview.pptx' })
  .then(() => console.log('✅  Deck written: Tranmere-Tracker-Platform-Overview.pptx'))
  .catch(err => { console.error('❌  Error:', err); process.exit(1); });
