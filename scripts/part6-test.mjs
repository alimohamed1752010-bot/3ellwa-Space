import http from "node:http";
// LOCAL ONLY integration test for Part 6: homepage layout drafts, unified publishing, discard, and history.
// Requires local D1 migrations, ADMIN_PASSWORD, and a local fake Discord webhook on 127.0.0.1:9999.
// node scripts/part6-test.mjs [baseUrl] "test password"
const base=(process.argv[2]??"http://localhost:8787").replace(/\/$/,"");
const PASSWORD=process.argv[3];
if(!PASSWORD){console.error('Usage: node scripts/part6-test.mjs http://127.0.0.1:8787 "test password"');process.exit(1);}
const messages=[];
const discord=http.createServer((req,res)=>{let body="";req.on("data",c=>body+=c);req.on("end",()=>{try{messages.push(JSON.parse(body).content??"");}catch{}res.writeHead(204).end();});});
await new Promise(resolve=>discord.listen(9999,"127.0.0.1",resolve));
const waitCode=async()=>{for(let i=0;i<30;i++){const code=messages.at(-1)?.match(/\*\*(\d{8})\*\*/)?.[1];if(code)return code;await new Promise(r=>setTimeout(r,100));}throw new Error("No Discord OTP received.");};
let failed=0;
const check=(name,ok,detail="")=>{console.log(`${ok?"PASS":"FAIL"}  ${name}${detail!==""?" ("+detail+")":""}`);if(!ok)failed++;};
const headers={"content-type":"application/json","cf-connecting-ip":"10.9.0.6"};
let r=await fetch(base+"/api/health");check("Worker is ready",r.status===200,r.status);
for(const [method,path] of [["GET","/api/admin/layout"],["POST","/api/admin/publish"],["POST","/api/admin/publish/discard"]]){
 r=await fetch(base+path,{method,headers,body:method==="GET"?undefined:"{}"});check(`unauthenticated ${method} ${path} is rejected`,r.status===401,r.status);
}
r=await fetch(base+"/api/auth/password",{method:"POST",headers,body:JSON.stringify({password:PASSWORD})});
const challenge=await r.json();const code=await waitCode();
const verified=await fetch(base+"/api/auth/code",{method:"POST",headers,body:JSON.stringify({challengeId:challenge.challengeId,code})});
const cookie=(verified.headers.get("set-cookie")??"").split(";")[0];
check("password plus Discord OTP creates a session",verified.status===200&&!!cookie,verified.status);
const H={...headers,cookie};
const call=(method,path,body)=>fetch(base+path,{method,headers:H,body:body===undefined?undefined:JSON.stringify(body)});
const get=async path=>(await call("GET",path)).json();
const tag=Date.now().toString(36);
const initial=await get("/api/admin/layout");
const original=structuredClone(initial.published);
check("layout endpoint returns draft, published, and pending counts",Array.isArray(initial.draft.sections)&&initial.pending&&typeof initial.hasDraft==="boolean");
const layout={sections:[
 {id:"profile",type:"profile",title:"",body:"",assetId:null,widgetId:null,enabled:true,visibleDesktop:true,visibleMobile:true},
 {id:"part6-"+tag,type:"text",title:"Part 6 test",body:"This section is only visible after unified publish.",assetId:null,widgetId:null,enabled:true,visibleDesktop:true,visibleMobile:false}
]};
r=await call("PUT","/api/admin/layout/draft",layout);let saved=await r.json();
check("layout draft saves and reports pending state",r.status===200&&saved.hasDraft&&saved.draft.sections.length===2,r.status);
let pub=await get("/api/public/site");
check("public site does not expose an unpublished layout",!pub.layout.sections.some(s=>s.id==="part6-"+tag));
const themeName="Part6 "+tag;
r=await call("POST","/api/admin/themes",{name:themeName});let theme=(await r.json()).item;
check("create a custom theme for unified publishing",r.status===201&&!!theme?.id,r.status);
const tokens=structuredClone(theme.tokens);tokens.colors.accent="#12abef";
r=await call("PUT",`/api/admin/themes/${theme.id}/draft`,{tokens});theme=(await r.json()).item;
check("save theme draft",r.status===200&&theme.draftTokens?.colors.accent==="#12abef",r.status);
r=await call("POST","/api/admin/pages",{title:"Part 6 "+tag});let page=(await r.json()).item;
const pageDraft={title:page.title,slug:page.slug,metaTitle:"",metaDescription:"",visibility:"public",indexable:false,sections:[{type:"text",title:"Draft page",body:"Published with the layout.",url:"",assetId:""}]};
r=await call("PUT",`/api/admin/pages/${page.id}/draft`,pageDraft);page=(await r.json()).item;
check("save a page draft",r.status===200&&page.status==="draft",r.status);
r=await fetch(base+"/api/public/pages/"+page.slug);check("draft page remains private before publish",r.status===404,r.status);
const before=await get("/api/admin/publish/history");
r=await call("POST","/api/admin/publish",{});const result=await r.json();
check("one publish request publishes layout, theme, and page",r.status===200&&result.summary.layout&&result.summary.themes===1&&result.summary.pages===1,JSON.stringify(result.summary));
pub=await get("/api/public/site");
check("published layout is now public",pub.layout.sections.some(s=>s.id==="part6-"+tag&&s.visibleMobile===false));
const themes=await get("/api/admin/themes");theme=themes.items.find(x=>x.id===theme.id);
check("theme draft was promoted by unified publish",theme?.tokens.colors.accent==="#12abef"&&theme.draftTokens===null);
r=await fetch(base+"/api/public/pages/"+page.slug);check("page draft was published by unified publish",r.status===200,r.status);
const after=await get("/api/admin/publish/history");
check("publish history records the unified publish",after.items.length===before.items.length+1&&after.items[0].version===result.version);
const draft2={sections:[...layout.sections,{id:"discard-"+tag,type:"text",title:"Discard me",body:"Not public",assetId:null,widgetId:null,enabled:true,visibleDesktop:true,visibleMobile:true}]};
r=await call("PUT","/api/admin/layout/draft",draft2);check("second layout draft saved",r.status===200,r.status);
const tokens2=structuredClone(theme.tokens);tokens2.colors.accent="#ee8844";
r=await call("PUT",`/api/admin/themes/${theme.id}/draft`,{tokens:tokens2});check("second theme draft saved",r.status===200,r.status);
r=await call("POST","/api/admin/pages",{title:"Discard "+tag});const throwaway=(await r.json()).item;
r=await call("POST","/api/admin/publish/discard",{});check("global discard endpoint succeeds",r.status===200,r.status);
const state=await get("/api/admin/layout");
check("global discard clears layout, theme, and page drafts",!state.hasDraft&&state.pending.themes===0&&state.pending.pages===0&&JSON.stringify(state.draft)===JSON.stringify(state.published));
pub=await get("/api/public/site");
check("discard never leaks the discarded section",!pub.layout.sections.some(s=>s.id==="discard-"+tag));
const pages=await get("/api/admin/pages");
check("new unpublished pages are removed by global discard",!pages.items.some(x=>x.id===throwaway.id));
theme=(await get("/api/admin/themes")).items.find(x=>x.id===theme.id);
check("theme draft was cleared by global discard",theme?.draftTokens===null);
await call("DELETE",`/api/admin/pages/${page.id}`);
await call("DELETE",`/api/admin/themes/${theme.id}`);
await call("PUT","/api/admin/layout/draft",original);
await call("POST","/api/admin/publish",{});
await call("POST","/api/auth/logout",{});
discord.close();
console.log(failed===0?"\nAll Part 6 checks passed.":`\n${failed} Part 6 check(s) FAILED.`);
process.exit(failed===0?0:1);
