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
  for(const [type,date] of [['Marriage','2000'],['Divorce','2010'],['Marriage','2015']]) {
    await page.getByRole('combobox', {name:'Event', exact:true}).selectOption(type);
    await page.getByLabel('Date', {exact:true}).fill(date);
    await page.getByRole('button', {name:'Add event',exact:true}).click();
  }
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
  await expect(page.getByText(/· Unchanged/)).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('button',{name:'Save copy'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:true});
  expect(privateRequests).toEqual([]);
  expect(errors).toEqual([]);
});
