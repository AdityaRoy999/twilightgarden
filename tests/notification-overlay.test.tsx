// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
vi.mock('../hooks/useNotifications',()=>({useNotifications:()=>({notifications:[],unreadCount:0,markAsRead:vi.fn(),markAllAsRead:vi.fn()})}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{role:'user'}})}));
vi.mock('../hooks/useAppMotion',()=>({useAppMotion:()=>({reduced:true})}));
import NotificationBell from '../components/NotificationBell';
afterEach(cleanup);
it('opens outside transformed route content and closes on Escape',()=>{render(<MemoryRouter><div data-testid="route" style={{transform:'translateX(1px)'}}><NotificationBell/></div></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'Notifications'}));const panel=screen.getByRole('region',{name:'Notifications'});expect(screen.getByTestId('route').contains(panel)).toBe(false);expect(panel.closest('[data-twilight-overlays]')).toBeTruthy();expect(screen.getByText('No notifications yet')).toBeTruthy();fireEvent.keyDown(document,{key:'Escape'});expect(screen.getByRole('button',{name:'Notifications'}).getAttribute('aria-expanded')).toBe('false');});
