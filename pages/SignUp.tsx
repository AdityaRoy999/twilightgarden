import React from 'react';
import {useSearchParams} from 'react-router-dom';
import AuthScreen from '../components/AuthScreen';
export default function SignUp(){const [params]=useSearchParams();return <AuthScreen signup partner={params.get('mode')==='partner'}/>;}
