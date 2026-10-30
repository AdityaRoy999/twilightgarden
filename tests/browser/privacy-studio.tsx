// Visual fixture only: no auth, production data or disconnect API requests.
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {ThemeProvider,useTheme} from '../../contexts/ThemeContext';
import {ConfirmAction} from '../../components/ConfirmAction';
import '../../index.css';import '../../styles/bloom.css';import '../../styles/spring.css';import '../../styles/dark.css';import '../../styles/finish.css';
function Studio(){const [open,setOpen]=useState(true),{toggleTheme}=useTheme();return <main className="privacy-center"><h1>Disconnect · visual preview</h1><p>This fixture does not disconnect anyone.</p><button className="reference-button" onClick={()=>setOpen(true)}>Open dialog</button><button className="reference-button secondary" onClick={toggleTheme}>Change theme</button>{open&&<ConfirmAction title="Disconnect" message="Messages, reactions, games, shared attachments, chat backups and registered chat keys will be deleted for both of you. Personal health records stay with their owner. Reconnecting starts fresh and needs a new backup password." confirmLabel="Disconnect" onConfirm={()=>setOpen(false)} onCancel={()=>setOpen(false)}/>}</main>;}
createRoot(document.getElementById('root')!).render(<ThemeProvider><Studio/></ThemeProvider>);
