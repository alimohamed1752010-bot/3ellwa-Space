import { useEffect, useState } from "react";
import { api, ApiError } from "../shared/api";
import { Button, Card, CardBody, Input, Textarea } from "../shared/ui";

type Entry = { id:string; name:string; message:string; createdAt:string };
export default function GuestbookPage() {
  const [items,setItems]=useState<Entry[]>([]);
  const [name,setName]=useState("");
  const [message,setMessage]=useState("");
  const [website,setWebsite]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  async function load(){try{const r=await api.get<{items:Entry[]}>("/api/public/guestbook");setItems(r.items);}catch{setError("Could not load the guestbook.");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setNotice("");setError("");try{const r=await api.post<{message:string}>("/api/public/guestbook",{name,message,website});setNotice(r.message);setName("");setMessage("");setWebsite("");}catch(err){setError(err instanceof ApiError?err.message:"Could not submit your entry.");}finally{setBusy(false);}}
  return <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10"><a href="/" className="text-sm text-accent-soft hover:underline">← Back home</a><header className="mt-6"><p className="text-xs uppercase tracking-[.2em] text-accent-soft">Leave a note</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Guestbook</h1><p className="mt-2 text-sm text-muted">A small corner for visitors to leave a message. Entries appear after review.</p></header>
  <Card className="mt-6"><CardBody><form onSubmit={submit} className="flex flex-col gap-3"><Input label="Your name" value={name} maxLength={50} required onChange={e=>setName(e.target.value)} placeholder="What should we call you?"/><Textarea label="Message" value={message} maxLength={500} minLength={2} required rows={4} onChange={e=>setMessage(e.target.value)} placeholder="Leave something nice…"/><div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">Up to 500 characters. Be respectful.</p><Button type="submit" loading={busy} disabled={!name.trim()||message.trim().length<2}>Sign guestbook</Button></div></form>{notice&&<p role="status" className="mt-3 text-sm text-ok">{notice}</p>}{error&&<p role="alert" className="mt-3 text-sm text-danger">{error}</p>}</CardBody></Card>
  <section className="mt-8"><div className="flex items-center justify-between"><h2 className="font-medium">Recent messages</h2><span className="text-xs text-muted">{items.length} shown</span></div>{loading?<p className="mt-4 text-sm text-muted">Loading entries…</p>:items.length===0?<Card className="mt-3"><CardBody><p className="text-sm text-muted">No messages yet. Yours could be the first.</p></CardBody></Card>:<div className="mt-3 flex flex-col gap-3">{items.map(item=><Card key={item.id}><CardBody><p className="whitespace-pre-wrap break-words text-sm leading-6">{item.message}</p><div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3"><span className="text-sm font-medium">{item.name}</span><time className="text-xs text-muted" dateTime={item.createdAt}>{new Date(item.createdAt+"Z").toLocaleDateString()}</time></div></CardBody></Card>)}</div>}</section></main>;
}
