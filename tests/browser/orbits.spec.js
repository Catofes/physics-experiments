import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const ids=['newton-cannon','satellite-orbit','earth-moon-transfer','geosynchronous','earth-moon-sun','change6-orbit'];
for(const id of ids)test(`${id} 目录入口、交互、布局与退出清理`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame;window.pendingFrames=new Set();window.requestAnimationFrame=callback=>{let id=request(t=>{window.pendingFrames.delete(id);callback(t)});window.pendingFrames.add(id);return id};window.cancelAnimationFrame=id=>{window.pendingFrames.delete(id);cancel(id)};});
 await page.goto('/');await page.locator(`a[href="/experiments/${id}"]`).click();
 await expect(page.getByRole('heading',{level:1})).toBeVisible();
 if(id==='geosynchronous'){
  await page.getByRole('button',{name:'切换静止卫星'}).click();await expect(page.locator('.lab-observation')).toContainText('星下点固定');
  await page.getByRole('button',{name:'恢复倾斜轨道'}).click();await page.getByRole('button',{name:'跳到 A 点'}).click();await expect(page.getByRole('slider',{name:'时间进度',exact:true})).toHaveValue('16.7');
 }else{
  await expect(page.getByLabel('轨道演示画布')).toBeVisible();await page.getByRole('button',{name:'放大视图',exact:true}).click();
  if(id==='satellite-orbit'||id==='earth-moon-transfer'){
   await expect(page.getByRole('button',{name:'顺轨加速',exact:true})).toBeDisabled();await page.getByRole('button',{name:'暂停模拟',exact:true}).click();await page.getByRole('group',{name:'加减速步长',exact:true}).getByRole('button',{name:'250',exact:true}).click();await page.getByRole('button',{name:'顺轨加速',exact:true}).click();await expect(page.locator('.orbit-status')).toContainText('椭圆轨道');await expect(page.locator('.delta-readings')).toContainText('+250.0');
  }else if(id==='newton-cannon'){await page.getByRole('button',{name:'精确圆轨道',exact:true}).click();await expect(page.getByLabel('轨道参数')).toContainText('圆轨道');await expect(page.getByLabel('轨道参数').locator('.katex')).toHaveCount(2);await expect(page.locator('.katex-error')).toHaveCount(0);}
 }
 const pause=page.getByRole('button',{name:'暂停演示',exact:true});if(await pause.count())await pause.click();
 await page.getByRole('button',{name:'重置实验',exact:true}).click();await expect(page.getByRole('button',{name:['satellite-orbit','earth-moon-transfer'].includes(id)?'继续模拟':'开始 / 继续',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`/tmp/${id}-${test.info().project.name}.png`,fullPage:true});
 await page.getByRole('link',{name:'← 实验目录'}).click();await expect(page.getByRole('heading',{name:'实验目录',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>window.pendingFrames.size)).toBe(0);expect(errors).toEqual([]);
});
test('卫星档案导出、读取、只读回放和继续实验',async({page})=>{
 await page.goto('/experiments/satellite-orbit');await page.getByRole('button',{name:'暂停模拟',exact:true}).click();await page.getByRole('button',{name:'顺轨加速',exact:true}).click();await page.getByRole('button',{name:'继续模拟',exact:true}).click();await page.waitForTimeout(300);await page.getByRole('button',{name:'暂停模拟',exact:true}).click();await page.getByRole('button',{name:'实验档案',exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出实验档案'}).click();const download=await downloadPromise;await page.locator('input[type=file]').setInputFiles(await download.path());await expect(page.locator('.replay-controls')).toContainText('只读回放');await expect(page.getByRole('button',{name:'顺轨加速',exact:true})).toBeDisabled();await expect(page.getByRole('slider',{name:'回放时间',exact:true})).toHaveValue('0');await page.getByRole('button',{name:'退出回放，继续实验'}).click();await expect(page.getByRole('button',{name:'顺轨加速',exact:true})).toBeEnabled();
});
for(const id of ['satellite-orbit','earth-moon-transfer'])test(id+' 必须暂停后瞬时变速，精调不推进时间，继续才移动',async({page})=>{
 await page.goto('/experiments/'+id);
 const speed=page.getByTestId('satellite-speed'),clock=page.getByTestId('mission-time'),accelerate=page.getByRole('button',{name:'顺轨加速',exact:true});
 await expect(accelerate).toBeDisabled();await expect(page.getByRole('button',{name:'按推荐值精确圆化'})).toBeDisabled();
 await page.getByRole('button',{name:'暂停模拟',exact:true}).click();
 const time=await clock.textContent(),before=parseFloat(await speed.textContent());
 await accelerate.click();await accelerate.click();await page.getByRole('group',{name:'加减速步长',exact:true}).getByRole('button',{name:'5',exact:true}).click();await page.getByRole('button',{name:'逆轨减速',exact:true}).click();
 await expect(clock).toHaveText(time);expect(parseFloat(await speed.textContent())-before).toBeCloseTo(.015,3);
 await expect(page.locator('.delta-readings')).toContainText('+15.0');await expect(page.locator('.delta-readings')).toContainText('25.0');
 await page.getByText('变轨记录',{exact:true}).click();await expect(page.locator('.footer-actions li')).toHaveCount(1);await expect(page.locator('.footer-actions li')).toContainText('3 次精调');
 await page.waitForTimeout(300);await expect(clock).toHaveText(time);await expect(page.getByRole('button',{name:'继续模拟',exact:true})).toBeVisible();
 await page.screenshot({path:'/tmp/'+id+'-paused-'+test.info().project.name+'.png',fullPage:true});
 if(id==='satellite-orbit'){
  await page.getByRole('button',{name:'实验档案',exact:true}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'导出实验档案'}).click();const file=await downloaded,data=JSON.parse(readFileSync(await file.path(),'utf8'));
  expect(data.events).toHaveLength(1);expect(data.events[0].adjustments).toHaveLength(3);expect(data.state.simTime).toBe(data.events[0].simTime);expect(data.state.position).toEqual(data.events[0].position);
  await page.getByRole('button',{name:'关闭实验档案',exact:true}).click();
 }

 await page.getByRole('button',{name:'继续模拟',exact:true}).click();await expect(accelerate).toBeDisabled();await expect(clock).not.toHaveText(time);
});

test('星下点轨道预设、自转开关、精调与响应式双图',async({page},info)=>{
 await page.goto('/experiments/geosynchronous');
 const preset=page.getByRole('group',{name:'轨道预设',exact:true});
 await preset.getByRole('button',{name:'近地轨道',exact:true}).click();
 await expect(page.getByRole('slider',{name:'轨道高度',exact:true})).toHaveAttribute('aria-valuetext','400 km');
 await expect(page.locator('.lab-observation')).toContainText('92.4 min');
 await page.getByRole('group',{name:'显示圈数',exact:true}).getByRole('button',{name:'3 圈',exact:true}).click();
 const rotatingPath=await page.locator('.map path').getAttribute('d');
 expect((rotatingPath.match(/M/g)||[]).length).toBeGreaterThan(1);
 await page.getByRole('checkbox',{name:'考虑地球自转'}).uncheck();
 await expect(page.locator('.lab-observation')).toContainText('地球自转已关闭');
 expect(await page.locator('.map path').getAttribute('d')).not.toBe(rotatingPath);
 for(const name of ['中轨道','高轨道','极地轨道'])await preset.getByRole('button',{name,exact:true}).click();
 await expect(page.getByRole('slider',{name:'轨道倾角',exact:true})).toHaveValue('90');
 await page.getByRole('checkbox',{name:'考虑地球自转'}).check();
 await preset.getByRole('button',{name:'静止轨道',exact:true}).click();
 await expect(page.locator('.lab-observation')).toContainText('星下点固定');
 await page.getByRole('slider',{name:'轨道倾角',exact:true}).fill('120');
 await expect(preset.getByRole('button',{pressed:true})).toHaveCount(0);
 await expect(page.locator('.lab-observation')).toContainText('极地或逆行轨道');
 await expect(page.getByRole('button',{name:'开始 / 继续',exact:true})).toBeVisible();
 const space=await page.locator('.space').boundingBox(),map=await page.locator('.map').boundingBox();
 if(info.project.name==='desktop'){expect(Math.abs(space.y-map.y)).toBeLessThan(2);expect(map.x).toBeGreaterThan(space.x+space.width);}
 else{expect(map.y).toBeGreaterThan(space.y+space.height);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`/tmp/ground-track-${info.project.name}.png`,fullPage:true});
});

test('三维地球贴图、参考面与卫星镜头跟随',async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/experiments/geosynchronous');
 await page.getByRole('button',{name:'暂停演示',exact:true}).click();
 await expect(page.locator('.space')).toHaveAttribute('data-texture','ready');
 await expect(page.getByRole('img',{name:'三维地球与卫星视角'})).toBeVisible();
 await page.getByRole('checkbox',{name:'黄道面',exact:true}).check();
 await expect(page.locator('.view-explainer')).toContainText('23.4°');
 await page.screenshot({path:`/tmp/globe-overview-${info.project.name}.png`,fullPage:true});
 const cameras=page.getByRole('group',{name:'观察视角',exact:true});
 const progress=page.getByRole('slider',{name:'时间进度',exact:true});
 const before=await progress.inputValue();
 await cameras.getByRole('button',{name:'卫星俯视',exact:true}).click();
 await expect(page.locator('.space')).toHaveAttribute('data-mode','nadir');
 await expect(progress).toHaveValue(before);
 await expect(page.getByRole('group',{name:'空间参考面'})).toHaveCount(0);
 await expect(page.locator('.crosshair')).toBeVisible();
 await page.screenshot({path:`/tmp/globe-satellite-${info.project.name}.png`,fullPage:true});
 await page.getByRole('group',{name:'轨道预设',exact:true}).getByRole('button',{name:'近地轨道',exact:true}).click();
 await cameras.getByRole('button',{name:'前向地平线',exact:true}).click();
 await progress.fill('16.7');
 await expect(page.locator('.space')).toHaveAttribute('data-mode','horizon');
 await page.screenshot({path:`/tmp/globe-horizon-${info.project.name}.png`,fullPage:true});
 for(const name of ['中轨道','同步轨道','高轨道']){
  await page.getByRole('group',{name:'轨道预设',exact:true}).getByRole('button',{name,exact:true}).click();
  await expect(page.locator('.space')).toHaveAttribute('data-mode','horizon');
  await expect(page.locator('.view-explainer')).toContainText('随高度调整取景');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.locator('.space').screenshot({path:`/tmp/horizon-${name}-${info.project.name}.png`});
 }
 await page.getByRole('group',{name:'轨道预设',exact:true}).getByRole('button',{name:'极地轨道',exact:true}).click();
 await cameras.getByRole('button',{name:'卫星俯视',exact:true}).click();
 await progress.fill('25');await page.getByRole('checkbox',{name:'考虑地球自转'}).uncheck();
 await cameras.getByRole('button',{name:'轨道全景',exact:true}).click();
 await page.getByRole('button',{name:'恢复视角',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('link',{name:'← 实验目录'}).click();expect(errors).toEqual([]);
});

test('地球表面星下点轨迹在俯视和地平线可见，并可独立隐藏',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/experiments/geosynchronous');
 await page.getByRole('button',{name:'暂停演示',exact:true}).click();
 await expect(page.locator('.space')).toHaveAttribute('data-texture','ready');
 const cameras=page.getByRole('group',{name:'观察视角',exact:true});
 await cameras.getByRole('button',{name:'卫星俯视',exact:true}).click();
 const toggle=page.getByRole('checkbox',{name:'地表星下点轨迹'}),canvas=page.getByRole('img',{name:'三维地球与卫星视角'});
 const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect(toggle).toBeChecked();await frame();
 const visible=await canvas.screenshot();
 await toggle.uncheck();await frame();
 const hidden=await canvas.screenshot();expect(visible.equals(hidden)).toBe(false);
 await toggle.check();await frame();
 expect((await canvas.screenshot()).equals(visible)).toBe(true);
 await page.locator('.space').screenshot({path:`/tmp/surface-track-sync-${info.project.name}.png`});
 await page.getByRole('group',{name:'轨道预设',exact:true}).getByRole('button',{name:'近地轨道',exact:true}).click();
 await page.getByRole('group',{name:'显示圈数',exact:true}).getByRole('button',{name:'3 圈',exact:true}).click();
 await page.getByRole('slider',{name:'时间进度',exact:true}).fill('5.6');
 await frame();await page.locator('.space').screenshot({path:`/tmp/surface-track-leo-${info.project.name}.png`});
 await cameras.getByRole('button',{name:'前向地平线',exact:true}).click();await frame();
 await page.locator('.space').screenshot({path:`/tmp/surface-track-horizon-${info.project.name}.png`});
 await page.getByRole('checkbox',{name:'考虑地球自转'}).uncheck();
 await page.getByRole('group',{name:'轨道预设',exact:true}).getByRole('button',{name:'极地轨道',exact:true}).click();
 await page.getByRole('slider',{name:'时间进度',exact:true}).fill('25');
 await cameras.getByRole('button',{name:'卫星俯视',exact:true}).click();await frame();
 await expect(toggle).toBeChecked();expect(errors).toEqual([]);
 await page.getByRole('link',{name:'← 实验目录'}).click();
});
