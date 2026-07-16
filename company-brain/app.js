const platforms = ["1Password","Adobe Acrobat","Airtable","Amplitude","Asana","AWS","Azure","BambooHR","BigQuery","Bitbucket","Brevo","Calendly","ClickUp","Cloudflare","Confluence","Copper","Datadog","DocuSign","Dropbox","Dynamics 365","Figma","Freshdesk","Gainsight","GitHub","GitLab","Gmail","Google Calendar","Google Drive","Google Sheets","Greenhouse","HubSpot","Intercom","Jira","Linear","Looker","Mailchimp","Make","Metabase","Microsoft Teams","Monday.com","MongoDB","Miro","Mixpanel","NetSuite","Notion","n8n","Okta","OpenAI","Outreach","Pipedrive","PostgreSQL","Power BI","QuickBooks","Ramp","Retool","Rippling","Salesforce","SAP","Segment","SendGrid","ServiceNow","SharePoint","Slack","Snowflake","Stripe","Tableau","Teams","Twilio","Typeform","Webflow","Workday","Xero","Zapier","Zendesk","Zoom"];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const initialMessage = "Let’s map how the company actually works, starting with your own work as CEO. What is one recurring workflow you personally own?";

let state = {
  company: "Northstar Labs",
  currentPersonId: "ceo",
  stage: "workflow_name",
  selectedPlatforms: [],
  people: [],
  workflows: [],
  messages: [],
};

const demoState = () => ({
  company: "Northstar Labs",
  currentPersonId: "ceo",
  stage: "platforms",
  selectedPlatforms: ["Slack", "Google Sheets", "Notion"],
  people: [
    { id:"ceo",name:"Marta Silva",email:"marta@northstar.example",role:"CEO",managerId:null,status:"progress",completion:62 },
    { id:"coo",name:"Ana Costa",email:"ana@northstar.example",role:"COO",managerId:"ceo",status:"complete",completion:100 },
    { id:"cto",name:"João Martins",email:"joao@northstar.example",role:"CTO",managerId:"ceo",status:"invited",completion:0 },
  ],
  workflows: [
    { id:"w1",personId:"ceo",title:"Weekly leadership review",minutes_per_week:150,platforms:[],steps:[],delegation:"",readiness:74 },
    { id:"w2",personId:"coo",title:"Customer onboarding handoff",minutes_per_week:240,platforms:["HubSpot","Slack","Notion"],steps:["Review signed contract","Create onboarding brief","Assign implementation owner"],delegation:"Commercial exceptions go to CEO",readiness:88 },
    { id:"w3",personId:"coo",title:"Monthly vendor reconciliation",minutes_per_week:110,platforms:["Google Sheets","Gmail","Xero"],steps:["Collect invoices","Match purchase records","Flag exceptions"],delegation:"Finance signs off exceptions",readiness:92 },
  ],
  messages: [
    { role:"assistant",text:initialMessage },
    { role:"user",text:"I run our weekly leadership review: gather metrics, identify blockers, decide priorities, and assign owners." },
    { role:"assistant",text:"That takes about 150 minutes each week. Which platforms do you use? Search the catalog and select every system involved." },
  ],
});

function save(){ localStorage.setItem("companyBrainState", JSON.stringify(state)); }
function currentPerson(){ return state.people.find((p) => p.id === state.currentPersonId) || state.people[0]; }
function currentWorkflow(){ return [...state.workflows].reverse().find((w) => w.personId === state.currentPersonId); }
function initials(name){ return name.split(/\s+/).map((p)=>p[0]).slice(0,2).join("").toUpperCase(); }
function escapeHtml(value){ return String(value ?? "").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function toast(text){ const el=$("#toast"); el.textContent=text; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2600); }

function openApp(nextState){ state=nextState; save(); $("#welcome").classList.add("hidden"); $("#app").classList.remove("hidden"); render(); checkApi(); }

$("#start-clean").addEventListener("click",()=>$("#ceo-dialog").showModal());
$("#load-demo").addEventListener("click",()=>openApp(demoState()));
$("#load-demo-bottom")?.addEventListener("click",()=>openApp(demoState()));
$("#ceo-form").addEventListener("submit",(event)=>{
  event.preventDefault();
  const name=$("#ceo-name").value.trim(), email=$("#ceo-email").value.trim(), company=$("#company-name").value.trim();
  if(!name || !email || !company) return;
  $("#ceo-dialog").close();
  openApp({company,currentPersonId:"ceo",stage:"workflow_name",selectedPlatforms:[],people:[{id:"ceo",name,email,role:"CEO",managerId:null,status:"progress",completion:8}],workflows:[],messages:[{role:"assistant",text:initialMessage}]});
});

async function checkApi(){
  try{ const data=await fetch("./api/status").then((r)=>{if(!r.ok)throw new Error("Static demo");return r.json();}); const el=$("#api-status"); el.innerHTML=`<i></i>${data.apiConfigured?` Live AI · ${escapeHtml(data.model)}`:" Demo interviewer"}`; el.classList.toggle("live",data.apiConfigured); }
  catch{}
}

function staticDemoInterview(stage,text){
  const base={provider:"static-demo",workflow_update:null,direct_reports:[],complete:false};
  const emails=[...String(text).matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((m)=>m[0]);
  if(stage==="workflow_name")return{...base,assistant_message:"Good. How many minutes does that workflow consume in a typical week? Include review and follow-up time.",next_stage:"time",workflow_update:{title:text||"Recurring workflow",minutes_per_week:null,platforms:[],steps:[],delegation:""}};
  if(stage==="time"){const n=Number((String(text).match(/\d+/)||[120])[0]);return{...base,assistant_message:"Which platforms do you use for it? Search the catalog, select every system involved, then send the selection.",next_stage:"platforms",workflow_update:{title:"",minutes_per_week:/hour/i.test(text)?n*60:n,platforms:[],steps:[],delegation:""}};}
  if(stage==="platforms")return{...base,assistant_message:"Walk me through the steps from trigger to finished output. A short numbered list is perfect.",next_stage:"steps",workflow_update:{title:"",minutes_per_week:null,platforms:text.split(",").map((v)=>v.trim()).filter(Boolean),steps:[],delegation:""}};
  if(stage==="steps")return{...base,assistant_message:"Where does judgment enter? Include the decision owner, approval threshold, governing policy, and what happens in an exception.",next_stage:"decisions",workflow_update:{title:"",minutes_per_week:null,platforms:[],steps:text.split(/\n|\d+[.)]/).map((v)=>v.trim()).filter(Boolean),delegation:""}};
  if(stage==="decisions")return{...base,assistant_message:"Last part: what do you delegate, and to whom? Include the email addresses of everyone who reports directly to you.",next_stage:"delegations",workflow_update:{title:"",minutes_per_week:null,platforms:[],steps:[],delegation:text||"Executive judgment and exception approval"}};
  const reports=emails.map((email)=>({email,name:email.split("@")[0].split(/[._-]/).map((p)=>p.charAt(0).toUpperCase()+p.slice(1)).join(" "),role:"Direct report"}));
  return{...base,assistant_message:reports.length?`Your interview is complete. I queued ${reports.length} personal invitation${reports.length===1?"":"s"}. The operating graph will expand as each person completes the same interview.`:"Add at least one direct-report email when you are ready; the graph grows only from verified reporting relationships.",next_stage:reports.length?"complete":"delegations",direct_reports:reports,complete:reports.length>0};
}

$$('.nav-item').forEach((button)=>button.addEventListener("click",()=>switchView(button.dataset.view)));
function switchView(name){
  $$('.nav-item').forEach((b)=>b.classList.toggle("active",b.dataset.view===name));
  $$('.view').forEach((v)=>v.classList.remove("active-view"));
  $(`#view-${name}`).classList.add("active-view");
  $("#top-view").textContent=name==="interview"?`${currentPerson()?.role||"CEO"} interview`:name==="graph"?"Operating graph":"AI priorities";
  if(name==="graph") renderGraph(); if(name==="priorities") renderPriorities();
}

$("#composer").addEventListener("submit",async(event)=>{
  event.preventDefault(); const input=$("#message-input"); const text=input.value.trim(); if(!text)return;
  state.messages.push({role:"user",text}); input.value=""; renderMessages();
  const typing={role:"assistant",text:"…",typing:true}; state.messages.push(typing); renderMessages();
  try{
    const response=await fetch("./api/interview",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({stage:state.stage,message:text,state:{company:state.company,person:currentPerson(),workflow:currentWorkflow()}})}).then((r)=>{if(!r.ok)throw new Error("Static demo");return r.json();}).catch(()=>staticDemoInterview(state.stage,text));
    state.messages.pop(); applyResponse(response); if(response.warning) toast("Live AI unavailable — continued in demo mode");
  }catch(error){ state.messages.pop(); state.messages.push({role:"assistant",text:"I could not process that answer. Please try again."}); toast(error.message); }
  save(); render();
});

function applyResponse(response){
  const person=currentPerson(); let workflow=currentWorkflow();
  if(response.workflow_update){
    if(!workflow || (response.workflow_update.title && workflow.title && state.stage==="workflow_name")){
      workflow={id:`w${Date.now()}`,personId:person.id,title:"",minutes_per_week:null,platforms:[],steps:[],delegation:"",readiness:0}; state.workflows.push(workflow);
    }
    const patch=response.workflow_update;
    if(patch.title)workflow.title=patch.title;
    if(patch.minutes_per_week!==null)workflow.minutes_per_week=patch.minutes_per_week;
    if(patch.platforms?.length)workflow.platforms=patch.platforms;
    if(patch.steps?.length)workflow.steps=patch.steps;
    if(patch.delegation)workflow.delegation=patch.delegation;
    workflow.readiness=Math.max(workflow.readiness||0,Math.min(96,32+[workflow.title,workflow.minutes_per_week,workflow.platforms.length,workflow.steps.length,workflow.delegation].filter(Boolean).length*12));
  }
  if(response.direct_reports?.length){
    for(const report of response.direct_reports){
      if(state.people.some((p)=>p.email===report.email))continue;
      state.people.push({id:`p${Date.now()}${Math.random().toString(16).slice(2,5)}`,name:report.name,email:report.email,role:report.role||"Direct report",managerId:person.id,status:"invited",completion:0});
    }
  }
  state.stage=response.next_stage||state.stage;
  person.completion=Math.max(person.completion||0,{workflow_name:8,time:25,platforms:42,steps:58,decisions:74,delegations:88,complete:100}[state.stage]||0);
  if(response.complete)person.status="complete";
  state.messages.push({role:"assistant",text:response.assistant_message||"Captured."});
}

function render(){
  const person=currentPerson(); if(!person)return;
  $("#top-company").textContent=state.company; $("#person-title").textContent=`${person.name} · ${person.role}`; $("#person-subtitle").textContent=person.managerId?"Invited through a verified reporting line":"Root of the operating graph";
  $("#completion-number").textContent=`${person.completion}%`; $("#progress-ring").style.strokeDashoffset=100.5*(1-person.completion/100);
  $("#graph-count").textContent=state.people.length; renderPeople(); renderMessages(); renderCapture(); renderGraph(); renderPriorities(); renderPlatforms();
}

function renderPeople(){
  $("#people-list").innerHTML=state.people.map((p)=>`<div class="person-side ${p.id===state.currentPersonId?'active':''}" data-person="${p.id}"><span class="avatar">${initials(p.name)}</span><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.role)} · ${p.status}</small></div></div>`).join("");
  $$('.person-side').forEach((el)=>el.addEventListener("click",()=>{
    const p=state.people.find((x)=>x.id===el.dataset.person); state.currentPersonId=p.id;
    if(p.status==="invited"){p.status="progress";p.completion=8;state.stage="workflow_name";state.messages=[{role:"assistant",text:`Welcome, ${p.name.split(' ')[0]}. I know you report to ${state.people.find((m)=>m.id===p.managerId)?.name}. Let’s map your own work first. What recurring workflow do you personally own?`}];}
    save();switchView("interview");render();
  }));
}

function renderMessages(){
  $("#messages").innerHTML=state.messages.map((m)=>`<div class="message ${m.role}"><span class="message-avatar">${m.role==='assistant'?'AI':initials(currentPerson()?.name||'You')}</span><div><div class="message-meta">${m.role==='assistant'?'INTERVIEWER':'YOU'}</div><div class="bubble">${m.typing?'<span class="typing">● ● ●</span>':escapeHtml(m.text).replace(/\n/g,'<br>')}</div></div></div>`).join("");
  $("#messages").scrollTop=$("#messages").scrollHeight;
}

function renderCapture(){
  const w=currentWorkflow(); $("#capture-workflow").textContent=w?.title||"Waiting for answer…"; $("#capture-time").textContent=w?.minutes_per_week?`${w.minutes_per_week} min`:'—'; $("#capture-readiness").textContent=w?.readiness?`${w.readiness}%`:'—';
  $("#capture-platforms").innerHTML=w?.platforms?.length?w.platforms.map((p)=>`<span>${escapeHtml(p)}</span>`).join(''):'<span class="empty-tag">Not mapped</span>';
  $("#capture-steps").innerHTML=w?.steps?.length?w.steps.map((s,i)=>`<p><b>${i+1}.</b> ${escapeHtml(s)}</p>`).join(''):'<p class="muted">The operating graph updates while the employee talks.</p>';
  const reports=state.people.filter((p)=>p.managerId===state.currentPersonId); $("#capture-reports").innerHTML=reports.length?reports.map((p)=>`<div class="report-chip"><span>${escapeHtml(p.name)} · ${escapeHtml(p.email)}</span><b>${p.status}</b></div>`).join(''):'<p class="muted">Direct-report emails are requested only after this interview.</p>';
}

function renderPlatforms(){
  const q=$("#platform-search")?.value?.toLowerCase()||""; let options=platforms.filter((p)=>p.toLowerCase().includes(q)).slice(0,60); if(q&&!platforms.some((p)=>p.toLowerCase()===q))options.unshift(`Add “${q}”`);
  $("#platform-results").innerHTML=options.map((p)=>`<button class="platform-option ${state.selectedPlatforms.includes(p)?'selected':''}" data-platform="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join('');
  $("#platform-selected-count").textContent=`${state.selectedPlatforms.length} selected`;
  $$('.platform-option').forEach((button)=>button.addEventListener('click',()=>{let value=button.dataset.platform;if(value.startsWith('Add “'))value=value.slice(5,-1);state.selectedPlatforms.includes(value)?state.selectedPlatforms=state.selectedPlatforms.filter((p)=>p!==value):state.selectedPlatforms.push(value);renderPlatforms();}));
}
$("#open-platforms").addEventListener('click',()=>{$("#platform-picker").classList.remove('hidden');$("#platform-search").focus();});
$("#close-platforms").addEventListener('click',()=>$("#platform-picker").classList.add('hidden'));
$("#platform-search").addEventListener('input',renderPlatforms);
$("#use-platforms").addEventListener('click',()=>{$("#message-input").value=state.selectedPlatforms.join(', ');$("#platform-picker").classList.add('hidden');$("#message-input").focus();});

function renderGraph(){
  const root=state.people.find((p)=>!p.managerId)||state.people[0], children=state.people.filter((p)=>p.managerId===root?.id); const node=(p,rootClass='')=>`<div class="org-node ${rootClass} ${p.status}"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.role)} · ${p.status}</small><div class="org-node-stats"><span>${state.workflows.filter((w)=>w.personId===p.id).length} workflows</span><span>${p.completion}% mapped</span></div></div>`;
  $("#org-graph").innerHTML=root?`<div class="org-tree">${node(root,'root')}<div class="org-line"></div><div class="org-children">${children.map((p)=>node(p)).join('')}</div></div>`:'';
  const minutes=state.workflows.reduce((sum,w)=>sum+(w.minutes_per_week||0),0);$("#metric-people").textContent=state.people.length;$("#metric-workflows").textContent=state.workflows.length;$("#metric-hours").textContent=`${(minutes/60).toFixed(1)}h`;
}

const priorities=[
  {title:"Monthly vendor reconciliation",owner:"Operations",saving:"92h / year",feasibility:92,confidence:86,status:"now"},
  {title:"Customer onboarding handoff",owner:"Operations",saving:"138h / year",feasibility:83,confidence:79,status:"now"},
  {title:"Weekly leadership review prep",owner:"CEO",saving:"65h / year",feasibility:68,confidence:72,status:"pilot"},
  {title:"Commercial exception approval",owner:"CEO",saving:"24h / year",feasibility:38,confidence:64,status:"later"},
  {title:"Security incident decision",owner:"CTO",saving:"12h / year",feasibility:26,confidence:58,status:"later"},
];
function renderPriorities(){
  $("#priority-list").innerHTML=priorities.map((p)=>`<div class="priority-row"><div><strong>${p.title}</strong><small>${p.owner}</small></div><div><strong>${p.saving}</strong><small>capacity</small></div><div><strong>${p.feasibility}%</strong><div class="score-bar"><i style="width:${p.feasibility}%"></i></div></div><div><strong>${p.confidence}%</strong><small>confidence</small></div><span class="priority-badge ${p.status}">${p.status==='now'?'Implement now':p.status==='pilot'?'Pilot':'Not yet'}</span></div>`).join('');
}

$("#export").addEventListener('click',()=>{
  const portable={schema_version:"0.1",exported_at:new Date().toISOString(),company:state.company,people:state.people,workflows:state.workflows,priorities}; const url=URL.createObjectURL(new Blob([JSON.stringify(portable,null,2)],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download=`${state.company.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-context-pack.json`;a.click();URL.revokeObjectURL(url);toast('Portable context pack exported');
});
$("#reset").addEventListener('click',()=>{localStorage.removeItem('companyBrainState');location.reload();});

const stored=localStorage.getItem("companyBrainState"); if(stored){try{openApp(JSON.parse(stored));}catch{}}
