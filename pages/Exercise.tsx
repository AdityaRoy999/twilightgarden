import React from 'react';
import {useData} from '../contexts/DataContext';
import {useCouples} from '../contexts/CouplesContext';
import {ExerciseLibrary} from '../components/exercise/ExerciseLibrary';
import {ReferenceHeading} from '../components/ui/ReferenceArt';
export default function Exercise({partner=false}:{partner?:boolean}){
 const {logs}=useData();const {partnerLogs}=useCouples();
 return <div className="reference-page"><ReferenceHeading title="Exercise" description="Move gently. Let how you feel lead the way."/><ExerciseLibrary logs={partner?partnerLogs:logs} partner={partner}/></div>;
}
