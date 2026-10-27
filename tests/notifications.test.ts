// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const fake=vi.hoisted(()=>({native:false,permission:vi.fn(),schedule:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>fake.native}}));
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:{requestPermissions:fake.permission,schedule:fake.schedule}}));
import {notificationPath} from '../lib/notificationRoutes';
import {showTestNotification} from '../lib/notificationTest';
beforeEach(()=>{fake.native=false;fake.permission.mockReset();fake.schedule.mockReset();});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('notification navigation',()=>{
 it.each(['https://evil.example/notes','javascript:alert(1)','//evil.example/notes',null])('rejects external or invalid targets: %s',value=>expect(notificationPath(value,'/dashboard',undefined,'https://twilight-mocha.vercel.app')).toBe('/dashboard'));
 it('preserves internal hashes and adapts shared screens to the recipient role',()=>{expect(notificationPath('/#/notes','/dashboard','partner')).toBe('/partner/notes');expect(notificationPath('/partner/games/tictactoe','/dashboard','admin')).toBe('/admin/games/tictactoe');expect(notificationPath('/partner/notes','/dashboard','menstruator')).toBe('/notes');});
});
describe('notification self-test',()=>{
 it('schedules a native local notification one second ahead without any push delivery',async()=>{fake.native=true;fake.permission.mockResolvedValue({display:'granted'});const start=Date.now();await showTestNotification();const note=fake.schedule.mock.calls[0][0].notifications[0];expect(note.id).toBe(999);expect(note.schedule.at.getTime()-start).toBeGreaterThanOrEqual(1000);expect(note.extra.url).toBe('/settings/notifications');});
 it('never schedules when native permission is denied',async()=>{fake.native=true;fake.permission.mockResolvedValue({display:'denied'});await expect(showTestNotification()).rejects.toThrow(/denied/);expect(fake.schedule).not.toHaveBeenCalled();});
 it('uses the ready service worker for a browser self-test',async()=>{vi.stubGlobal('Notification',{permission:'granted'});const show=vi.fn();Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve({showNotification:show})}});await showTestNotification();expect(show).toHaveBeenCalledWith('Twilight Garden',expect.objectContaining({data:{url:'/settings/notifications'}}));});
 it('bounds a stuck service worker wait',async()=>{vi.useFakeTimers();vi.stubGlobal('Notification',{permission:'granted'});Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:new Promise(()=>{})}});const pending=expect(showTestNotification()).rejects.toThrow(/has not started/);await vi.advanceTimersByTimeAsync(5001);await pending;});
 it('rejects browser permission denial',async()=>{vi.stubGlobal('Notification',{permission:'denied'});await expect(showTestNotification()).rejects.toThrow(/denied/);});
});
