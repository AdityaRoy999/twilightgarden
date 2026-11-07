import { test, expect } from '@playwright/test';
test('two real SDK clients exchange and decode encrypted video through the local SFU', async ({ browser }) => {
  test.skip(process.env.TEST_LOCAL_SFU !== '1','Start the localhost SFU and set TEST_LOCAL_SFU=1.');
  const alice = await browser.newContext({permissions:['camera','microphone']}), bob = await browser.newContext({permissions:['camera','microphone']});
  try {
    const a = await alice.newPage(), b = await bob.newPage();
    await a.goto('/tests/browser/sfu.html?identity=alice'); await b.goto('/tests/browser/sfu.html?identity=bob');
    await a.getByRole('button',{name:'Join',exact:true}).click();
    await expect(a.locator('#status')).toHaveText('Connected',{timeout:30000});
    await b.getByRole('button',{name:'Join',exact:true}).click();
    await expect(a.locator('#status')).toHaveText('Partner connected',{timeout:30000});
    await expect(b.locator('#status')).toHaveText('Partner connected',{timeout:30000});
    for (const page of [a,b]) {
      await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.getVideoPlaybackQuality().totalVideoFrames),{timeout:20000}).toBeGreaterThan(5);
      await expect.poll(() => page.evaluate(() => (window as any).decodedAudio()),{timeout:15000}).toBeGreaterThan(0.000001);
    }
    await b.getByRole('button',{name:'Leave',exact:true}).click(); await expect(b.locator('#status')).toHaveText('Ended');
  } finally { await alice.close(); await bob.close(); }
});

test('a peer using the wrong media key cannot decode video', async ({browser}) => {
  test.skip(process.env.TEST_LOCAL_SFU !== '1','Start the localhost SFU and set TEST_LOCAL_SFU=1.');
  const alice = await browser.newContext({permissions:['camera','microphone']}), bob = await browser.newContext({permissions:['camera','microphone']});
  try {
    const a = await alice.newPage(), b = await bob.newPage();
    await a.goto('/tests/browser/sfu.html?identity=alice'); await b.goto('/tests/browser/sfu.html?identity=bob&key=wrong-key');
    await a.getByRole('button',{name:'Join',exact:true}).click(); await expect(a.locator('#status')).toHaveText('Connected',{timeout:30000});
    await b.getByRole('button',{name:'Join',exact:true}).click();
    await expect(b.locator('#status')).toHaveText(/Partner connected|Media encryption failed/,{timeout:30000});
    // Use a bounded observation window: signaling can connect while ciphertext remains unreadable.
    await b.waitForTimeout(2500);
    for (const page of [a,b]) expect(await page.locator('video').evaluate((video:HTMLVideoElement) => video.getVideoPlaybackQuality().totalVideoFrames)).toBe(0);
  } finally { await alice.close(); await bob.close(); }
});
test('call controls fit phone and desktop and restore an edge-docked preview', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/tests/browser/call-studio.html');
  await page.getByRole('button',{name:'Start synthetic video call'}).click();
  await expect(page.getByRole('button',{name:'Minimize call'})).toBeVisible();
  await page.getByRole('button',{name:'Hide your preview'}).click();
  await expect(page.getByRole('button',{name:'Restore your video preview'})).toBeVisible();
  await page.getByRole('button',{name:'Restore your video preview'}).click();
  await expect(page.getByRole('button',{name:'Hide your preview'})).toBeVisible();
  await page.getByRole('button',{name:'More',exact:true}).click();
  await page.getByRole('button',{name:'Share device audio: off',exact:true}).click();
  await expect(page.getByRole('button',{name:'Share device audio: on',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:'tmp/call-phone-light.png'});
  await page.getByRole('button',{name:'Close call options'}).click();
  await page.setViewportSize({width:1440,height:900});
  const bounds = await page.locator('.call-controls').boundingBox(); expect(bounds!.width).toBeLessThanOrEqual(540);
  await page.screenshot({path:'tmp/call-desktop-light.png'});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button',{name:'End',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
