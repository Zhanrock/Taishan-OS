const SUPABASE_URL  = 'https://wftmqyewidvlxvpzqnuk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmdG1xeWV3aWR2bHh2cHpxbnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzQyOTcsImV4cCI6MjA4OTk1MDI5N30.0PdD4tsnnZ2z-pNLKy0ojPaTeeuAfeoEoxlPd5iifpo';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const HABITS = [
  { id:'wake',     label:'Wake Up',        emoji:'\u23F0', color:'#ffd36a', unlockPhase:1, tip:'Hit 8:00am. Every day.' },
  { id:'morning',  label:'Morning Routine', emoji:'\uD83C\uDF05', color:'#7c6aff', unlockPhase:1, tip:'Walk, water, one task.' },
  { id:'deepWork', label:'Deep Work',       emoji:'\uD83D\uDD2C', color:'#ff6a6a', unlockPhase:2, tip:'2+ hours focused, no phone.' },
  { id:'noScroll', label:'No Late Scroll',  emoji:'\uD83D\uDCF5', color:'#6affd4', unlockPhase:2, tip:'Phone away by midnight.' },
  { id:'exercise', label:'Move',            emoji:'\u26A1', color:'#ff9f6a', unlockPhase:3, tip:'20min walk/workout.' },
  { id:'review',   label:'Night Protocol',  emoji:'\uD83C\uDF19', color:'#a06aff', unlockPhase:3, tip:'Prep tomorrow tonight.' },
];
const PHASES = [
  { num:1, name:'Phase 1 \u2014 The Anchor',  nextAt:7,  desc:'Week 1\u20132: Build the foundation. Only 2 habits active. Master the wake time and morning routine before anything else unlocks.', habits:'Active habits: 2 / 6' },
  { num:2, name:'Phase 2 \u2014 The Builder', nextAt:14, desc:'Week 3\u20134: Add deep work blocks and the no-late-scroll rule. Four habits now. Build the study engine.', habits:'Active habits: 4 / 6' },
  { num:3, name:'Phase 3 \u2014 Full System', nextAt:21, desc:'Week 5+: All six habits active. Exercise, night protocol, everything locked in. This is the full version of you.', habits:'Active habits: 6 / 6' },
];

// Default schedule — overridden by user's saved version if it exists
const DEFAULT_SCHEDULE_BLOCKS = [
  { time:'8:00',  label:'Morning Anchor',    sub:'Wake \u2192 water \u2192 walk \u2192 one-task review', type:'anchor' },
  { time:'9:00',  label:'Deep Work Block 1', sub:'Hardest task: lecture / assignment / research', type:'deep' },
  { time:'12:00', label:'Midday Reset',       sub:'Lunch + real rest \u2014 no guilt here', type:'reset' },
  { time:'14:00', label:'Deep Work Block 2', sub:'Second priority: classes, problem sets, coding', type:'deep' },
  { time:'18:00', label:'Free Zone',          sub:'Gym, friends, meals, whatever you want', type:'free' },
  { time:'21:00', label:'Wind Down',          sub:'No screens 30min before bed. Night protocol.', type:'reset' },
  { time:'23:30', label:'Lights Out',         sub:'Target sleep time. Non-negotiable.', type:'anchor' },
];

const NIGHT_CHECKS = [
  { id:'task',  label:'Written ONE task for tomorrow on paper/whiteboard' },
  { id:'prep',  label:'Bag packed and clothes set out' },
  { id:'phone', label:'Phone placed across the room' },
];

// Generic starter tasks seeded only for a brand-new account with zero tasks.
// Keep this non-identifying — real task content lives in Supabase per account,
// never in this shipped file.
const DEFAULT_TASKS = [
  { name:'Review your course/lecture notes',           category:'module',    due:'', priority:'high', note:'' },
  { name:'Read one assigned or relevant paper',        category:'research',  due:'', priority:'high', note:'' },
  { name:'Check your project/hackathon backlog',       category:'hackathon', due:'', priority:'med',  note:'' },
  { name:'One admin task (payments, forms, housing)',  category:'personal',  due:'', priority:'med',  note:'' },
  { name:'7-day wake streak \u2014 Phase 2 unlocks!',  category:'personal',  due:'', priority:'med',  note:'' },
];
const EVENT_COLORS = { meeting:'#7c6aff', deadline:'#ff6a6a', class:'#6affd4', personal:'#ffd36a', exam:'#ff9f6a' };
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_NAMES    = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const CAT_CLASS    = { Physical:'physical', Sensory:'sensory', Mental:'mental', Action:'action' };
const CARD_DECK = [
  {num:1,cat:'Physical',task:'15 jumping jacks.'},{num:2,cat:'Physical',task:'Touch your toes and hold for 30 seconds.'},{num:3,cat:'Physical',task:'10 pushups next to the bed.'},{num:4,cat:'Physical',task:'Wall sit for 45 seconds.'},{num:5,cat:'Physical',task:'High knees in place for 1 minute.'},{num:6,cat:'Physical',task:'Plank for as long as you can.'},{num:7,cat:'Physical',task:'20 squats.'},{num:8,cat:'Physical',task:'Arm circles \u2014 30 forward, 30 back.'},{num:9,cat:'Physical',task:'Shadowbox the air for 1 minute.'},{num:10,cat:'Physical',task:'Standing side-stretches.'},{num:11,cat:'Physical',task:'Balance on one leg for 30 seconds. Eyes closed for extra difficulty.'},{num:12,cat:'Physical',task:'Calf raises while standing on the floor.'},{num:13,cat:'Physical',task:'Cat-Cow stretch on the floor.'},
  {num:14,cat:'Sensory',task:'Drink a full glass of water.'},{num:15,cat:'Sensory',task:'Splash your face with water.'},{num:16,cat:'Sensory',task:'Open every curtain and blind in the room.'},{num:17,cat:'Sensory',task:'Spritz a refreshing scent \u2014 peppermint or citrus.'},{num:18,cat:'Sensory',task:'Rub your palms together until warm, then press to your eyes.'},{num:19,cat:'Sensory',task:'Brush your hair vigorously.'},{num:20,cat:'Sensory',task:'Put on a pair of fresh, clean socks.'},{num:21,cat:'Sensory',task:'Pull your earlobes gently for 30 seconds.'},{num:22,cat:'Sensory',task:'Clench your fists and toes as hard as you can, then release. 3 times.'},{num:23,cat:'Sensory',task:'Listen to one high-energy song all the way through.'},{num:24,cat:'Sensory',task:'Look out the window and count 5 different colors.'},{num:25,cat:'Sensory',task:'Stand barefoot on the floor (not the rug) for 1 minute.'},{num:26,cat:'Sensory',task:'Box breathing \u2014 4s inhale, 4s hold, 4s exhale, 4s hold. Repeat 4 times.'},
  {num:27,cat:'Mental',task:'Count backward from 100 by 7s.'},{num:28,cat:'Mental',task:'Name 10 types of fruit out loud.'},{num:29,cat:'Mental',task:'List 5 things in the room that start with the letter S.'},{num:30,cat:'Mental',task:'Solve this in your head: 14 \u00D7 12.'},{num:31,cat:'Mental',task:'Spell your full name backward.'},{num:32,cat:'Mental',task:'Name 5 cities you want to visit one day.'},{num:33,cat:'Mental',task:'Recite the alphabet skipping every other letter \u2014 A, C, E...'},{num:34,cat:'Mental',task:'Think of 3 things you are grateful for today.'},{num:35,cat:'Mental',task:'State your main mission for the day out loud.'},{num:36,cat:'Mental',task:'Name 5 famous people who share your first name.'},{num:37,cat:'Mental',task:'Pick up a book and memorize one random fact from it.'},{num:38,cat:'Mental',task:'Plan your exact outfit for the day in your head before opening the wardrobe.'},{num:39,cat:'Mental',task:'Categorize 10 items in your room by material \u2014 wood, plastic, fabric, etc.'},
  {num:40,cat:'Action',task:'Make the bed perfectly.'},{num:41,cat:'Action',task:'Organize one shelf or your nightstand drawer.'},{num:42,cat:'Action',task:'Put away 3 pieces of stray clothing.'},{num:43,cat:'Action',task:'Wipe your phone screen clean.'},{num:44,cat:'Action',task:'Fold one item of clothing.'},{num:45,cat:'Action',task:'Write a 1-sentence morning mantra on a sticky note.'},{num:46,cat:'Action',task:'Delete 10 old photos or emails from your phone.'},{num:47,cat:'Action',task:"Check your calendar for today's top 3 tasks."},{num:48,cat:'Action',task:'Power Pose \u2014 hands on hips, stand tall for 1 minute.'},{num:49,cat:'Action',task:'Doodle a quick emoji of how you feel right now.'},{num:50,cat:'Action',task:'Fluff and rotate your pillows.'},{num:51,cat:'Action',task:'Straighten any crooked frames or posters on the wall.'},{num:52,cat:'Action',task:'Give yourself a high-five in the mirror.'}
];
