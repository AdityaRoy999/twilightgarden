import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { getWellnessIllustration, matchWellnessIllustration, parseWellnessGuide, wellnessGuidePrompt, wellnessIllustrations } from '../lib/wellnessGuide';

describe('original illustration catalog', () => {
  it('ships more than 80 distinct subjects and distinct drawings, rather than theme variants', () => {
    expect(wellnessIllustrations.length).toBeGreaterThan(80);
    expect(new Set(wellnessIllustrations.map(art => art.id)).size).toBe(wellnessIllustrations.length);
    const hashes = wellnessIllustrations.map(art => {
      expect(existsSync(`public${art.src}`)).toBe(true);
      const content = readFileSync(`public${art.src}`);
      return createHash('sha256').update(art.format === 'vector' ? content.toString().replace(/<title>.*?<\/title>/,'') : content).digest('hex');
    });
    expect(new Set(hashes).size).toBe(wellnessIllustrations.length);
    for (const art of wellnessIllustrations.filter(art => art.format === 'vector')) {
      const source = readFileSync(`public${art.src}`,'utf8');
      expect(source).not.toMatch(/<script|<image|filter=|http[s]?:\/\/(?!www.w3.org)/);
      expect(source).toContain('<title>');
      expect(existsSync(`public${art.darkSrc}`)).toBe(true);
      expect(readFileSync(`public${art.darkSrc}`,'utf8')).not.toEqual(source);
    }
  });
  it.each([
    ['Gentle Movement','Try gentle stretching.','gentle-stretch'],
    ['Hydration Focus','Try warm herbal tea.','herbal-hydration'],
    ['Hydration & Comfort Check','Offer a warm herbal drink or keep water within reach.','herbal-hydration'],
    ['Rest & Recovery','Allow time to recharge.','rest-recovery'],
    ['Listen Without Fixing','Listen and be present with your partner.','supportive-couple'],
    ['A glass of water','Sip water through the day.','water-glass'],
    ['A handful of nuts','Almonds make a convenient snack.','nuts'],
    ['A quiet reading moment','Read a favorite book.','reading'],
    ['Warmth for cramps','A heating pad may feel comforting.','heat-pad'],
    ['Warm Comfort','A heating pad may feel comforting.','heat-pad'],
  ])('matches %s to its actual subject', (title,body,id) => {
    expect(matchWellnessIllustration(title,body,id).id).toBe(id);
  });
  it('rejects an unrelated model choice and does not allow external image URLs', () => {
    expect(matchWellnessIllustration('Peaceful sleep','Make space for sleep.','herbal-hydration').id).toBe('peaceful-sleep');
    expect(getWellnessIllustration('https://tracker.invalid/image').id).toBe('general-care');
    expect(matchWellnessIllustration('Warm Comfort','Try a heating pad.','self-comfort').id).toBe('heat-pad');
    expect(matchWellnessIllustration('Gentle Movement','Take a short walk.','gentle-stretch').id).toBe('walking-shoes');
  });
  it('uses neutral care for an unknown subject rather than random artwork', () => {
    expect(matchWellnessIllustration('Unrecognized suggestion','An unrecognized suggestion.').id).toBe('general-care');
  });
});

describe('generated guide validation', () => {
  it('accepts structured output and corrects incompatible illustration ids', () => {
    const cards = parseWellnessGuide(JSON.stringify({cards:[{title:'Peaceful sleep',body:'Make space for sleep.',illustrationId:'ginger-tea',actions:['Dim the lights'],quote:'Take your time.'}]}));
    expect(cards[0]).toMatchObject({illustrationId:'peaceful-sleep',actions:['Dim the lights'],quote:'Take your time.'});
  });
  it('keeps older Markdown guidance readable', () => {
    const cards = parseWellnessGuide('🌿 **Gentle Movement**\nTry stretching.\n\n💧 **Hydration Focus**\nEnjoy warm herbal tea.\n\n🌙 **Rest & Recovery**\nGive yourself time to rest.');
    expect(cards.map(card => card.illustrationId)).toEqual(['gentle-stretch','herbal-hydration','rest-recovery']);
  });
  it('does not expose malformed JSON as advice', () => {
    expect(parseWellnessGuide('{"cards":[{"title":"unfinished')).toEqual([]);
    expect(parseWellnessGuide('{"cards":"wrong"}')).toEqual([]);
    expect(parseWellnessGuide('{"cards":[null,12,{}]}')).toEqual([]);
  });
  it('bounds model content and renders it as text, without model-controlled image fields', () => {
    const cards = parseWellnessGuide(JSON.stringify({cards:[{title:'<script>hello</script>',body:'x'.repeat(3000),imageUrl:'https://tracker.invalid',actions:[null,'One'],illustrationId:'../../secrets'}]}));
    expect(cards[0].body.length).toBe(1600);
    expect(cards[0].title).toBe('hello');
    expect(cards[0].actions).toEqual(['One']);
    expect(cards[0]).not.toHaveProperty('imageUrl');
  });
  it('keeps a realistic context and the full catalog inside the API prompt limit', () => {
    const prompt = wellnessGuidePrompt({phase:'Menstrual',cycleDay:2,logHistory:'x'.repeat(2400)},false);
    expect(prompt.length).toBeLessThan(12000);
    expect(prompt).toContain('Exactly 3 cards');
    expect(prompt).toContain('Do not diagnose');
  });
});
