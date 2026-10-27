export function navigationSelected(destination:string,pathname:string) {
 const path=pathname.replace(/\/+$/,'')||'/';
 if(destination==='/settings')return path==='/settings'||path.startsWith('/settings/')||path==='/notifications';
 if(destination==='/partner/profile')return path==='/partner/profile'||path.startsWith('/partner/profile/')||path==='/partner/notifications';
 if(destination==='/insights'&&['/breathing','/exercise'].includes(path))return true;
 if(destination==='/partner/insights'&&path==='/partner/exercise')return true;
 return path===destination;
}
