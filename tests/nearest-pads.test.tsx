// @vitest-environment jsdom
import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const fixture=vi.hoisted(()=>({search:vi.fn(),route:vi.fn()}));
vi.mock('../lib/wellnessAI',()=>({searchNearbyPharmacies:fixture.search,getRouteToShop:fixture.route}));
vi.mock('../contexts/ThemeContext',()=>({useTheme:()=>({theme:'light'})}));
vi.mock('../components/wellness/PharmacyMap',()=>({default:()=> <div aria-label="Store map"/>}));
import {NearestPads} from '../components/wellness/NearestPads';
beforeEach(()=>{fixture.search.mockReset();fixture.route.mockReset();});afterEach(cleanup);
it('waits for explicit location action and offers a manual area fallback after permission denial',async()=>{
 const locate=vi.fn((_ok,failure)=>failure({code:1}));Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:locate},configurable:true});
 render(<NearestPads/>);expect(locate).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Use my location'}));
 expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.getByText(/Location access is off/)).toBeTruthy();
 fixture.search.mockResolvedValue([{id:'1',name:'Local Store',address:'City area',lat:22.6,lon:88.4}]);
 fireEvent.change(screen.getByLabelText('Or search an area or city'),{target:{value:'Kolkata'}});fireEvent.click(screen.getByRole('button',{name:'Search pharmacies by area'}));
 expect(await screen.findByText('Local Store')).toBeTruthy();expect(fixture.search).toHaveBeenCalledWith(undefined,undefined,'Kolkata');
 expect(screen.getByRole('link',{name:'Walking'}).getAttribute('href')).toContain('travelmode=walking');
 expect(screen.queryByText(/km away/)).toBeNull();
});
it('reports provider failure instead of showing a false empty search',async()=>{
 fixture.search.mockRejectedValue(new Error('Search unavailable'));
 render(<NearestPads/>);fireEvent.change(screen.getByLabelText('Or search an area or city'),{target:{value:'Delhi'}});fireEvent.click(screen.getByRole('button',{name:'Search pharmacies by area'}));
 expect(await screen.findByText('Search unavailable')).toBeTruthy();expect(screen.queryByText('No stores found in this search')).toBeNull();
});
it('ends a successful empty search with a useful Maps fallback',async()=>{
 fixture.search.mockResolvedValue([]);render(<NearestPads/>);fireEvent.change(screen.getByLabelText('Or search an area or city'),{target:{value:'Local area'}});fireEvent.click(screen.getByRole('button',{name:'Search pharmacies by area'}));
 expect(await screen.findByText('No stores found in this search')).toBeTruthy();await waitFor(()=>expect(screen.queryByRole('status')).toBeNull());expect(screen.getByRole('link',{name:/Search in Maps/})).toBeTruthy();
});
