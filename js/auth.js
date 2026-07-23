async function handleAuth(type) {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Email and password required.'; return; }
  const fn = type === 'login'
    ? db.auth.signInWithPassword({ email, password })
    : db.auth.signUp({ email, password });
  const { data, error } = await fn;
  if (error) { errEl.textContent = error.message; return; }
  currentUser = data.user || data.session?.user;
  purgeLegacyLocalStorage(currentUser.id);
  await initApp();
}

async function signOut() { await db.auth.signOut(); location.reload(); }

// One-time cleanup: remove old localStorage keys that were migrated to Supabase.
// Safe to run on every login — keys simply won't exist after the first run.
function purgeLegacyLocalStorage(userId) {
  const legacyKeys = [
    'taishan_domains_'  + userId,
    'taishan_lastDone_' + userId,
    'taishan_lastGen_'  + userId,
    // Also clean up guest key if it exists
    'taishan_domains_guest',
  ];
  legacyKeys.forEach(k => localStorage.removeItem(k));
}
