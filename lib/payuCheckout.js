// PayU's flow is a full-page form POST redirect to a PayU-hosted
// payment page, not a JS popup SDK like Razorpay — this builds and
// submits that hidden form. The browser navigates away entirely;
// there's no in-page callback to wait for, since the user comes back
// via app/api/payu/success or /failure after leaving the site.
export function submitToPayu(checkoutUrl, fields) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkoutUrl;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value ?? "";
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

// Shared by SubscribeButton and DayPassButton: calls the given order
// API, and if the account has no phone on file yet (PayU requires
// one on every request — see migration_051), prompts for it once and
// retries with it included rather than failing outright.
export async function startPayuCheckout(orderUrl, body) {
  let res = await fetch(orderUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = await res.json();

  if (!res.ok && data.error === "phone_required") {
    const phone = window.prompt("Enter a 10-digit phone number to continue — PayU requires this for payment.");
    if (!phone) return { error: "Phone number is required to continue." };
    res = await fetch(orderUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, phone: phone.trim() }),
    });
    data = await res.json();
  }

  if (!res.ok || !data.checkoutUrl) {
    return { error: data.message || data.error || "Couldn't start checkout." };
  }

  submitToPayu(data.checkoutUrl, data.fields);
  return { success: true };
}
