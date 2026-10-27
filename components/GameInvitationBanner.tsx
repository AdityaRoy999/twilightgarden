import React, {useEffect} from 'react';
import {AnimatePresence,motion} from 'framer-motion';
import {useLocation,useNavigate} from 'react-router-dom';
import {useNotifications} from '../hooks/useNotifications';
import {useAuth} from '../contexts/AuthContext';
import {useAppMotion} from '../hooks/useAppMotion';
import {motionTransition,springs} from '../lib/motion';
import {notificationPath} from '../lib/notificationRoutes';
import {MotionPortal} from './ui/MotionPortal';
import {AppIcon} from './ui/Icons';

export function GameInvitationBanner() {
  const {arrival,dismissArrival,markAsRead} = useNotifications();
  const {user} = useAuth();
  const {pathname} = useLocation();
  const navigate = useNavigate();
  const {reduced} = useAppMotion();
  const target = notificationPath((arrival?.data as {url?:unknown}|null)?.url,'/games',user?.role);
  const alreadyThere = target === pathname;
  useEffect(()=>{if (arrival && alreadyThere) dismissArrival();},[arrival?.id,alreadyThere,dismissArrival]);
  return <MotionPortal><div className="game-invitation-host"><AnimatePresence>{arrival && !alreadyThere && <motion.article key={arrival.id} className="game-invitation-banner" role="status" initial={reduced?false:{opacity:0,y:-14}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-10}} transition={motionTransition(springs.section,reduced)}>
    <span className="game-invitation-symbol"><AppIcon name="Gamepad2" size={25}/></span>
    <div><strong>A little time together?</strong><p>{arrival.message}</p><button className="game-invitation-join" onClick={()=>{navigate(target);dismissArrival();void markAsRead(arrival.id);}}>Join game <AppIcon name="ArrowRight" size={17}/></button></div>
    <button className="game-invitation-close" aria-label="Dismiss game invitation" onClick={dismissArrival}><AppIcon name="close" size={22}/></button>
  </motion.article>}</AnimatePresence></div></MotionPortal>;
}
