export type CallQuality='voice'|'low'|'balanced'|'clear'|'hd';
export type CallNetwork={rttMs:number|null;availableBitrate:number|null;loss:number;videoWidth?:number;videoHeight?:number;sentKbps?:number;receivedJitterMs?:number};
const order:CallQuality[]=['voice','low','balanced','clear','hd'];
export const qualityProfiles={
 voice:{videoBitrate:0,audioBitrate:16000,scale:12,fps:3,label:'Audio priority'},
 low:{videoBitrate:70000,audioBitrate:20000,scale:6,fps:10,label:'Low bandwidth'},
 balanced:{videoBitrate:280000,audioBitrate:28000,scale:3,fps:15,label:'Adaptive 360p target'},
 clear:{videoBitrate:1200000,audioBitrate:32000,scale:1.5,fps:24,label:'Adaptive 720p target'},
 hd:{videoBitrate:2800000,audioBitrate:40000,scale:1,fps:30,label:'Adaptive 1080p target'},
} as const;
export function recommendedCallQuality(network:CallNetwork):CallQuality{
 const capacity=network.availableBitrate,rtt=network.rttMs??0;
 if(capacity!==null&&capacity<100000||network.loss>.25||rtt>1500)return 'voice';
 if(capacity!==null&&capacity<350000||network.loss>.12||rtt>900)return 'low';
 if(capacity!==null&&capacity<1100000||network.loss>.05||rtt>450)return 'balanced';
 if(capacity!==null&&capacity<3500000||network.loss>.025||rtt>250)return 'clear';
 return capacity===null?'clear':'hd';
}
/** Downgrade promptly; require three good samples before raising quality. */
export function nextCallQuality(current:CallQuality,requested:CallQuality,goodSamples:number){
 if(order.indexOf(requested)<order.indexOf(current))return {quality:requested,goodSamples:0};
 if(requested===current)return {quality:current,goodSamples:0};
 return goodSamples>=2?{quality:order[order.indexOf(current)+1],goodSamples:0}:{quality:current,goodSamples:goodSamples+1};
}
export class CallStatsSampler{
 private previous=new Map<string,{sent:number;received:number;lost:number;timestamp:number}>();
 sample(report:RTCStatsReport):CallNetwork{
  const rows:any[]=[];report.forEach(row=>rows.push(row));
  const transport=rows.find(row=>row.type==='transport'&&row.selectedCandidatePairId);
  const pair=rows.find(row=>row.id===transport?.selectedCandidatePairId)||rows.find(row=>row.type==='candidate-pair'&&row.nominated&&row.state==='succeeded');
  const network:CallNetwork={rttMs:typeof pair?.currentRoundTripTime==='number'?Math.round(pair.currentRoundTripTime*1000):null,availableBitrate:pair?.availableOutgoingBitrate>0?pair.availableOutgoingBitrate:null,loss:0};
  for(const row of rows){
   const previous=this.previous.get(row.id);
   if(row.type==='remote-inbound-rtp'&&typeof row.fractionLost==='number')network.loss=Math.max(network.loss,Math.max(0,row.fractionLost));
   if(row.type==='inbound-rtp'&&previous){const received=(row.packetsReceived||0)-previous.received,lost=(row.packetsLost||0)-previous.lost;if(received+lost>0)network.loss=Math.max(network.loss,Math.max(0,lost)/(received+Math.max(0,lost)));}
   if(row.type==='inbound-rtp'&&(row.kind||row.mediaType)==='audio'&&typeof row.jitter==='number')network.receivedJitterMs=Math.round(row.jitter*1000);
   if(row.type==='outbound-rtp'&&(row.kind||row.mediaType)==='video'){
    network.videoWidth=row.frameWidth;network.videoHeight=row.frameHeight;
    if(previous&&row.timestamp>previous.timestamp)network.sentKbps=Math.round(Math.max(0,row.bytesSent-previous.sent)*8/(row.timestamp-previous.timestamp));
   }
   if(['inbound-rtp','outbound-rtp'].includes(row.type))this.previous.set(row.id,{sent:row.bytesSent||0,received:row.packetsReceived||0,lost:row.packetsLost||0,timestamp:row.timestamp});
  }
  return network;
 }
}
export function preferSpeechCodec(pc:RTCPeerConnection){
 const capabilities=typeof RTCRtpSender!=='undefined'?RTCRtpSender.getCapabilities?.('audio'):null;
 if(!capabilities)return;
 const codecs=[...capabilities.codecs].sort((a,b)=>Number(b.mimeType.toLowerCase()==='audio/opus')-Number(a.mimeType.toLowerCase()==='audio/opus'));
 for(const transceiver of pc.getTransceivers?.()||[])if(transceiver.sender.track?.kind==='audio'){try{transceiver.setCodecPreferences?.(codecs);}catch{/* Use the browser's negotiated codec on unsupported implementations. */}}
}
export async function applyCallQuality(pc:RTCPeerConnection,quality:CallQuality){
 const profile=qualityProfiles[quality];let paused=false;
 await Promise.all((pc.getSenders?.()||[]).map(async sender=>{
  if(!sender.track||!sender.getParameters||!sender.setParameters)return;
  const parameters=sender.getParameters();if(!parameters.encodings?.length)return;
  const video=sender.track.kind==='video';if(!video&&sender.track.kind!=='audio')return;
  let changed=false;
  if(video&&parameters.degradationPreference!=='balanced'){parameters.degradationPreference='balanced';changed=true;}
  for(const encoding of parameters.encodings){
   const values=video?{active:quality!=='voice',maxBitrate:profile.videoBitrate||70000,maxFramerate:profile.fps,scaleResolutionDownBy:profile.scale}:{maxBitrate:profile.audioBitrate};
   for(const [key,value]of Object.entries(values))if((encoding as any)[key]!==value){(encoding as any)[key]=value;changed=true;}
  }
  try{if(changed)await sender.setParameters(parameters);if(video&&quality==='voice')paused=true;}catch{/* Built-in WebRTC congestion control remains active if tuning is unsupported. */}
 }));
 return paused;
}
