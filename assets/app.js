function $(id){ return document.getElementById(id); }

async function loadJSON(path){
  const res = await fetch(path, { cache: "no-store" });
  if(!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

function uniq(arr){ return [...new Set(arr)].sort(); }

function setupMobileMenu(){
  const btn = $("menuBtn");
  const nav = $("mobileNav");
  if(!btn || !nav) return;
  btn.addEventListener("click", () => nav.classList.toggle("show"));
}

function setYear(){
  const y = $("year");
  if(y) y.textContent = new Date().getFullYear();
}

function pill(text){
  const el = document.createElement("span");
  el.className = "pill";
  el.innerHTML = `<strong>${text}</strong>`;
  return el;
}

function tagEl(t){
  const el = document.createElement("span");
  el.className = "tag";
  el.textContent = t;
  return el;
}

function badgeTier(t){
  const el = document.createElement("span");
  el.className = `badge ${t}`;
  el.textContent = `Tier ${t}`;
  return el;
}

// ---------- Home stats + method pills ----------
async function initHome(){
  const statP = $("statPapers");
  const statM = $("statMethods");
  const statT = $("statTaxa");
  const pills = $("methodPills");
  if(!statP && !pills) return;

  const [papers, methods, taxonomy] = await Promise.all([
    loadJSON("data/papers.json").catch(() => []),
    loadJSON("data/methods.json").catch(() => []),
    loadJSON("data/taxonomy.json").catch(() => [])
  ]);

  if(statP) statP.textContent = papers.length.toString();
  if(statM) statM.textContent = methods.length.toString();
  if(statT) statT.textContent = taxonomy.length.toString();

  if(pills){
    pills.innerHTML = "";
    methods.slice(0, 12).forEach(m => pills.appendChild(pill(m.name)));
  }
}

// ---------- Papers page ----------
function normalize(s){ return (s || "").toLowerCase().trim(); }

function paperMatches(p, q){
  if(!q) return true;
  const blob = [
    p.title, p.authors?.join(", "),
    p.venue, p.year,
    (p.tags || []).join(" "),
    p.method_family, p.problem_type
  ].join(" ");
  return normalize(blob).includes(normalize(q));
}

function renderPapers(rows){
  const body = $("papersBody");
  const count = $("countRow");
  if(!body) return;

  body.innerHTML = "";
  rows.forEach(p => {
    const tr = document.createElement("tr");

    const tdYear = document.createElement("td");
    tdYear.textContent = p.year ?? "";

    const tdTitle = document.createElement("td");
    const title = document.createElement("div");
    title.style.fontWeight = "800";
    title.textContent = p.title ?? "Untitled";
    tdTitle.appendChild(title);
    if(p.url){
      const a = document.createElement("a");
      a.className = "link";
      a.href = p.url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = "PDF / Page";
      tdTitle.appendChild(document.createElement("br"));
      tdTitle.appendChild(a);
    }
    if(p.note){
      const note = document.createElement("div");
      note.className = "muted small";
      note.textContent = p.note;
      tdTitle.appendChild(note);
    }

    const tdAuth = document.createElement("td");
    tdAuth.textContent = (p.authors || []).join(", ");

    const tdVenue = document.createElement("td");
    tdVenue.textContent = p.venue ?? "";

    const tdTags = document.createElement("td");
    (p.tags || []).slice(0, 8).forEach(t => tdTags.appendChild(tagEl(t)));

    const tdTier = document.createElement("td");
    tdTier.appendChild(badgeTier(p.tier || "C"));

    tr.appendChild(tdYear);
    tr.appendChild(tdTitle);
    tr.appendChild(tdAuth);
    tr.appendChild(tdVenue);
    tr.appendChild(tdTags);
    tr.appendChild(tdTier);

    body.appendChild(tr);
  });

  if(count) count.textContent = `${rows.length} result(s)`;
}

async function initPapers(){
  const table = $("papersTable");
  if(!table) return;

  const papers = await loadJSON("data/papers.json");
  const familySel = $("family");
  const ptypeSel = $("ptype");

  const families = uniq(papers.map(p => p.method_family).filter(Boolean));
  const ptypes = uniq(papers.map(p => p.problem_type).filter(Boolean));

  families.forEach(f => {
    const o = document.createElement("option");
    o.value = f; o.textContent = f;
    familySel.appendChild(o);
  });

  ptypes.forEach(t => {
    const o = document.createElement("option");
    o.value = t; o.textContent = t;
    ptypeSel.appendChild(o);
  });

  const q = $("q"), tier = $("tier"), fam = $("family"), pt = $("ptype");

  function apply(){
    const qq = q.value;
    const tt = tier.value;
    const ff = fam.value;
    const pp = pt.value;

    const rows = papers
      .filter(p => paperMatches(p, qq))
      .filter(p => !tt || (p.tier === tt))
      .filter(p => !ff || (p.method_family === ff))
      .filter(p => !pp || (p.problem_type === pp))
      .sort((a,b) => (b.year||0) - (a.year||0));

    renderPapers(rows);
  }

  [q, tier, fam, pt].forEach(el => el.addEventListener("input", apply));
  apply();
}

// ---------- Taxonomy page ----------
function renderTree(nodes){
  const host = $("taxList");
  if(!host) return;
  host.innerHTML = "";

  // build map by parent
  const byParent = new Map();
  nodes.forEach(n => {
    const key = n.parent || "__root__";
    if(!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
  });
  for(const [k,v] of byParent.entries()){
    v.sort((a,b) => (a.order||0) - (b.order||0));
  }

  function build(parentId){
    const kids = byParent.get(parentId) || [];
    const frag = document.createDocumentFragment();

    kids.forEach(n => {
      const details = document.createElement("details");
      details.open = parentId === "__root__"; // open top level

      const sum = document.createElement("summary");
      sum.textContent = `${n.name}  (${n.id})`;
      details.appendChild(sum);

      const meta = document.createElement("div");
      meta.className = "nodeMeta";
      meta.innerHTML = `
        <div><span class="badge">${n.kind || "node"}</span></div>
        ${n.desc ? `<div style="margin-top:8px">${n.desc}</div>` : ""}
      `;
      details.appendChild(meta);

      const childFrag = build(n.id);
      if(childFrag.childNodes.length){
        const wrap = document.createElement("div");
        wrap.style.marginTop = "10px";
        wrap.appendChild(childFrag);
        details.appendChild(wrap);
      }
      frag.appendChild(details);
    });

    return frag;
  }

  host.appendChild(build("__root__"));
}

async function initTaxonomy(){
  if(!$("taxList")) return;
  const nodes = await loadJSON("data/taxonomy.json");
  renderTree(nodes);
}

// ---------- boot ----------
(async function main(){
  setupMobileMenu();
  setYear();
  await Promise.allSettled([initHome(), initPapers(), initTaxonomy()]);
})();
