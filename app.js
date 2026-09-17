import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const login=document.getElementById("login"), app=document.getElementById("app");
const msg=document.getElementById("loginMsg"), recordsEl=document.getElementById("records");

let profile=null;

document.getElementById("loginBtn").onclick=async()=>{
  msg.textContent="Bejelentkezés…";
  const email=document.getElementById("email").value.trim();
  const password=document.getElementById("password").value;
  const {error}=await supabase.auth.signInWithPassword({email,password});
  msg.textContent=error?error.message:"";
};

document.getElementById("logoutBtn").onclick=()=>supabase.auth.signOut();

supabase.auth.onAuthStateChange(async(_event,session)=>{
  if(session) await loadProfile(session.user);
  else {app.classList.add("hidden");login.classList.remove("hidden")}
});

async function loadProfile(user){
  const {data,error}=await supabase.from("profiles").select("id,full_name,organization_id,organizations(id,name)").eq("id",user.id).single();
  if(error){msg.textContent=error.message;return}
  profile=data;
  login.classList.add("hidden");app.classList.remove("hidden");
  document.getElementById("orgName").textContent=data.organizations.name;
  document.getElementById("userInfo").textContent=(data.full_name||user.email)+" · "+data.organizations.name;
  document.getElementById("permission").textContent="Az Ön szervezetéhez tartozó mezők módosíthatók. Más szervezetek adatai csak olvashatók.";
  await loadRecords();
}

async function loadRecords(){
  const {data,error}=await supabase.from("records_view").select("*").order("created_at",{ascending:false});
  if(error){recordsEl.innerHTML=`<div class="card error">${esc(error.message)}</div>`;return}
  recordsEl.innerHTML=data.length?data.map(renderRecord).join(""):'<div class="card">Még nincs bejegyzés.</div>';
  recordsEl.querySelectorAll("[data-save]").forEach(el=>el.onchange=saveField);
  recordsEl.querySelectorAll("[data-delete]").forEach(el=>el.onclick=deleteRecord);
}

function renderRecord(r){
  const can=r.my_record===true;
  return `<article class="card record">
    <div class="record-head"><strong>#${r.id}</strong>${can?`<button class="danger" data-delete="${r.id}">Törlés</button>`:""}</div>
    <label>Helyszín<input data-save="${r.id}" data-field="location" value="${esc(r.location||"")}" ${can?"":"disabled"}></label>
    <label>Dátum<input type="date" data-save="${r.id}" data-field="record_date" value="${esc(r.record_date||"")}" ${can?"":"disabled"}></label>
    <label>Státusz<select data-save="${r.id}" data-field="status" ${can?"":"disabled"}>
      ${["Új","Folyamatban","Lezárt"].map(s=>`<option ${r.status===s?"selected":""}>${s}</option>`).join("")}
    </select></label>
    <label>ReFoMix megjegyzés<textarea data-save="${r.id}" data-field="refomix_note" ${can?"":"disabled"}>${esc(r.refomix_note||"")}</textarea></label>
    <label>Közterület megjegyzés<textarea data-save="${r.id}" data-field="kozterulet_note" ${can?"":"disabled"}>${esc(r.kozterulet_note||"")}</textarea></label>
    <label>Rendőrség megjegyzés<textarea data-save="${r.id}" data-field="rendorseg_note" ${can?"":"disabled"}>${esc(r.rendorseg_note||"")}</textarea></label>
  </article>`;
}

async function saveField(e){
  const id=Number(e.target.dataset.save), field=e.target.dataset.field, value=e.target.value;
  // A Supabase RLS szabályok ellenőrzik, hogy az aktuális felhasználó módosíthatja-e a sort/mezőt.
  const {error}=await supabase.rpc("update_own_record_field",{p_record_id:id,p_field:field,p_value:value});
  if(error) alert("Mentési hiba: "+error.message);
  else await loadRecords();
}

async function deleteRecord(e){
  if(!confirm("Biztosan törli ezt a bejegyzést?")) return;
  const {error}=await supabase.from("records").delete().eq("id",Number(e.currentTarget.dataset.delete));
  if(error) alert(error.message); else await loadRecords();
}

document.getElementById("addBtn").onclick=async()=>{
  const {error}=await supabase.from("records").insert({created_by:profile.id,organization_id:profile.organization_id,location:"",record_date:new Date().toISOString().slice(0,10),status:"Új"});
  if(error) alert(error.message); else await loadRecords();
};

function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
