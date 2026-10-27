import {expect,it} from 'vitest';
import {navigationSelected} from '../lib/navigation';
it('keeps section selection consistent on nested settings, notification and breathing screens',()=>{
 expect(navigationSelected('/settings','/settings/profile')).toBe(true);
 expect(navigationSelected('/settings','/notifications')).toBe(true);
 expect(navigationSelected('/partner/profile','/partner/notifications')).toBe(true);
 expect(navigationSelected('/insights','/breathing')).toBe(true);
 expect(navigationSelected('/settings','/settings-other')).toBe(false);
 expect(navigationSelected('/notes','/notes/')).toBe(true);
});
