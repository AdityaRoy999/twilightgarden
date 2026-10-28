import React,{useState,useRef,useEffect,useLayoutEffect} from 'react';
import {AnimatePresence,motion} from 'framer-motion';
import {useNavigate,useLocation} from 'react-router-dom';
import {formatDistanceToNow} from 'date-fns';
import {useNotifications} from '../hooks/useNotifications';
import {useAuth} from '../contexts/AuthContext';
import {notificationPath} from '../lib/notificationRoutes';
import {AppIcon} from './ui/Icons';
import {MotionPortal} from './ui/MotionPortal';
import {useAppMotion} from '../hooks/useAppMotion';
import {springs,motionTransition} from '../lib/motion';

export default function NotificationBell(){
 const {notifications,unreadCount,markAsRead,markAllAsRead,error}=useNotifications();
 const {user}=useAuth();const {reduced}=useAppMotion();const navigate=useNavigate(),location=useLocation();
 const [open,setOpen]=useState(false),[position,setPosition]=useState({top:80,right:16});
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(!open)return;
  const place=()=>{const rect=trigger.current?.getBoundingClientRect();if(rect)setPosition({top:Math.max(12,Math.min(rect.bottom+10,window.innerHeight-160)),right:Math.max(12,window.innerWidth-rect.right)});};
  place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[open]);
 useEffect(()=>{setOpen(false);},[location.pathname]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!panel.current?.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 const visit=(notification:typeof notifications[number])=>{
  void markAsRead(notification.id);setOpen(false);
  const data=notification.data&&typeof notification.data==='object'&&!Array.isArray(notification.data)?notification.data:{};
  const raw=notification.type.startsWith('game_invite|')?notification.type.split('|')[1]:['game','game_invite'].includes(notification.type)?data.url||'/games':notification.type==='chat'?'/notes':'/dashboard';
  navigate(notificationPath(raw,'/dashboard',user?.role));
 };
 return <><button ref={trigger} aria-label="Notifications" aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="notification-bell relative min-h-11 min-w-11 p-2 rounded-full flex items-center justify-center"><AppIcon name="BellRing" size={24}/>{unreadCount>0&&<span className="notification-count">{unreadCount>9?'9+':unreadCount}</span>}</button>
 <MotionPortal><AnimatePresence>{open&&<motion.div ref={panel} role="region" aria-label="Notifications" className="notification-popover" style={{top:position.top,right:position.right,maxHeight:Math.max(120,window.innerHeight-position.top-16)}} initial={reduced?false:{opacity:0,y:8,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0}} transition={motionTransition(springs.modal,reduced)}><header><h2>Notifications</h2>{unreadCount>0&&<button onClick={()=>void markAllAsRead()}>Mark all read</button>}<button aria-label="Close notifications" onClick={()=>setOpen(false)}><AppIcon name="X" size={22}/></button></header>{error&&<p role="alert">{error}</p>}<div className="notification-list">{!notifications.length?<div className="notification-empty"><AppIcon name="BellOff" size={32}/><p>No notifications yet</p></div>:notifications.map(notification=><button key={notification.id} className="notification-item" data-unread={!notification.is_read} onClick={()=>visit(notification)}><span>{notification.message}</span><small>{(()=>{const date=new Date(notification.created_at);return Number.isNaN(+date)?'':formatDistanceToNow(date,{addSuffix:true});})()}</small></button>)}</div></motion.div>}</AnimatePresence></MotionPortal></>;
}
