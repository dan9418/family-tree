const {test, expect} = require('@playwright/test');
const fs = require('node:fs');

test('fictional edit, download, and reopen on desktop and mobile', async ({page}, testInfo) => {
  const privateRequests = [];
  page.on('request', request => {if(new URL(request.url()).pathname === '/family-tree.json') privateRequests.push(request.url());});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?editor');
  await page.getByLabel('Name', {exact:true}).fill('Alex Revised');
  await page.getByRole('button', {name:'Apply name'}).click();
  const tree = page.getByRole('region', {name:'Document tree'});
  await expect(tree.locator('[data-person-id="alex"]')).toHaveText('Alex Revised');
  await expect(tree.locator('[data-person-id]')).toHaveCount(3);
  for(const [type,date] of [['Marriage','2000'],['Divorce','2010'],['Marriage','2015']]) {
    await page.getByRole('combobox', {name:'Event', exact:true}).selectOption(type);
    await page.getByLabel('Date', {exact:true}).fill(date);
    await page.getByRole('button', {name:'Add event',exact:true}).click();
    await expect(tree.locator('[data-relationship-id="couple-alex-robin"]')).toContainText(`${type}: ${date}`);
  }
  await tree.locator('[data-person-id="robin"]').click();
  await expect(page.getByLabel('Name', {exact:true})).toHaveValue('Robin Sample');
  await tree.locator('[data-person-id="alex"]').click();
  await expect(page.getByLabel('Name', {exact:true})).toHaveValue('Alex Revised');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name:'Save copy'}).click();
  const download = await downloadPromise;
  const saved = testInfo.outputPath('fictional-roundtrip.json');
  await download.saveAs(saved);
  const document = JSON.parse(fs.readFileSync(saved,'utf8'));
  expect(document.persons[0].names[0].nameForms[0].fullText).toBe('Alex Revised');
  expect(document.relationships[0].facts.map(f=>f.date.original)).toEqual(['2000','2010','2015']);
  page.on('dialog', dialog => dialog.accept());
  await page.locator('input[type=file]').setInputFiles(saved);
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Alex Revised');
  await expect(page.getByRole('listitem')).toHaveText(['Marriage: 2000','Divorce: 2010','Marriage: 2015']);
  await expect(tree.locator('[data-relationship-id="couple-alex-robin"]')).toContainText('Marriage: 2015');
  await expect(tree.locator('[data-person-id="alex"]')).toHaveText('Alex Revised');
  await expect(page.getByText(/· Unchanged/)).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('button',{name:'Save copy'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:true});
  expect(privateRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('duplicate names keep separate identities and undo restores the graph', async ({page}) => {
  await page.goto('/?editor');
  const tree = page.getByRole('region', {name:'Document tree'});
  await page.getByLabel('Name', {exact:true}).fill('Robin Sample');
  await page.getByRole('button', {name:'Apply name'}).click();
  await expect(tree.locator('[data-person-id="alex"]')).toHaveText('Robin Sample');
  await expect(tree.locator('[data-person-id="robin"]')).toHaveText('Robin Sample');
  await expect(tree.locator('[data-person-id]')).toHaveCount(3);
  await page.getByRole('button', {name:'Undo last applied change'}).click();
  await expect(tree.locator('[data-person-id="alex"]')).toHaveText('Alex Example');
  await page.getByRole('combobox', {name:'Event',exact:true}).selectOption('Divorce');
  await page.getByLabel('Date', {exact:true}).fill('2010');
  await page.getByRole('button', {name:'Add event',exact:true}).click();
  await expect(tree.locator('[data-relationship-id="couple-alex-robin"]')).toContainText('Divorce: 2010');
  await expect(tree.locator('[data-relationship-id="parent-alex-casey"]')).toHaveCount(1);
  await page.getByRole('button', {name:'Undo last applied change'}).click();
  await expect(tree.locator('[data-relationship-id="couple-alex-robin"]')).not.toContainText('Divorce');
});
