import {calendarDayDifference} from './dates';
export type ExerciseCategory='Seated'|'Standing'|'Walking'|'Breathing';
export type Point=[number,number];
export type Pose=Record<string,Point>;
export type Exercise={id:string;name:string;category:ExerciseCategory;minutes:number;effort:'easy'|'steady';focus:string;steps:string[];changes:Pose;source:string;art:string};
const sitting='https://www.nhs.uk/live-well/exercise/sitting-exercises/';
const standing='https://www.nhs.uk/live-well/exercise/strength-exercises/';
const gentle='https://www.nhs.uk/symptoms/period-pain/';
const breathing='https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/';
// Original visual poses: H=head, S=shoulder, E=elbow, W=wrist,
// P=hip, K=knee, F=foot. Anatomical left is shown on the right of the drawing.
export const standingPose:Pose={H:[120,51],SL:[102,83],SR:[138,83],EL:[94,111],ER:[146,111],WL:[93,140],WR:[147,140],PL:[109,138],PR:[131,138],KL:[104,177],KR:[136,177],FL:[97,217],FR:[145,217]};
export const seatedPose:Pose={...standingPose,PL:[105,138],PR:[135,138],KL:[92,173],KR:[148,173],FL:[89,211],FR:[153,211],WL:[93,151],WR:[147,151]};
type Spec=[string,string,ExerciseCategory,string,Pose,string,string,('easy'|'steady')?];
const specs:Spec[]=[
 ['neck-turn','Comfortable neck turn','Seated','Neck',{H:[127,51]},'Sit tall and let your shoulders soften.','Look slowly to one side, return to centre, then switch sides.'],
 ['neck-tilt','Gentle neck tilt','Seated','Neck',{H:[111,54]},'Keep your gaze forward and shoulders relaxed.','Bring one ear a little toward its shoulder without lifting the shoulder. Switch sides.'],
 ['chin-tuck','Small chin tuck','Seated','Posture',{H:[117,51]},'Sit upright with your eyes level.','Draw your chin slightly back, then release. Keep the movement small.'],
 ['shoulder-shrug','Shoulder release','Seated','Shoulders',{SL:[102,72],SR:[138,72],EL:[95,103],ER:[145,103]},'Let your arms rest beside you.','Gently lift both shoulders, then lower them slowly.'],
 ['shoulder-roll','Shoulder rolls','Seated','Shoulders',{SL:[99,79],SR:[141,79],EL:[88,109],ER:[152,109]},'Sit comfortably with your arms relaxed.','Make small, slow backward circles with your shoulders.'],
 ['shoulder-blades','Shoulder blade squeeze','Seated','Upper back',{SL:[106,83],SR:[134,83],EL:[104,109],ER:[136,109],WL:[110,141],WR:[130,141]},'Keep your neck long and look ahead.','Gently draw your shoulder blades together, then release without arching your back.'],
 ['chest-open','Seated chest opening','Seated','Chest',{EL:[80,97],ER:[160,97],WL:[64,120],WR:[176,120]},'Sit near the front of a stable chair.','Open your arms comfortably to the sides, then bring them back down.'],
 ['arm-reach','Single arm reach','Seated','Shoulders',{ER:[148,57],WR:[146,27]},'Keep both feet grounded and sit tall.','Reach one hand up only as far as feels easy. Lower it and switch arms.'],
 ['seated-side','Seated side reach','Seated','Side body',{H:[108,54],SL:[94,88],SR:[130,81],ER:[133,50],WR:[108,29]},'Place one hand beside you on the chair.','Lift the other arm and lean a little to the side. Return and switch.'],
 ['seated-twist','Easy seated turn','Seated','Back',{SL:[110,83],SR:[143,86],EL:[129,110],ER:[151,117],WL:[145,132],WR:[131,143]},'Sit tall with feet flat and hips facing forward.','Turn your chest a little to one side without pulling yourself with your hands. Switch sides.'],
 ['wrist-circle','Wrist circles','Seated','Hands',{EL:[96,108],ER:[144,108],WL:[103,94],WR:[151,91]},'Rest or support your forearms in front of you.','Circle your wrists slowly in each direction with relaxed fingers.'],
 ['wrist-flex','Wrist flex and release','Seated','Hands',{EL:[88,105],ER:[152,105],WL:[75,96],WR:[165,116]},'Hold your forearms comfortably forward.','Bend your hands gently up and down without forcing the stretch.'],
 ['finger-spread','Open hands','Seated','Hands',{EL:[91,103],ER:[149,103],WL:[86,79],WR:[154,79]},'Bring your hands up where you can see them.','Open and spread your fingers, then relax them.'],
 ['hand-close','Soft hand squeeze','Seated','Hands',{EL:[96,103],ER:[144,103],WL:[100,77],WR:[140,77]},'Let your shoulders drop and keep wrists neutral.','Close your fingers into a loose fist, then gently open your hands.'],
 ['forearm-turn','Palm turns','Seated','Arms',{EL:[94,115],ER:[146,115],WL:[78,118],WR:[162,118]},'Keep your elbows near your body.','Turn your palms up, then down, through an easy range.'],
 ['elbow-bend','Easy elbow bends','Seated','Arms',{EL:[95,112],ER:[145,112],WL:[105,82],WR:[135,82]},'Sit tall and keep elbows close to your sides.','Bring hands toward shoulders, then lower slowly without weights.'],
 ['knee-extension','Seated knee extension','Seated','Legs',{KR:[157,159],FR:[186,164]},'Use a stable chair with your feet on the floor.','Straighten one knee comfortably, lower the foot, and switch legs.'],
 ['seated-march','Seated marching','Seated','Hips',{KL:[91,150],FL:[85,184],KR:[149,171]},'Sit upright and hold the chair lightly if helpful.','Lift one knee a little, lower it, then alternate at a comfortable pace.'],
 ['ankle-pump','Ankle pumps','Seated','Ankles',{KL:[101,155],FL:[79,157]},'Lift one foot a little with the leg supported or extended.','Point your toes away, then bring them toward you. Switch feet.'],
 ['ankle-circle','Ankle circles','Seated','Ankles',{KR:[156,159],FR:[170,145]},'Support yourself in a stable chair and lift one foot.','Trace small circles with the toes, then switch direction and foot.'],
 ['seated-heels','Seated heel lifts','Seated','Calves',{FL:[84,199],FR:[157,199]},'Place both feet on the floor under your knees.','Keep toes down as you lift and lower your heels.'],
 ['seated-toes','Seated toe lifts','Seated','Ankles',{FL:[94,207],FR:[148,207]},'Keep your heels grounded beneath your knees.','Lift your toes toward your shins, then lower them slowly.'],
 ['hip-open','Seated hip opening','Seated','Hips',{KL:[76,165],KR:[164,165],FL:[67,207],FR:[173,207]},'Sit tall with both feet supported.','Move one knee slightly outward, return, and switch. Do not push into the knee.'],
 ['wall-press','Gentle wall press','Standing','Arms',{SL:[111,86],SR:[141,86],EL:[148,96],ER:[170,99],WL:[180,85],WR:[192,87],FL:[86,216],FR:[133,216]},'Stand facing a wall with hands at shoulder height.','Bend elbows a little toward the wall, then press back. Keep feet stable.','steady'],
 ['sit-stand','Supported sit to stand','Standing','Legs',{H:[125,64],SL:[106,95],SR:[142,95],PL:[104,150],PR:[134,150],KL:[88,180],KR:[153,180],WL:[98,151],WR:[142,151]},'Sit on a stable chair with feet flat and enough space in front.','Lean forward slightly and stand using support if needed. Sit down slowly.','steady'],
 ['standing-heels','Supported calf raise','Standing','Calves',{H:[120,42],SL:[102,74],SR:[138,74],PL:[109,129],PR:[131,129],KL:[104,168],KR:[136,168],FL:[100,207],FR:[142,207]},'Stand beside a stable chair or counter and hold it.','Lift your heels a small distance, then lower slowly.','steady'],
 ['standing-toes','Supported toe raise','Standing','Ankles',{FL:[103,211],FR:[139,211],WL:[80,134],WR:[159,134]},'Hold a stable support and keep heels grounded.','Lift the fronts of your feet gently, then lower.'],
 ['supported-knee','Supported knee lift','Standing','Hips',{KR:[156,150],FR:[157,186],WR:[165,128]},'Hold a sturdy support and stand upright.','Lift one knee a little without leaning back. Lower and switch legs.','steady'],
 ['side-leg','Supported side leg lift','Standing','Hips',{KR:[158,170],FR:[182,209],WR:[164,129]},'Hold a stable support and keep your body tall.','Move one leg out a short distance, then return slowly. Switch legs.','steady'],
 ['heel-curl','Standing heel curl','Standing','Legs',{KR:[143,176],FR:[163,157],WR:[162,130]},'Hold a stable chair or counter.','Bend one knee so the heel moves gently behind you. Lower and switch.','steady'],
 ['calf-stretch','Supported calf stretch','Standing','Calves',{KL:[90,174],KR:[149,178],FL:[70,215],FR:[170,215],EL:[87,98],WL:[69,90]},'Place hands on a wall and step one foot back.','Keep the back heel down and lean slightly forward. Return and switch.'],
 ['split-stance','Small split-stance stretch','Standing','Hips',{PL:[107,142],PR:[129,142],KL:[84,180],KR:[145,183],FL:[66,216],FR:[159,218]},'Hold support and step into a short, comfortable split stance.','Shift weight slightly forward without arching your back. Switch sides.'],
 ['side-step','Gentle side steps','Walking','Movement',{KL:[84,173],KR:[145,177],FL:[65,216],FR:[156,216],EL:[83,105],ER:[156,106],WL:[75,132],WR:[166,132]},'Choose a clear, flat space with support nearby.','Step to one side and bring the other foot alongside. Repeat in the other direction.'],
 ['forward-step','Forward and back step','Walking','Movement',{KL:[94,172],KR:[148,174],FL:[80,215],FR:[171,211],EL:[95,102],WR:[142,128]},'Stand beside support on a clear, level surface.','Step one foot a little forward and return. Alternate without rushing.'],
 ['standing-march','Easy marching','Walking','Movement',{KL:[84,148],FL:[81,185],ER:[150,104],WR:[148,80]},'Stand tall near support with a comfortable stance.','Lift alternate feet in small steps and breathe normally.'],
 ['easy-walk','Comfortable walk','Walking','Movement',{KL:[91,173],KR:[149,174],FL:[76,216],FR:[168,212],EL:[89,105],ER:[150,104],WL:[78,127],WR:[159,79]},'Choose a level route where you can turn back easily.','Walk at a pace where conversation feels comfortable. Start with a short loop.'],
 ['arm-swing','Relaxed arm swings','Standing','Shoulders',{EL:[78,98],ER:[161,112],WL:[60,110],WR:[177,138]},'Stand comfortably with knees soft and feet planted.','Swing relaxed arms gently forward and back without twisting forcefully.'],
 ['wall-chest','Wall chest opening','Standing','Chest',{EL:[82,85],WL:[64,62],ER:[154,110],WR:[159,142]},'Place one forearm lightly against a wall at a comfortable height.','Turn your chest a small amount away until you feel a gentle stretch. Switch sides.'],
 ['overhead-reach','Standing overhead reach','Standing','Shoulders',{EL:[96,55],ER:[144,55],WL:[108,26],WR:[132,26]},'Stand with feet comfortably apart, or use a chair instead.','Reach both arms upward as far as feels easy, then lower slowly.'],
 ['standing-side','Standing side reach','Standing','Side body',{H:[109,53],SL:[94,86],SR:[130,79],ER:[134,50],WR:[112,25],WL:[85,143]},'Keep both feet planted and one hand by your side.','Reach the other hand up and lean slightly sideways. Return and switch.'],
 ['mini-bend','Supported mini knee bend','Standing','Legs',{H:[120,62],SL:[102,94],SR:[138,94],PL:[106,148],PR:[134,148],KL:[91,181],KR:[149,181],WL:[88,124],WR:[152,124]},'Hold a stable support with feet comfortably apart.','Bend both knees just a little, then straighten without locking them.','steady'],
 ['seated-breathe','Seated steady breathing','Breathing','Breath',{EL:[100,113],ER:[140,113],WL:[110,122],WR:[130,122]},'Sit with your back supported and feet resting comfortably.','Breathe gently in and out at your own pace. Do not hold or force your breath.'],
 ['standing-breathe','Standing breathing pause','Breathing','Breath',{EL:[97,111],ER:[143,111],WL:[111,105],WR:[129,105]},'Stand near support with relaxed knees and shoulders.','Rest hands lightly over your ribs and allow comfortable, unforced breaths.'],
 ['shoulder-breathe','Shoulder-release breathing','Breathing','Breath',{SL:[100,87],SR:[140,87],EL:[89,120],ER:[151,120],WL:[87,151],WR:[153,151]},'Sit comfortably and notice tension in your shoulders.','Let your shoulders soften as you breathe out. Continue without breath holds.']
];
export const exercises:Exercise[]=specs.map(([id,name,category,focus,changes,a,b,effort])=>({id,name,category,focus,changes,effort:effort||'easy',minutes:category==='Walking'?5:2,steps:[a,b,'Keep within a comfortable range. Stop if the movement hurts or makes you dizzy.'],source:category==='Seated'?sitting:category==='Breathing'?breathing:category==='Walking'?gentle:standing,art:`/art/exercise/${id}.svg`}));
export function exerciseSuggestions(logs:any[],today:string){
 const actual=logs.filter(log=>log.date<=today&&calendarDayDifference(today,log.date)<=7&&!log.notes?.startsWith('[Sample history:')).sort((a,b)=>b.date.localeCompare(a.date));
 const latest=actual[0];const symptoms=(latest?.symptoms||[]).map((s:string)=>s.toLowerCase());
 const dizzy=symptoms.includes('dizziness');const tired=latest?.energyLevel==='low'||latest?.energy_level==='low'||symptoms.includes('fatigue')||latest?.sleepQuality==='poor'||latest?.sleep_quality==='poor';
 const discomfort=symptoms.some((s:string)=>['cramps','backache','pelvic pain','bloating'].includes(s));
 const selected=exercises.filter(ex=>dizzy?ex.category==='Breathing'&&ex.id==='seated-breathe':tired||discomfort?ex.effort==='easy'&&['Seated','Breathing'].includes(ex.category):['easy-walk','shoulder-roll','arm-reach','ankle-pump','seated-breathe','overhead-reach'].includes(ex.id)).slice(0,6);
 return {selected,observedDays:actual.length,reason:dizzy?'Your latest check-in mentions dizziness. Rest while dizzy; try a seated pause only if comfortable.':tired?'Your latest check-in suggests a lower-energy day, so these options are seated and easy.':discomfort?'Your latest check-in includes discomfort. These are gentle options to explore only if they feel comfortable.':latest?'A few easy movements to match your recent check-in. Adjust to how you feel now.':'No recent non-demo check-ins yet. These are general options, not personalized recommendations.'};
}
export const exerciseVideoSearch=(exercise:Exercise)=>`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.name+' gentle exercise physiotherapist tutorial')}`;
