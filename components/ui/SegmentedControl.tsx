import React from 'react';
import {AppIcon} from './Icons';
export function SegmentedControl<T extends string>({value,options,onChange,label,className=''}:{value:T;options:readonly {value:T;label:string;icon?:string}[];onChange:(value:T)=>void;label:string;className?:string}){
 return <div className={`gentle-segments ${className}`} role="group" data-count={options.length} style={{'--segment-count':options.length} as React.CSSProperties} aria-label={label}>{options.map(option=><button key={option.value} type="button" aria-pressed={value===option.value} onClick={()=>onChange(option.value)}><span className="segment-content">{option.icon?<AppIcon name={option.icon} size={21}/>:null}{option.label}</span></button>)}</div>;
}
