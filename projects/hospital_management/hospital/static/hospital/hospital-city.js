// Bank wiring for the hospital pages: HUD, paying for a visit, earning by treating a patient.
import City from '/city-core/city-core.js';

City.mountHud({ service: 'hospital', title: 'MediCore Hospital' });

const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
const baseHeaders = () => ({ ...City.identityHeaders(), 'X-Requested-With': 'fetch', 'X-CSRFToken': csrf });

/* ── book a visit: bank is charged first, refunded if the hospital rejects the booking ── */
const form = document.getElementById('book-form');
if (form) {
  const select = document.getElementById('doctor-select');
  const line = document.getElementById('fee-line');
  const submit = document.getElementById('book-submit');
  const showFee = () => {
    const opt = select.selectedOptions[0];
    if (opt && opt.dataset.fee) line.textContent = `Fee: ${City.money(opt.dataset.fee)} — charged to your city bank account when you confirm.`;
  };
  select.addEventListener('change', showFee);
  showFee();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const opt = select.selectedOptions[0];
    const fee = Number(opt?.dataset.fee || 0);
    submit.disabled = true;
    try {
      let paid = null;
      if (fee > 0) {
        paid = await City.spend('hospital', fee, `Consultation with ${opt.dataset.name}`);
        if (!paid.ok) {
          City.toast(paid.message || 'Payment failed.', 'bad');
          return;
        }
      }
      const res = await fetch(location.href, {
        method: 'POST',
        body: new FormData(form),
        headers: { ...baseHeaders(), ...(paid ? { 'X-City-Paid': '1' } : {}) },
      });
      if (!res.ok) {
        if (paid) await City.earn('hospital', fee, 'Refund: booking was not accepted');
        let msg = 'The hospital could not book that visit.';
        try {
          const data = await res.json();
          const first = Object.values(data.errors || {})[0];
          if (first && first[0]) msg = first[0].message;
        } catch { /* keep default */ }
        City.toast(msg + (paid ? ' You were refunded.' : ''), 'bad');
        return;
      }
      City.toast('Visit booked.', 'ok');
      location.href = form.dataset.next;
    } finally {
      submit.disabled = false;
    }
  });
}

/* ── treat a patient: the hospital marks the visit treated once, then the payout is credited ── */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.treat-btn');
  if (!btn) return;
  if (!City.snapshot().loggedIn) return City.openLogin();
  btn.disabled = true;
  try {
    const res = await fetch(`/hospital/appointments/${btn.dataset.id}/complete/`, { method: 'POST', headers: baseHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      City.toast(data.error || 'Could not treat this patient.', 'bad');
      btn.disabled = false;
      return;
    }
    const paid = await City.earn('hospital', data.payout, 'Treated a patient');
    City.toast(paid.ok ? `Patient treated — ${City.money(data.payout)} earned.` : 'Treated, but the payout failed: ' + paid.message, paid.ok ? 'ok' : 'warn');
    const row = btn.closest('tr');
    btn.remove();
    if (row) row.style.opacity = '0.5';
  } catch {
    City.toast('Network problem — try again.', 'bad');
    btn.disabled = false;
  }
});
