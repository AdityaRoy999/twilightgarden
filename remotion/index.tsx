import React from 'react';
import {registerRoot,Composition} from 'remotion';
import {TutorialFilm,filmDuration} from '../components/tutorials/TutorialFilm';
import {tutorialRegistry} from '../components/tutorials/tutorialData';
const Root=()=> <>{Object.keys(tutorialRegistry).flatMap(gameId=>['light','dark'].map(theme=><Composition key={`${gameId}-${theme}`} id={`${gameId}-${theme}`} component={TutorialFilm} durationInFrames={filmDuration(gameId,30)} fps={30} width={720} height={1080} defaultProps={{gameId,dark:theme==='dark',reduce:false}}/>))}</>;
registerRoot(Root);
