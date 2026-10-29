import {expect,it,vi} from 'vitest';
import {applyCallQuality,CallStatsSampler,nextCallQuality,recommendedCallQuality} from '../lib/callQuality';
const network=(availableBitrate:number|null,rttMs=50,loss=0)=>({availableBitrate,rttMs,loss});
it('prioritizes speech when capacity is tiny and reduces video under loss or delay',()=>{
 expect(recommendedCallQuality(network(80000))).toBe('voice');
 expect(recommendedCallQuality(network(250000))).toBe('low');
 expect(recommendedCallQuality(network(800000))).toBe('balanced');
 expect(recommendedCallQuality(network(2000000))).toBe('clear');
 expect(recommendedCallQuality(network(5000000))).toBe('hd');
 expect(recommendedCallQuality(network(5000000,50,.15))).toBe('low');
 expect(recommendedCallQuality(network(null))).toBe('clear');
});
it('drops quality immediately but raises one tier only after three good samples',()=>{
 expect(nextCallQuality('hd','voice',2)).toEqual({quality:'voice',goodSamples:0});
 expect(nextCallQuality('low','hd',0)).toEqual({quality:'low',goodSamples:1});
 expect(nextCallQuality('low','hd',1)).toEqual({quality:'low',goodSamples:2});
 expect(nextCallQuality('low','hd',2)).toEqual({quality:'balanced',goodSamples:0});
});
it('measures selected-pair delay, interval loss, jitter and actual outgoing video',()=>{
 const sampler=new CallStatsSampler();
 const report=(bytes:number,received:number,lost:number,timestamp:number)=>new Map([
  ['transport',{id:'transport',type:'transport',selectedCandidatePairId:'pair'}],
  ['pair',{id:'pair',type:'candidate-pair',currentRoundTripTime:.08,availableOutgoingBitrate:1500000}],
  ['audio',{id:'audio',type:'inbound-rtp',kind:'audio',jitter:.012,packetsReceived:received,packetsLost:lost,timestamp}],
  ['video',{id:'video',type:'outbound-rtp',kind:'video',bytesSent:bytes,frameWidth:1280,frameHeight:720,timestamp}],
 ]) as unknown as RTCStatsReport;
 sampler.sample(report(1000,100,0,1000));
 expect(sampler.sample(report(101000,190,10,3000))).toMatchObject({rttMs:80,availableBitrate:1500000,loss:.1,receivedJitterMs:12,videoHeight:720,sentKbps:400});
});
it('pauses and resumes the video encoding without unmuting the user’s tracks',async()=>{
 const video={track:{kind:'video',enabled:false},getParameters:()=>({encodings:[{}]}),setParameters:vi.fn(async()=>{})};
 const audio={track:{kind:'audio',enabled:false},getParameters:()=>({encodings:[{}]}),setParameters:vi.fn(async()=>{})};
 const pc={getSenders:()=>[video,audio]} as unknown as RTCPeerConnection;
 expect(await applyCallQuality(pc,'voice')).toBe(true);
 expect(video.setParameters).toHaveBeenLastCalledWith(expect.objectContaining({encodings:[expect.objectContaining({active:false})]}));
 expect(await applyCallQuality(pc,'hd')).toBe(false);
 expect(video.setParameters).toHaveBeenLastCalledWith(expect.objectContaining({encodings:[expect.objectContaining({active:true,maxBitrate:2800000,scaleResolutionDownBy:1})]}));
 expect(video.track.enabled).toBe(false);expect(audio.track.enabled).toBe(false);
});
it('falls back to browser congestion control when sender tuning is unsupported',async()=>{
 expect(await applyCallQuality({getSenders:()=>[]} as unknown as RTCPeerConnection,'voice')).toBe(false);
});
it('keeps the intended resolution after replacing a camera with 720p effects or a portrait source',async()=>{
 const settings={width:1920,height:1080};
 const video={track:{kind:'video',getSettings:()=>settings},getParameters:()=>({encodings:[{}]}),setParameters:vi.fn(async()=>{})};
 const pc={getSenders:()=>[video]} as unknown as RTCPeerConnection;
 await applyCallQuality(pc,'clear');
 expect(video.setParameters).toHaveBeenLastCalledWith(expect.objectContaining({encodings:[expect.objectContaining({scaleResolutionDownBy:1.5})]}));
 settings.width=1280;settings.height=720;await applyCallQuality(pc,'clear');
 expect(video.setParameters).toHaveBeenLastCalledWith(expect.objectContaining({encodings:[expect.objectContaining({scaleResolutionDownBy:1})]}));
 settings.width=720;settings.height=1280;await applyCallQuality(pc,'clear');
 expect(video.setParameters).toHaveBeenLastCalledWith(expect.objectContaining({encodings:[expect.objectContaining({scaleResolutionDownBy:1})]}));
 await applyCallQuality(pc,'low');
 expect(video.setParameters).toHaveBeenLastCalledWith(expect.objectContaining({encodings:[expect.objectContaining({scaleResolutionDownBy:4,maxBitrate:70000})]}));
});
