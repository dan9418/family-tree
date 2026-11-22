const {test, expect} = require('@playwright/test');
const fs = require('node:fs');

test('person dates edit, undo, discard, and file round trip', async ({page}, testInfo) => {
  await page.goto('/?demo');
  const alex = page.locator('[data-person-id="alex"]');
  await alex.click();
  await page.getByLabel('Birth date', {exact:true}).fill('1950');
  await page.getByLabel('Death date', {exact:true}).fill('2026');
  await page.getByRole('button',{name:'Apply dates',exact:true}).click();
  await expect(alex).toContainText('1950-2026');
  await page.getByRole('button',{name:'Close editor'}).click();
  await page.getByRole('button',{name:'Undo last applied change'}).click();
  await expect(alex).not.toContainText('1950');
  await alex.click();
  await expect(page.getByLabel('Birth date',{exact:true})).toHaveValue('');
  await page.getByLabel('Birth date',{exact:true}).fill('1950');
  await page.getByLabel('Death date',{exact:true}).fill('2026');
  await page.getByRole('button',{name:'Apply dates',exact:true}).click();
  await page.getByLabel('Birth date',{exact:true}).fill('1900');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button',{name:'Close editor'}).click();
  await expect(alex).toContainText('1950-2026');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button',{name:'Save copy'}).click();
  const saved = testInfo.outputPath('fictional-dates.json');
  await (await downloadPromise).saveAs(saved);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('input[type=file]').setInputFiles(saved);
  await alex.click();
  await expect(page.getByLabel('Birth date',{exact:true})).toHaveValue('1950');
  await expect(page.getByLabel('Death date',{exact:true})).toHaveValue('2026');
  await page.getByLabel('Death date',{exact:true}).fill('');
  await page.getByRole('button',{name:'Apply dates',exact:true}).click();
  await expect(alex).toContainText('1950-?');
  await page.getByLabel('Person',{exact:true}).selectOption('robin');
  await expect(page.getByLabel('Birth date',{exact:true})).toHaveValue('');
});

test('year labels, compact partnerships, and fullscreen viewer', async ({page}) => {
  await page.goto('/?demo');
  const data = {persons:[
    {id:'a',names:[{nameForms:[{fullText:'Taylor Example'}]}],facts:[
      {type:'http://gedcomx.org/Birth',date:{original:'1950'}},
      {type:'http://gedcomx.org/Death',date:{original:'2026'}}]},
    {id:'b',names:[{nameForms:[{fullText:'Morgan Example'}]}]}
  ],relationships:[{id:'ab',type:'http://gedcomx.org/Couple',person1:{resource:'#a'},person2:{resource:'#b'},facts:[{type:'http://gedcomx.org/Marriage',date:{original:'1975'}}]}]};
  await page.locator('input[type=file]').setInputFiles({name:'fictional.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  const person = page.locator('[data-person-id="a"]');
  const couple = page.locator('[data-relationship-id="ab"]');
  await expect(person).toContainText('1950-2026');
  await expect(person).toHaveCSS('text-align','center');
  await expect(couple).toContainText('1975');
  const p = await person.boundingBox(), c = await couple.boundingBox();
  expect(c.width).toBeLessThan(p.width);
  expect(c.height).toBeLessThan(p.height);
  await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();
  await expect(page.getByRole('button',{name:'Exit fullscreen',exact:true})).toBeVisible();
  await person.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Close editor'}).click();
  await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
  await expect(page.getByRole('button',{name:'Enter fullscreen',exact:true})).toBeVisible();
});

test('fictional edit, download, and reopen on desktop and mobile', async ({page}, testInfo) => {
  const privateRequests = [];
  page.on('request', request => {if(['/family-tree.json','/family-tree.gedcomx.json'].includes(new URL(request.url()).pathname)) privateRequests.push(request.url());});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?editor&demo');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('[data-person-id="alex"]').click();
  await page.getByLabel('Name', {exact:true}).fill('Alex Revised');
  await page.getByRole('button', {name:'Apply name'}).click();
  const tree = page.locator('section[aria-label="Document tree"]');
  await expect(tree.locator('[data-person-id="alex"]')).toHaveText('Alex Revised');
  await expect(tree.locator('[data-person-id]')).toHaveCount(3);
  for(const [type,date] of [['Marriage','2000'],['Divorce','2010'],['Marriage','2015']]) {
    await page.getByRole('combobox', {name:'Event', exact:true}).selectOption(type);
    await page.getByLabel('Date', {exact:true}).fill(date);
    await page.getByRole('button', {name:'Add event',exact:true}).click();
    await expect(tree.locator('[data-relationship-id="couple-alex-robin"]')).toContainText(date);
  }
  await page.getByRole('button', {name:'Close editor'}).click();
  await tree.locator('[data-person-id="robin"]').click();
  await expect(page.getByLabel('Name', {exact:true})).toHaveValue('Robin Sample');
  await page.getByRole('button', {name:'Close editor'}).click();
  await tree.locator('[data-person-id="alex"]').click();
  await expect(page.getByLabel('Name', {exact:true})).toHaveValue('Alex Revised');
  await page.getByRole('button', {name:'Close editor'}).click();
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
  await tree.locator('[data-relationship-id="couple-alex-robin"]').click();
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Alex Revised');
  await expect(page.getByRole('listitem')).toHaveText(['Marriage: 2000','Divorce: 2010','Marriage: 2015']);
  await expect(tree.locator('[data-relationship-id="couple-alex-robin"]')).toContainText('2015');
  await expect(tree.locator('[data-person-id="alex"]')).toHaveText('Alex Revised');
  await page.getByRole('button', {name:'Close editor'}).click();
  await expect(page.getByText(/· Unchanged/)).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('button',{name:'Save copy'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:true});
  await tree.locator('[data-person-id="alex"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('mobile-dialog.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(privateRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('duplicate names keep separate identities and undo restores the graph', async ({page}) => {
  await page.goto('/?editor&demo');
  const tree = page.locator('section[aria-label="Document tree"]');
  await tree.locator('[data-person-id="alex"]').click();
  await page.getByLabel('Name', {exact:true}).fill('Robin Sample');
  await page.getByRole('button', {name:'Apply name'}).click();
  await expect(tree.locator('[data-person-id="alex"]')).toHaveText('Robin Sample');
  await expect(tree.locator('[data-person-id="robin"]')).toHaveText('Robin Sample');
  await expect(tree.locator('[data-person-id]')).toHaveCount(3);
  await page.getByRole('button', {name:'Close editor'}).click();
  await page.getByRole('button', {name:'Undo last applied change'}).click();
  await expect(tree.locator('[data-person-id="alex"]')).toHaveText('Alex Example');
  await tree.locator('[data-relationship-id="couple-alex-robin"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('combobox', {name:'Event',exact:true}).selectOption('Divorce');
  await page.getByLabel('Date', {exact:true}).fill('2010');
  await page.getByRole('button', {name:'Add event',exact:true}).click();
  await expect(tree.locator('[data-relationship-id="couple-alex-robin"]')).toContainText('2010');
  await expect(tree.locator('[data-relationship-id="parent-alex-casey"]')).toHaveCount(1);
  await page.getByRole('button', {name:'Close editor'}).click();
  await page.getByRole('button', {name:'Undo last applied change'}).click();
  await expect(tree.locator('[data-relationship-id="couple-alex-robin"]')).not.toContainText('2010');
});

test('closing protects unapplied name edits', async ({page}) => {
  await page.goto('/?demo');
  await page.locator('[data-person-id="alex"]').click();
  await page.getByLabel('Name', {exact:true}).fill('Draft Example');
  page.once('dialog', dialog => dialog.dismiss());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Name', {exact:true})).toHaveValue('Draft Example');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name:'Close editor'}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('[data-person-id="alex"]')).toHaveText('Alex Example');
});
