// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const fake=vi.hoisted(()=>({platform:'ios',permission:vi.fn(),schedule:vi.fn(),request:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>fake.platform!=='web',getPlatform:()=>fake.platform}}));
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:{checkPermissions:fake.permission,schedule:fake.schedule,requestPermissions:fake.request}}));
import {presentNativeGameInvitation} from '../lib/gameAlerts';
const note={id:'4d5c4a99-5115-4593-9075-241bcacef236',message:'Your partner invited you to Tic Tac Toe.',data:{url:'/games/tictactoe'}};
beforeEach(()=>{fake.platform='ios';fake.permission.mockReset().mockResolvedValue({display:'granted'});fake.schedule.mockReset();fake.request.mockReset();});afterEach(vi.unstubAllGlobals);
it('presents an authorized iOS local alert with a role-correct tap target',async()=>{await presentNativeGameInvitation(note,'partner',()=>true);const notification=fake.schedule.mock.calls[0][0].notifications[0];expect(notification.extra.url).toBe('/partner/games/tictactoe');expect(notification.body).toBe(note.message);expect(notification.id).toBeGreaterThan(999);expect(fake.request).not.toHaveBeenCalled();});
it('does not ask for permission or schedule when permission is absent',async()=>{fake.permission.mockResolvedValue({display:'denied'});await presentNativeGameInvitation(note,'partner',()=>true);expect(fake.schedule).not.toHaveBeenCalled();expect(fake.request).not.toHaveBeenCalled();});
it('does not schedule for a previous account after permission lookup completes',async()=>{let active=true;fake.permission.mockImplementation(async()=>{active=false;return {display:'granted'};});await presentNativeGameInvitation(note,'partner',()=>active);expect(fake.schedule).not.toHaveBeenCalled();});
it('leaves browser and Android push delivery to their existing transports',async()=>{for(const platform of ['web','android']){fake.platform=platform;await presentNativeGameInvitation(note,'partner',()=>true);}expect(fake.schedule).not.toHaveBeenCalled();});
