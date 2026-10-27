// Render original Remotion tutorial media only; this is not app UI automation.
import {bundle} from '@remotion/bundler';
import {getCompositions,openBrowser,renderStill} from '@remotion/renderer';
import path from 'node:path';import fs from 'node:fs';
fs.mkdirSync('tmp/tutorial-frames',{recursive:true});
const serveUrl=await bundle({entryPoint:path.resolve('remotion/index.tsx'),publicDir:path.resolve('public'),webpackOverride:config=>({...config,cache:false})});
const browser=await openBrowser('chrome');
try{const compositions=await getCompositions(serveUrl,{puppeteerInstance:browser});for(const composition of compositions){for(const frame of [30,210,390]){await renderStill({serveUrl,composition,frame,output:`tmp/tutorial-frames/${composition.id}-${frame}.png`,puppeteerInstance:browser,scale:.5});}console.log('Verified frames',composition.id);}}finally{await browser.close({silent:true});}
