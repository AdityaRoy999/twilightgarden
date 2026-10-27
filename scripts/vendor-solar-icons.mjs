// Build-time only. Icon data from Iconify's Solar collection, by 480 Design,
// CC BY 4.0. Download json/solar.json from iconify/icon-sets into tmp first.
import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync('tmp/solar-icons.json','utf8'));
const mapping={
 Pause:'pause-circle',Reply:'undo-left-round',BellOff:'bell-off',LinkOff:'unlink',PhoneOff:'end-call-rounded',VideoOff:'videocamera-off',MicOff:'microphone-3',EyeOff:'eye-closed',Quote:'quote-square',CheckCircle:'check-circle',House:'home-angle',CalendarDays:'calendar',ChartNoAxesCombined:'chart-2',MessageCircle:'chat-round-dots',Heart:'heart',Flower2:'health',Gamepad2:'gamepad',Settings:'settings',UserRound:'user-rounded',Users:'users-group-rounded',BellRing:'bell',Moon:'moon',Droplet:'waterdrop',FlowLight:'waterdrop',FlowMedium:'waterdrops',FlowHeavy:'waterdrops',Leaf:'leaf',Sparkles:'stars',Smile:'smile-circle',Frown:'sad-circle',Zap:'bolt',Sun:'sun',Lightbulb:'lightbulb-bolt',Phone:'phone-rounded',Video:'videocamera',Mic:'microphone-2',Camera:'camera',Shield:'shield-check',Lock:'lock-keyhole',Key:'key',Eye:'eye',Clock:'clock-circle',Clipboard:'clipboard-text',Smartphone:'smartphone',Monitor:'monitor',Palette:'palette',Waves:'soundwave',Grid2X2:'widget-2',List:'list',Menu:'hamburger-menu',PanelLeftClose:'panel-left-close',Check:'check',DoubleCheck:'check',X:'close-circle',Plus:'add-circle',ArrowLeft:'arrow-left',ArrowRight:'arrow-right',ChevronLeft:'alt-arrow-left',ChevronRight:'alt-arrow-right',ChevronDown:'alt-arrow-down',ArrowUp:'arrow-up',ArrowOut:'arrow-right-up',Play:'play-circle',Stop:'stop-circle',Send:'plain-3',Download:'download-minimalistic',RefreshCw:'refresh',Trash2:'trash-bin-trash',PenLine:'pen-new-square',AlertCircle:'info-circle',HelpCircle:'question-circle',Ellipsis:'menu-dots',EllipsisVertical:'menu-dots',Hand:'hand-heart',Star:'star',Pin:'pin',Link:'link-round',Copy:'copy',Share:'share',Search:'magnifer',Location:'map-point',Mail:'letter',Medical:'medical-kit',Food:'chef-hat',Dice:'gamepad-old',Brain:'brain',Party:'confetti',Image:'gallery',Gif:'sticker-square',Battery:'battery-half',Logout:'logout-2',Fire:'fire',Music:'music-note',Book:'book-bookmark',Target:'target',Gift:'gift',Skull:'ghost',Hourglass:'hourglass',Rock:'asteroid',Paper:'document',Scissors:'scissors',
};
const icons={};
for(const [key,base] of Object.entries(mapping)){
 let name=base+'-bold-duotone';
 if(!source.icons[name]){const candidates=Object.keys(source.icons).filter(name=>name.startsWith(base)&&name.endsWith('-bold-duotone'));throw Error(`Missing ${name}: ${candidates.join(',')}`);}
 let body=source.icons[name].body;
 if(key==='EllipsisVertical')body=`<g transform="rotate(90 12 12)">${body}</g>`;
 if(key==='MicOff')body=source.icons['microphone-2-bold-duotone'].body+`<g transform="translate(12 0) scale(.5)">${source.icons['close-circle-bold-duotone'].body}</g>`;
 if(/<script|<image|https?:|on[a-z]+=/i.test(body))throw Error('Unsafe SVG '+name);
 icons[key]={name,body};
}
fs.writeFileSync('components/ui/solar-data.json',JSON.stringify(icons,null,2)+'\n');
console.log(Object.keys(icons).length+' local Solar icon mappings');
