import * as THREE from './three.module.js';
import {createDatacenterInterior} from './interior.js';
const $=s=>document.querySelector(s), W=28,H=24, costs={server:12,solar:10,coal:8,cooling:12,plant:3,cut:0};
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});}catch(e){$('#fallback').hidden=false;throw e;}
$('#world').append(renderer.domElement);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(), ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),tiles=[],animals=[],buildings=[],smokes=[];
scene.background=new THREE.Color('#2e4944');scene.fog=new THREE.Fog('#2e4944',38,83);scene.add(new THREE.HemisphereLight(0xffefd4,0x364838,2.3));const sun=new THREE.DirectionalLight(0xffefd4,3);sun.position.set(-14,28,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24});sun.shadow.bias=-.008;sun.shadow.normalBias=.035;scene.add(sun);
const group=new THREE.Group();scene.add(group);const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:1,flatShading:true});
function box(g,x,y,z,w,h,d,c){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function leaf(g,x,y,z,r,c){const o=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0),mat(c));o.position.set(x,y,z);o.scale.set(1,.8,1);o.castShadow=true;g.add(o);return o;}
function cone(g,x,y,z,r,h,c,sides=5){const o=new THREE.Mesh(new THREE.ConeGeometry(r,h,sides),mat(c));o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;}
let seed=13;function rnd(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}const riverX=z=>Math.sin(z*.24)*2.1+.7;
const base=box(group,0,-1,0,W,.9,H,'#544d35');box(group,0,-1.55,0,W-.6,.2,H-.6,'#333c2c');
function tree(t,young=false){const g=new THREE.Group();g.position.set(t.x,.03,t.z);group.add(g);const trunk=box(g,0,.65,0,.18,1.3,.18,'#695130');let crown=[];if(t.palm){for(let i=0;i<5;i++){let a=i*Math.PI*2/5;const b=box(g,Math.sin(a)*.38,1.65,Math.cos(a)*.38,.25,.14,1.2,'#457845');b.rotation.y=a;b.rotation.z=.25;crown.push(b);}}else{crown=[leaf(g,0,1.4,0,.79,'#3c7140'),leaf(g,.25,1.85,.12,.57,'#5b8645')];}g.scale.setScalar(young?.25:.8+rnd()*.4);t.tree={g,trunk,crown,age:young?0:90};return g;}
for(let iz=0;iz<H;iz++)for(let ix=0;ix<W;ix++){const x=ix-W/2+.5,z=iz-H/2+.5,water=Math.abs(x-riverX(z))<1.35;const color=water?'#649d9a':['#6a8850','#738e56','#789354','#5e8049'][Math.floor(rnd()*4)];const m=box(group,x,water?-.28:-.12,z,.99,water?.17:.44,.99,color);const t={x,z,water,m,color:new THREE.Color(color),damage:0,tree:null,building:null,palm:rnd()<.14};m.userData.tile=t;tiles.push(t);if(!water&&rnd()<.39&&!(x>3&&x<8&&z>-3&&z<2))tree(t);if(!water&&rnd()<.06&&!t.tree)box(group,x,.14,z,.35,.4,.3,'#8f9279');}
const cursor=new THREE.Mesh(new THREE.BoxGeometry(.98,.08,.98),new THREE.MeshBasicMaterial({color:'#e5f5ad',transparent:true,opacity:.65}));cursor.visible=false;group.add(cursor);
function makeAnimal(kind,x,z){const g=new THREE.Group();g.position.set(x,.2,z);group.add(g);const parts=[];if(kind==='capybara'){parts.push(box(g,0,.2,0,.48,.32,.8,'#b29362'),box(g,0,.35,.4,.39,.35,.35,'#b29362'));for(let a of [-1,1])for(let b of [-1,1])parts.push(box(g,a*.15,.02,b*.25,.1,.22,.1,'#725c40'));box(g,-.16,.44,.57,.05,.05,.05,'#17291b');box(g,.16,.44,.57,.05,.05,.05,'#17291b');}else{parts.push(box(g,0,.5,0,.22,.3,.3,'#252c29'));parts.push(box(g,0,.68,.19,.15,.12,.35,'#e7b44b'));parts.push(box(g,0,.48,-.21,.13,.12,.3,'#dc9545'));}const horns=new THREE.Group();cone(horns,-.16,.78,.35,.08,.4,'#cfbdb3');cone(horns,.16,.78,.35,.08,.4,'#cfbdb3');horns.visible=false;g.add(horns);animals.push({g,kind,parts,horns,x,z,phase:rnd()*10});}
for(let i=0;i<8;i++){let z=-9+i*2.7;makeAnimal('capybara',riverX(z)+(i%2?2.4:-2.4),z);}for(let i=0;i<5;i++)makeAnimal('toucan',-10+rnd()*19,-9+rnd()*18);
let interior = null;
let state={interiorTile:null,placed:false,tool:'datacenter',cash:46,price:20,history:[20,20],reputation:0,capacity:1,power:0,cooling:1,coal:0,solar:0,efficiency:0,time:0,damage:0,active:null,completed:0,paused:false,speed:1,ended:false,dc:null,sound:false};let hovered=null,hintTimeout,offerVersion=0;
function hint(s,keep=false){$('#hint').textContent=s;$('#hint').style.opacity='1';clearTimeout(hintTimeout);if(!keep)hintTimeout=setTimeout(()=>$('#hint').style.opacity='0',3200);}
function runningCapacity(){return state.placed?Math.min(state.capacity,state.power,state.cooling):0;}
function operations(){
  $('#cash').textContent=Math.floor(state.cash).toLocaleString('en-US');
  $('#cash').parentElement.setAttribute('aria-label',`Available cash: ${Math.floor(state.cash)} coins`);
  const demand=state.placed?state.capacity:0, running=runningCapacity();
  for(const [id,supply,label] of [['energy',state.power,'Electricity'],['compute',running,'AI capacity online'],['water',state.cooling,'Cooling']]){
    const meter=$(`#${id}`),ratio=demand?Math.min(1,supply/demand):0;
    meter.querySelector('i').style.width=ratio*100+'%';
    meter.classList.toggle('shortage',!!demand&&supply<demand);
    meter.setAttribute('aria-label',`${label}: ${supply} available for ${demand} datacenters`);
    meter.title=supply<demand?`${label} — more infrastructure needed`:`${label} — ready`;
  }
  let index=0;
  for(const t of buildings){if(!['server','datacenter'].includes(t.building.kind))continue;
    const online=index++<running;
    t.building.body.material.color.set(online?'#d4d8bd':'#7e8b80');
    for(const light of t.building.lights)light.material.color.set(online?'#d2e690':'#4c5850');
  }
}
function refreshValue(){
  const target=state.placed?20+state.capacity*4+runningCapacity()*8+state.power*2+state.efficiency*3+state.completed*6+state.reputation+(state.active?state.active.reward*.12:0):20;
  if(Math.abs(Math.max(1,target)-state.price)>.001)changePrice(target-state.price);
  else market();
}
function changeCash(v){state.cash=Math.max(0,state.cash+v);market();}
function market(){operations();const h=state.history.slice(-42), max=Math.max(80,...h)*1.1;const points=h.map((v,i)=>[i/(h.length-1)*220,60-v/max*55]);const d=points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ');$('#chartline').setAttribute('d',d);$('#chartfill').setAttribute('d',d+' L220,65 L0,65Z');$('#chartdot').setAttribute('cx',points.at(-1)[0]);$('#chartdot').setAttribute('cy',points.at(-1)[1]);$('#trend').textContent=h.at(-1)>=h.at(-2)?'↗':'↘';document.querySelectorAll('[data-tool]').forEach(b=>{b.disabled=!state.placed||state.ended||state.cash<costs[b.dataset.tool];b.classList.toggle('selected',state.tool===b.dataset.tool);});}
function changePrice(v){state.price=Math.max(1,state.price+v);state.history.push(state.price);market();}
function chooseTool(tool){if(state.interiorTile)return false;if(!state.placed||state.ended||!(tool in costs)||state.cash<costs[tool])return false;state.tool=tool;market();$('#mode-label').textContent='⌖  '+({server:'PLACE DATACENTER',solar:'PLACE SOLAR',coal:'PLACE GENERATOR',cooling:'PLACE COOLING',cut:'CHOOSE A TREE',plant:'PLANT A TREE'}[tool]);return true;}
function build(t,kind){const g=new THREE.Group();g.position.set(t.x,.15,t.z);group.add(g);let body;const lights=[];
if(kind==='datacenter'||kind==='server'){body=box(g,0,.55,0,.9,1.1,.9,'#d4d8bd');box(g,0,1.14,0,.98,.12,.98,'#74827c');for(let j=0;j<3;j++){box(g,0,.3+j*.27,.46,.65,.1,.025,'#415954');lights.push(box(g,.27,.3+j*.27,.48,.06,.06,.02,'#d2e690'));}box(g,0,.09,0,1.15,.12,1.15,'#afb69e');if(kind==='datacenter'){box(g,0,1.38,0,.15,.4,.15,'#7d8980');} }
if(kind==='solar'){box(g,0,.2,0,.08,.4,.08,'#bbc1aa');body=box(g,0,.47,0,.93,.09,.88,'#284e70');body.rotation.x=-.25;for(let i=-1;i<=1;i++)box(g,i*.28,.52,0,.012,.015,.82,'#85a6ab');}
if(kind==='coal'){body=box(g,0,.4,0,.85,.8,.85,'#635d54');box(g,-.2,1,0,.22,1.4,.22,'#494a46');box(g,.24,.74,.1,.18,.9,.18,'#797968');box(g,0,.3,.44,.45,.23,.05,'#e38e47');for(let i=0;i<5;i++){const p=box(g,-.2,1.9+i*.3,0,.25,.25,.25,'#687269');p.material.transparent=true;p.material.opacity=.45;smokes.push({p,phase:i/5,g});}}
if(kind==='cooling'){body=box(g,0,.3,0,.85,.6,.8,'#a8c0b9');cone(g,0,.85,0,.38,.6,'#dce0c5',8);box(g,0,.1,.5,.1,.12,.6,'#9bb5ad');}
t.building={kind,g,body,lights};g.traverse(o=>{o.userData.tile=t;});buildings.push(t);return g;}
function pipe(t){const water=tiles.filter(t=>t.water).sort((a,b)=>Math.hypot(a.x-t.x,a.z-t.z)-Math.hypot(b.x-t.x,b.z-t.z))[0];const a=new THREE.Vector3(t.x,.11,t.z),b=new THREE.Vector3(water.x,.11,water.z),len=a.distanceTo(b);const p=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,len,6),mat('#a2aba0'));p.position.copy(a.clone().add(b).multiplyScalar(.5));p.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());group.add(p);}
function act(t){if(!t||state.ended||t.water||state.interiorTile)return false;if(['datacenter','server'].includes(t.building?.kind))return enterInterior(t);const k=state.tool;if(k==='datacenter'){if(state.placed||t.building)return false;if(t.tree){group.remove(t.tree.g);t.tree=null;state.damage+=2;}build(t,k);state.placed=true;state.dc=t;pipe(t);state.tool=null;$('#mode-label').textContent='⌖  CHOOSE AN ACTION';hint('Add power  ⚡');renderOffers();refreshValue();tone(330);return true;}
if(!state.placed||!(k in costs)||state.cash<costs[k])return false;if(k==='cut'){if(!t.tree)return hint('♧  Choose a tree'),false;group.remove(t.tree.g);t.tree=null;t.damage+=22;state.damage+=2;changeCash(6);tone(160);return true;}
if(t.tree||t.building)return hint('⌖  Find open ground'),false;if(k==='plant'){tree(t,true);changeCash(-costs[k]);tone(490);return true;}
build(t,k);changeCash(-costs[k]);if(k==='server'){state.capacity++;pipe(t);}if(k==='solar'){state.power++;state.solar++;}if(k==='coal'){state.power+=3;state.coal++;state.damage+=1;}if(k==='cooling'){state.cooling+=3;state.efficiency++;pipe(t);}refreshValue();renderContractProgress();tone(280);return true;}
const offers=[{demand:1,deadline:95,work:42,reward:16},{demand:3,deadline:80,work:48,reward:34},{demand:6,deadline:62,work:46,reward:72}];
function renderOffers() {
  offerVersion++;
  $('#offers').innerHTML = offers.map((o, i) => `
    <button class="offer" data-contract="${i}" aria-label="Accept ${['modest', 'growing', 'ambitious'][i]} contract" ${!state.placed || state.active ? 'disabled' : ''}>
      <div class="offer-icons"><span>${'▥'.repeat(i + 1)}</span>
        <svg viewBox="0 0 36 30"><path d="M2 26L12 ${22-i*2}L21 ${20-i*5}L33 ${16-i*7}" fill="none" stroke="#d8f293" stroke-width="2"/></svg>
      </div>
      <div class="offer-details"><span>${'◉'.repeat(i + 1)}</span>
        <svg class="clock" viewBox="0 0 24 24" role="img" aria-label="Delivery deadline"><circle cx="12" cy="12" r="9" stroke="#60715a" fill="none" stroke-width="2"/><circle class="clock-ring" cx="12" cy="12" r="9" stroke="#d8f293" fill="none" stroke-width="2" stroke-dasharray="56.55" stroke-dashoffset="${i*10}"/></svg>
      </div>
      <div class="progress-caption"><span>AI</span><strong class="progress-value">0%</strong><span class="processing-state" aria-label="Processing status">◉ ↗</span></div>
      <div class="contract-progress" role="progressbar" aria-label="AI contract completed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      <div class="contract-throughput"><span class="processing-rate">0×</span><span class="capacity-note" aria-label="Infrastructure bottleneck"></span></div>
    </button>`).join('');
  document.querySelectorAll('[data-contract]').forEach(b => b.onclick = () => accept(Number(b.dataset.contract)));
  renderContractProgress();
}

// Read current infrastructure on every tick, including buildings added after signing.
function contractThroughput(contract = state.active) {
  if (!contract) return {rate: 0, shortage: null};
  const online = runningCapacity();
  const rate = online / contract.demand;
  let shortage = null;
  if (online < contract.demand || online < state.capacity) {
    shortage = state.power < state.capacity && state.power <= state.cooling ? '⚡'
      : state.cooling < state.capacity ? '≋' : '▥';
  }
  return {rate, shortage};
}

function renderContractProgress() {
  const a = state.active;
  if (!a) return;
  const card = $(`[data-contract="${a.i}"]`);
  const percent = Math.min(100, a.progress / a.work * 100);
  const {rate, shortage} = contractThroughput(a);
  const blocked = rate === 0;
  const processing = !blocked && !state.paused && !state.ended;
  card.classList.add('active');
  card.classList.toggle('processing', processing);
  card.classList.toggle('blocked', blocked);
  const bar = card.querySelector('.contract-progress');
  bar.querySelector('i').style.width = percent + '%';
  bar.setAttribute('aria-valuenow', Math.floor(percent));
  card.querySelector('.progress-value').textContent = Math.floor(percent) + '%';
  const status = card.querySelector('.processing-state');
  status.textContent = state.paused ? 'Ⅱ' : blocked ? (shortage || '▥') : '◉ ↗';
  status.setAttribute('aria-label', state.paused ? 'Paused' : blocked ? 'No operating datacenters' : 'Processing and earning cash');
  const rateLabel = `${Number(rate.toFixed(2))}×`;
  const speed = card.querySelector('.processing-rate');
  speed.textContent = rateLabel;
  speed.setAttribute('aria-label', `Processing speed: ${rateLabel}${state.paused ? ', simulation paused' : ''}`);
  const capacityNote = card.querySelector('.capacity-note');
  capacityNote.textContent = shortage || '';
  const shortageLabel = shortage === '⚡' ? 'More electricity can increase processing speed'
    : shortage === '≋' ? 'More cooling can increase processing speed'
    : shortage === '▥' ? 'More powered and cooled datacenters can increase processing speed' : 'Infrastructure ready';
  capacityNote.setAttribute('aria-label', shortageLabel);
  capacityNote.title = shortageLabel;
  card.querySelector('.clock-ring').setAttribute('stroke-dashoffset', 56.55 * (1 - Math.max(0, a.remaining / a.deadline)));
  card.querySelector('.clock').setAttribute('aria-label', Math.ceil(Math.max(0, a.remaining)) + ' seconds until deadline');
  $('#contract-state').textContent = state.paused ? 'Ⅱ' : blocked ? (shortage || '▥') : '◷';
}

function accept(i) {
  if (!state.placed || state.active || state.ended || !Number.isInteger(i) || i < 0 || i > 2) return false;
  const offer = offers[i];
  // Lock the payout when signing; later construction cannot change this contract's rate.
  const payout = offer.reward * THREE.MathUtils.clamp(1 + state.coal * .25 - state.solar * .04, .6, 2.6);
  state.active = {...offer, i, remaining: offer.deadline, progress: 0, payout, earned: 0};
  refreshValue();
  renderOffers();
  tone(440);
  hint('▥  +  ⚡  +  ≋', false);
  return true;
}

function finishContract(ok) {
  const a = state.active;
  if (ok) {
    // Work already paid as it progressed. Only settle floating-point rounding here.
    changeCash(Math.max(0, a.payout - a.earned));
    state.completed++;
    state.reputation += a.reward * .1;
    tone(660);
    hint('✓  ◉  ↗');
  } else {
    changeCash(-a.reward * .2);
    state.reputation -= a.reward * .3;
    tone(110);
    hint('◷  ↘');
  }
  state.active = null;
  refreshValue();
  $('#contract-state').textContent = '◇ ◇ ◇';
  renderOffers();
}

function processContract(dt) {
  const a = state.active;
  if (!a) return;
  const workingTime = Math.min(dt, Math.max(0, a.remaining));
  a.remaining = Math.max(0, a.remaining - dt);
  const {rate} = contractThroughput(a);
  if (rate > 0) {
    a.progress = Math.min(a.work, a.progress + workingTime * rate);
    const earned = a.payout * a.progress / a.work;
    changeCash(Math.max(0, earned - a.earned));
    a.earned = earned;
  }
  renderContractProgress();
  if (a.progress >= a.work) finishContract(true);
  else if (a.remaining <= 0) finishContract(false);
}
function end(){leaveInterior();state.ended=true;state.tool=null;state.active=null;const bad=state.damage>=58;$('#end-symbol').textContent=bad?'♨':'♧';$('#end-title').textContent=bad?'Everything. At a cost.':'Enough. And alive.';$('#end-copy').textContent=bad?'The company kept growing. The river did not.':'A smaller company. A world that still breathes.';$('#end-chart').innerHTML=$('#chart').innerHTML;$('#ending').hidden=false;market();renderOffers();tone(bad?90:520);}
function enterInterior(tile) {
  if (state.ended || !['datacenter', 'server'].includes(tile?.building?.kind)) return false;
  if (!interior) interior = createDatacenterInterior();
  state.interiorTile = tile;
  cursor.visible = false;
  drag = null;
  $('#game').classList.add('inside-datacenter');
  $('#interior-hud').hidden = false;
  const centers = buildings.filter(t => ['datacenter', 'server'].includes(t.building.kind));
  $('#interior-title').textContent = `DATA / ${String(centers.indexOf(tile) + 1).padStart(2, '0')}`;
  $('#world').setAttribute('aria-label', 'Datacenter interior. Workers walk between server racks. Use the zoom controls or Escape to return to the valley.');
  interior.resize(innerWidth, innerHeight);
  $('#leave-interior').focus({preventScroll: true});
  return true;
}
function leaveInterior() {
  if (!state.interiorTile) return;
  hovered = state.interiorTile;
  state.interiorTile = null;
  drag = null;
  $('#game').classList.remove('inside-datacenter');
  $('#interior-hud').hidden = true;
  $('#world').setAttribute('aria-label', 'Interactive river valley. Select an action, then choose land. Select a datacenter to enter it.');
  $('#world').focus({preventScroll: true});
}
$('#leave-interior').onclick = leaveInterior;
$('#interior-zoom-in').onclick = () => interior?.setZoom(interior.zoom - .12);
$('#interior-zoom-out').onclick = () => interior?.setZoom(interior.zoom + .12);
let camPanX=0,camPanZ=0,zoom=1;
function resize(){const width=innerWidth,height=innerHeight;renderer.setSize(Math.round(width*.68),Math.round(height*.68),false);renderer.domElement.style.width=width+'px';renderer.domElement.style.height=height+'px';const aspect=width/height,view=(aspect<.9?29:27)*zoom;camera.left=-view*aspect/2;camera.right=view*aspect/2;camera.top=view/2;camera.bottom=-view/2;camera.near=.1;camera.far=110;camera.position.set(28+camPanX,32,35+camPanZ);camera.lookAt(camPanX,0,camPanZ);camera.updateProjectionMatrix();interior?.resize(width,height);}addEventListener('resize',resize);resize();
function hover(e){if(state.interiorTile)return;const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects([...tiles.map(t=>t.m),...buildings.map(t=>t.building.g)],true)[0];hovered=hit?.object.userData.tile;cursor.visible=!!hovered&&!hovered.water&&!state.ended&&!!state.tool;if(hovered){cursor.position.set(hovered.x,.15,hovered.z);const valid=!hovered.water&&(state.tool==='cut'?!!hovered.tree:state.tool==='datacenter'||(!hovered.tree&&!hovered.building));cursor.material.color.set(valid?'#e5f5ad':'#df8170');}}
let drag=null;renderer.domElement.addEventListener('pointerdown',e=>{if(state.interiorTile)return;drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};renderer.domElement.setPointerCapture(e.pointerId);});renderer.domElement.addEventListener('pointermove',e=>{if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6)drag.moved=true;if(drag.moved){const scale=(camera.right-camera.left)/innerWidth;camPanX+=(-dx*.78+dy*1.1)*scale;camPanZ+=(dx*.62+dy*1.4)*scale;camPanX=THREE.MathUtils.clamp(camPanX,-15,15);camPanZ=THREE.MathUtils.clamp(camPanZ,-14,14);resize();}drag.x=e.clientX;drag.y=e.clientY;}hover(e);});renderer.domElement.addEventListener('pointerup',e=>{if(drag&&!drag.moved){hover(e);act(hovered);}drag=null;});renderer.domElement.addEventListener('pointercancel',()=>drag=null);renderer.domElement.addEventListener('pointerleave',()=>cursor.visible=false);renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();if(state.interiorTile){interior.setZoom(interior.zoom+e.deltaY*.001);return;}zoom=THREE.MathUtils.clamp(zoom+e.deltaY*.001,.6,1.5);resize();},{passive:false});$('#world').tabIndex=0;$('#world').addEventListener('keydown',e=>{if(state.interiorTile)return;const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(directions[e.key]){e.preventDefault();const d=directions[e.key],start=hovered||tiles.find(t=>!t.water&&!t.tree);hovered=tiles.find(t=>t.x===start.x+d[0]&&t.z===start.z+d[1])||start;cursor.position.set(hovered.x,.15,hovered.z);cursor.visible=true;}if(e.key==='Enter'){e.preventDefault();act(hovered||tiles.find(t=>!t.water&&!t.tree));}});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>chooseTool(b.dataset.tool));$('#pause').onclick=()=>{state.paused=!state.paused;$('#pause').textContent=state.paused?'▶':'Ⅱ';$('#pause').setAttribute('aria-label',state.paused?'Resume':'Pause');renderContractProgress();};$('#speed').onclick=()=>{state.speed=state.speed===1?3:state.speed===3?6:1;$('#speed').textContent=state.speed+'×';};$('#restart').onclick=()=>location.reload();$('#again').onclick=()=>location.reload();addEventListener('keydown',e=>{if(e.target.tagName==='BUTTON'&&e.key===' ')return;const t={s:'server',r:'solar',f:'coal',w:'cooling',x:'cut',t:'plant'}[e.key.toLowerCase()];if(t)chooseTool(t);if(e.code==='Space'){e.preventDefault();$('#pause').click();}if(e.key==='Escape'){if(state.interiorTile){leaveInterior();return;}state.tool=null;market();cursor.visible=false;}});
let audio=null;function tone(f){if(!state.sound||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.22);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.25);}
$('#sound').onclick=()=>{if(!audio){audio=new(window.AudioContext||window.webkitAudioContext)();}audio.resume();state.sound=!state.sound;$('#sound').style.color=state.sound?'#dbef89':'';$('#sound').setAttribute('aria-label',state.sound?'Mute sound':'Enable sound');tone(400);};
function update(dt){if(state.ended||!state.placed)return;state.time+=dt;const trees=tiles.filter(t=>t.tree),mature=trees.filter(t=>t.tree.age>30).length;const baseline=runningCapacity()*.012/(1+state.efficiency*.65);const emissions=state.coal*.18+baseline;const recovery=Math.max(0,(mature-110))*.0007+state.solar*.004;state.damage=THREE.MathUtils.clamp(state.damage+dt*(emissions-recovery),0,100);$('#seasonfill').style.width=Math.min(100,state.time/360*100)+'%';
for(const t of tiles){const sources=buildings.filter(t=>t.building.kind==='coal'||t.building.kind==='server'||t.building.kind==='datacenter');let local=0;for(const b of sources){const d=Math.hypot(t.x-b.x,t.z-b.z);local+=Math.max(0,1-d/7)*(b.building.kind==='coal'?35:6);}const target=THREE.MathUtils.clamp(state.damage+local,0,100);t.damage+=(target-t.damage)*Math.min(1,dt*.035);let color=t.color.clone();if(t.water){color.lerp(new THREE.Color(t.damage>65?'#413a2e':'#728375'),Math.min(1,t.damage/65));if(t.damage>80)color.lerp(new THREE.Color('#983929'),(t.damage-80)/20);}else{color.lerp(new THREE.Color('#8b7850'),Math.min(1,t.damage/45));if(t.damage>40)color.lerp(new THREE.Color('#504d3d'),Math.min(1,(t.damage-40)/40));if(t.damage>80)color.lerp(new THREE.Color('#624039'),(t.damage-80)/20);}t.m.material.color.copy(color);
if(t.tree){const tr=t.tree;tr.age+=dt;const sc=tr.age<90?.25+tr.age/90*.65:Math.min(1,tr.g.scale.x);tr.g.scale.setScalar(sc);for(const c of tr.crown){c.material.color.set(t.damage>70?'#423f32':t.damage>40?'#85754a':t.damage>20?'#788349':'#4b7c43');c.visible=t.damage<65||tr.age<40;}tr.trunk.material.color.set(t.damage>80?'#393633':'#695130');if(tr.age<90)t.damage=Math.max(0,t.damage-dt*.05);}}
for(const a of animals){const near=tiles.reduce((best,t)=>Math.hypot(t.x-a.g.position.x,t.z-a.g.position.z)<Math.hypot(best.x-a.g.position.x,best.z-a.g.position.z)?t:best,tiles[0]);const d=near.damage;const pace=d>50?.2:.7;const time=state.time*pace+a.phase;a.g.position.x=a.x+Math.sin(time*.3)*.7;a.g.position.z=a.z+Math.cos(time*.24)*.6;a.g.rotation.y=Math.sin(time*.2)*2;a.g.position.y=a.kind==='toucan'?1.7+Math.sin(time)*.15:.18+Math.abs(Math.sin(time*4))*(d>40?.06:.025);a.horns.visible=d>80;a.g.scale.set(1,d>65?1.25:1, d>65?.75:1);for(const p of a.parts)p.material.color.set(d>80?'#413332':d>55?'#807459':a.kind==='capybara'?'#b29362':'#343f32');}
processContract(dt);
const infernal=state.damage>78;fires.forEach((f,i)=>{f.visible=infernal&&i<Math.floor((state.damage-78)*1.5);if(f.visible){f.scale.y=.6+Math.abs(Math.sin(state.time*5+i))*.8;}});scene.background.lerp(new THREE.Color(state.damage>75?'#392e2d':state.damage>40?'#454a3e':'#2e4944'),.015);scene.fog.color.copy(scene.background);sun.color.set(state.damage>80?'#ff9a68':'#ffefd4');if(state.sound&&Math.random()<dt*.05*(1-state.damage/100))tone(800+Math.random()*800);if(state.time>=360||(state.damage>=98&&state.time>150))end();}
const fires=[];for(let i=0;i<35;i++){const t=tiles[Math.floor(rnd()*tiles.length)];if(t.water)continue;const g=new THREE.Group();g.position.set(t.x,.2,t.z);cone(g,0,.3,0,.23,.8,'#e47438',4);cone(g,.04,.12,0,.12,.5,'#f3ca69',4);group.add(g);g.visible=false;fires.push(g);}
let previous=performance.now(),envAccum=0;function frame(now){const realDt=Math.min(.1,(now-previous)/1000);previous=now;if(state.placed&&!state.paused&&!state.ended){envAccum+=realDt*state.speed;if(envAccum>.12){update(envAccum);envAccum=0;}}for(const s of smokes){if(state.paused)continue;const v=((now/1700+s.phase)%1);s.p.position.y=1.8+v*2;s.p.position.x=-.2+v*.6;s.p.scale.setScalar(.7+v*1.8);s.p.material.opacity=(1-v)*.45;}if(state.interiorTile){
const centers=buildings.filter(t=>['datacenter','server'].includes(t.building.kind));
const online=centers.indexOf(state.interiorTile)<runningCapacity();
interior.animate(realDt*state.speed,{paused:state.paused||state.ended,online,active:!!state.active});
$('#interior-status').textContent=online?'▥':'⚡';
$('#interior-status').setAttribute('aria-label',online?'Datacenter online':'Datacenter offline: needs electricity or cooling');
$('#interior-status').classList.toggle('offline',!online);
renderer.render(interior.scene,interior.camera);
}else renderer.render(scene,camera);requestAnimationFrame(frame);}renderOffers();market();requestAnimationFrame(frame);
const context=document.modelContext;if(context?.registerTool){const lifecycle=new AbortController();const registration=context.registerTool({name:'river_company_action',description:'Place the datacenter or perform a selected construction action on a land tile, or accept one of the three contracts. Uses the same rules as the visible game.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['datacenter','server','solar','coal','cooling','cut','plant','contract']},x:{type:'number'},z:{type:'number'},contract:{type:'integer',minimum:0,maximum:2}},required:['action'],additionalProperties:false},execute(input){if(!input||typeof input!=='object')throw Error('Invalid action');let ok=false;if(input.action==='contract')ok=accept(input.contract);else{if(!['datacenter',...Object.keys(costs)].includes(input.action)||!Number.isFinite(input.x)||!Number.isFinite(input.z))throw Error('Invalid construction');const t=tiles.find(t=>Math.abs(t.x-input.x)<.5&&Math.abs(t.z-input.z)<.5);if(!t)throw Error('Tile outside map');if(input.action==='datacenter'){if(state.placed)throw Error('Datacenter already placed');state.tool='datacenter';}else if(!chooseTool(input.action))throw Error('Construction unavailable');ok=act(t);}if(!ok)throw Error('Action unavailable');return {completed:true,placed:state.placed,activeContract:state.active?.i??null};}}, {signal:lifecycle.signal});Promise.resolve(registration).catch(()=>{});addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
export {state,tiles,act,accept,chooseTool,update,end,runningCapacity,contractThroughput,enterInterior,leaveInterior,interior};
