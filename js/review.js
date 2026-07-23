async function saveReview() {
  const r1=document.getElementById('r1').value, r2=document.getElementById('r2').value, r3=document.getElementById('r3').value, r4=document.getElementById('r4').value;
  if(!r1&&!r2){notify('\u26A0','Fill at least 2 questions','var(--accent2)');return;}
  setSyncStatus('syncing');
  const{data,error}=await db.from('reviews').insert({user_id:currentUser.id,date:today(),r1,r2,r3,r4}).select().single();
  if(error){setSyncStatus('error');return;}
  state.reviews.unshift(data); setSyncStatus('synced');
  ['r1','r2','r3','r4'].forEach(id=>document.getElementById(id).value='');
  notify('\u25CE Review Saved!','Week locked in. See you next Sunday.','var(--accent)');
  renderReviews();
}
function renderReviews() {
  const el=document.getElementById('pastReviews');
  if(!state.reviews.length){el.innerHTML='';return;}
  el.innerHTML='<div class="small-section-label">Past Reviews</div>'+state.reviews.slice(0,5).map(r=>`<div class="review-box" style="margin-bottom:12px"><div style="font-family:var(--mono);font-size:10px;color:var(--accent);margin-bottom:10px">${fmtDate(r.date)}</div>${r.r1?`<div style="font-size:12px;margin-bottom:6px"><b>Priority:</b> ${r.r1}</div>`:''}${r.r2?`<div style="font-size:12px;margin-bottom:6px"><b>Friction:</b> ${r.r2}</div>`:''}${r.r3?`<div style="font-size:12px;margin-bottom:6px"><b>Change:</b> ${r.r3}</div>`:''}${r.r4?`<div style="font-size:12px"><b>Streak:</b> ${r.r4}</div>`:''}</div>`).join('');
}