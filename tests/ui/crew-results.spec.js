import { test, expect } from '@playwright/test';
import { seedFixtureRace, openApp } from './helpers.js';

test.describe('ASMG crew results',()=>{
  test.beforeEach(async({page})=>{await openApp(page);await seedFixtureRace(page);});

  test('opens results only on demand, filters both views by class, and searches crews',async({page})=>{
    const dialog=page.locator('.crew-results-dialog');
    const dialogClass=page.locator('#crewResultsDialogClass');
    await expect(dialog).not.toBeVisible();
    await page.getByRole('button',{name:/Все результаты/}).click();
    await expect(dialog).toBeVisible();
    await expect(page.locator('#crewResultsStage')).toHaveValue('overall');
    await dialogClass.selectOption('Абсолют');

    const rows=page.locator('[data-crew-row]');
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText('Гожев Руслан / Коломиец Денис');
    await expect(rows.first()).toContainText('Skoda Fabia Rally2 Evo');
    await expect(rows.first()).toContainText('Абсолют');
    await expect(rows.nth(2)).toContainText('Гаврилов Клим / Еникеев Кирилл');

    await dialogClass.selectOption('R5');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Сидоров Иван / Петров Павел');
    await dialogClass.selectOption('');
    await expect(rows).toHaveCount(5);

    await page.locator('#crewResultsSearch').fill('40');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Жигунов Андрей / Аксаков Алексей');
    await page.getByRole('button',{name:'Закрыть результаты'}).click();
    await expect(dialog).not.toBeVisible();
  });

  test('shows cumulative time and selected-stage time in the table',async({page})=>{
    await page.getByRole('button',{name:/Все результаты/}).click();
    await expect(page.locator('.crew-results-dialog')).toBeVisible();
    const firstRow=page.locator('[data-crew-row]').first();
    await expect(firstRow).toContainText('00:14:50:0');
    await expect(page.locator('#crewResultsTimeHeading')).toContainText('Общий итог');

    await page.locator('#crewResultsStage').selectOption('0');
    await expect(page.locator('#crewResultsTimeHeading')).toContainText('СУ 2 · Пуйккола');
    await expect(firstRow).toContainText('00:14:50:0');
  });

  test('stores a followed crew so the service worker can refresh it offline',async({page})=>{
    await page.getByRole('button',{name:/Все результаты/}).click();
    await expect(page.locator('.crew-results-dialog')).toBeVisible();
    const row=page.locator('[data-crew-row]').first();
    await row.getByRole('button',{name:/Следить за экипажем/}).click();
    await expect(row.getByRole('button',{name:/Отписаться от экипажа/})).toBeVisible();
    const saved=await page.evaluate(async()=>{
      const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('rallyfans-offline',3);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      return await new Promise((resolve,reject)=>{const request=db.transaction('crewSubscriptions').objectStore('crewSubscriptions').getAll();request.onsuccess=()=>{db.close();resolve(request.result);};request.onerror=()=>reject(request.error);});
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({asmgRaceId:'55',crewId:'2273',name:'Гожев Руслан / Коломиец Денис'});
  });
});
