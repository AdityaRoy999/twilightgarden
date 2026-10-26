import React,{useEffect,useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useAuth} from '../../contexts/AuthContext';
import {supabase} from '../../lib/supabase';
export default function PartnerAuthCallback(){
 const {user,loading,refreshUser}=useAuth();const [choosing,setChoosing]=useState(sessionStorage.getItem('twilight-partner-signup')==='true');
 useEffect(()=>{if(loading||!user||!choosing)return;let active=true;
  sessionStorage.removeItem('twilight-partner-signup');
  void (async()=>{if(user.role==='user'){const {error}=await supabase.rpc('choose_initial_account_role',{p_role:'partner'});if(!error)await refreshUser();}if(active)setChoosing(false);})();
  return()=>{active=false;};
 },[loading,user?.id]);
 if(loading||choosing&&user)return <p role="status" className="p-8 text-center">Preparing your account…</p>;
 return <Navigate replace to={!user?'/login':user.role==='admin'?'/admin/users':user.role==='partner'?'/partner/dashboard':'/dashboard'}/>;
}
