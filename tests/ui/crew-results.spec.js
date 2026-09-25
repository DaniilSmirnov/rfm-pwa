import { test, expect } from '@playwright/test';
import { downloadFixtureRace, openApp } from './helpers.js';

test.describe('ASMG crew results',()=>{
  test.beforeEach(async({page})=>{await openApp(page);await downloadFixtureRace(page);});

  test('shows the top three first and finds other crews by search',async({page})=>{
    await expect(page.locator('#crewResultsStage')).toHaveValue('overall');
    const cards=page.locator('[data-crew-card]');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText('Гожев Руслан / Коломиец Денис');
    await expect(cards.nth(2)).toContainText('Гаврилов Клим / Еникеев Кирилл');
    await page.locator('#crewResultsSearch').fill('40');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Жигунов Андрей / Аксаков Алексей');
  });

  test('expands full result details for a crew',async({page})=>{
    const card=page.locator('[data-crew-card]').first();
    await card.locator('summary').click();
    await expect(card).toContainText('Skoda Fabia Rally2 Evo');
    await expect(card).toContainText('00:14:50:0');
    await expect(card).toContainText('120.3 км/ч');
  });

  test('stores a followed crew so the service worker can refresh it offline',async({page})=>{
    const card=page.locator('[data-crew-card]').first();
    await card.locator('summary').click();
    await card.getByRole('button',{name:'Следить за экипажем'}).click();
    await expect(card.getByRole('button',{name:'Отписаться от экипажа'})).toBeVisible();
    const saved=await page.evaluate(async()=>{
      const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('rallyfans-offline',3);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      return await new Promise((resolve,reject)=>{const request=db.transaction('crewSubscriptions').objectStore('crewSubscriptions').getAll();request.onsuccess=()=>{db.close();resolve(request.result);};request.onerror=()=>reject(request.error);});
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({asmgRaceId:'101',crewId:'2273',name:'Гожев Руслан / Коломиец Денис'});
  });
});
