// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
const local=vi.hoisted(()=>({addListener:vi.fn().mockResolvedValue({remove:vi.fn()})}));
const push=vi.hoisted(()=>({register:vi.fn(),addListener:vi.fn(),unregister:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'ios'}}));
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:local}));
vi.mock('@capacitor/push-notifications',()=>({PushNotifications:push}));
vi.mock('../lib/supabase',()=>({supabase:{}}));
import {registerPushNotifications} from '../lib/notifications';
afterEach(()=>{window.location.hash='';});
it('initializes local tap handling on iOS without attempting APNs registration',async()=>{
 await registerPushNotifications('recipient');
 expect(local.addListener.mock.calls.map(call=>call[0])).toEqual(['localNotificationReceived','localNotificationActionPerformed']);
 expect(push.register).not.toHaveBeenCalled();expect(push.addListener).not.toHaveBeenCalled();
 const tap=local.addListener.mock.calls.find(call=>call[0]==='localNotificationActionPerformed')![1];
 tap({notification:{id:12000,extra:{url:'/partner/games/tictactoe'}}});
 expect(window.location.hash).toBe('#/partner/games/tictactoe');
});
