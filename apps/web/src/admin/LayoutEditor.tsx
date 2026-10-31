import {useCallback,useEffect,useMemo,useState} from "react";
import {DndContext,KeyboardSensor,PointerSensor,closestCenter,useSensor,useSensors} from "@dnd-kit/core";
import type {DragEndEvent} from "@dnd-kit/core";
import {SortableContext,sortableKeyboardCoordinates,verticalListSortingStrategy,useSortable,arrayMove} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {api,ApiError} from "../shared/api";
import {Button,Card,CardBody,CardHeader,Checkbox,Input,Select,Textarea,useToast} from "../shared/ui";
import MediaPicker from "./media/MediaPicker";

type SectionType="profile"|"links"|"projects"|"text"|"gallery"|"widget"|"spacer";
type Section={id:string;type:SectionType;title:string;body:string;assetId:string|null;widgetId:string|null;enabled:boolean;visibleDesktop:boolean;visibleMobile:boolean;imageUrl?:string|null};
type LayoutData={sections:Section[]};
type LayoutResponse={draft:LayoutData;published:LayoutData;version:number;hasDraft:boolean;pending:{layout:boolean;themes:number;pages:number}};
type HistoryItem={id:string;version:number;summary:{layout?:boolean;themes?:number;pages?:number};createdAt:string};
type WidgetOption={id:string;name:string;type:string;enabled:boolean};
const types:SectionType[]=["profile","links","projects","text","gallery","widget","spacer"];
const labels:Record<SectionType,string>={profile:"Profile",links:"Links",projects:"Projects",text:"Text",gallery:"Gallery",widget:"Widget",spacer:"Spacer"};
const blank=(type:SectionType):Section=>({id:crypto.randomUUID(),type,title:"",body:type==="spacer"?"32":"",assetId:null,widgetId:null,enabled:true,visibleDesktop:true,visibleMobile:true});
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const clean=(layout:LayoutData):LayoutData=>({sections:layout.sections.map(s=>({id:s.id,type:s.type,title:s.title,body:s.body,assetId:s.assetId,widgetId:s.widgetId,enabled:s.enabled,visibleDesktop:s.visibleDesktop,visibleMobile:s.visibleMobile}))});

function SortableSection({section,index,onChange,onRemove,onImage,widgets}:{section:Section;index:number;onChange:(patch:Partial<Section>)=>void;onRemove:()=>void;onImage:()=>void;widgets:WidgetOption[]}){
 const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:section.id});
 const style={transform:CSS.Transform.toString(transform),transition,opacity:isDragging ? 0.55 : 1};
 return <div ref={setNodeRef} style={style} className="rounded-card border border-line bg-surface p-4">
  <div className="mb-3 flex flex-wrap items-center gap-2">
   <button type="button" aria-label={`Drag ${labels[section.type]} section`} className="cursor-grab rounded-control border border-line px-2.5 py-2 text-muted hover:text-ink active:cursor-grabbing" {...attributes} {...listeners}>⠿</button>
   <div className="min-w-0 flex-1"><p className="text-sm font-medium">{labels[section.type]}</p><p className="text-xs text-muted">Section {index+1}</p></div>
   <Button size="sm" variant="danger" onClick={onRemove}>Remove</Button>
  </div>
  <div className="grid gap-3 sm:grid-cols-2">
   <Input label="Section heading" value={section.title} onChange={e=>onChange({title:e.target.value})} placeholder={labels[section.type]}/>
   {section.type==="widget"&&<Select aria-label="Choose widget" value={section.widgetId??""} onChange={e=>onChange({widgetId:e.target.value||null})}><option value="">Choose widget…</option>{widgets.filter(w=>w.enabled).map(w=><option key={w.id} value={w.id}>{w.name} · {w.type}</option>)}</Select>}
   {section.type==="spacer"&&<Input label="Height (px)" type="number" min={0} max={400} value={section.body} onChange={e=>onChange({body:e.target.value})}/>}
  </div>
  {section.type==="text"&&<Textarea className="mt-3" label="Text content" rows={4} value={section.body} onChange={e=>onChange({body:e.target.value})}/>}
  {section.type==="gallery"&&<div className="mt-3 flex flex-wrap items-center gap-3"><Button size="sm" variant="secondary" onClick={onImage}>{section.assetId?"Change image":"Choose image"}</Button>{section.imageUrl&&<img src={section.imageUrl} alt="" className="size-16 rounded-control border border-line object-cover"/>}{section.assetId&&!section.imageUrl&&<span className="text-xs text-muted">Selected image</span>}</div>}
  {section.type==="widget"&&<Textarea className="mt-3" label="Fallback description" rows={2} value={section.body} onChange={e=>onChange({body:e.target.value})}/>}
  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 border-t border-line pt-3">
   <Checkbox label="Enabled" checked={section.enabled} onChange={e=>onChange({enabled:e.target.checked})}/>
   <Checkbox label="Desktop" checked={section.visibleDesktop} onChange={e=>onChange({visibleDesktop:e.target.checked})}/>
   <Checkbox label="Mobile" checked={section.visibleMobile} onChange={e=>onChange({visibleMobile:e.target.checked})}/>
  </div>
 </div>;
}

export default function LayoutEditor(){
 const toast=useToast();
 const [data,setData]=useState<LayoutResponse|null>(null);
 const [draft,setDraft]=useState<LayoutData|null>(null);
 const [history,setHistory]=useState<LayoutData[]>([]);
 const [cursor,setCursor]=useState(0);
 const [historyItems,setHistoryItems]=useState<HistoryItem[]>([]);
 const [widgets,setWidgets]=useState<WidgetOption[]>([]);
 const [snapshot,setSnapshot]=useState<unknown|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [preview,setPreview]=useState<"desktop"|"mobile">("desktop");
 const [addType,setAddType]=useState<SectionType|"">("");
 const [mediaFor,setMediaFor]=useState<string|null>(null);
 const dirty=!!draft&&!!data&&JSON.stringify(clean(draft))!==JSON.stringify(clean(data.draft));
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
 const load=useCallback(async()=>{
  setError("");
  try{
   const [layout,pub,widgetData]=await Promise.all([api.get<LayoutResponse>("/api/admin/layout"),api.get<{items:HistoryItem[]}>("/api/admin/publish/history"),api.get<{items:WidgetOption[]}>("/api/admin/widgets")]);
   setData(layout);setDraft(clone(layout.draft));setHistory([clone(layout.draft)]);setCursor(0);setHistoryItems(pub.items);setWidgets(widgetData.items);
  }catch(e){setError(e instanceof ApiError?e.message:"Could not load the layout editor.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const sectionIds=useMemo(()=>draft?.sections.map(s=>s.id)??[],[draft]);
 function commit(next:LayoutData){
  if(!draft)return;
  const base=history.slice(0,cursor+1);
  base.push(clone(next));
  const trimmed=base.slice(-31);
  setHistory(trimmed);setCursor(trimmed.length-1);setDraft(next);
 }
 function patch(id:string,change:Partial<Section>){if(!draft)return;commit({sections:draft.sections.map(s=>s.id===id?{...s,...change}:s)});}
 function remove(id:string){if(!draft)return;commit({sections:draft.sections.filter(s=>s.id!==id)});}
 function add(){if(!draft||!addType)return;if(draft.sections.length>=40){toast.show("A layout can contain up to 40 sections.","error");return;}commit({sections:[...draft.sections,blank(addType)]});setAddType("");}
 function move(event:DragEndEvent){if(!draft||!event.over||event.active.id===event.over.id)return;const from=draft.sections.findIndex(s=>s.id===event.active.id);const to=draft.sections.findIndex(s=>s.id===event.over?.id);if(from>=0&&to>=0)commit({sections:arrayMove(draft.sections,from,to)});}
 function undo(){if(cursor<=0)return;setCursor(cursor-1);setDraft(clone(history[cursor-1]));}
 function redo(){if(cursor>=history.length-1)return;setCursor(cursor+1);setDraft(clone(history[cursor+1]));}
 async function save(){
  if(!draft)return;setBusy(true);
  try{const r=await api.put<LayoutResponse>("/api/admin/layout/draft",clean(draft));setData(r);setDraft(clone(r.draft));setHistory([clone(r.draft)]);setCursor(0);toast.show("Layout draft saved.","success");}
  catch(e){toast.show(e instanceof ApiError?e.message:"Could not save the layout draft.","error");}
  finally{setBusy(false);}
 }
 async function publish(){
  if(!draft)return;setBusy(true);
  try{
   await api.put("/api/admin/layout/draft",clean(draft));
   const result=await api.post<{version:number;summary:{layout:boolean;themes:number;pages:number};publishedAt:string}>("/api/admin/publish");
   toast.show(`Published version ${result.version}.`,"success");await load();
  }catch(e){toast.show(e instanceof ApiError?e.message:"Could not publish the changes.","error");}
  finally{setBusy(false);}
 }
 async function discard(){
  if(!window.confirm("Discard every unpublished layout, theme, and page change? This cannot be undone."))return;
  setBusy(true);
  try{await api.post("/api/admin/publish/discard");toast.show("All unpublished changes were discarded.","success");await load();}
  catch(e){toast.show(e instanceof ApiError?e.message:"Could not discard the changes.","error");}
  finally{setBusy(false);}
 }
 if(loading)return <p className="text-sm text-muted">Loading layout editor…</p>;
 if(error)return <div><p role="alert" className="text-sm text-danger">{error}</p><Button className="mt-3" onClick={()=>{setLoading(true);void load();}}>Retry</Button></div>;
 if(!draft||!data)return null;
 return <div className="rise flex flex-col gap-5">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-medium">Layout editor</h1><p className="mt-1 text-sm text-muted">Arrange homepage sections, tune device visibility, then publish all saved drafts together.</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={cursor<=0||busy} onClick={undo}>Undo</Button><Button size="sm" variant="secondary" disabled={cursor>=history.length-1||busy} onClick={redo}>Redo</Button><Button size="sm" variant="secondary" disabled={!dirty||busy} loading={busy} onClick={save}>Save draft</Button><Button size="sm" disabled={busy} loading={busy} onClick={publish}>Publish all</Button></div></div>
  <Card><CardHeader title="Homepage sections" description="Drag using the handle to reorder. Undo and redo retain the last 30 changes." action={<div className="flex gap-2"><Select aria-label="Section type" value={addType} onChange={e=>setAddType(e.target.value as SectionType|"")}><option value="">Add section…</option>{types.map(t=><option key={t} value={t}>{labels[t]}</option>)}</Select><Button size="sm" disabled={!addType||draft.sections.length>=40} onClick={add}>Add</Button></div>}/><CardBody><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={move}><SortableContext items={sectionIds} strategy={verticalListSortingStrategy}><div className="flex flex-col gap-3">{draft.sections.length===0&&<p className="rounded-control border border-dashed border-line p-6 text-center text-sm text-muted">No sections yet. Add one above.</p>}{draft.sections.map((s,i)=><SortableSection key={s.id} section={s} index={i} onChange={p=>patch(s.id,p)} onRemove={()=>remove(s.id)} onImage={()=>setMediaFor(s.id)} widgets={widgets}/>)}</div></SortableContext></DndContext></CardBody></Card>
  <Card><CardHeader title="Preview" description="Visibility controls are reflected in the preview." action={<div className="flex gap-1"><Button size="sm" variant={preview==="desktop"?"primary":"secondary"} onClick={()=>setPreview("desktop")}>Desktop</Button><Button size="sm" variant={preview==="mobile"?"primary":"secondary"} onClick={()=>setPreview("mobile")}>Mobile</Button></div>}/><CardBody><div className="mx-auto overflow-hidden rounded-xl border border-line bg-bg transition-all" style={{width:preview==="mobile"?375:"100%",maxWidth:"100%"}}><div className="flex items-center gap-1 border-b border-line bg-surface px-3 py-2"><span className="size-2 rounded-full bg-danger/70"/><span className="size-2 rounded-full bg-yellow-400/70"/><span className="size-2 rounded-full bg-ok/70"/><span className="ml-2 text-[10px] text-muted">{preview==="mobile"?"Mobile preview · 375px":"Desktop preview"}</span></div><div className="flex flex-col gap-3 p-4">{draft.sections.filter(s=>s.enabled&&(preview==="desktop"?s.visibleDesktop:s.visibleMobile)).map((s,i)=><div key={s.id} className="rounded-control border border-dashed border-accent/40 bg-surface/70 p-3"><div className="mb-1 flex items-center justify-between"><span className="text-xs font-medium">{s.title||labels[s.type]}</span><span className="text-[10px] text-muted">#{i+1}</span></div>{s.type==="text"&&<p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted">{s.body||"Your text content appears here."}</p>}{s.type==="gallery"&&s.imageUrl&&<img src={s.imageUrl} alt="" className="max-h-28 w-full rounded object-cover"/>}{s.type==="spacer"&&<div style={{height:Math.min(120,Math.max(0,Number(s.body)||32))}}/>}{s.type==="profile"&&<p className="text-xs text-muted">Profile section</p>}{s.type==="links"&&<p className="text-xs text-muted">Featured links section</p>}{s.type==="projects"&&<p className="text-xs text-muted">Projects showcase</p>}{s.type==="widget"&&<p className="text-xs text-muted">{widgets.find(w=>w.id===s.widgetId)?.name||"No widget selected"}</p>}</div>)}</div></div></CardBody></Card>
  <Card><CardHeader title="Publish history" description="Each publish records a snapshot of the public content."/><CardBody>{historyItems.length===0?<p className="text-sm text-muted">Nothing has been published through the unified publisher yet.</p>:<ol className="divide-y divide-line">{historyItems.map(h=><li key={h.id} className="flex flex-wrap items-center gap-2 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">Version {h.version}</p><p className="text-xs text-muted">{new Date(h.createdAt.replace(" ","T")+"Z").toLocaleString()} · {h.summary.layout?"Layout":""}{h.summary.themes?(` · ${h.summary.themes} theme(s)`):""}{h.summary.pages?(` · ${h.summary.pages} page(s)`):""}</p></div><Button size="sm" variant="secondary" onClick={()=>api.get<{item:{snapshot:unknown}}>(`/api/admin/publish/history/${h.id}`).then(r=>setSnapshot(r.item.snapshot)).catch(()=>toast.show("Could not load this snapshot.","error"))}>View snapshot</Button></li>)}</ol>}</CardBody></Card>
  {snapshot!==null&&<Card><CardHeader title="Publish snapshot" action={<Button size="sm" variant="ghost" onClick={()=>setSnapshot(null)}>Close</Button>}/><CardBody><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-control bg-bg p-3 text-xs text-muted">{JSON.stringify(snapshot,null,2)}</pre></CardBody></Card>}
  <MediaPicker open={mediaFor!==null} title="Choose a section image" onClose={()=>setMediaFor(null)} onPick={a=>{if(mediaFor)patch(mediaFor,{assetId:a.id,imageUrl:a.url});setMediaFor(null);}}/>
  <div className="flex flex-wrap justify-between gap-2"><p className="text-xs text-muted">{dirty?"Unsaved editor changes":data.hasDraft?"Saved changes pending publish":"No unpublished changes"} · Layout v{data.version} · {data.pending.themes} theme drafts · {data.pending.pages} page drafts</p><Button variant="danger" size="sm" disabled={busy||(!dirty&&!data.hasDraft)} onClick={discard}>Discard all drafts</Button></div>
 </div>;
}
