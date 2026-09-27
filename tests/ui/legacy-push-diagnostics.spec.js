import {test,expect} from '@playwright/test';
import {openApp} from './helpers.js';

test.describe('legacy push and diagnostics controls',()=>{
  test('explains why push notifications are unavailable',async({page})=>{
    await page.addInitScript(()=>{
      Object.defineProperty(window,'PushManager',{configurable:true,value:undefined});
    });
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.getByRole('button',{name:/Настройки и диагностика/}).click();
    await expect(page.locator('#pushEnableBtn')).toBeDisabled();
    await expect(page.locator('#pushStatus')).toContainText('не поддерживаются');
  });

  test('copies and exports a diagnostics report',async({page})=>{
    await openApp(page);
    for(let tap=0;tap<5;tap++) await page.locator('#headerLogo').click();
    const copy=page.locator('#bootDiagnosticsCopy');
    await copy.click();
    await expect(copy).toHaveText('Скопировано');
    await expect.poll(()=>page.evaluate(()=>window.__copied||'')).toContain('app-script-start');

    const downloadPromise=page.waitForEvent('download');
    await page.locator('#bootDiagnosticsExport').click();
    const download=await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^rfm-diagnostics-.*\.json$/);
    const stream=await download.createReadStream();
    const chunks=[];
    for await(const chunk of stream) chunks.push(chunk);
    const report=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    expect(report.marks.some(mark=>mark.name==='app-script-start')).toBe(true);
    await page.locator('#bootDiagnosticsClose').click();
    await expect(page.locator('#bootDiagnosticsModal')).toBeHidden();
  });
});
